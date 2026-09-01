// ghlike background (service worker MV3): orquesta las acciones del widget.
// Para cada peticion abre UNA pestana en segundo plano del repo con un hash
// de control (#ghlike-star...); el content script de github.com actua y
// responde, y aqui se cierra la pestana y se devuelve el estado al widget.

const pending = new Map(); // repo -> { waiters: [fn], timer, tabId }

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg) return;

  if (msg.type === "ghlike:result") {
    const entry = pending.get(msg.repo);
    if (entry) {
      pending.delete(msg.repo);
      clearTimeout(entry.timer);
      if (sender.tab && sender.tab.id != null) {
        chrome.tabs.remove(sender.tab.id).catch(() => {});
      }
      for (const resolve of entry.waiters) resolve(msg);
    }
    return;
  }

  const verb = msg.type === "ghlike:star" || msg.type === "ghlike:unstar" ||
               msg.type === "ghlike:toggle" || msg.type === "ghlike:check"
    ? msg.type.split(":")[1] : null;
  if (verb && typeof msg.repo === "string") {
    handle(msg.repo, verb).then(sendResponse);
    return true; // respuesta asincrona
  }
});

async function handle(repo, verb) {
  const entry = pending.get(repo) || { waiters: [], timer: null, tabId: null };
  const promise = new Promise((resolve) => entry.waiters.push(resolve));
  pending.set(repo, entry);

  // peticiones concurrentes del mismo repo: reutiliza la pestana en vuelo
  if (entry.tabId != null) return promise;

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
