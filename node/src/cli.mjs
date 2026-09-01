#!/usr/bin/env node
// CLI de ghlike: like (star) en repos de GitHub con la sesión del navegador.
import { findSessions } from './browsers.mjs';
import { GhlikeError, NoSessionError, RepoNotFoundError, run } from './core.mjs';

const EXIT_OK = 0, EXIT_ERROR = 1, EXIT_NO_SESSION = 2, EXIT_NOT_FOUND = 3;
const VERSION = '0.1.2';

const HELP = `ghlike ${VERSION} — like (star) en GitHub con tu sesión del navegador, sin tokens

Uso:
  ghlike owner/repo            dar star (si ya lo tienes, no hace nada)
  ghlike owner/repo -u         quitar el star
  ghlike owner/repo -c         solo consultar
  ghlike owner/repo --toggle   invertir el estado
  ghlike --list                sesiones de GitHub detectadas
Opciones:
  --browser NOMBRE   forzar navegador (brave, chrome, chromium, edge, vivaldi, opera)
  --json             salida en JSON
  -h, --help         ayuda    -v, --version  version`;

function parseArgs(argv) {
  const args = { action: 'star', browser: null, asJson: false, list: false, repo: null };
  const rest = [...argv];
  while (rest.length) {
    const a = rest.shift();
    if (a === '-u' || a === '--unstar') args.action = 'unstar';
    else if (a === '-c' || a === '--check') args.action = 'check';
    else if (a === '--toggle') args.action = 'toggle';
    else if (a === '--browser') args.browser = rest.shift();
    else if (a.startsWith('--browser=')) args.browser = a.slice('--browser='.length);
    else if (a === '--json') args.asJson = true;
    else if (a === '--list') args.list = true;
    else if (a === '-h' || a === '--help') { console.log(HELP); process.exit(EXIT_OK); }
    else if (a === '-v' || a === '--version') { console.log(`ghlike ${VERSION}`); process.exit(EXIT_OK); }
    else if (a.startsWith('-')) { console.error(`ghlike: opcion desconocida: ${a}`); process.exit(EXIT_ERROR); }
    else args.repo = a;
  }
  return args;
}

async function listSessions(asJson) {
  const sessions = findSessions();
  if (asJson) {
    console.log(JSON.stringify(sessions.map(s => ({ browser: s.browser.label, exe: s.exe, profile: s.profileName, githubCookies: s.cookieCount })), null, 2));
    return EXIT_OK;
  }
  if (!sessions.length) {
    console.log('No se ha encontrado ninguna sesion de github.com en los navegadores Chromium.');
    return EXIT_NO_SESSION;
  }
  console.log('Sesiones de github.com detectadas:');
  for (const s of sessions) {
    console.log(`  - ${s.browser.label}: perfil ${s.profileName}`);
    console.log(`      ${s.exe}`);
  }
  return EXIT_OK;
}

const args = parseArgs(process.argv.slice(2));

async function main() {
  if (args.repo === 'daemon') {
    // subcomando: servidor local para el widget <gh-like>
    const { start } = await import('./daemon.mjs');
    const i = process.argv.indexOf('--port');
    start(i !== -1 ? Number(process.argv[i + 1]) : undefined);
    return;
  }
  if (args.list) process.exit(await listSessions(args.asJson));
  if (!args.repo) { console.error(HELP); process.exit(EXIT_ERROR); }

  const r = await run(args.repo, { action: args.action, browser: args.browser });
  if (args.asJson) { console.log(JSON.stringify(r)); process.exit(EXIT_OK); }

  const who = `[${r.user} via ${r.browser}]`;
  if (r.action === 'check') console.log(`${r.repo}: ${r.after ? 'con like' : 'sin like'} ${who}`);
  else if (!r.changed) console.log(`${r.repo}: ${r.after ? 'ya tenia like' : 'ya estaba sin like'}, sin cambios ${who}`);
  else console.log(`${r.repo}: ${r.after ? 'like dado :star:' : 'like quitado'} ${who}`);
  process.exit(EXIT_OK);
}

try {
  await main();
} catch (e) {
  if (e instanceof NoSessionError) { console.error(`ghlike: ${e.message}`); process.exit(EXIT_NO_SESSION); }
  if (e instanceof RepoNotFoundError) { console.error(`ghlike: ${e.message}`); process.exit(EXIT_NOT_FOUND); }
  if (e instanceof GhlikeError) { console.error(`ghlike: ${e.message}`); process.exit(EXIT_ERROR); }
  console.error('ghlike: error inesperado:', e);
  process.exit(EXIT_ERROR);
}
