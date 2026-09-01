// Detección de navegadores Chromium, sus perfiles y la sesión de GitHub.
// Funciona con instalaciones nativas y snap. No se descifra nada: se copia
// la tienda de cookies cifrada a un perfil temporal que el propio navegador abre.
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const SESSION_COOKIES = ['user_session', '__Host-user_session_same_site', 'logged_in', '_gh_sess'];

export const BROWSERS = [
  { name: 'brave', label: 'Brave',
    exe: ['/snap/bin/brave', '/usr/bin/brave-browser', '/usr/bin/brave',
          '/usr/local/bin/brave-browser', '/opt/brave.com/brave/brave-browser',
          '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
          'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe',
          'C:\\Program Files (x86)\\BraveSoftware\\Brave-Browser\\Application\\brave.exe'],
    roots: ['~/.config/BraveSoftware/Brave-Browser', '~/snap/brave/*/.config/BraveSoftware/Brave-Browser'] },
  { name: 'chrome', label: 'Google Chrome',
    exe: ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/opt/google/chrome/chrome',
          '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
          'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'],
    roots: ['~/.config/google-chrome'] },
  { name: 'chromium', label: 'Chromium',
    exe: ['/snap/bin/chromium', '/usr/bin/chromium', '/usr/bin/chromium-browser',
          '/Applications/Chromium.app/Contents/MacOS/Chromium'],
    roots: ['~/.config/chromium', '~/snap/chromium/*/.config/chromium'] },
  { name: 'edge', label: 'Microsoft Edge',
    exe: ['/usr/bin/microsoft-edge', 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'],
    roots: ['~/.config/microsoft-edge'] },
  { name: 'vivaldi', label: 'Vivaldi',
    exe: ['/usr/bin/vivaldi', '/Applications/Vivaldi.app/Contents/MacOS/Vivaldi'],
    roots: ['~/.config/vivaldi'] },
  { name: 'opera', label: 'Opera',
    exe: ['/usr/bin/opera'],
    roots: ['~/.config/opera'] },
];

const expand = (p) => path.join(os.homedir(), p.slice(2));

function resolveExe(browser) {
  for (const cand of browser.exe) {
    const p = cand.startsWith('~/') ? expand(cand) : cand;
    try { fs.accessSync(p, fs.constants.X_OK); return p; } catch {}
  }
  try { return execSync(`command -v ${browser.name}`, { stdio: ['ignore', 'pipe', 'ignore'] })
    .toString().trim() || null; } catch { return null; }
}

function* globDirs(pattern) {
  // glob mínimo: solo sufijo "/*/" al final del patrón (suficiente para snaps)
  const m = pattern.match(/^(.*)\/\*\/(.*)$/);
  if (!m) { try { yield expand(pattern); } catch {} return; }
  const [_, base, rest] = m;
  const baseAbs = base.startsWith('~/') ? expand(base) : base;
  let entries = [];
  try { entries = fs.readdirSync(baseAbs); } catch { return; }
  for (const e of entries) yield path.join(baseAbs, e, rest);
}

function profileDirs(root) {
  const out = [];
  const cands = [path.join(root, 'Default'), ...(() => {
    try { return fs.readdirSync(root).filter(d => d.startsWith('Profile ')).map(d => path.join(root, d)); }
    catch { return []; }
  })()];
  for (const d of cands) {
    try { fs.statSync(path.join(d, 'Cookies')); out.push(d); } catch {}
  }
  out.sort((a, b) => fs.statSync(path.join(b, 'Cookies')).mtimeMs - fs.statSync(path.join(a, 'Cookies')).mtimeMs);
  return out;
}

export function githubCookieCount(profileDir) {
  // Sin dependencias no hay SQLite: heuristica binaria sobre la BD (y su WAL).
  // Cuenta nombres de cookies de sesion cuando "github.com" aparece como host.
  // Un falso positivo es inofensivo: en runtime se verifica el login real y
  // se pasa al siguiente perfil si la sesion no sirve.
  let text = '';
  for (const f of ['Cookies', 'Cookies-wal']) {
    try { text += fs.readFileSync(path.join(profileDir, f)).toString('latin1'); } catch {}
  }
  if (!text.includes('github.com')) return 0;
  let n = 0;
  for (const name of SESSION_COOKIES) {
    let idx = 0;
    while ((idx = text.indexOf(name, idx)) !== -1) { n++; idx += name.length; }
  }
  return n;
}

export function findSessions(preferred) {
  // Sin `preferred` escanea todos los soportados. Con `preferred`, SOLO ese
  // navegador: forzar uno y caer a otro en silencio seria enganoso.
  const order = preferred
    ? BROWSERS.filter(b => b.name === preferred.toLowerCase())
    : BROWSERS;
  if (preferred && order.length === 0) return [];
  const found = [];
  for (const browser of order) {
    const exe = resolveExe(browser);
    if (!exe) continue;
    const roots = [];
    const seen = new Set();
    for (const pattern of browser.roots) {
      for (const r of globDirs(pattern)) {
        let real;
        try { fs.statSync(r); real = fs.realpathSync(r); } catch { continue; }
        if (seen.has(real)) continue;
        seen.add(real);
        roots.push(r);
      }
    }
    for (const root of roots) {
      for (const profile of profileDirs(root)) {
        const count = githubCookieCount(profile);
        if (count > 0) {
          found.push({ browser, exe, profileDir: profile, profileName: path.basename(profile),
                       rootDir: root, cookieCount: count });
        }
      }
    }
  }
  return found;
}

const PROFILE_FILES = ['Cookies', 'Cookies-wal', 'Cookies-shm', 'Preferences'];
const ROOT_FILES = ['Local State'];

export function copySession(session) {
  // Dir temporal visible en $HOME: los navegadores snap no escriben en rutas ocultas.
  const tmp = fs.mkdtempSync(path.join(os.homedir(), 'ghlike-'));
  fs.mkdirSync(path.join(tmp, session.profileName), { recursive: true });
  for (const f of PROFILE_FILES) {
    const src = path.join(session.profileDir, f);
    try { fs.copyFileSync(src, path.join(tmp, session.profileName, f)); } catch {}
  }
  for (const f of ROOT_FILES) {
    const src = path.join(session.rootDir, f);
    try { fs.copyFileSync(src, path.join(tmp, f)); } catch {}
  }
  return tmp;
}
