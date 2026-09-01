// ghlike widget-bridge: content script que corre en TODAS las webs http/https.
// Detecta elementos <gh-like> y, si el visitante tiene la extension, se apropia
// de sus clicks para dar el star con la sesion de github.com del navegador.
// La coordinacion con el widget (mundo de la pagina) es 100% por atributos DOM:
// data-ghlike-ext="1" (extension presente), data-starred, data-busy, data-error.
(() => {
  if (window.__ghlikeBridge) return;
  window.__ghlikeBridge = true;

  const SELECTOR = "gh-like, [ghlike]";
  const mark = (el) => el.setAttribute("data-ghlike-ext", "1");

  const scan = (root) => {
    if (!root || !root.querySelectorAll) return;
    if (root.matches && root.matches(SELECTOR)) mark(root);
    root.querySelectorAll(SELECTOR).forEach(mark);
  };

  scan(document);
  new MutationObserver((muts) => {
    for (const m of muts) {
      for (const n of m.addedNodes) {
        if (n.nodeType === Node.ELEMENT_NODE) scan(n);
      }
    }
  }).observe(document.documentElement, { childList: true, subtree: true });

  // captura: llega antes que cualquier handler del propio widget (fallback)
  document.addEventListener(
    "click",
    async (event) => {
      const host = event.target && event.target.closest ? event.target.closest(SELECTOR) : null;
      if (!host || host.getAttribute("data-ghlike-ext") !== "1") return;
      const repo = host.getAttribute("repo") || (host.dataset && host.dataset.repo);
      if (!repo || !/^[\w.\-]+\/[\w.\-]+$/.test(repo)) return;

      event.preventDefault();
      event.stopPropagation();

      host.setAttribute("data-busy", "1");
      host.removeAttribute("data-error");
      try {
        const reply = await chrome.runtime.sendMessage({ type: "ghlike:toggle", repo });
        if (reply && reply.ok) {
          host.setAttribute("data-starred", reply.starred ? "1" : "0");
        } else {
          host.setAttribute("data-error", (reply && reply.error) || "error");
        }
      } catch (e) {
        host.setAttribute("data-error", String(e && e.message) || "error");
      } finally {
        host.removeAttribute("data-busy");
      }
    },
    true
  );
})();
