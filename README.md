# ghlike

**GitHub likes, everywhere — no tokens.**

**Likes de GitHub en todas partes — sin tokens.**

The Twitter/Facebook-style like button for GitHub repos: a visitor who is
already logged into GitHub stars your repo **without leaving your website**.

El botón de "me gusta" estilo Twitter/Facebook para repos de GitHub: quien
visita tu web y ya está logueado en GitHub le da star a tu repo **sin salir
de tu página**.

[English guide](#english-guide) · [Guía en español](#guía-en-español)

---

# English guide

## The pieces in this repo

| Piece | Package | For whom | What it does |
|-------|---------|----------|--------------|
| **Widget** | [`ghlike-widget`](widget/) (npm) | Website owners | The `<gh-like repo="owner/repo">` embeddable button |
| **Extension** | [browser extension](extension/) | Visitors | One-click stars using their github.com session |
| **CLI + daemon** | [`ghlike`](node/) (npm) | Developers | Star repos from the terminal; `ghlike daemon` powers widgets locally |

The Python twin of the CLI lives in a separate repo:
[686f6c61/ghlike-py](https://github.com/686f6c61/ghlike-py) (`pipx install
ghlike`).

The same principle powers everything: **your browser already has your GitHub
login, so no tokens or OAuth flows are ever needed**. The click on the real
Star button is performed with your session — GitHub handles its own CSRF.

## 1. Widget — for your website

```html
<script type="module" src="https://cdn.jsdelivr.net/npm/ghlike-widget"></script>

<gh-like repo="vercel/next.js"></gh-like>
<gh-like repo="vercel/next.js" variant="pill"></gh-like>
```

- Live star count (GitHub public API, CORS, no key; cached 1 h in
  `localStorage`).
- **Visitor has the extension** → one click stars the repo in place; the
  button switches to "Liked".
- **Local daemon running** (`ghlike daemon`) → same one-click behavior on
  that machine, in any browser.
- **Nothing installed** → the click opens the repo in a new tab (classic
  fallback, the widget is never broken).
- **5 predefined variants**: `classic` (default), `pill`, `outline`, `glass`,
  `block`.
- **Full CSS customization** via `--ghlike-*` custom properties and shadow
  parts (`::part(button)`, `::part(label)`, `::part(count)`). Dark mode
  automatic.
- The `repo` attribute is reactive and accepts full GitHub URLs.
- Zero dependencies, one file.

## 2. Extension — for visitors

Install once; after that every `<gh-like>` button on the web works with one
click. Source in [`extension/`](extension/) — installable as an unpacked
developer extension today (store submission next).

Flow on click: the content script on the visited site intercepts the click →
the background opens **one background tab** of the repo → the github.com
content script clicks the real Star button (GitHub's own CSRF) → tab closes →
widget shows "Liked". Manifest V3, host permission only for
`https://github.com/*`, no tabs permission, no storage, no remote code.

## 3. CLI + daemon — for developers

```bash
npm install -g ghlike    # Node ≥ 22, zero dependencies
```

```bash
ghlike vercel/next.js                  # star (idempotent)
ghlike https://github.com/vercel/next.js   # full URLs work
ghlike vercel/next.js -c               # check state
ghlike vercel/next.js -u               # unstar
ghlike vercel/next.js --toggle         # flip
ghlike --list                          # GitHub sessions found in your browsers
ghlike --browser brave vercel/next.js  # force one browser
ghlike vercel/next.js --json           # machine-readable
ghlike daemon                          # local server (127.0.0.1:8469) for <gh-like> widgets
```

Also usable as a library:

```js
import { star, unstar, check, toggle } from "ghlike";
await star("vercel/next.js", { browser: "brave" });
```

The daemon lets `<gh-like>` buttons work with one click in any browser on
your machine — including embedded browsers that can't load extensions. While
it runs, any page open in your browsers can request stars through it: use it
for development/testing and stop it when done.

## Security & privacy

- **Zero dependencies everywhere.** Audit the whole project in one sitting.
- Cookies are **never decrypted** and never leave the machine. The only
  thing that ever uses your session is one click on the real Star button,
  performed by your own browser.
- The extension requests host access to `github.com` only.
- The widget caches public star counts only.

## Limitations

- Chromium-family browsers only. **Firefox is not supported** — no CDP.
- CLI/daemon operations take ~8–12 s (headless browser + page load); the
  extension path is faster (~2–4 s).
- Depends on GitHub's Star button markup; one selector line fixes it.

## Development

See [DEVELOPMENT.md](DEVELOPMENT.md) — architecture, protocols, testing and
the release runbook. Quick start:

```bash
python3 -m http.server 8123 &                     # demo page
node node/src/daemon.mjs                          # daemon
brave --load-extension=$PWD/extension http://127.0.0.1:8123/demo/
```

License: MIT.

---

# Guía en español

## Las piezas de este repo

| Pieza | Paquete | Para quién | Qué hace |
|-------|---------|------------|----------|
| **Widget** | [`ghlike-widget`](widget/) (npm) | Dueños de webs | El botón embebible `<gh-like repo="owner/repo">` |
| **Extensión** | [extensión de navegador](extension/) | Visitantes | Like con un clic usando su sesión de github.com |
| **CLI + daemon** | [`ghlike`](node/) (npm) | Developers | Star desde el terminal; `ghlike daemon` alimenta widgets en local |

El gemelo Python del CLI vive en otro repo:
[686f6c61/ghlike-py](https://github.com/686f6c61/ghlike-py)
(`pipx install ghlike`).

Las piezas se alimentan del mismo principio: **tu navegador ya tiene tu
login de GitHub, así que nunca hacen falta tokens ni OAuth**. El clic se da
sobre el botón de Star real con tu sesión — GitHub gestiona su propio CSRF.

## 1. Widget — para tu web

```html
<script type="module" src="https://cdn.jsdelivr.net/npm/ghlike-widget"></script>

<gh-like repo="vercel/next.js"></gh-like>
<gh-like repo="vercel/next.js" variant="pill"></gh-like>
```

- Contador de stars en vivo (API pública de GitHub, sin clave; cacheado 1 h
  en `localStorage`).
- **Visitante con la extensión** → un clic da el star sin salir de la página.
- **Daemon local corriendo** (`ghlike daemon`) → mismo comportamiento en esa
  máquina, en cualquier navegador.
- **Nada instalado** → el clic abre el repo en una pestaña nueva (fallback
  clásico, nunca roto).
- **5 variantes**: `classic` (por defecto), `pill`, `outline`, `glass`,
  `block`.
- **Personalización CSS total** con variables `--ghlike-*` y shadow parts.
  Modo oscuro automático.
- El atributo `repo` es reactivo y acepta URLs completas de GitHub.
- Cero dependencias, un fichero.

## 2. Extensión — para visitantes

Se instala una vez; después todo botón `<gh-like>` de la web funciona con un
clic. Código en [`extension/`](extension/) — hoy instalable como extensión
de desarrollador (publicación en tiendas, siguiente paso).

Flujo del clic: el content script de la web intercepta → el background abre
**una pestaña en segundo plano** del repo → el script de github.com pulsa el
botón de Star real (CSRF propio de GitHub) → se cierra → "Liked". Manifest
V3, permiso solo sobre `https://github.com/*`, sin permiso de pestañas, sin
storage, sin código remoto.

## 3. CLI + daemon — para developers

```bash
npm install -g ghlike    # Node ≥ 22, cero dependencias
```

```bash
ghlike vercel/next.js                  # dar star (idempotente)
ghlike https://github.com/vercel/next.js   # URLs completas valen
ghlike vercel/next.js -c               # consultar estado
ghlike vercel/next.js -u               # quitar star
ghlike vercel/next.js --toggle         # invertir
ghlike --list                          # sesiones detectadas
ghlike --browser brave vercel/next.js  # forzar navegador
ghlike vercel/next.js --json           # salida para scripts
ghlike daemon                          # servidor local (127.0.0.1:8469) para widgets
```

También como librería:

```js
import { star, unstar, check, toggle } from "ghlike";
await star("vercel/next.js", { browser: "brave" });
```

El daemon hace que los widgets funcionen con un clic en cualquier navegador
de tu máquina — incluidos los embebidos sin soporte de extensiones. Mientras
corra, cualquier página abierta puede pedirle stars: úsalo para
desarrollo/pruebas y páralo al acabar.

## Seguridad y privacidad

- **Cero dependencias en todo el proyecto.** Se audita en una sentada.
- Las cookies **nunca se descifran** ni salen de la máquina. Lo único que usa
  tu sesión es un clic en el botón de Star real, ejecutado por tu navegador.
- La extensión solo pide acceso a `github.com`.
- El widget solo cachea contadores públicos.

## Limitaciones

- Solo navegadores Chromium. **Firefox no está soportado** — sin CDP.
- CLI/daemon: ~8–12 s por operación; la extensión es más rápida (~2–4 s).
- Depende del botón de Star de GitHub; se arregla con una línea de selector.

## Desarrollo

Ver [DEVELOPMENT.md](DEVELOPMENT.md) — arquitectura, protocolos, testing y
runbook de publicación. Inicio rápido:

```bash
python3 -m http.server 8123 &                     # página demo
node node/src/daemon.mjs                          # daemon
brave --load-extension=$PWD/extension http://127.0.0.1:8123/demo/
```

Licencia: MIT.
