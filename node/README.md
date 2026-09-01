# ghlike (Node CLI + library + daemon)

Star GitHub repos from the terminal using the login session already in your
browser — no tokens, no `gh auth login`. Works with Brave, Chrome, Chromium,
Edge, Vivaldi and Opera (native or snap installs). Zero dependencies,
Node ≥ 22 (uses the native WebSocket).

Part of the [ghlike project](https://github.com/686f6c61/ghlike) — see the
project README for the full picture (widget + extension + CLI). The Python
twin of this package lives in [686f6c61/ghlike-py](https://github.com/686f6c61/ghlike-py) with identical behavior.

## Install

```bash
npm install -g ghlike
```

## CLI

```bash
ghlike owner/repo            # star (idempotent — tells you if already starred)
ghlike https://github.com/o/r  # full URLs work
ghlike owner/repo -c         # check current state only
ghlike owner/repo -u         # unstar
ghlike owner/repo --toggle   # flip
ghlike --list                # github.com sessions found in your browsers
ghlike --browser brave o/r   # force one browser
ghlike o/r --json            # machine-readable output
ghlike daemon                # local server (127.0.0.1:8469) for <gh-like> widgets
```

Exit codes: `0` ok (incl. nothing-to-do) · `1` generic error · `2` no
github.com session · `3` repo not found.

## Library (ESM)

```js
import { star, unstar, check, toggle, GhlikeError } from "ghlike";

const r = await star("vercel/next.js");            // { repo, user, before, after, changed, … }
const s = await check("vercel/next.js");           // { starred: true|false, … }
await unstar("vercel/next.js", { browser: "brave" }); // force a browser
```

Errors: `NoSessionError`, `RepoNotFoundError`, `GhlikeError`.

## Daemon

`ghlike daemon` serves `127.0.0.1:8469` so `<gh-like>` buttons work with one
click in any browser on the machine — including embedded browsers that can't
load extensions:

| route | body | returns |
|-------|------|---------|
| `GET /ping` | – | `{ok, service, version}` |
| `POST /check\|/star\|/unstar\|/toggle` | `{"repo":"o/r"}` | `{ok, repo, starred, changed, user}` |

While it runs, any page open in your browsers can request stars through it.
Use it for development/testing and stop it when done.

## How it works

Finds a browser profile with github.com session cookies → copies the
**encrypted** cookie store to a throwaway profile → opens your own browser
headless with a private debug port → clicks the real Star button (GitHub
handles its own CSRF) → verifies → kills the browser and deletes the
profile. Cookies are never decrypted and never leave your machine.

License: MIT.
