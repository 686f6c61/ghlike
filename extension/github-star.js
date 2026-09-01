// ghlike github-star: content script en github.com. Cuando el background abre
// una pestana con #ghlike-star / #ghlike-unstar / #ghlike-toggle / #ghlike-check,
// espera al boton de Star real, actua sobre el (GitHub gestiona su propio CSRF),
// verifica el cambio y reporta el resultado al background, que cierra la pestana.
(() => {
  if (!location.hash.startsWith("#ghlike-")) return;
  const action = location.hash.slice("#ghlike-".length);
  if (!["star", "unstar", "toggle", "check"].includes(action)) return;

  const repo = location.pathname.slice(1).replace(/\/+$/, "");
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const findBtn = () =>
    document.querySelector(
      'button[aria-label^="Star"], button[aria-label^="Unstar"], button[aria-label^="Starred"]'
    );
  const isStarred = (btn) =>
    !!btn &&
    ((btn.getAttribute("aria-label") || "").startsWith("Unstar") ||
      /Starred/i.test(btn.innerText || ""));

  const send = (msg) => {
    try {
      chrome.runtime.sendMessage(Object.assign({ type: "ghlike:result", repo }, msg));
    } catch (e) {
      /* el background ya pudo cerrar por timeout */
    }
  };

  (async () => {
    try {
      let btn = null;
      for (let i = 0; i < 40 && !(btn = findBtn()); i++) await sleep(500);

      if (/Page not found|404/i.test(document.title)) return send({ ok: false, error: "not-found" });
      const login = document.querySelector('meta[name="user-login"]');
      if (!login || !login.content) return send({ ok: false, error: "no-session" });
      if (!btn) return send({ ok: false, error: "markup-changed" });

      const before = isStarred(btn);
      if (action === "check") return send({ ok: true, starred: before });

      const desired = action === "toggle" ? !before : action === "star";
      if (before !== desired) {
        btn.click();
        let flipped = false;
        for (let i = 0; i < 30; i++) {
          await sleep(500);
          const b = findBtn();
          if (b && isStarred(b) === desired) {
            flipped = true;
            break;
          }
        }
        if (!flipped) return send({ ok: false, error: "no-flip" });
      }
      send({ ok: true, starred: desired });
    } catch (err) {
      send({ ok: false, error: String(err && err.message || err) });
    }
  })();
})();
