// ghlike daemon: servidor HTTP local (127.0.0.1) que expone el motor del CLI
// al widget <gh-like> de cualquier web del navegador local.
//
//   GET  /ping              -> {ok:true}
//   POST /toggle|/star|/unstar|/check  body {"repo":"owner/repo"}
//                              -> {ok:true, starred, changed, user}
//
// Cada peticion ejecuta el flujo probado del CLI: copia la sesion cifrada a
// un perfil temporal, abre el navegador headless, pulsa el Star real y borra
// todo. Peticiones encoladas de una en una (un navegador a la vez).
//
// AVISO de confianza: mientras el daemon corre, CUALQUIER web abierta en el
// navegador puede pedirle stars (igual que la extension, pero sin requerir
// clic en un widget). Es una herramienta de desarrollo/local: cierralo cuando
// no lo uses. El producto para visitantes genericos es la extension.
import http from 'node:http';
import { GhlikeError, NoSessionError, RepoNotFoundError, run } from './core.mjs';

export const DEFAULT_PORT = 8469;

export function start(port = DEFAULT_PORT) {
  let queue = Promise.resolve();
  const server = http.createServer((req, res) => {
    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'content-type',
      'Content-Type': 'application/json',
    };
    const reply = (code, obj) => { res.writeHead(code, cors); res.end(JSON.stringify(obj)); };
    if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end(); }

    const url = new URL(req.url, 'http://127.0.0.1');
    if (url.pathname === '/ping' && req.method === 'GET') {
      return reply(200, { ok: true, service: 'ghlike-daemon', version: '0.1.2' });
    }

    const action = ['toggle', 'star', 'unstar', 'check'].includes(url.pathname.slice(1))
      ? url.pathname.slice(1) : null;
    if (action && req.method === 'POST') {
      let body = '';
      req.on('data', (c) => { body += c; if (body.length > 4096) req.destroy(); });
      req.on('end', () => {
        let repo = null;
        try { repo = JSON.parse(body || '{}').repo; } catch {}
        if (!repo || !/^[\w.\-]+\/[\w.\-]+$/.test(repo)) return reply(400, { ok: false, error: 'bad-repo' });
        // cola: una accion de navegador a la vez
        queue = queue
          .then(() => run(repo, { action }))
          .then((r) => reply(200, { ok: true, repo: r.repo, starred: !!r.after, changed: r.changed, user: r.user }))
          .catch((e) => {
            if (e instanceof NoSessionError) reply(409, { ok: false, error: 'no-session' });
            else if (e instanceof RepoNotFoundError) reply(404, { ok: false, error: 'not-found' });
            else if (e instanceof GhlikeError) reply(500, { ok: false, error: 'ghlike-error' });
            else reply(500, { ok: false, error: 'internal' });
          });
      });
      return;
    }
    reply(404, { ok: false, error: 'not-found' });
  });

  server.listen(port, '127.0.0.1', () => {
    console.log(`ghlike daemon escuchando en http://127.0.0.1:${port}`);
    console.log('Ctrl+C para parar. Recuerda: cualquier web local puede usarlo mientras corra.');
  });
  return server;
}

// ejecucion directa: node src/daemon.mjs [--port N]
if (process.argv[1] && process.argv[1].endsWith('daemon.mjs')) {
  const i = process.argv.indexOf('--port');
  const port = i !== -1 ? Number(process.argv[i + 1]) : DEFAULT_PORT;
  start(port);
}
