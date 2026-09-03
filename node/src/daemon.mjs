// ghlike daemon: servidor HTTP local (127.0.0.1) que expone el motor del CLI
// a la landing ghlike.686f6c61.dev (boton de like con un clic, sin extension).
//
//   GET  /ping              -> {ok:true, service:"ghlike-daemon", version}
//   POST /toggle|/star|/unstar|/check  body {"repo":"owner/repo"}
//                              -> {ok:true, repo, starred, changed, user}
//
// Cada peticion ejecuta el flujo probado del CLI: copia la sesion cifrada a
// un perfil temporal, abre el navegador headless, pulsa el Star real y borra
// todo. Peticiones encoladas de una en una (un navegador a la vez).
//
// Endurecido (auditoria):
// - La allowlist de origen gobierna la EJECUCION, no solo el CORS: un Origin
//   no allowlistado recibe 403 bad-origin SIN ejecutar nada (las peticiones
//   "simples" text/plain no pasan preflight, el CORS solo no protege).
// - Validacion de Host anti DNS-rebinding: solo 127.0.0.1:<port>/localhost:<port>.
// - CORS reflejado solo para origenes allowlistados (nunca *), con
//   Access-Control-Allow-Private-Network (Chrome lo exige para https -> loopback).
// - Cola limitada a 4 pendientes (429 queue-full), body <= 4 KB.
// Peticiones sin Origin (curl/CLI) se permiten: no vienen de una web.
import fs from 'node:fs';
import http from 'node:http';
import { GhlikeError, NoSessionError, RepoNotFoundError, run } from './core.mjs';

export const DEFAULT_PORT = 8469;
export const DEFAULT_ORIGINS = [
  'https://ghlike.686f6c61.dev',
  'http://127.0.0.1:8123',
  'http://localhost:8123',
];

const MAX_BODY = 4096;
const MAX_QUEUED = 4;
const REPO_RE = /^[\w.\-]+\/[\w.\-]+$/;
const VERSION = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;

export function start(port = DEFAULT_PORT, { allowOrigins = [] } = {}) {
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new GhlikeError(`puerto no valido: ${port} (debe ser 1-65535)`);
  }
  const origins = new Set([...DEFAULT_ORIGINS, ...allowOrigins]);
  let queue = Promise.resolve();
  let queued = 0;

  const server = http.createServer((req, res) => {
    const origin = req.headers.origin;
    const allowed = origin !== undefined && origins.has(origin);
    const cors = {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'content-type',
      // Chrome exige esta cabecera para fetch https publico -> loopback
      'Access-Control-Allow-Private-Network': 'true',
      ...(allowed ? { 'Access-Control-Allow-Origin': origin } : {}),
    };
    const reply = (code, obj) => { res.writeHead(code, cors); res.end(JSON.stringify(obj)); };

    // anti DNS-rebinding: solo se sirve a quien pide el loopback directamente
    const host = req.headers.host;
    if (host !== `127.0.0.1:${port}` && host !== `localhost:${port}`) {
      return reply(403, { ok: false, error: 'bad-host' });
    }
    // la allowlist gobierna la ejecucion: origen desconocido -> ni preflight ni accion
    if (origin !== undefined && !allowed) return reply(403, { ok: false, error: 'bad-origin' });
    // Content-Length: 0 explicito (como el gemelo Python): sin el, el preflight
    // PNA de Chrome (https publico -> loopback) falla con "Failed to fetch"
    if (req.method === 'OPTIONS') { res.writeHead(204, { ...cors, 'Content-Length': '0' }); return res.end(); }

    const url = new URL(req.url, 'http://127.0.0.1');
    if (url.pathname === '/ping' && req.method === 'GET') {
      return reply(200, { ok: true, service: 'ghlike-daemon', version: VERSION });
    }

    const action = ['toggle', 'star', 'unstar', 'check'].includes(url.pathname.slice(1))
      ? url.pathname.slice(1) : null;
    if (action && req.method === 'POST') {
      let body = '';
      let tooBig = false;
      req.on('data', (c) => { body += c; if (body.length > MAX_BODY) tooBig = true; });
      req.on('end', () => {
        let repo = null;
        if (!tooBig) { try { repo = JSON.parse(body || '{}').repo; } catch {} }
        if (tooBig || !repo || !REPO_RE.test(repo)) return reply(400, { ok: false, error: 'bad-repo' });
        if (queued >= MAX_QUEUED) return reply(429, { ok: false, error: 'queue-full' });
        // cola: una accion de navegador a la vez
        queued++;
        queue = queue
          .then(() => run(repo, { action }))
          .then((r) => reply(200, { ok: true, repo: r.repo, starred: !!r.after, changed: r.changed, user: r.user }))
          .catch((e) => {
            if (e instanceof NoSessionError) reply(409, { ok: false, error: 'no-session' });
            else if (e instanceof RepoNotFoundError) reply(404, { ok: false, error: 'not-found' });
            else if (e instanceof GhlikeError) reply(500, { ok: false, error: 'ghlike-error' });
            else reply(500, { ok: false, error: 'internal' });
          })
          .finally(() => { queued--; });
      });
      return;
    }
    reply(404, { ok: false, error: 'not-found' });
  });

  server.listen(port, '127.0.0.1', () => {
    console.log(`ghlike daemon ${VERSION} escuchando en http://127.0.0.1:${port}`);
    console.log(`solo responde a: ${[...origins].join(', ')} (y peticiones sin Origin)`);
    console.log('Ctrl+C para parar.');
  });
  return server;
}

// ejecucion directa: node src/daemon.mjs [--port N] [--allow-origin URL]...
if (process.argv[1] && process.argv[1].endsWith('daemon.mjs')) {
  const i = process.argv.indexOf('--port');
  const port = i !== -1 ? Number(process.argv[i + 1]) : DEFAULT_PORT;
  const allowOrigins = [];
  process.argv.forEach((a, j) => { if (a === '--allow-origin' && process.argv[j + 1]) allowOrigins.push(process.argv[j + 1]); });
  start(port, { allowOrigins });
}
