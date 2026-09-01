# ghlike-widget

GitHub "like" button for any website — `<gh-like repo="owner/repo">`.

- **Without** the [ghlike extension](../extension/) or the local daemon
  (`ghlike daemon`): the button shows the star count and opens the repo in a
  new tab (classic fallback — never broken).
- **With** the extension installed by the visitor: **one click stars the repo**
  using the visitor's existing github.com login. They never leave your page.
- **With** the local daemon running: same one-click behavior for the machine
  running `ghlike daemon` (dev/testing tool).

## Usage

```html
<script type="module" src="https://cdn.jsdelivr.net/npm/ghlike-widget"></script>

<gh-like repo="vercel/next.js"></gh-like>
<gh-like repo="vercel/next.js" variant="pill"></gh-like>
```

Or from npm:

```bash
npm install ghlike-widget
```

```js
import "ghlike-widget";   // defines <gh-like>
```

## Pointing it at a repo

The `repo` attribute decides the target — one widget, one repo:

```html
<gh-like repo="vercel/next.js"></gh-like>
<gh-like repo="https://github.com/vercel/next.js"></gh-like>  <!-- full URLs OK -->
```

It's reactive: change it at any time with JS and the button re-targets,
clears its previous like-state and re-fetches the star count.

```js
document.querySelector("gh-like").setAttribute("repo", "denoland/deno");
```

Invalid formats render a visible error ("Invalid repo format"). Star counts
are cached in `localStorage` for 1 hour and deduplicated per page, so a page
full of buttons won't burn GitHub's anonymous API quota (60 req/h per IP).

## Variants — `variant="…"`

| variant | look |
|---------|------|
| `classic` *(default)* | GitHub-style gray button |
| `pill` | fully-rounded dark button, amber star when liked |
| `outline` | transparent with accent border and text |
| `glass` | translucent + blur, for hero/gradient/photo backgrounds |
| `block` | wide solid call-to-action button |

## CSS customization

Everything is overridable with CSS custom properties — set them on the
element, a class, or any parent (they cascade into the shadow DOM):

| var | what | default |
|-----|------|---------|
| `--ghlike-bg` | button background | `#f6f8fa` |
| `--ghlike-bg-hover` | hover background | `#eef1f4` |
| `--ghlike-fg` | text color | `#24292f` |
| `--ghlike-border` | border color | `#d0d7de` |
| `--ghlike-radius` | corner radius | `6px` |
| `--ghlike-padding` | button padding | `5px 14px` |
| `--ghlike-font-size` | text size | `14px` |
| `--ghlike-gap` | gap between icon/text/count | `7px` |
| `--ghlike-icon` | star icon size | `15px` |
| `--ghlike-star` | star color (not liked) | `#9a6700` |
| `--ghlike-star-on` | star color (liked) | `#eac54f` |
| `--ghlike-on-bg` | liked background | `#fff8c5` |
| `--ghlike-on-border` | liked border | `#d4a72c` |
| `--ghlike-on-fg` | liked text color | inherit |

Full control via shadow parts:

```css
gh-like::part(button) { letter-spacing: .3px; }
gh-like::part(count)  { font-weight: 700; }
gh-like::part(label)  { text-transform: uppercase; }
```

Dark mode is automatic (`prefers-color-scheme`).

The star count comes from GitHub's public API (CORS-enabled, no key needed).

License: MIT.
