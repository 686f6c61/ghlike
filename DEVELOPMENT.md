# ghlike — Developer guide

Architecture, protocols, local setup, testing and the release runbook for
this repo (the Node CLI + library). The Python twin lives in
[686f6c61/ghlike-py](https://github.com/686f6c61/ghlike-py).

## Architecture

```
  USER'S TERMINAL
┌───────────────┐
│ ghlike CLI    │   node/src/cli.mjs (zero-dep arg parser)
│  └─ core.mjs  │──► findSessions() → copy encrypted cookies to temp profile
│       │       │──► spawn user's browser headless
│       │       │      --remote-debugging-pipe (NO TCP port)
│       ▼       │──► CDP over fds 3/4 (NUL-delimited JSON) ──► browser
│  click Star   │      Target.createTarget → attach (flatten) →
│  + verify     │      Runtime.evaluate (STATE_JS / CLICK_JS)
│       │       │──► kill process tree, delete temp profile
└───────┴───────┘
```

The core trick: **we never decrypt anything.** The encrypted cookie store is
copied to a throwaway profile and opened by the user's own browser, which
clicks the star button exactly like a human would (GitHub's own React handles
the CSRF). No tokens exist anywhere. And because CDP travels over a private
pair of pipes instead of a TCP debug port, no other local process can attach
to the debugging channel.

## File map

```
node/src/browsers.mjs          browser/profile discovery, session copy
node/src/cdp.mjs               CdpPipe (CDP over --remote-debugging-pipe),
                               waitReady, openPage (Target.attach flatten)
node/src/core.mjs              orchestration: STATE_JS/CLICK_JS selectors,
                               session loop, kill-tree + cleanup
node/src/cli.mjs               zero-dep arg parser, exit codes, --list
node/src/index.mjs             library exports (star/unstar/check/toggle)
extension/                     landing-only MV3 extension (2 origins:
                               ghlike.686f6c61.dev bridge + github.com star)
```

## Protocols

### How a star is given

1. Find a profile with github.com session cookies (never decrypted).
2. Copy `Cookies`(+wal/shm), `Preferences`, `Local State` to a temp dir
   (visible in `$HOME` — snap browsers can't write hidden paths).
3. Launch the user's browser headless with `--remote-debugging-pipe` and
   `stdio: ['ignore','ignore','ignore','pipe','pipe']`, in its own process
   group. Chrome reads CDP commands from fd 3 and writes responses/events to
   fd 4 — NUL-delimited UTF-8 JSON, no WebSocket, no HTTP, no TCP port.
4. Readiness: retry `Browser.getVersion` until it answers (~10 s deadline).
5. `Target.createTarget {url}` → `Target.attachToTarget {flatten:true}` →
   page commands carry the top-level `sessionId` over the same pipe.
6. Wait for `document.readyState`, wait for the star button
   (`button[aria-label^="Star"], …`), click, poll until the state flips.
7. Kill the process **group** (POSIX: `process.kill(-pid)`; Windows:
   `taskkill /pid <pid> /T /F`), close the pipes, delete the temp dir with
   retries (if it survives, warn on stderr with the path).

## Local development

```bash
cd node && node src/cli.mjs --list             # CLI from source
cd node && node src/cli.mjs owner/repo -c      # check a repo
```

No build step, no dependencies, no transpilation. Edit and rerun.

## Testing

Manual checklist (needs a github.com session in a Chromium browser):

```
node src/cli.mjs --list                    → session listed
ghlike owner/repo -c                       → correct state
ghlike owner/repo && ghlike … -u           → star + unstar round trip
ghlike este-no/existe -c                   → exit 3
ghlike --browser firefox …                 → exit 2, "not supported"
load extension/ unpacked, open the landing → click the like button: star
                                             toggles, ghlike:update fires
```

Smoke test for the CDP pipe (no GitHub session needed): launch Chrome
headless with `--remote-debugging-pipe` and an empty `--user-data-dir`, then
`Browser.getVersion`, `Target.createTarget` to `https://example.com`,
`Runtime.evaluate` of `1+1` and `document.title`, and clean up (kill process,
delete tempdir).

## Versioning & release runbook

Versions to bump together in this repo (currently `0.2.0`):

1. `node/package.json` → `version`
2. `node/src/cli.mjs` → `VERSION`
3. `extension/manifest.json` → `version`

The Python package versions live in the
[ghlike-py repo](https://github.com/686f6c61/ghlike-py).

Publishing is automated: **push a git tag / create a GitHub Release named
`vX.Y.Z`** and [`.github/workflows/publish-npm.yml`](.github/workflows/publish-npm.yml)
publishes the `ghlike` npm package. It requires the
`NPM_TOKEN` secret (npm automation token) in repo settings. The release tag
must match the package's `version`.

```bash
# manual check before releasing
cd node && npm pack --dry-run
```

## Security model

- Zero dependencies (supply-chain surface = 0).
- Cookies never decrypted, never leave the machine; only the user's own
  browser ever uses them, for exactly one click.
- The CDP channel uses `--remote-debugging-pipe`: two file descriptors
  between ghlike and the browser process. **No debug port is opened**, so no
  other local process can attach to the debugging session.

## Roadmap

- Firefox: no CDP; viable path = read plaintext `cookies.sqlite` and inject
  into a headless Chromium via CDP `Network.setCookie`.
- CI (GitHub Actions): syntax checks + the pipe smoke test with a test
  session.
