# ghlike extension

Companion extension **for the ghlike landing only**
([ghlike.686f6c61.dev](https://ghlike.686f6c61.dev)): visitors who install it
can star the repo **with one click on the landing**, using their existing
github.com login. No tokens.

```
landing click → bridge (ghlike.686f6c61.dev) → background → background tab
of the repo → github.com script clicks the real Star button → tab closes
→ ghlike:update event on the landing button
```

## Permissions

Minimal by design — the original "access to all websites" is gone:

- Content scripts on **exactly two origins**:
  `https://ghlike.686f6c61.dev/*` (the bridge) and `https://github.com/*`
  (the star action).
- **No** `tabs` permission, **no** storage, **no** remote code.
- Clicks must be real: the bridge ignores any event with `isTrusted === false`.

## Install (development)

Chromium browsers (Brave, Chrome, Edge…):

1. Open `brave://extensions` (or `chrome://extensions`).
2. Enable **Developer mode**.
3. **Load unpacked** → select this `extension/` folder.

Or launch a dedicated instance:

```bash
brave --load-extension=/path/to/extension https://ghlike.686f6c61.dev/
```

## Files

| file | role |
|------|------|
| `manifest.json` | MV3; content scripts on 2 explicit origins only (`ghlike.686f6c61.dev` + `github.com`) |
| `widget-bridge.js` | landing content script: marks `[data-ghlike-repo]` elements with `data-ghlike-ext="1"`, intercepts **trusted** clicks in capture phase, calls the background, writes results back via `data-starred`/`data-error` and a `ghlike:update` CustomEvent |
| `background.js` | service worker: re-validates the repo, opens/closes the action tab, queues concurrent requests (same repo shares a tab, race-safe), 45 s timeout, only accepts results from the tab it opened |
| `github-star.js` | github.com content script: when the URL has `#ghlike-star|unstar|toggle|check`, waits for the star button, acts, verifies, reports `{type:"ghlike:result"}` |

## Protocol

- Page ↔ bridge: **DOM attributes + one event**. The landing marks buttons
  with `data-ghlike-repo="owner/repo"`; the bridge sets `data-ghlike-ext="1"`,
  `data-busy`, `data-starred="0|1"`, `data-error`, and dispatches
  `new CustomEvent("ghlike:update", {detail: {ok, starred, error}, bubbles: true})`
  on the element after each action. The page script never touches extension
  APIs.
- Bridge ↔ background: `chrome.runtime.sendMessage`
  `{type:"ghlike:toggle", repo}` → response `{ok, starred}` or
  `{ok:false, error:"no-session"|"not-found"|"timeout"|"markup-changed"}`.
- Background ↔ github script: `{type:"ghlike:result", repo, ok, starred?, error?}`.

## Maintenance notes

- If GitHub changes its star button, update `findBtn()` in
  `github-star.js` (and the CLI selectors `STATE_JS`/`CLICK_JS` in
  `node/src/core.mjs` and the Python twin in [ghlike-py](https://github.com/686f6c61/ghlike-py)).
- Icons are generated (pure-Python rasterizer, no deps); regenerate by
  drawing a 5-point star into RGBA PNGs at 16/32/48/128.

License: MIT — see [LICENSE](../LICENSE).
