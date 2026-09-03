# ghlike — CLI + library

**Star GitHub repos with your browser session — no tokens. / Da estrellas en
GitHub con la sesión de tu navegador — sin tokens.**

📦 npm: **[www.npmjs.com/package/ghlike](https://www.npmjs.com/package/ghlike)**

[English](#english) · [Español](#español)

Part of the [ghlike project](https://github.com/686f6c61/ghlike). Python twin:
[ghlike-py](https://github.com/686f6c61/ghlike-py) ([PyPI](https://pypi.org/project/ghlike/)).

---

# English

## What it does

`ghlike owner/repo` stars a GitHub repository using the login session already
active in your browser. No `gh auth login`, no personal access tokens, no
OAuth: if you're logged into GitHub in Brave, Chrome, Chromium, Edge, Vivaldi
or Opera (native or snap installs), it just works.

Zero dependencies (Node ≥ 22). Works on Linux, macOS and Windows (tabulated
paths; Linux fully tested).

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
ghlike --browser brave o/r   # force one browser (strict — fails if it has no session)
ghlike o/r --json            # machine-readable output
ghlike daemon                # local server (127.0.0.1:8469) for the ghlike landing
```

Example:

```
$ ghlike sindresorhus/awesome
sindresorhus/awesome: like dado :star: [you via Brave]
```

Exit codes: `0` ok (incl. nothing-to-do) · `1` generic error · `2` no
github.com session · `3` repo not found.

JSON output:

```json
{"repo":"cli/cli","user":"you","browser":"Brave","profile":"Default",
 "before":false,"action":"star","after":true,"changed":true}
```

## Library (ESM)

```js
import { star, unstar, check, toggle } from "ghlike";

const r = await star("vercel/next.js");               // { repo, user, before, after, changed, … }
const s = await check("vercel/next.js");              // { …, starred: true|false, … }
await unstar("vercel/next.js", { browser: "brave" }); // force a browser
await toggle("denoland/deno");
```

Errors: `NoSessionError`, `RepoNotFoundError`, `GhlikeError`.

## Daemon

`ghlike daemon` serves `127.0.0.1:8469` so the like button on the project
landing ([ghlike.686f6c61.dev](https://ghlike.686f6c61.dev)) works with **one
click**, no browser extension needed:

| route | body | returns |
|-------|------|---------|
| `GET /ping` | – | `{ok, service:"ghlike-daemon", version}` |
| `POST /check` | `{"repo":"o/r"}` | `{ok, repo, starred, changed, user}` |
| `POST /star` / `POST /unstar` / `POST /toggle` | `{"repo":"o/r"}` | `{ok, repo, starred, changed, user}` |

Errors: `400 bad-repo` · `403 bad-origin|bad-host` · `404 not-found` ·
`409 no-session` · `429 queue-full` · `500 ghlike-error`. Actions are queued
one at a time (max 4 pending).

**Security note:** the daemon only executes requests whose `Origin` is
`https://ghlike.686f6c61.dev` or localhost — any other website gets
`403 bad-origin` and nothing runs (the origin allowlist gates execution, not
just CORS; Host header is validated against DNS-rebinding). Extra origins can
be added with repeated `--allow-origin <url>` flags. Stop it when done.

## How it works

Finds a browser profile with github.com session cookies → copies the
**encrypted** cookie store to a throwaway profile → opens your own browser
headless, driven over a **private CDP pipe** (`--remote-debugging-pipe` — no
TCP debug port is ever opened) → clicks the real Star button (GitHub handles
its own CSRF) → verifies → kills the browser and deletes the profile. Cookies
are never decrypted and never leave your machine.

## Limitations

- Chromium-family browsers only; Firefox is not supported (no CDP).
- Each operation takes ~8–12 s (headless browser + page load) — the price of
  the no-token approach.
- Depends on GitHub's Star button; if the markup changes, one selector line
  fixes it (`STATE_JS` in `src/core.mjs`).

License: MIT.

---

# Español

## Qué hace

`ghlike owner/repo` da una estrella a un repositorio de GitHub usando la
sesión ya iniciada en tu navegador. Sin `gh auth login`, sin personal access
tokens, sin OAuth: si estás logueado en GitHub en Brave, Chrome, Chromium,
Edge, Vivaldi u Opera (nativo o snap), funciona directamente.

Cero dependencias (Node ≥ 22). Funciona en Linux, macOS y Windows (rutas
tabuladas; Linux probado a fondo).

## Instalación

```bash
npm install -g ghlike
```

## CLI

```bash
ghlike owner/repo            # dar star (idempotente — avisa si ya lo tenía)
ghlike https://github.com/o/r  # URLs completas valen
ghlike owner/repo -c         # solo consultar estado
ghlike owner/repo -u         # quitar el star
ghlike owner/repo --toggle   # invertir
ghlike --list                # sesiones de github.com detectadas en tus navegadores
ghlike --browser brave o/r   # forzar un navegador (estricto — falla si no tiene sesión)
ghlike o/r --json            # salida para scripts
ghlike daemon                # servidor local (127.0.0.1:8469) para la landing
```

Ejemplo:

```
$ ghlike sindresorhus/awesome
sindresorhus/awesome: like dado :star: [tú via Brave]
```

Códigos de salida: `0` ok (también "nada que hacer") · `1` error genérico ·
`2` sin sesión de github.com · `3` repo no encontrado.

## Librería (ESM)

```js
import { star, unstar, check, toggle } from "ghlike";

const r = await star("vercel/next.js");               // { repo, user, before, after, changed, … }
const s = await check("vercel/next.js");              // { …, starred: true|false, … }
await unstar("vercel/next.js", { browser: "brave" }); // forzar navegador
await toggle("denoland/deno");
```

Errores: `NoSessionError`, `RepoNotFoundError`, `GhlikeError`.

## Daemon

`ghlike daemon` sirve `127.0.0.1:8469` para que el botón de like de la
landing del proyecto ([ghlike.686f6c61.dev](https://ghlike.686f6c61.dev))
funcione **con un clic**, sin extensión de navegador:

| ruta | body | devuelve |
|------|------|----------|
| `GET /ping` | – | `{ok, service:"ghlike-daemon", version}` |
| `POST /check` | `{"repo":"o/r"}` | `{ok, repo, starred, changed, user}` |
| `POST /star` / `POST /unstar` / `POST /toggle` | `{"repo":"o/r"}` | `{ok, repo, starred, changed, user}` |

Errores: `400 bad-repo` · `403 bad-origin|bad-host` · `404 not-found` ·
`409 no-session` · `429 queue-full` · `500 ghlike-error`. Las acciones van en
cola de una en una (máx. 4 pendientes).

**Aviso de seguridad:** el daemon solo ejecuta peticiones cuyo `Origin` sea
`https://ghlike.686f6c61.dev` o localhost — cualquier otra web recibe
`403 bad-origin` y no se ejecuta nada (la allowlist de origen gobierna la
ejecución, no solo el CORS; el header Host se valida contra DNS-rebinding).
Se pueden añadir orígenes con `--allow-origin <url>` repetido. Páralo al
acabar.

## Cómo funciona

Busca el perfil del navegador con cookies de sesión de github.com → copia la
tienda **cifrada** a un perfil desechable → abre tu propio navegador en modo
invisible, controlado por un **pipe CDP privado** (`--remote-debugging-pipe`
— nunca se abre un puerto TCP de depuración) → pulsa el botón de Star real
(GitHub gestiona su propio CSRF) → verifica → cierra el navegador y borra el
perfil. Las cookies nunca se descifran ni salen de tu máquina.

## Limitaciones

- Solo navegadores Chromium; Firefox no está soportado (sin CDP).
- Cada operación tarda ~8–12 s (navegador invisible + carga de la página) —
  el precio del enfoque sin tokens.
- Depende del botón de Star de GitHub; si cambia el markup, se arregla con
  una línea de selector (`STATE_JS` en `src/core.mjs`).

Licencia: MIT.
