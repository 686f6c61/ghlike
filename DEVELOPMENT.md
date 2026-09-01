# ghlike — Developer guide

Architecture, protocols, local setup, testing and the release runbook for
this repo (widget + extension + Node CLI/daemon). The Python twin lives in
[686f6c61/ghlike-py](https://github.com/686f6c61/ghlike-py).

## Architecture

```
                    ┌────────────────────────────────────────────┐
   ANY WEBSITE      │                VISITOR'S MACHINE            │
┌───────────────┐   │  ┌─────────────┐        ┌───────────────┐   │
│ <gh-like      │   │  │  EXTENSION  │        │  ghlike       │   │
│  repo="a/b">  │◄──┼──┤  (MV3)      │        │  daemon       │   │
│               │   │  │             │        │ (127.0.0.1)   │   │
└───────────────┘   │  │ bridge ─────┼──► bg ─┼──► core.mjs    │   │
       │  fallback  │  │ (all sites) │  tab   │  (node/src/)  │   │
       ▼  (no ext)  │  │ github-star │◄─close─┴──────┬────────┘   │
   open repo        │  └─────────────┘               │            │
                    │         copy encrypted cookies → headless    │
                    │         browser (CDP) → click the REAL star  │
                    │         button → clean up                    │
                    └────────────────────────────────────────────┘
```

Three delivery vehicles, one engine. The core trick, identical everywhere:
**we never decrypt anything.** The encrypted cookie store is copied to a
throwaway profile and opened by the user's own browser, which clicks the
star button exactly like a human would (GitHub's own React handles the
CSRF). No tokens exist anywhere.

## File map

```
widget/src/gh-like.js          web component: variants, CSS vars, count cache,
                               extension/daemon/fallback click chain
extension/manifest.json        MV3 manifest (host: github.com)
extension/widget-bridge.js     content script (all sites): marks widgets,
                               intercepts clicks, talks to background
extension/github-star.js       content script (github.com): #ghlike-* actions,
                               click + verify + report
extension/background.js        service worker: tab lifecycle, request queue
node/src/browsers.mjs          browser/profile discovery, session copy
node/src/cdp.mjs               freePort/waitForCdp/openTab/Tab (native WebSocket)
node/src/core.mjs              orchestration: STATE_JS/CLICK_JS selectors,
                               session loop, kill-tree + cleanup
node/src/cli.mjs               zero-dep arg parser + `daemon` subcommand
node/src/daemon.mjs            localhost HTTP server wrapping core.run()
node/src/index.mjs             library exports (star/unstar/check/toggle)
demo/index.html                variants showcase + playground + live target
```

## Protocols

### Widget ↔ Extension (DOM attributes only)

The page-world script never touches extension APIs. Contract:

| attribute on `<gh-like>` | set by | meaning |
|--------------------------|--------|---------|
| `data-ghlike-ext="1"` | bridge | extension present; bridge owns clicks |
| `data-busy="1"` / removed | bridge (ext) or widget (daemon) | action in flight |
| `data-starred="0|1"` | both | current like state after action |
| `data-error="…"` | both | `no-session` \| `not-found` \| `timeout` \| … |

Click routing (widget internal): extension present → bridge already handled
it in capture phase → do nothing. Else daemon alive → POST /toggle. Else →
open repo in new tab (fallback).

### Extension internal (chrome.runtime messages)

`{type:"ghlike:toggle"|"star"|"unstar"|"check", repo}` from bridge →
background opens `https://github.com/{repo}#ghlike-{verb}` in a background
tab → `github-star.js` performs and answers
`{type:"ghlike:result", repo, ok, starred?, error?}` → background closes the
tab and resolves the widget request. Timeout 45 s; concurrent requests for
the same repo share one tab.

### Daemon HTTP API (127.0.0.1:8469, CORS `*`)

| route | body | returns |
|-------|------|---------|
| `GET /ping` | – | `{ok, service:"ghlike-daemon", version}` |
| `POST /check` | `{"repo":"o/r"}` | `{ok, repo, starred, user}` |
| `POST /star` / `POST /unstar` / `POST /toggle` | `{"repo":"o/r"}` | `{ok, repo, starred, changed, user}` |

Errors: `400 bad-repo`, `404 not-found`, `409 no-session`, `500 ghlike-error`.
Actions are queued one at a time (one browser at a time). **Trust note:**
while the daemon runs, any page open in your browsers can request stars
through it — dev tool only, stop it when done.

### The star action itself (all paths)

1. Find profile with github.com session cookies (never decrypted).
2. Copy `Cookies`(+wal/shm), `Preferences`, `Local State` to a temp dir
   (visible in `$HOME` — snap browsers can't write hidden paths).
3. Launch the visitor's browser headless with a private CDP port, in its own
   process group.
4. Navigate, wait for `document.readyState`, wait for the star button
   (`button[aria-label^="Star"], …`), click, poll until the state flips.
5. Kill the process **group** (the snap wrapper orphans the real binary
   otherwise), delete the temp dir with retries.

## Local development

```bash
python3 -m http.server 8123 --directory . &   # demo page
node node/src/daemon.mjs                       # daemon
cd node && node src/cli.mjs --list             # CLI from source
brave --load-extension=$PWD/extension http://127.0.0.1:8123/demo/
```

No build step, no dependencies, no transpilation. Edit and reload.

## Testing

Manual checklist (needs a github.com session in a Chromium browser):

```
node src/cli.mjs --list                    → session listed
ghlike owner/repo -c                       → correct state
ghlike owner/repo && ghlike … -u           → star + unstar round trip
ghlike este-no/existe -c                   → exit 3
ghlike --browser firefox …                 → exit 2, "not supported"
demo page: click with daemon               → "Liked", no new tab
demo page: click with extension            → "Liked", background tab opens+closes
demo: error card                           → "Repo not found"
demo: retarget input                       → count + aria change
```

Scripted E2E (the pattern used during development): launch the browser
headless with `--remote-debugging-port` + copied session (+`--load-extension`
to test the extension), drive it over CDP, assert DOM state. Beware the
**anonymous GitHub API quota** (60 req/h per IP): the widget caches counts in
`localStorage` (1 h) and dedupes in-flight requests per page.

## Versioning & release runbook

Versions to bump together in this repo (all currently `0.1.2`):

1. `node/package.json` → `version`
2. `node/src/cli.mjs` → `VERSION`
3. `widget/package.json` → `version`
4. `extension/manifest.json` → `version`
5. `node/src/daemon.mjs` → version in the `/ping` response

The Python package versions live in the
[ghlike-py repo](https://github.com/686f6c61/ghlike-py).

Publishing is automated: **push a git tag / create a GitHub Release named
`vX.Y.Z`** and [`.github/workflows/publish-npm.yml`](.github/workflows/publish-npm.yml)
publishes both npm packages (`ghlike-widget` and `ghlike`). It requires the
`NPM_TOKEN` secret (npm automation token) in repo settings. The release tag
must match the packages' `version`.

```bash
# manual check before releasing
cd widget && npm pack --dry-run && cd ../node && npm pack --dry-run
```

## Security model

- Zero dependencies across all packages (supply-chain surface = 0).
- Cookies never decrypted, never leave the machine; only the user's own
  browser ever uses them, for exactly one click.
- Extension: host permission only for `github.com`; content scripts on
  http/https; no tabs permission, no storage, no remote code.
- Daemon: localhost-only, but open to any page while running (documented
  above). Roadmap: optional token.
- Widget: localStorage only caches public star counts (`ghlike:count:*`).

## Roadmap

- Firefox: no CDP; viable path = read plaintext `cookies.sqlite` and inject
  into a headless Chromium via CDP `Network.setCookie`.
- CI (GitHub Actions): syntax checks + the E2E pattern with a test session.
- Store listings for the extension; optional daemon auth token.
