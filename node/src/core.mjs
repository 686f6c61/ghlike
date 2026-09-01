// Orquestación: sesión del navegador -> navegador headless con CDP -> click en Star.
// El "like" se hace clicando el botón real de github.com con la sesión del
// usuario. Sin tokens ni API: las cookies cifradas se copian a un perfil
// temporal local y se borran al terminar.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { copySession, findSessions, BROWSERS } from './browsers.mjs';
import { freePort, openTab, Tab, waitForCdp } from './cdp.mjs';

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

async function waitReady(tab, timeoutMs = 25000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try { if (await tab.eval('document.readyState') === 'complete') return; } catch {}
    await new Promise(r => setTimeout(r, 400));
  }
  throw new GhlikeError('la pagina no termino de cargar');
}

async function readState(tab) {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    try {
      const st = await tab.eval(STATE_JS);
      if (st && st.login !== null && st.login !== undefined) return st;
    } catch {}
    await new Promise(r => setTimeout(r, 500));
  }
  return (await tab.eval(STATE_JS).catch(() => ({}))) || {};
}

async function killTree(proc) {
  // Mata el grupo completo: /snap/bin/brave es un wrapper y el binario real
  // queda huérfano si solo se mata el Popen (y seguiría escribiendo en tmp).
  for (const sig of ['SIGTERM', 'SIGKILL']) {
    try { process.kill(-proc.pid, sig); } catch { return; }
    for (let i = 0; i < 50; i++) {
      await new Promise(r => setTimeout(r, 100));
      try { process.kill(-proc.pid, 0); } catch { return; }
    }
  }
}

async function rmRetry(tmp, attempts = 4) {
  for (let i = 0; i < attempts; i++) {
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch {}
    if (!fs.existsSync(tmp)) return;
    await new Promise(r => setTimeout(r, 500));
  }
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
    const port = await freePort();
    const proc = spawn(session.exe, [
      '--headless=new', '--disable-gpu', '--no-first-run',
      '--no-default-browser-check', '--disable-component-update',
      `--user-data-dir=${tmp}`,
      `--profile-directory=${session.profileName}`,
      `--remote-debugging-port=${port}`,
      'about:blank',
    ], { stdio: 'ignore', detached: true });
    proc.unref();

    try {
      const up = await waitForCdp(port);
      if (!up || proc.exitCode !== null) throw new GhlikeError(`${session.browser.label} no arranco con el puerto de depuracion`);
      const tab = new Tab(await openTab(port, `https://github.com/${repo}`));
      try {
        await waitReady(tab);
        await new Promise(r => setTimeout(r, 2000)); // margen para la hidratacion de React
        const st = await readState(tab);

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
          if (!(await tab.eval(CLICK_JS))) throw new GhlikeError('el boton de star desaparecio antes del click');
          let flipped = false;
          const deadline = Date.now() + 15000;
          while (Date.now() < deadline) {
            await new Promise(r => setTimeout(r, 600));
            const st2 = await readState(tab);
            if (!!st2.starred === desired) { flipped = true; break; }
          }
          if (!flipped) throw new GhlikeError('el click no cambio el estado del star (rate limit o cambio de UI)');
        }
        return { ...result, action, after: desired, changed: before !== desired };
      } finally {
        tab.close();
      }
    } finally {
      await killTree(proc);
      await rmRetry(tmp);
    }
  }
  throw new NoSessionError(lastSessionFailure || 'ninguna sesion de navegador pudo usarse');
}

export const star = (repo, opts) => run(repo, { ...opts, action: 'star' });
export const unstar = (repo, opts) => run(repo, { ...opts, action: 'unstar' });
export const toggle = (repo, opts) => run(repo, { ...opts, action: 'toggle' });
export const check = (repo, opts) => run(repo, { ...opts, action: 'check' });
