/* ============================================================
   ghlike — landing: idioma, tema, copiar, scrollspy, botón de
   star del hero (daemon local del CLI o pestaña nueva) y
   contador de stars (API pública de GitHub). Cero dependencias.
   ============================================================ */
(() => {
  "use strict";

  /* ---------- año del pie · footer year ---------- */
  document.getElementById("year").textContent = new Date().getFullYear();

  const html = document.documentElement;

  /* ---------- botón de star del hero (daemon local del CLI) ----------
     Si el visitante tiene el CLI instalado y `ghlike daemon` corriendo
     (http://127.0.0.1:8469), el botón da/quita la estrella sin salir
     de la página (~8-12 s: pulsa el Star real con su navegador).
     Sin daemon, el clic abre el repo en una pestaña nueva.
     Sonda moderada: un probe al cargar y, si falla, reintentos con
     backoff 4 s → 8 s → 16 s → 32 s y se para. Al hacer click se
     re-sondea una vez antes de caer al fallback (por si el daemon
     se acaba de arrancar).                                          */
  const starBtn = document.getElementById("star-btn");
  const starLbl = document.getElementById("star-lbl");
  const starErr = document.getElementById("star-error");
  const starsEl = document.getElementById("gh-stars");
  const LBL = { es: ["Like", "Liked"], en: ["Like", "Liked"] };
  const DAEMON = "http://127.0.0.1:8469";
  let starred = false;   // sin sesión no se puede saber el estado inicial
  let starCount = null;
  let daemonAlive = false;
  function renderStarBtn() {
    const lang = html.getAttribute("lang") === "en" ? "en" : "es";
    starLbl.textContent = LBL[lang][starred ? 1 : 0];
    starBtn.classList.toggle("liked", starred);
    starBtn.setAttribute("aria-pressed", starred ? "true" : "false");
    if (starCount !== null)
      starsEl.textContent = starCount.toLocaleString(lang === "es" ? "es-ES" : "en-US");
  }
  async function pingDaemon() {
    try {
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), 1500);
      const res = await fetch(DAEMON + "/ping", { signal: ctl.signal });
      clearTimeout(t);
      const info = await res.json().catch(() => null);
      return !!(res.ok && info && info.ok && info.service === "ghlike-daemon");
    } catch (e) { return false; }
  }
  (async function probeDaemon() {
    if (await pingDaemon()) { daemonAlive = true; return; }
    for (const wait of [4000, 8000, 16000, 32000]) {
      await new Promise((r) => setTimeout(r, wait));
      if (await pingDaemon()) { daemonAlive = true; return; }
    }
  })();
  function showStarError(detail) {
    starErr.classList.add("show");
    if (detail) starBtn.title = detail;
    setTimeout(() => starErr.classList.remove("show"), 6000);
  }
  starBtn.addEventListener("click", async () => {
    if (starBtn.getAttribute("data-busy") === "1") return;
    if (!daemonAlive) daemonAlive = await pingDaemon();
    if (!daemonAlive) {
      window.open("https://github.com/" + starBtn.getAttribute("data-ghlike-repo"), "_blank", "noopener");
      return;
    }
    starBtn.setAttribute("data-busy", "1");
    try {
      const res = await fetch(DAEMON + "/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repo: starBtn.getAttribute("data-ghlike-repo") }),
      });
      const info = await res.json().catch(() => null);
      if (res.ok && info && info.ok) {
        starred = !!info.starred;
        if (starCount !== null) starCount = Math.max(0, starCount + (starred ? 1 : -1));
        starErr.classList.remove("show");
        starBtn.removeAttribute("title");
      } else {
        showStarError((info && (info.error || info.message)) || ("HTTP " + res.status));
      }
    } catch (e) {
      daemonAlive = false; // daemon caído a mitad: la próxima vez, fallback
      showStarError(String((e && e.message) || e));
    } finally {
      starBtn.removeAttribute("data-busy");
      renderStarBtn();
    }
  });
  /* contador inicial · initial count (API pública de GitHub) */
  fetch("https://api.github.com/repos/686f6c61/ghlike")
    .then((res) => (res.ok ? res.json() : null))
    .then((info) => {
      if (!info || typeof info.stargazers_count !== "number") return;
      starCount = info.stargazers_count;
      renderStarBtn();
    })
    .catch(() => { /* sin red o sin cuota: se queda el placeholder · offline: keep placeholder */ });

  /* ---------- idioma · language ---------- */
  const TITLES = {
    es: "ghlike — stars de GitHub desde el terminal, sin tokens",
    en: "ghlike — GitHub stars from your terminal, no tokens",
  };
  function setLang(lang) {
    html.setAttribute("data-lang", lang);
    html.setAttribute("lang", lang);
    document.title = TITLES[lang];
    document.getElementById("lang-es").classList.toggle("on", lang === "es");
    document.getElementById("lang-en").classList.toggle("on", lang === "en");
    renderStarBtn();
    try { localStorage.setItem("ghlike-site-lang", lang); } catch (e) {}
  }
  document.getElementById("lang-es").addEventListener("click", () => setLang("es"));
  document.getElementById("lang-en").addEventListener("click", () => setLang("en"));
  let stored = null;
  try { stored = localStorage.getItem("ghlike-site-lang"); } catch (e) {}
  setLang(stored || ((navigator.language || "es").toLowerCase().startsWith("en") ? "en" : "es"));

  /* ---------- tema · theme ---------- */
  function setTheme(t) {
    html.setAttribute("data-theme", t);
    try { localStorage.setItem("ghlike-site-theme", t); } catch (e) {}
  }
  document.getElementById("themebtn").addEventListener("click", () =>
    setTheme(html.getAttribute("data-theme") === "dark" ? "light" : "dark"));
  let storedTheme = null;
  try { storedTheme = localStorage.getItem("ghlike-site-theme"); } catch (e) {}
  setTheme(storedTheme ||
    (window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"));

  /* ---------- copiar · copy buttons ---------- */
  const COPY_SVG = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M16 1H4a2 2 0 00-2 2v14h2V3h12V1zm3 4H8a2 2 0 00-2 2v14a2 2 0 002 2h11a2 2 0 002-2V7a2 2 0 00-2-2zm0 16H8V7h11v14z"/></svg>';
  const OK_SVG = '<svg class="ok" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z"/></svg>';
  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); return true; } catch (e) {}
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.cssText = "position:fixed;top:-999px;opacity:0";
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand("copy"); } catch (e) {}
    ta.remove();
    return ok;
  }
  document.addEventListener("click", (ev) => {
    const btn = ev.target.closest(".copybtn");
    if (!btn) return;
    const code = btn.closest(".code") && btn.closest(".code").querySelector("code");
    if (!code) return;
    copyText(code.textContent).then((ok) => {
      if (!ok) return;
      btn.innerHTML = OK_SVG;
      setTimeout(() => { btn.innerHTML = COPY_SVG; }, 1400);
    });
  });

  /* ---------- chips activos al hacer scroll · scrollspy ---------- */
  const chipMap = new Map();
  document.querySelectorAll(".chip[data-target]").forEach((c) => {
    const s = document.getElementById(c.dataset.target);
    if (s) chipMap.set(s, c);
  });
  if ("IntersectionObserver" in window && chipMap.size) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) {
          chipMap.forEach((c) => c.classList.remove("active"));
          chipMap.get(en.target).classList.add("active");
        }
      });
    }, { rootMargin: "-40% 0px -55% 0px" });
    chipMap.forEach((_, s) => io.observe(s));
  }
})();
