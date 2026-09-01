# ghlike-widget — the GitHub like button

**`<gh-like repo="owner/repo">`: the Twitter/Facebook-style like button for
GitHub repos, for any website.**

📦 npm: **[www.npmjs.com/package/ghlike-widget](https://www.npmjs.com/package/ghlike-widget)**

[English](#english) · [Español](#español)

Part of the [ghlike project](https://github.com/686f6c61/ghlike): this
widget + the [browser extension](https://github.com/686f6c61/ghlike/tree/main/extension)
(visitors star with one click, their session, no tokens) + the
[CLI/daemon](https://www.npmjs.com/package/ghlike). Live
[demo page](https://github.com/686f6c61/ghlike/tree/main/demo).

---

# English

## Quick start

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

## How the click behaves

| Visitor has… | What happens on click |
|--------------|----------------------|
| the **ghlike extension** | Stars the repo **in place** — one click, never leaves your page; the button switches to "Liked" |
| the **daemon** running (`ghlike daemon`) | Same one-click behavior, in any browser of that machine (dev/testing tool) |
| **nothing installed** | Opens the repo in a new tab (classic fallback — the widget is never broken) and shows a small hint |

The star count is always visible (GitHub public API; cached 1 h in
`localStorage` and deduplicated per page, so a page full of buttons won't
burn the anonymous API quota).

## Attributes

| attribute | effect |
|-----------|--------|
| `repo` | required — `owner/repo` or a full `github.com` URL. **Reactive**: change it any time with `setAttribute` and the button re-targets, clears its state and re-fetches the count |
| `variant` | one of the 5 predefined styles (below); default `classic` |
| `daemon-url` | override the daemon URL (default `http://127.0.0.1:8469`) |
| `class`, `style` | normal CSS hooks for the custom properties below |

Invalid `repo` values render a visible "Invalid repo format" error instead
of failing silently.

## Variants

| variant | look |
|---------|------|
| `classic` *(default)* | GitHub-style gray button |
| `pill` | fully-rounded dark button, amber star when liked |
| `outline` | transparent with accent border and text |
| `glass` | translucent + blur, for hero/gradient/photo backgrounds |
| `block` | wide solid call-to-action button |

## CSS customization

Everything is overridable with custom properties — set them on the element,
a class, or any parent (they cascade into the shadow DOM):

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
| `--ghlike-min-width` | minimum width (`block` variant) | `220px` |

Full control via shadow parts:

```css
gh-like::part(button) { letter-spacing: .3px; }
gh-like::part(count)  { font-weight: 700; }
gh-like::part(label)  { text-transform: uppercase; }
```

Dark mode is automatic (`prefers-color-scheme`). Cascade order: **your CSS >
variant palette > dark-mode defaults** — your overrides always win.

## Security & privacy

- Zero dependencies, one file (`src/gh-like.js`), shadow DOM — your page's
  CSS and JS are isolated from the widget's.
- The widget talks to the extension through **DOM attributes only**
  (`data-ghlike-ext`, `data-starred`, `data-busy`, `data-error`) — it never
  touches extension APIs.
- The only network calls are GitHub's public API (star counts) and, if
  present, your local daemon at `127.0.0.1`.
- `localStorage` is used solely to cache public star counts (`ghlike:count:*`).

License: MIT.

---

# Español

## Inicio rápido

```html
<script type="module" src="https://cdn.jsdelivr.net/npm/ghlike-widget"></script>

<gh-like repo="vercel/next.js"></gh-like>
<gh-like repo="vercel/next.js" variant="pill"></gh-like>
```

O desde npm:

```bash
npm install ghlike-widget
```

```js
import "ghlike-widget";   // define <gh-like>
```

## Cómo se comporta el clic

| El visitante tiene… | Qué pasa al pulsar |
|---------------------|--------------------|
| la **extensión ghlike** | Da el star **en sitio** — un clic, sin salir de tu página; el botón pasa a "Liked" |
| el **daemon** corriendo (`ghlike daemon`) | Mismo comportamiento de un clic, en cualquier navegador de esa máquina (herramienta de dev/pruebas) |
| **nada instalado** | Abre el repo en una pestaña nueva (fallback clásico — el widget nunca queda roto) y muestra una pista discreta |

El contador de stars siempre está visible (API pública de GitHub; cacheado
1 h en `localStorage` y deduplicado por página, así una página llena de
botones no quema la cuota anónima de la API).

## Atributos

| atributo | efecto |
|----------|--------|
| `repo` | obligatorio — `owner/repo` o la URL completa de `github.com`. **Reactiva**: cámbiala cuando quieras con `setAttribute` y el botón se re-apunta, limpia su estado y vuelve a pedir el contador |
| `variant` | uno de los 5 estilos predefinidos (abajo); por defecto `classic` |
| `daemon-url` | sobreescribe la URL del daemon (por defecto `http://127.0.0.1:8469`) |
| `class`, `style` | ganchos CSS normales para las propiedades de abajo |

Un `repo` inválido muestra el error visible "Invalid repo format" en vez de
fallar en silencio.

## Variantes

| variante | aspecto |
|----------|---------|
| `classic` *(por defecto)* | botón gris estilo GitHub |
| `pill` | píldora oscura redondeada, estrella ámbar al dar like |
| `outline` | transparente con borde y texto de acento |
| `glass` | translúcido con blur, para héroes/degradados/fotos |
| `block` | botón grande sólido tipo llamada a la acción |

## Personalización CSS

Todo se puede sobreescribir con propiedades CSS — en el elemento, una clase
o cualquier padre (cascadan al shadow DOM):

| var | qué controla | por defecto |
|-----|--------------|-------------|
| `--ghlike-bg` | fondo del botón | `#f6f8fa` |
| `--ghlike-bg-hover` | fondo al pasar el ratón | `#eef1f4` |
| `--ghlike-fg` | color del texto | `#24292f` |
| `--ghlike-border` | color del borde | `#d0d7de` |
| `--ghlike-radius` | redondeo de esquinas | `6px` |
| `--ghlike-padding` | padding del botón | `5px 14px` |
| `--ghlike-font-size` | tamaño del texto | `14px` |
| `--ghlike-gap` | separación icono/texto/contador | `7px` |
| `--ghlike-icon` | tamaño del icono estrella | `15px` |
| `--ghlike-star` | color de la estrella (sin like) | `#9a6700` |
| `--ghlike-star-on` | color de la estrella (con like) | `#eac54f` |
| `--ghlike-on-bg` | fondo con like | `#fff8c5` |
| `--ghlike-on-border` | borde con like | `#d4a72c` |
| `--ghlike-on-fg` | color de texto con like | heredado |
| `--ghlike-min-width` | ancho mínimo (variante `block`) | `220px` |

Control total con shadow parts:

```css
gh-like::part(button) { letter-spacing: .3px; }
gh-like::part(count)  { font-weight: 700; }
gh-like::part(label)  { text-transform: uppercase; }
```

Modo oscuro automático (`prefers-color-scheme`). Orden de cascada: **tu CSS >
paleta de variante > modo oscuro** — tus sobreescrituras siempre ganan.

## Seguridad y privacidad

- Cero dependencias, un fichero (`src/gh-like.js`), shadow DOM — el CSS y JS
  de tu página quedan aislados de los del widget.
- El widget habla con la extensión **solo por atributos DOM**
  (`data-ghlike-ext`, `data-starred`, `data-busy`, `data-error`) — nunca
  toca APIs de extensión.
- Las únicas llamadas de red son la API pública de GitHub (contadores) y, si
  existe, tu daemon local en `127.0.0.1`.
- `localStorage` solo cachea contadores públicos (`ghlike:count:*`).

Licencia: MIT.
