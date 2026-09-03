// Orquestación: sesión del navegador -> navegador headless con CDP por pipe
// (--remote-debugging-pipe, sin puerto TCP) -> click en Star.
// El "like" se hace clicando el botón real de github.com con la sesión del
// usuario. Sin tokens ni API: las cookies cifradas se copian a un perfil
// temporal local y se borran al terminar.
import { execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import { copySession, findSessions, BROWSERS } from './browsers.mjs';
import { CdpPipe, openPage, waitReady } from './cdp.mjs';

const REPO_RE = /^[\w.\-]+\/[\w.\-]+$/;
const URL_RE = /github\.com\/([\w.\-]+)\/([\w.\-]+)/;

// GitHub renderiza el repo con React: no hay formularios clásicos ni
// authenticity_token en el HTML; el click dispara el POST con su propio CSRF.
const STATE_JS = `(() => {
  const btn = document.querySelector('button[aria-label^="Star"], button[aria-label^="Unstar"], button[aria-label^="Starred"]');
  const meta = document.querySelector('meta[name="user-login"]');
  return {
    login: meta ? meta.content : null,
    found: !!btn,
    starred: btn ? ((btn.getAttribute('aria-label') || '').startsWith('Unstar') || /Starred/i.test(btn.innerText || '')) : null,
    aria: btn ? btn.getAttribute('aria-label') : null,
    notFound: /Page not found|404 "not found"/i.test(document.title)
  };
})()`;

const CLICK_JS = `(() => {
  const btn = document.querySelector('button[aria-label^="Star"], button[aria-label^="Unstar"], button[aria-label^="Starred"]');
  if (!btn) return false;
  btn.click();
  return true;
})()`;

export class GhlikeError extends Error {}
export class NoSessionError extends GhlikeError {}
export class RepoNotFoundError extends GhlikeError {}

export function parseRepo(text) {
  text = String(text || '').trim().replace(/\/+$/, '');
  const m = URL_RE.exec(text);
  if (m) return `${m[1]}/${m[2]}`;
  if (text.startsWith('http')) throw new GhlikeError(`URL no reconocida como repo de GitHub: ${text}`);
  if (REPO_RE.test(text)) return text;
  throw new GhlikeError(`formato esperado 'owner/repo' o URL de GitHub: ${text}`);
}

async function waitLoaded(page, timeoutMs = 25000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try { if (await page.eval('document.readyState') === 'complete') return; } catch {}
    await new Promise(r => setTimeout(r, 400));
  }
  throw new GhlikeError('la pagina no termino de cargar');
}

async function readState(page, timeoutMs = 20000) {
  // Espera al login Y al botón: en repos grandes el header de React puede
  // hidratarse después del meta de login, y comprobar antes da un falso
  // "markup cambió".
  const deadline = Date.now() + timeoutMs;
  let st = {};
  while (Date.now() < deadline) {
    try {
      st = (await page.eval(STATE_JS)) || {};
      if (st.login && (st.found || st.notFound)) return st;
    } catch {}
    await new Promise(r => setTimeout(r, 500));
  }
  return st;
}

// PIDs cuyo cmdline referencia el perfil temporal: con navegadores snap el
// binario real escapa del grupo de procesos (snap-confine), y la unica forma
// fiable de localizarlo es por el --user-data-dir con que se lanzo.
function pidsOnTmp(tmp) {
  const pids = [];
  for (const name of fs.readdirSync('/proc')) {
    if (!/^\d+$/.test(name)) continue;
    try {
      if (fs.readFileSync(`/proc/${name}/cmdline`, 'utf8').includes(`--user-data-dir=${tmp}\0`)) pids.push(Number(name));
    } catch {}
  }
  return pids;
}

async function killTree(proc, tmp) {
  if (process.platform === 'win32') {
    // process.kill(-pid) es POSIX-only; en Windows se mata el arbol con taskkill
    try { execFileSync('taskkill', ['/pid', String(proc.pid), '/T', '/F'], { stdio: 'ignore' }); }
    catch { try { proc.kill(); } catch {} }
    return;
  }
  // Mata el grupo completo: /snap/bin/brave es un wrapper y el binario real
  // queda huérfano si solo se mata el Popen (y seguiría escribiendo en tmp).
  for (const sig of ['SIGTERM', 'SIGKILL']) {
    try { process.kill(-proc.pid, sig); } catch { break; }
    for (let i = 0; i < 50; i++) {
      await new Promise(r => setTimeout(r, 100));
      try { process.kill(-proc.pid, 0); } catch { break; }
    }
  }
  // Barrido por cmdline para los procesos que escaparon del grupo (snap):
  // si se les deja vivos, recrean el perfil temporal DESPUES de borrarlo.
  for (let i = 0; i < 100; i++) {
    const pids = pidsOnTmp(tmp);
    if (!pids.length) return;
    for (const pid of pids) { try { process.kill(pid, i < 50 ? 'SIGTERM' : 'SIGKILL'); } catch {} }
    await new Promise(r => setTimeout(r, 100));
  }
}

async function rmRetry(tmp, attempts = 4) {
  for (let i = 0; i < attempts; i++) {
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch {}
    if (!fs.existsSync(tmp)) return;
    await new Promise(r => setTimeout(r, 500));
  }
  // El perfil temporal contiene una copia cifrada de las cookies: si no se
  // pudo borrar, avisar con la ruta para que el usuario lo haga a mano.
  process.stderr.write(`ghlike: aviso: no se pudo borrar el perfil temporal, eliminalo a mano: ${tmp}\n`);
}

export async function run(repo, { action = 'star', browser = null } = {}) {
  if (!['star', 'unstar', 'toggle', 'check'].includes(action)) throw new GhlikeError(`accion desconocida: ${action}`);
  repo = parseRepo(repo);

  const sessions = findSessions(browser);
  if (!sessions.length) {
    if (browser && !BROWSERS.some(b => b.name === browser.toLowerCase())) {
      const known = BROWSERS.map(b => b.name).join(', ');
      throw new NoSessionError(`navegador '${browser}' no soportado (soportados: ${known}). Firefox no funciona: no implementa CDP.`);
    }
    throw new NoSessionError(
      'no se encontro ninguna sesion de github.com en los perfiles de Brave/Chrome/Chromium/Edge/Vivaldi/Opera. Logueate en el navegador primero.');
  }

  let lastSessionFailure = null;
  for (const session of sessions) {
    const tmp = copySession(session);
    const proc = spawn(session.exe, [
      '--headless=new', '--disable-gpu', '--no-first-run',
      '--no-default-browser-check', '--disable-component-update',
      `--user-data-dir=${tmp}`,
      `--profile-directory=${session.profileName}`,
      '--remote-debugging-pipe',
      'about:blank',
    ], { stdio: ['ignore', 'ignore', 'ignore', 'pipe', 'pipe'], detached: true });
    proc.unref();
    const pipe = new CdpPipe(proc);

    try {
      const up = await waitReady(pipe);
      if (!up || proc.exitCode !== null) throw new GhlikeError(`${session.browser.label} no arranco con el pipe de depuracion`);
      const page = await openPage(pipe, `https://github.com/${repo}`);
      try {
        await waitLoaded(page);
        await new Promise(r => setTimeout(r, 2000)); // margen para la hidratacion de React
        const st = await readState(page);

        if (st.notFound) throw new RepoNotFoundError(`el repo ${repo} no existe (o no es visible)`);
        if (!st.login) {
          lastSessionFailure = `la sesion de ${session.browser.label} (${session.profileName}) no se pudo usar`;
          continue; // probar el siguiente perfil/navegador
        }
        if (!st.found) throw new GhlikeError('no se encontro el boton de star: el markup de GitHub cambio, abre un issue');

        const before = !!st.starred;
        const result = { repo, user: st.login, browser: session.browser.label, profile: session.profileName, before };
        if (action === 'check') return { ...result, action, after: before, changed: false };

        const desired = action === 'toggle' ? !before : action === 'star';
        if (before !== desired) {
          if (!(await page.eval(CLICK_JS))) throw new GhlikeError('el boton de star desaparecio antes del click');
          let flipped = false;
          const deadline = Date.now() + 15000;
          while (Date.now() < deadline) {
            await new Promise(r => setTimeout(r, 600));
            const st2 = await readState(page);
            if (!!st2.starred === desired) { flipped = true; break; }
          }
          if (!flipped) throw new GhlikeError('el click no cambio el estado del star (rate limit o cambio de UI)');
        }
        return { ...result, action, after: desired, changed: before !== desired };
      } finally {
        await page.close();
      }
    } finally {
      pipe.close();
      await killTree(proc, tmp);
      await rmRetry(tmp);
    }
  }
  throw new NoSessionError(lastSessionFailure || 'ninguna sesion de navegador pudo usarse');
}

export const star = (repo, opts) => run(repo, { ...opts, action: 'star' });
export const unstar = (repo, opts) => run(repo, { ...opts, action: 'unstar' });
export const toggle = (repo, opts) => run(repo, { ...opts, action: 'toggle' });
export const check = (repo, opts) => run(repo, { ...opts, action: 'check' });
