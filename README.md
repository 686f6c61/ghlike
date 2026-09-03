# ghlike

**GitHub likes from your terminal — no tokens.**

**Likes de GitHub desde tu terminal — sin tokens.**

`ghlike owner/repo` stars a GitHub repository using the login session already
active in your browser: no `gh auth login`, no personal access tokens, no
OAuth flows. Zero dependencies, Node ≥ 22.

`ghlike owner/repo` da una estrella a un repo de GitHub con la sesión ya
iniciada en tu navegador: sin `gh auth login`, sin tokens, sin OAuth.
Cero dependencias, Node ≥ 22.

[English guide](#english-guide) · [Guía en español](#guía-en-español)

---

# English guide

## What it is

The npm package [`ghlike`](node/) — CLI + Node library. The Python twin lives
in a separate repo: [686f6c61/ghlike-py](https://github.com/686f6c61/ghlike-py),
available on [PyPI](https://pypi.org/project/ghlike/) (`pipx install ghlike`).

The principle: **your browser already has your GitHub login, so no tokens or
OAuth flows are ever needed**. The click on the real Star button is performed
with your session — GitHub handles its own CSRF.

## Install

```bash
npm install -g ghlike
```

## CLI

```bash
ghlike vercel/next.js                  # star (idempotent)
ghlike https://github.com/vercel/next.js   # full URLs work
ghlike vercel/next.js -c               # check state
ghlike vercel/next.js -u               # unstar
ghlike vercel/next.js --toggle         # flip
ghlike --list                          # GitHub sessions found in your browsers
ghlike --browser brave vercel/next.js  # force one browser
ghlike vercel/next.js --json           # machine-readable
ghlike daemon                          # local server for one-click likes on the landing
```

Running `ghlike daemon` (127.0.0.1:8469) lets the like button on the project
landing ([ghlike.686f6c61.dev](https://ghlike.686f6c61.dev)) star with **one
click** — it only answers to the landing and localhost; any other website
gets a 403.

Exit codes: `0` ok (incl. nothing-to-do) · `1` generic error · `2` no
github.com session · `3` repo not found.

## Library (ESM)

```js
import { star, unstar, check, toggle } from "ghlike";

const r = await star("vercel/next.js");               // { repo, user, before, after, changed, … }
await unstar("vercel/next.js", { browser: "brave" }); // force a browser
```

Errors: `NoSessionError`, `RepoNotFoundError`, `GhlikeError`.

## How it works

Finds a browser profile with github.com session cookies → copies the
**encrypted** cookie store to a throwaway profile → opens your own browser
headless, driven over a **private CDP pipe** (`--remote-debugging-pipe`, no
TCP debug port is ever exposed) → clicks the real Star button (GitHub handles
its own CSRF) → verifies → kills the browser and deletes the profile.

## Security & privacy

- **Zero dependencies.** Audit the whole package in one sitting.
- Cookies are **never decrypted** and never leave the machine. The only
  thing that ever uses your session is one click on the real Star button,
  performed by your own browser.
- The CDP channel is a pair of pipes between ghlike and the browser process:
  **no debug port**, so no other local process can attach to it.

## Limitations

- Chromium-family browsers only (Brave, Chrome, Chromium, Edge, Vivaldi,
  Opera; native or snap). **Firefox is not supported** — no CDP.
- Each operation takes ~8–12 s (headless browser + page load).
- Depends on GitHub's Star button markup; one selector line fixes it.

## Development

See [DEVELOPMENT.md](DEVELOPMENT.md) — architecture, protocols, testing and
the release runbook. Quick start:

```bash
cd node && node src/cli.mjs --list      # CLI from source, zero deps, no build
```

License: MIT.

---

# Guía en español

## Qué es

El paquete npm [`ghlike`](node/) — CLI + librería Node. El gemelo Python vive
en otro repo: [686f6c61/ghlike-py](https://github.com/686f6c61/ghlike-py),
disponible en [PyPI](https://pypi.org/project/ghlike/) (`pipx install ghlike`).

El principio: **tu navegador ya tiene tu login de GitHub, así que nunca hacen
falta tokens ni OAuth**. El clic se da sobre el botón de Star real con tu
sesión — GitHub gestiona su propio CSRF.

## Instalación

```bash
npm install -g ghlike
```

## CLI

```bash
ghlike vercel/next.js                  # dar star (idempotente)
ghlike https://github.com/vercel/next.js   # URLs completas valen
ghlike vercel/next.js -c               # consultar estado
ghlike vercel/next.js -u               # quitar star
ghlike vercel/next.js --toggle         # invertir
ghlike --list                          # sesiones detectadas
ghlike --browser brave vercel/next.js  # forzar navegador
ghlike vercel/next.js --json           # salida para scripts
ghlike daemon                          # servidor local para likes con un clic en la landing
```

Con `ghlike daemon` corriendo (127.0.0.1:8469), el botón de like de la
landing del proyecto ([ghlike.686f6c61.dev](https://ghlike.686f6c61.dev)) da
el star **con un clic** — solo responde a la landing y a localhost; cualquier
otra web recibe un 403.

Códigos de salida: `0` ok (también "nada que hacer") · `1` error genérico ·
`2` sin sesión de github.com · `3` repo no encontrado.

## Librería (ESM)

```js
import { star, unstar, check, toggle } from "ghlike";

const r = await star("vercel/next.js");               // { repo, user, before, after, changed, … }
await unstar("vercel/next.js", { browser: "brave" }); // forzar navegador
```

Errores: `NoSessionError`, `RepoNotFoundError`, `GhlikeError`.

## Cómo funciona

Busca el perfil del navegador con cookies de sesión de github.com → copia la
tienda **cifrada** a un perfil desechable → abre tu propio navegador en modo
invisible, controlado por un **pipe CDP privado** (`--remote-debugging-pipe`,
sin exponer ningún puerto TCP de depuración) → pulsa el botón de Star real
(GitHub gestiona su propio CSRF) → verifica → cierra el navegador y borra el
perfil.

## Seguridad y privacidad

- **Cero dependencias.** Se audita en una sentada.
- Las cookies **nunca se descifran** ni salen de la máquina. Lo único que usa
  tu sesión es un clic en el botón de Star real, ejecutado por tu navegador.
- El canal CDP es un par de pipes entre ghlike y el proceso del navegador:
  **sin puerto de depuración**, ningún otro proceso local puede engancharse.

## Limitaciones

- Solo navegadores Chromium (Brave, Chrome, Chromium, Edge, Vivaldi, Opera;
  nativo o snap). **Firefox no está soportado** — sin CDP.
- Cada operación tarda ~8–12 s (navegador invisible + carga de la página).
- Depende del botón de Star de GitHub; se arregla con una línea de selector.

## Desarrollo

Ver [DEVELOPMENT.md](DEVELOPMENT.md) — arquitectura, protocolos, testing y
runbook de publicación. Inicio rápido:

```bash
cd node && node src/cli.mjs --list      # CLI desde fuente, cero deps, sin build
```

Licencia: MIT.
