// ghlike widget-bridge: content script que corre SOLO en la landing
// https://ghlike.686f6c61.dev/* (ver manifest.json).
// Detecta elementos [data-ghlike-repo] y, si el visitante tiene la extension,
// se apropia de sus clicks para dar el star con la sesion de github.com del
// navegador. La coordinacion con la pagina es 100% por atributos DOM:
// data-ghlike-ext="1" (extension presente), data-starred, data-busy,
// data-error, mas un CustomEvent "ghlike:update" por elemento.
(() => {
  if (window.__ghlikeBridge) return;
  window.__ghlikeBridge = true;

  const SELECTOR = "[data-ghlike-repo]";
  const mark = (el) => el.setAttribute("data-ghlike-ext", "1");

  const scan = (root) => {
    if (!root || !root.querySelectorAll) return;
    if (root.matches && root.matches(SELECTOR)) mark(root);
    root.querySelectorAll(SELECTOR).forEach(mark);
  };

  scan(document);
  // la landing puede renderizar los botones tarde: observar el DOM
  new MutationObserver((muts) => {
    for (const m of muts) {
      for (const n of m.addedNodes) {
        if (n.nodeType === Node.ELEMENT_NODE) scan(n);
      }
    }
  }).observe(document.documentElement, { childList: true, subtree: true });

  // captura: llega antes que cualquier handler de la propia pagina (fallback)
  document.addEventListener(
    "click",
    async (event) => {
      // sin interaccion real no hay star: el JS de la pagina no puede
      // sintetizar clicks (isTrusted=false) para dar likes sin que el usuario pulse
      if (!event.isTrusted) return;
      const host = event.target && event.target.closest ? event.target.closest(SELECTOR) : null;
      if (!host || host.getAttribute("data-ghlike-ext") !== "1") return;
      const repo = host.getAttribute("data-ghlike-repo");
      if (!repo || !/^[\w.\-]+\/[\w.\-]+$/.test(repo)) return;

      event.preventDefault();
      event.stopPropagation();

      const update = (detail) =>
        host.dispatchEvent(new CustomEvent("ghlike:update", { detail, bubbles: true }));

      host.setAttribute("data-busy", "1");
      host.removeAttribute("data-error");
      try {
        const reply = await chrome.runtime.sendMessage({ type: "ghlike:toggle", repo });
        if (reply && reply.ok) {
          host.setAttribute("data-starred", reply.starred ? "1" : "0");
          update({ ok: true, starred: !!reply.starred, error: null });
        } else {
          const error = (reply && reply.error) || "error";
          host.setAttribute("data-error", error);
          update({ ok: false, starred: null, error });
        }
      } catch (e) {
        const error = String(e && e.message) || "error";
        host.setAttribute("data-error", error);
        update({ ok: false, starred: null, error });
      } finally {
        host.removeAttribute("data-busy");
      }
    },
    true
  );
})();
