// ghlike background (service worker MV3): orquesta las acciones de la landing.
// Para cada peticion abre UNA pestana en segundo plano del repo con un hash
// de control (#ghlike-star...); el content script de github.com actua y
// responde, y aqui se cierra la pestana y se devuelve el estado al bridge.

const REPO_RE = /^[\w.\-]+\/[\w.\-]+$/;
const pending = new Map(); // repo -> { waiters: [fn], timer, tabId, creating }

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg) return;

  if (msg.type === "ghlike:result") {
    const entry = pending.get(msg.repo);
    // solo resuelve la pestana que abrimos nosotros para ese repo
    if (!entry || !sender.tab || sender.tab.id !== entry.tabId) return;
    pending.delete(msg.repo);
    clearTimeout(entry.timer);
    chrome.tabs.remove(sender.tab.id).catch(() => {});
    for (const resolve of entry.waiters) resolve(msg);
    return;
  }

  const verb = msg.type === "ghlike:star" || msg.type === "ghlike:unstar" ||
               msg.type === "ghlike:toggle" || msg.type === "ghlike:check"
    ? msg.type.split(":")[1] : null;
  // defensa en profundidad: el repo se revalida aqui antes de crear la pestana
  if (verb && typeof msg.repo === "string" && REPO_RE.test(msg.repo)) {
    handle(msg.repo, verb).then(sendResponse);
    return true; // respuesta asincrona
  }
});

async function handle(repo, verb) {
  const entry = pending.get(repo) || { waiters: [], timer: null, tabId: null, creating: false };
  const promise = new Promise((resolve) => entry.waiters.push(resolve));
  pending.set(repo, entry);

  // peticiones concurrentes del mismo repo: reutiliza la pestana en vuelo.
  // "creating" se marca de forma sincrona: sin el, dos mensajes seguidos
  // pasaban el await de tabs.create y abrian dos pestanas.
  if (entry.tabId != null || entry.creating) return promise;
  entry.creating = true;

  let tab;
  try {
    tab = await chrome.tabs.create({
      url: `https://github.com/${repo}#ghlike-${verb}`,
      active: false,
    });
  } catch (e) {
    pending.delete(repo);
    for (const resolve of entry.waiters) resolve({ ok: false, error: "tab-failed" });
    return { ok: false, error: "tab-failed" };
  }
  entry.creating = false;
  entry.tabId = tab.id;

  entry.timer = setTimeout(() => {
    if (pending.get(repo) === entry) {
      pending.delete(repo);
      chrome.tabs.remove(tab.id).catch(() => {});
      for (const resolve of entry.waiters) resolve({ ok: false, error: "timeout" });
    }
  }, 45000);

  return promise;
}
