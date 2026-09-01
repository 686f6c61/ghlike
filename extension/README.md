# ghlike extension

Companion extension for the [`<gh-like>` widget](widget/): visitors who
install it can star GitHub repos **with one click, from any website**, using
their existing github.com login. No tokens.

```
widget click → bridge (this site) → background → background tab of the repo
→ github.com script clicks the real Star button → tab closes → "Liked"
```

## Install (development)

Chromium browsers (Brave, Chrome, Edge…):

1. Open `brave://extensions` (or `chrome://extensions`).
2. Enable **Developer mode**.
3. **Load unpacked** → select this `extension/` folder.

Or launch a dedicated instance:

```bash
brave --load-extension=/path/to/extension http://127.0.0.1:8123/demo/
```

## Files

| file | role |
|------|------|
| `manifest.json` | MV3; host permission only for `https://github.com/*`; content scripts on http/https sites + github.com |
| `widget-bridge.js` | all-sites content script: marks `<gh-like>` elements with `data-ghlike-ext="1"`, intercepts clicks in capture phase, calls the background, writes results back via `data-starred`/`data-error` |
| `background.js` | service worker: opens/closes the action tab, queues concurrent requests (same repo shares a tab), 45 s timeout |
| `github-star.js` | github.com content script: when the URL has `#ghlike-star|unstar|toggle|check`, waits for the star button, acts, verifies, reports `{type:"ghlike:result"}` |

## Protocol

- Page ↔ bridge: **DOM attributes only** (`data-ghlike-ext`, `data-starred`,
  `data-busy`, `data-error`). The page script never touches extension APIs.
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
- No tabs permission, no storage, no remote code — keep it that way for
  store review.

License: MIT — see [LICENSE](../LICENSE).
