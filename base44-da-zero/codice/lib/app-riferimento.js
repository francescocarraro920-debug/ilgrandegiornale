/* Il Grande Giornale: router e viste della SPA.
   I dati arrivano dalle API del server (/api/...); qui si decide solo come mostrarli. */

const view = document.getElementById("view");
const fresh = document.getElementById("fresh");

/* ---------- Stato ---------- */
let META = null;
const SRC = {};
const TL = {};
const state = { orig: load("igg-orig") === "1", topic: "tutte", fonte: "tutte", dove: "tutte", open: {} };
const cache = new Map();          // url API -> {at, data}
let seenChanged = null;           // ultimo aggiornamento con notizie nuove, quando la vista è stata disegnata
let renderSeq = 0;
let searchSeq = 0;

function load(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function save(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

/* ---------- Utilità ---------- */
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const pl = (n, s, p) => n + " " + (n === 1 ? s : p);
const norm = (s) => String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const fmtTime = new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", hour: "2-digit", minute: "2-digit", hour12: false });
const fmtDay = new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", weekday: "long", day: "numeric", month: "long" });
const fmtShort = new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", day: "numeric", month: "short" });
const hm = (ts) => fmtTime.format(new Date(ts * 1000));
const dayDate = (d) => new Date(d + "T12:00:00Z");
const safeUrl = (u) => (/^https?:\/\//i.test(u || "") ? u : "#");
const LOWVAL = { live: 1, bollettino: 1, anteprima: 1 };

async function api(path, maxAge = 0) {
  const hit = cache.get(path);
  if (hit && Date.now() - hit.at < maxAge) return hit.data;
  const r = await fetch("/api/" + path, { headers: { Accept: "application/json" } });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error("HTTP " + r.status);
  const data = await r.json();
  cache.set(path, { at: Date.now(), data });
  return data;
}

/* Un "contesto" tiene gli articoli e le storie di una risposta, indicizzati per id */
const ARTS = new Map();            // tutti gli articoli visti, per la scheda che invita a leggerli
function ctx(articles, stories) {
  const A = {}, ST = {};
  (articles || []).forEach((a) => { A[a.id] = a; ARTS.set(a.id, a); });
  (stories || []).forEach((s) => { ST[s.id] = s; });
  return { A, ST };
}

/* ---------- Piccoli pezzi ---------- */
function parts(a) {
  const it = a.it, o = a.o;
  if (it && o) {
    return state.orig ? { main: { txt: o, lang: a.l }, sub: { txt: it, lang: "it" } } : { main: { txt: it, lang: "it" }, sub: { txt: o, lang: a.l } };
  }
  return { main: { txt: it || o, lang: it ? "it" : a.l }, sub: null };
}
const langBadge = (a) => (a.l !== "it" ? `<span class="badge" title="Lingua originale">${esc(a.l.toUpperCase())}</span>` : "");
function tipoTag(a) {
  const m = { live: "Live", bollettino: "Notiziario", anteprima: "Anteprima", opinione: "Commento" };
  return m[a.x] ? `<span class="tag tag--${a.x}">${m[a.x]}</span>` : "";
}
// I link alle testate aprono prima la scheda d'invito alla lettura (vedi readOpen)
const ext = (a) => `href="${esc(safeUrl(a.u))}" target="_blank" rel="noopener" data-art="${esc(a.id)}"`;
const hasStory = (a) => !!a.st;
const linkFor = (a) => (hasStory(a) ? `href="/storia/${esc(a.st)}"` : ext(a));
function srcNames(s, max) {
  const names = s.srcs.map((k) => (SRC[k] ? SRC[k].n : k));
  return names.slice(0, max).join(" · ") + (names.length > max ? " e altre " + (names.length - max) : "");
}
const srcName = (k) => (SRC[k] ? SRC[k].n : k);
const ccName = (k) => (META.countries[SRC[k]?.cc] || "");

function timelineHTML(s, C, big) {
  const arts = s.arts.map((id) => C.A[id]).filter(Boolean).sort((p, q) => p.ts - q.ts);
  if (!arts.length) return "";
  const min = arts[0].ts, max = arts[arts.length - 1].ts, span = Math.max(max - min, 1200);
  const ticks = arts.map((a, i) => `<i class="${i === 0 ? "first" : ""}" style="left:${(((a.ts - min) / span) * 100).toFixed(2)}%" title="${esc(srcName(a.s))} · ${a.t}"></i>`).join("");
  return `<figure class="tl${big ? " tl--big" : ""}" aria-label="Copertura nel tempo: prima testata alle ${hm(min)}, ultima alle ${hm(max)}">
    <div class="tl__bar">${ticks}</div>
    <figcaption class="tl__cap mono"><span>${hm(min)} · prima ${esc(srcName(arts[0].s))}</span><span>${pl(arts.length, "articolo", "articoli")}</span><span>${hm(max)}</span></figcaption></figure>`;
}

/* Quattro titoli, possibilmente da paesi diversi e con l'originale in lingua */
function pickTakes(s, C, n) {
  const bySrc = {};
  s.arts.map((id) => C.A[id]).filter(Boolean).forEach((a) => {
    if (LOWVAL[a.x]) return;
    const cur = bySrc[a.s];
    if (!cur || (!cur.o && a.o)) bySrc[a.s] = a;
  });
  const list = Object.values(bySrc).sort((p, q) => (q.o ? 1 : 0) - (p.o ? 1 : 0) || q.ts - p.ts);
  const out = [], ccs = {};
  list.forEach((a) => { const cc = SRC[a.s]?.cc; if (out.length < n && !ccs[cc]) { ccs[cc] = 1; out.push(a); } });
  list.forEach((a) => { if (out.length < n && !out.includes(a)) out.push(a); });
  return out;
}

function takeHTML(a) {
  const p = parts(a), name = srcName(a.s);
  return `<a class="take" ${ext(a)}>
    <span class="take__m"><span class="mono acc">${esc(name)}</span>${langBadge(a)}<span class="mono muted">${a.t}</span></span>
    <span class="take__t" lang="${p.main.lang}">${esc(p.main.txt)}</span>
    ${p.sub ? `<span class="take__o" lang="${p.sub.lang}">${esc(p.sub.txt)}</span>` : ""}
    <span class="mono take__go">Vai a ${esc(name)} ↗</span></a>`;
}

/* inHero: la storia è già nella copertina con foto e titolo grande, qui il titolo si ripete in piccolo */
function leadHTML(s, C, label, inHero) {
  // Nel magazine la prima notizia apre con la sua foto grande e il titolo sopra, come sul sito
  if (curStyle() === "magazine" && s.img && !inHero) return `<article class="lead lead--cover">
    <a class="lead__cover" href="/storia/${esc(s.id)}"><img src="${esc(s.img)}" alt="" fetchpriority="high" decoding="async" referrerpolicy="no-referrer" onerror="this.parentNode.classList.add('no-img');this.remove()">
      <span class="lead__over"><span class="kick"><span class="chip">${esc(label)}</span><span class="mono"><b>${pl(s.n, "testata", "testate")}</b></span><span class="mono">${esc(TL[s.k])} · ${esc(s.w)} · ${hm(s.last)}</span></span>
        <h2 class="lead__t">${esc(s.t)}</h2>${s.d ? `<span class="lead__d">${esc(s.d)}</span>` : ""}</span></a>
    ${s.img_s ? `<p class="mono lead__credit">Foto · ${esc(srcName(s.img_s))}</p>` : ""}
    <p class="mono srcline">Ne parlano <b>${esc(srcNames(s, 5))}</b></p>
    ${timelineHTML(s, C, false)}
    <h3 class="mono takes__h">Come lo raccontano</h3>
    <div class="takes">${pickTakes(s, C, 4).map(takeHTML).join("")}</div>
    <a class="more mono" href="/storia/${esc(s.id)}">Tutte le ${s.n} testate →</a></article>`;
  return `<article class="lead">
    <div class="kick"><span class="chip">${esc(label)}</span><span class="mono"><b>${pl(s.n, "testata", "testate")}</b></span><span class="mono muted">${esc(TL[s.k])} · ${esc(s.w)}</span><span class="mono muted">Aggiornata alle ${hm(s.last)}</span></div>
    <h2 class="lead__t${inHero ? " lead__t--echo" : ""}"><a href="/storia/${esc(s.id)}">${esc(s.t)}</a></h2>
    ${inHero ? "" : photoHTML(s.img, s.img_s, "pic--lead", s.t)}
    ${s.d ? `<p class="lead__d">${esc(s.d)}</p>` : ""}
    <p class="mono srcline">Ne parlano <b>${esc(srcNames(s, 5))}</b></p>
    ${timelineHTML(s, C, false)}
    <h3 class="mono takes__h">Come lo raccontano</h3>
    <div class="takes">${pickTakes(s, C, 4).map(takeHTML).join("")}</div>
    <a class="more mono" href="/storia/${esc(s.id)}">Tutte le ${s.n} testate →</a></article>`;
}

/* Le foto restano sul sito della testata: si caricano da lì, con il credito, senza copiarle */
function photoHTML(url, src, cls, alt) {
  if (!url || !/^https?:\/\//i.test(url)) return "";
  return `<figure class="pic ${cls}"><img src="${esc(url)}" alt="${esc(alt || "")}" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.closest('figure').remove()">${src ? `<figcaption class="mono">Foto · ${esc(srcName(src))}</figcaption>` : ""}</figure>`;
}

/* ---------- Invito alla lettura ----------
   Toccando un articolo di una testata non si salta subito sul suo sito: si apre una scheda con la
   testata, la foto, il titolo e le prime righe, e un grande pulsante per leggerlo sul giornale che
   l'ha pubblicato. Su telefono sale dal basso, su computer compare al centro. */
let readFrom = null;
const DESC = new Map();

function readBox() {
  let d = document.getElementById("read");
  if (!d) {
    d = document.createElement("dialog");
    d.id = "read";
    d.className = "read";
    d.setAttribute("aria-labelledby", "read-t");
    // Un tocco fuori dalla scheda la chiude
    d.addEventListener("click", (e) => { if (e.target === d) readClose(); });
    d.addEventListener("close", () => { document.documentElement.classList.remove("has-read"); if (readFrom) readFrom.focus({ preventScroll: true }); readFrom = null; });
    document.body.appendChild(d);
  }
  return d;
}

function readOpen(id, from) {
  const a = ARTS.get(id);
  if (!a) return;
  const d = readBox(), p = parts(a), name = srcName(a.s), cc = SRC[a.s]?.cc || "";
  let host = "";
  try { host = new URL(a.u).hostname.replace(/^www\./, ""); } catch (e) {}
  const here = location.pathname === "/storia/" + a.st;
  const live = a.x === "live";
  d.innerHTML = `<div class="read__panel">
    <button class="read__x" type="button" data-act="read-close" aria-label="Chiudi">×</button>
    <p class="read__src"><span class="read__name">${esc(name)}</span>${langBadge(a)}${live ? '<span class="tag tag--live">Diretta</span>' : ""}</p>
    <p class="mono muted read__meta">${esc(cc)} · ${esc(ccName(a.s))} · ${esc(TL[a.k] || "")} · pubblicato alle ${a.t}</p>
    ${a.img ? `<figure class="read__pic"><img src="${esc(a.img)}" alt="" decoding="async" referrerpolicy="no-referrer" onerror="this.parentNode.remove()"></figure>` : ""}
    <h2 class="read__t" id="read-t" lang="${p.main.lang}">${esc(p.main.txt)}</h2>
    ${p.sub ? `<p class="read__o" lang="${p.sub.lang}">${esc(p.sub.txt)}</p>` : ""}
    <p class="read__d" lang="${a.l}" aria-busy="true"><span class="sk sk--l"></span><span class="sk sk--s"></span></p>
    <div class="read__cta"><a class="read__go" href="${esc(safeUrl(a.u))}" target="_blank" rel="noopener">Leggi l’articolo su ${esc(name)}<span aria-hidden="true">↗</span></a>
      ${host ? `<span class="mono muted read__host">${esc(host)}</span>` : ""}</div>
    <p class="read__note">L’articolo completo è sul sito di <b>${esc(name)}</b>. Il Grande Giornale raccoglie i titoli e ti porta alla fonte: leggerlo lì sostiene il lavoro di chi l’ha scritto.</p>
    ${a.st && !here ? `<a class="mono read__story" href="/storia/${esc(a.st)}">Come lo raccontano le altre testate →</a>` : ""}
  </div>`;
  d.querySelector(".read__go").addEventListener("click", () => setTimeout(() => readClose(), 150));
  readFrom = from || null;
  document.documentElement.classList.add("has-read");
  if (typeof d.showModal === "function") d.showModal(); else d.setAttribute("open", "");
  d.querySelector(".read__go").focus({ preventScroll: true });
  readDesc(id, d);
}

/* Le prime righe arrivano dal server solo per l'articolo aperto */
async function readDesc(id, d) {
  let t = DESC.get(id);
  if (t === undefined) {
    try { const r = await fetch("/api/article/" + encodeURIComponent(id)); t = r.ok ? ((await r.json()).desc || "") : ""; } catch (e) { t = ""; }
    DESC.set(id, t);
  }
  const box = d.open && d.querySelector(".read__d");
  if (!box) return;
  box.removeAttribute("aria-busy");
  if (t) { box.textContent = t; box.classList.add("is-in"); } else box.remove();
}

function readClose(now) {
  const d = document.getElementById("read");
  if (!d || !d.open) return;
  const reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (now || reduce) { d.close(); return; }
  d.classList.add("is-closing");
  setTimeout(() => { d.classList.remove("is-closing"); if (d.open) d.close(); }, 200);
}

/* ---------- Copertina della prima pagina ----------
   Una foto a tutta larghezza per ciascuna delle storie più seguite che ne hanno una; scorre da sola
   ogni 7 secondi e il titolo sotto cambia con lei. Si ferma passandoci sopra, con il fuoco della
   tastiera, con il pulsante Pausa e quando la scheda del browser non è visibile. */
const HERO_MS = 7000;
const HERO_MAX = 6;
let hero = null;

function heroHTML(items) {
  const two = (n) => String(n).padStart(2, "0");
  const slides = items.map((s, i) => `<a class="hero__slide${i ? "" : " is-on"}" href="/storia/${esc(s.id)}" tabindex="${i ? -1 : 0}" aria-hidden="${i ? "true" : "false"}">
      <img src="${esc(s.img)}" alt="${esc(s.t)}" ${i ? 'loading="lazy"' : 'fetchpriority="high"'} decoding="async" referrerpolicy="no-referrer"></a>`).join("");
  const caps = items.map((s, i) => `<div class="hero__cap${i ? "" : " is-on"}" aria-hidden="${i ? "true" : "false"}">
      <p class="kick"><span class="chip">${two(i + 1)} / ${two(items.length)}</span><span class="mono"><b>${pl(s.n, "testata", "testate")}</b></span><span class="mono muted">${esc(TL[s.k])} · ${esc(s.w)}</span></p>
      <h2 class="hero__t"><a href="/storia/${esc(s.id)}" tabindex="${i ? -1 : 0}">${esc(s.t)}</a></h2>
      <p class="mono muted hero__credit">Foto · ${esc(srcName(s.img_s))} · aggiornata alle ${hm(s.last)}</p></div>`).join("");
  const many = items.length > 1;
  const dots = items.map((s, i) => `<button class="hero__dot" type="button" data-act="hero-go" data-k="${i}" aria-label="Storia ${i + 1} di ${items.length}" aria-current="${i === 0}"></button>`).join("");
  return `<section class="hero${many ? "" : " is-single"}" aria-roledescription="carosello" aria-label="Le notizie in primo piano">
    <div class="hero__frame"><div class="hero__track">${slides}</div>
      ${many ? `<button class="hero__nav hero__nav--prev" type="button" data-act="hero-prev" aria-label="Storia precedente"><span aria-hidden="true">‹</span></button>
      <button class="hero__nav hero__nav--next" type="button" data-act="hero-next" aria-label="Storia successiva"><span aria-hidden="true">›</span></button>
      <div class="hero__progress" aria-hidden="true"><i></i></div>` : ""}</div>
    <div class="wrap hero__below"><div class="hero__caps">${caps}</div>
      ${many ? `<div class="hero__ctrl"><div class="hero__dots" role="group" aria-label="Scegli la storia">${dots}</div>
        <button class="mono hero__pause" type="button" data-act="hero-pause" aria-pressed="false">Pausa</button></div>` : ""}</div></section>`;
}

function heroStop() {
  if (hero) clearInterval(hero.timer);
  hero = null;
}

function heroTick() {
  clearInterval(hero.timer);
  hero.timer = setInterval(() => {
    if (hero && !hero.paused && !hero.hold && !document.hidden) heroGo(hero.i + 1);
  }, HERO_MS);
  const bar = hero.el.querySelector(".hero__progress i");
  if (bar) { bar.style.animation = "none"; void bar.offsetWidth; bar.style.animation = ""; }
}

function heroStart() {
  heroStop();
  const el = document.querySelector(".hero");
  if (!el) return;
  const n = el.querySelectorAll(".hero__slide").length;
  hero = { el, i: 0, n, paused: false, hold: false, timer: null, x0: null, swiped: false };
  if (n < 2) return;
  if (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches) heroPause(true);
  // Quando si riparte, il conto alla rovescia ricomincia da capo insieme alla barra
  const hold = (v) => () => { if (hero) { hero.hold = v; el.classList.toggle("is-held", v); if (!v && !hero.paused) heroTick(); } };
  el.addEventListener("mouseenter", hold(true));
  el.addEventListener("mouseleave", hold(false));
  el.addEventListener("focusin", hold(true));
  el.addEventListener("focusout", hold(false));
  // Scorrimento col dito (o col mouse): a sinistra la successiva, a destra la precedente
  const frame = el.querySelector(".hero__frame");
  frame.addEventListener("pointerdown", (e) => { if (hero) hero.x0 = e.clientX; });
  frame.addEventListener("pointerup", (e) => {
    if (!hero || hero.x0 == null) return;
    const dx = e.clientX - hero.x0;
    hero.x0 = null;
    if (Math.abs(dx) > 40) { hero.swiped = true; heroGo(hero.i + (dx < 0 ? 1 : -1), true); }
  });
  frame.addEventListener("click", (e) => { if (hero && hero.swiped) { e.preventDefault(); hero.swiped = false; } }, true);
  heroTick();
}

function heroGo(i, byUser) {
  if (!hero || hero.n < 2) return;
  const { el, n } = hero;
  hero.i = ((i % n) + n) % n;
  el.querySelectorAll(".hero__slide").forEach((s, k) => {
    const on = k === hero.i;
    s.classList.toggle("is-on", on); s.setAttribute("aria-hidden", String(!on)); s.tabIndex = on ? 0 : -1;
  });
  el.querySelectorAll(".hero__cap").forEach((c, k) => {
    const on = k === hero.i;
    c.classList.toggle("is-on", on); c.setAttribute("aria-hidden", String(!on));
    const a = c.querySelector("a"); if (a) a.tabIndex = on ? 0 : -1;
  });
  el.querySelectorAll(".hero__dot").forEach((d, k) => d.setAttribute("aria-current", String(k === hero.i)));
  // Il titolo nuovo si annuncia ai lettori di schermo solo quando a cambiarlo è il lettore
  el.querySelector(".hero__caps").setAttribute("aria-live", byUser ? "polite" : "off");
  if (byUser) heroTick();
}

function heroPause(force) {
  if (!hero) return;
  hero.paused = force === undefined ? !hero.paused : force;
  hero.el.classList.toggle("is-paused", hero.paused);
  const b = hero.el.querySelector(".hero__pause");
  if (b) { b.setAttribute("aria-pressed", String(hero.paused)); b.textContent = hero.paused ? "Riprendi" : "Pausa"; }
  if (!hero.paused) heroTick();
}

/* ---------- Globo della prima pagina ----------
   I paesi delle notizie dell'edizione, colorati per quante testate ne parlano; toccandone uno
   (sul globo o nell'elenco sotto) compaiono le sue storie. Il disegno è in globe.js. */
const ISO = {
  "Italia": "380", "Francia": "250", "Germania": "276", "Spagna": "724", "Regno Unito": "826", "Stati Uniti": "840",
  "Russia": "643", "Ucraina": "804", "Cina": "156", "Giappone": "392", "India": "356", "Israele": "376", "Palestina": "275",
  "Iran": "364", "Libano": "422", "Siria": "760", "Iraq": "368", "Arabia Saudita": "682", "Yemen": "887", "Turchia": "792",
  "Egitto": "818", "Venezuela": "862", "Brasile": "076", "Argentina": "032", "Messico": "484", "Canada": "124",
  "Colombia": "170", "Cile": "152", "Serbia": "688", "Bulgaria": "100", "Romania": "642", "Polonia": "616",
  "Ungheria": "348", "Repubblica Ceca": "203", "Austria": "040", "Svizzera": "756", "Belgio": "056", "Paesi Bassi": "528",
  "Portogallo": "620", "Grecia": "300", "Irlanda": "372", "Svezia": "752", "Norvegia": "578", "Danimarca": "208",
  "Finlandia": "246", "Moldavia": "498", "Georgia": "268", "Bielorussia": "112", "Afghanistan": "004", "Pakistan": "586",
  "Corea del Nord": "408", "Corea del Sud": "410", "Taiwan": "158", "Filippine": "608", "Indonesia": "360",
  "Australia": "036", "Nigeria": "566", "Sudan": "729", "Etiopia": "231", "Sudafrica": "710", "Congo": "180",
  "Uganda": "800", "Kenya": "404", "Libia": "434", "Tunisia": "788", "Algeria": "012", "Marocco": "504", "Niger": "562",
  "Mali": "466", "Giordania": "400", "Qatar": "634", "Emirati Arabi": "784", "Cuba": "192", "Haiti": "332",
};
const HOT = 5;                       // da quante testate un paese è "caldo" (rosso invece che giallo)
let globe = null, GLOBE = null;
const isPop = () => document.documentElement.getAttribute("data-style") === "pop";

function globeData(win, elig) {
  const by = new Map();
  win.forEach((a) => {
    const id = ISO[a.w];
    if (!id) return;
    if (!by.has(id)) by.set(id, { id, name: a.w, srcs: new Set(), arts: [] });
    const c = by.get(id);
    c.srcs.add(a.s);
    c.arts.push(a);
  });
  const list = [...by.values()].map((c) => ({ ...c, n: c.srcs.size, hot: c.srcs.size >= HOT, stories: elig.filter((s) => s.w === c.name) }));
  return list.sort((p, q) => q.n - p.n || q.arts.length - p.arts.length);
}

function globeHTML(list, sel, E) {
  const chips = list.map((c) => `<a class="gchip${c.hot ? " is-hot" : ""}" href="/paese/${slugOf(c.name)}" data-country="${c.id}"><i aria-hidden="true"></i>${esc(c.name)} <b>${c.n}</b></a>`).join("");
  return `<section class="globe" aria-labelledby="globe-t"><div class="wrap globe__in">
    <div class="globe__head"><div class="globe__intro">
      <p class="mono">Il mondo adesso · Edizione ${esc(E.of)}</p>
      <h2 class="globe__t" id="globe-t">Dove si parla <em>di cosa.</em></h2>
      <p class="globe__help">Trascina il globo per farlo girare, avvicinalo con due dita o con + e −. Passa sopra un paese per i suoi numeri, toccalo per aprire le sue notizie.</p>
      <ul class="globe__legend mono"><li><i style="background:var(--g-low)"></i>1–${HOT - 1} testate</li><li><i style="background:var(--g-high)"></i>${HOT} o più</li><li><i style="background:var(--g-land)"></i>Nessuna notizia</li></ul></div>
      <div class="ginfo" id="ginfo" hidden></div></div>
    <div class="globe__stage"><canvas class="globe__cv" role="img" aria-label="Globo con i paesi di cui parlano le testate in questa edizione. Per aprirne uno con la tastiera usa l’elenco dei paesi."></canvas>
      <div class="globe__tip" hidden></div>
      <div class="globe__ctrl"><button type="button" data-act="globe-zoom" data-k="1.5" aria-label="Avvicina">+</button><button type="button" data-act="globe-zoom" data-k="0.667" aria-label="Allontana">−</button>
        <button type="button" data-act="globe-spin" aria-pressed="false" aria-label="Ferma la rotazione automatica">❚❚</button></div></div>
    <nav class="globe__chips" aria-label="Paesi nelle notizie">${chips}</nav>
  </div></section>`;
}

function globeStop() {
  if (globe) globe.destroy();
  globe = null;
}

async function globeStart() {
  globeStop();
  const stage = document.querySelector(".globe__stage");
  if (!stage || !GLOBE) return;
  const seq = renderSeq;
  try {
    const { mountGlobe } = await import("/globe.js");
    const data = new Map(GLOBE.list.map((c) => [c.id, { name: c.name, n: c.n, hot: c.hot }]));
    const g = await mountGlobe(stage, { data, selected: GLOBE.sel, onPick: countryGo, onHover: globeInfo });
    if (seq !== renderSeq || !stage.isConnected) { g.destroy(); return; }
    globe = g;
    const b = document.querySelector('[data-act="globe-spin"]');
    if (b) syncSpin(b);
  } catch (e) {
    stage.insertAdjacentHTML("beforeend", `<p class="globe__msg mono">Il globo non si è caricato (${esc(e.message)}). I paesi sono nell’elenco qui sotto.</p>`);
  }
}

function syncSpin(b) {
  const on = globe ? globe.spinning() : false;
  b.setAttribute("aria-pressed", String(!on));
  b.setAttribute("aria-label", on ? "Ferma la rotazione automatica" : "Fai girare il globo da solo");
  b.textContent = on ? "❚❚" : "⟳";
}

/* A sinistra del globo, al posto del titolo, i numeri del paese sotto il puntatore (o della
   pillola che ha il fuoco della tastiera): testate, notizie, storie, lingue, paesi delle testate,
   le sezioni in cui compare e il titolo più seguito. */
function globeInfo(id) {
  const box = document.getElementById("ginfo");
  const intro = document.querySelector(".globe__intro");
  if (!box || !intro) return;
  const c = id && GLOBE && GLOBE.list.find((x) => x.id === id);
  box.closest(".globe__head").classList.toggle("is-info", !!c);
  if (!c) { box.hidden = true; intro.removeAttribute("aria-hidden"); return; }
  const langs = new Set(c.arts.map((a) => a.l)).size;
  const from = new Set(c.arts.map((a) => SRC[a.s] && SRC[a.s].cc)).size;
  const per = {};
  c.arts.forEach((a) => { per[a.k] = (per[a.k] || 0) + 1; });
  const secs = Object.entries(per).sort((p, q) => q[1] - p[1]).slice(0, 4);
  const max = secs.length ? secs[0][1] : 1;
  const last = c.arts.reduce((m, a) => Math.max(m, a.ts), 0);
  const top = c.stories[0];
  const num = (n, label) => `<div><dd>${n}</dd><dt class="mono">${label}</dt></div>`;
  box.innerHTML = `<p class="mono">${c.hot ? "Paese caldo" : "Paese"} · aggiornato alle ${hm(last)}</p>
    <h3 class="ginfo__t">${esc(c.name)}</h3>
    <dl class="ginfo__n">${num(c.n, c.n === 1 ? "testata" : "testate")}${num(c.arts.length, c.arts.length === 1 ? "notizia" : "notizie")}${num(c.stories.length, c.stories.length === 1 ? "storia" : "storie")}${num(langs, langs === 1 ? "lingua" : "lingue")}${num(from, from === 1 ? "paese che scrive" : "paesi che scrivono")}</dl>
    <ul class="ginfo__bars">${secs.map(([k, n]) => `<li><span class="mono">${esc(TL[k])}</span><i style="--w:${Math.round(n / max * 100)}%"></i><b>${n}</b></li>`).join("")}</ul>
    ${top ? `<p class="ginfo__top"><span class="mono">La più seguita · ${pl(top.n, "testata", "testate")}</span>${esc(top.t)}</p>` : ""}
    <p class="mono ginfo__go">Tocca il paese per aprire le sue notizie →</p>`;
  box.hidden = false;
  intro.setAttribute("aria-hidden", "true");
}

/* Dal globo alla pagina del paese: il globo vola sul paese e si avvicina, poi un cerchio di colore
   si allarga dal globo con il nome del paese e, sotto, si apre la pagina. Con "riduci movimento"
   si va subito alla pagina. */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const slugOf = (name) => norm(name).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
let going = false;

async function countryGo(id) {
  const name = Object.keys(ISO).find((n) => ISO[n] === id);
  if (!name || going) return;
  const href = "/paese/" + slugOf(name);
  const reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const stage = document.querySelector(".globe__stage");
  if (reduce || !globe || !stage) { go(href); return; }
  going = true;
  try {
    globe.select(id);
    // Se l'animazione si blocca (scheda in secondo piano) si prosegue lo stesso
    await Promise.race([globe.flyTo(id, { fit: true, ms: 1000 }), sleep(1500)]);
    const r = stage.getBoundingClientRect();
    const ov = document.createElement("div");
    ov.className = "iris";
    ov.setAttribute("aria-hidden", "true");
    ov.style.setProperty("--x", Math.round(r.left + r.width / 2) + "px");
    ov.style.setProperty("--y", Math.round(r.top + r.height / 2) + "px");
    ov.innerHTML = `<span class="iris__t">${esc(name)}</span>`;
    document.body.appendChild(ov);
    await sleep(620);
    await go(href);
    ov.classList.add("is-out");
    await sleep(500);
    ov.remove();
  } finally {
    going = false;
  }
}

/* ---------- Pagina del paese ----------
   Titolo grande, le notizie principali in grande a scorrimento laterale, poi a scendere l'elenco
   delle storie e di tutte le notizie delle ultime 36 ore che parlano di quel paese. */
const COUNTRY_HOURS = 36;
const COUNTRY_SLIDES = 8;

async function renderCountry(slug) {
  const name = Object.keys(ISO).find((n) => slugOf(n) === slug);
  if (!name) return render404();
  const D = await api("day", 30000);
  const C = ctx(D.articles, D.stories);
  const since = D.now - COUNTRY_HOURS * 3600;
  const arts = D.articles.filter((a) => a.w === name && a.ts <= D.now && a.ts >= since).sort((p, q) => q.ts - p.ts);
  const stories = D.stories.filter((s) => s.w === name && s.solid >= 2);
  const inStory = new Set(stories.map((s) => s.id));
  const papers = new Set(arts.map((a) => a.s));
  // In grande: prima le storie raccontate da più testate, poi le notizie singole con una foto
  const slides = stories.slice(0, COUNTRY_SLIDES).map((s) => ({ s }))
    .concat(arts.filter((a) => a.img && !(a.st && inStory.has(a.st))).slice(0, Math.max(0, COUNTRY_SLIDES - stories.length)).map((a) => ({ a })));
  const two = (n) => String(n).padStart(2, "0");
  const slideHTML = (x, i) => {
    if (x.s) {
      const s = x.s;
      return `<li class="cs__slide"><a class="cs__card" href="/storia/${esc(s.id)}">
        ${s.img ? `<span class="cs__img"><img src="${esc(s.img)}" alt="" loading="${i ? "lazy" : "eager"}" decoding="async" referrerpolicy="no-referrer" onerror="this.parentNode.remove()"></span>` : ""}
        <span class="cs__body"><span class="kick"><span class="chip">${two(i + 1)} / ${two(slides.length)}</span><span class="mono"><b>${pl(s.n, "testata", "testate")}</b></span><span class="mono">${esc(TL[s.k])} · ${hm(s.last)}</span></span>
        <span class="cs__t">${esc(s.t)}</span><span class="cs__s">${esc(srcNames(s, 4))}</span></span></a></li>`;
    }
    const a = x.a, p = parts(a);
    return `<li class="cs__slide"><a class="cs__card" ${linkFor(a)}>
      <span class="cs__img"><img src="${esc(a.img)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.parentNode.remove()"></span>
      <span class="cs__body"><span class="kick"><span class="chip">${two(i + 1)} / ${two(slides.length)}</span><span class="mono"><b>${esc(srcName(a.s))}</b></span><span class="mono">${esc(TL[a.k])} · ${a.t}</span></span>
      <span class="cs__t" lang="${p.main.lang}">${esc(p.main.txt)}</span>${p.sub ? `<span class="cs__s" lang="${p.sub.lang}">${esc(p.sub.txt)}</span>` : ""}</span></a></li>`;
  };
  const carousel = slides.length ? `<section class="cs" aria-label="In primo piano">
      <div class="cs__head"><h2 class="mono">In primo piano</h2>
        ${slides.length > 1 ? `<div class="cs__nav"><button type="button" class="cs__btn" data-act="cs-prev" aria-label="Notizia precedente">←</button><span class="mono cs__count" aria-live="polite">1 / ${slides.length}</span><button type="button" class="cs__btn" data-act="cs-next" aria-label="Notizia successiva">→</button></div>` : ""}</div>
      <ol class="cs__track" tabindex="0" aria-label="Notizie principali: scorri di lato">${slides.map(slideHTML).join("")}</ol></section>` : "";
  const list = stories.length ? `<section class="sec country__stories"><h2 class="sec-h">Le notizie <span class="mono muted">${pl(stories.length, "raccontata", "raccontate")} da più testate</span></h2>
      <ol class="country__list">${stories.map((s) => `<li><a href="/storia/${esc(s.id)}"><span class="mono muted">${pl(s.n, "testata", "testate")} · ${esc(TL[s.k])} · ${hm(s.last)}</span><span class="country__lt">${esc(s.t)}</span></a></li>`).join("")}</ol></section>` : "";
  const rows = arts.length ? `<section class="sec"><h2 class="sec-h">Tutte le notizie <span class="mono muted">${pl(arts.length, "notizia", "notizie")} · ultime ${COUNTRY_HOURS} ore</span></h2><ol class="rows">${rowsHTML(arts, C, "pa")}</ol></section>` : "";
  return {
    title: name, nav: "", watch: true, after: csStart,
    html: `<div class="wrap page country">
      <a class="back mono" href="/">← Il mondo</a>
      <header class="country__h"><p class="mono">Paese · notizie delle ultime ${COUNTRY_HOURS} ore</p><h1 class="country__t">${esc(name)}</h1>
        <p class="country__d">${arts.length ? `Ne parlano <b>${pl(papers.size, "testata", "testate")}</b>: ${pl(arts.length, "notizia", "notizie")}, ${pl(stories.length, "storia", "storie")} raccontate da più giornali.` : "In questo momento nessuna testata ne parla."}</p></header>
      ${carousel}${list}${rows}
      ${arts.length ? "" : `<div class="empty"><h2 class="empty__t">Nessuna notizia da qui nelle ultime ${COUNTRY_HOURS} ore.</h2><a class="btn" href="/">Torna al globo</a></div>`}</div>`,
  };
}

/* Notizie grandi a scorrimento laterale: lo scatto lo fa il browser, qui solo frecce e contatore */
function csStart() {
  const track = document.querySelector(".cs__track");
  if (!track) return;
  const count = document.querySelector(".cs__count");
  const n = track.children.length;
  let t = 0;
  track.addEventListener("scroll", () => {
    clearTimeout(t);
    t = setTimeout(() => { if (count) count.textContent = `${csIndex(track) + 1} / ${n}`; }, 80);
  }, { passive: true });
}

function csIndex(track) {
  const first = track.children[0];
  const step = first ? first.getBoundingClientRect().width + parseFloat(getComputedStyle(track).columnGap || 0) : track.clientWidth;
  return Math.round(track.scrollLeft / step);
}

function csMove(d) {
  const track = document.querySelector(".cs__track");
  if (!track) return;
  const i = Math.max(0, Math.min(track.children.length - 1, csIndex(track) + d));
  const reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  track.scrollTo({ left: track.children[i].offsetLeft - track.offsetLeft, behavior: reduce ? "auto" : "smooth" });
}

function cardHTML(s) {
  return `<a class="card${s.img ? " has-img" : ""}" href="/storia/${esc(s.id)}">${photoHTML(s.img, s.img_s, "pic--card", "")}
    <span class="mono card__k"><b class="acc">${pl(s.n, "testata", "testate")}</b> · ${esc(TL[s.k])} · ${esc(s.w)}</span>
    <span class="card__t">${esc(s.t)}</span>
    <span class="card__s">${esc(srcNames(s, 4))}</span>
    <span class="mono muted">Aggiornata alle ${hm(s.last)}</span></a>`;
}

function rowHTML(a, C) {
  const p = parts(a), s = a.st && C.ST[a.st];
  const thumb = a.img ? `<a class="row__img" ${linkFor(a)} tabindex="-1" aria-hidden="true"><img src="${esc(a.img)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.closest('.row__img').remove()"></a>` : "";
  return `<li class="row${a.img ? " has-img" : ""}"><div class="row__meta mono"><time>${a.t}</time><span>${esc(ccName(a.s))}</span></div>
    <div class="row__b"><div class="row__src">${favMark(a.s)}<span class="mono acc">${esc(srcName(a.s))}</span>${langBadge(a)}${tipoTag(a)}${s ? `<span class="mono muted">Storia · ${pl(s.n, "testata", "testate")}</span>` : hasStory(a) ? `<span class="mono muted">Storia</span>` : ""}</div>
    <a class="row__t" ${linkFor(a)} lang="${p.main.lang}">${esc(p.main.txt)}${hasStory(a) ? "" : '<span class="ext" aria-hidden="true"> ↗</span>'}</a>
    ${p.sub ? `<p class="row__o" lang="${p.sub.lang}">${esc(p.sub.txt)}</p>` : ""}</div>${thumb}</li>`;
}

/* Al massimo due titoli di fila dalla stessa testata; gli altri si aprono a richiesta */
function rowsHTML(arts, C, prefix) {
  let html = "", i = 0;
  while (i < arts.length) {
    let j = i;
    while (j < arts.length && arts[j].s === arts[i].s) j++;
    const run = arts.slice(i, j), gid = prefix + "-" + run[0].id;
    if (run.length > 2 && !state.open[gid]) {
      html += run.slice(0, 2).map((a) => rowHTML(a, C)).join("");
      html += `<li class="row row--more"><button class="mono morebtn" type="button" data-act="expand" data-g="${esc(gid)}">+${run.length - 2} da ${esc(srcName(run[0].s))}</button></li>`;
    } else html += run.map((a) => rowHTML(a, C)).join("");
    i = j;
  }
  return html;
}

function chipsFor(kind, counts, total) {
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return [["tutte", "Tutte", total], ...entries.map(([k, n]) => [k, k, n])].map(([k, label, n]) => {
    const on = state[kind] === k;
    return `<button class="chip-b${on ? " is-on" : ""}" type="button" data-act="${kind}" data-k="${esc(k)}" aria-pressed="${on}"><span class="mono">${esc(label)}</span><span class="mono chip-b__n">${n}</span></button>`;
  }).join("");
}

const loadingHTML = () => `<div class="wrap loading" aria-busy="true" aria-label="Caricamento"><div class="sk sk--s"></div><div class="sk sk--t"></div><div class="sk sk--l"></div><div class="sk sk--l"></div><div class="sk sk--s"></div></div>`;
const errorHTML = (msg) => `<div class="wrap page"><div class="empty"><p class="mono muted">Errore</p><h2 class="empty__t">Non riesco a raggiungere il server.</h2><p>${esc(msg)}</p><button class="btn" type="button" data-act="reload">Riprova</button></div></div>`;

/* ---------- Prima pagina ---------- */
function edLabel(day) {
  const days = META.days;
  if (day === days[0]) return "Oggi";
  if (day === days[1]) return "Ieri";
  return fmtShort.format(dayDate(day));
}

function edBarHTML(day, ek) {
  const nowH = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Rome", hour: "2-digit", hour12: false }).format(new Date(META.now * 1000))) % 24;
  const isToday = day === META.days[0];
  const eds = META.editions.map((e) => {
    const on = e.k === ek, future = isToday && e.a > nowH;
    return `<a class="ed${on ? " is-on" : ""}" ${future ? 'aria-disabled="true" tabindex="-1" style="opacity:.38;pointer-events:none"' : ""} href="/?giorno=${day}&ed=${e.k}" aria-current="${on}"><span class="mono">${e.n}</span><span class="ed__r">${e.r}</span></a>`;
  }).join("");
  const days = META.demo ? "" : `<div class="days" role="group" aria-label="Giorno">${META.days.map((d) => `<a class="day mono" href="/?giorno=${d}&ed=${d === META.days[0] ? META.edition : "sera"}" aria-pressed="${d === day}">${edLabel(d)}</a>`).join("")}</div>`;
  return `<div class="edbar"><div class="wrap edbar__in"><span class="mono muted edbar__lab">Edizioni</span><div class="edbar__list" role="group" aria-label="Edizioni">${eds}</div>${days}</div></div>`;
}

function statusHTML(F, E) {
  const dayTxt = F.day === META.days[0] ? "" : " di " + fmtDay.format(dayDate(F.day));
  let s;
  if (F.closed) s = `Edizione ${E.of}${dayTxt} · chiusa ${hm(F.b) === "00:00" ? "a mezzanotte" : "alle " + hm(F.b)}`;
  else if (META.demo) s = `<span class="on">Edizione ${E.of}</span> · in aggiornamento · istantanea delle ${hm(META.now)}`;
  else s = `<span class="on">Edizione ${E.of}</span> · in aggiornamento${META.updated ? " · ultimo controllo alle " + hm(META.updated) : ""}`;
  if (F.count) s += ` · ${pl(F.count, "notizia", "notizie")} da ${pl(F.papers, "testata", "testate")}`;
  return `<p class="status mono">${s}</p>`;
}

/* Testata del numero, solo nello stile magazine: "N. 298 · Sera · Il mondo raccontato da 34 testate · domenica 25 ottobre 2026" */
function issueHTML(F, E) {
  const d = dayDate(F.day);
  const start = Date.UTC(d.getUTCFullYear(), 0, 0);
  const num = Math.floor((d - start) / 86400000);
  const when = fmtDay.format(d) + " " + d.getUTCFullYear();
  return `<div class="issue mag-only" aria-hidden="true"><span>N. ${num} · ${E.n}</span><span>Il mondo raccontato da ${META.sources.length} testate</span><span>${esc(when)}</span></div>`;
}

/* Le cifre del giorno: il primo numero con unità nei titoli italiani delle storie più seguite */
const CIFRA_RX = /(\d{1,3}(?:[.\s]\d{3})*(?:,\d+)?|\d+(?:,\d+)?)\s?(%|(?:per cento|mila|milioni|miliardi|morti|feriti|anni|mesi|euro|dollari|voti)(?![a-zà-ÿ]))/i;
function cifreHTML(stories, C) {
  const items = [];
  stories.forEach((s) => {
    if (items.length >= 4) return;
    // Prima il titolo della storia, poi quelli italiani dei suoi articoli
    const cands = [{ t: s.t, s: s.srcs[0] }].concat(s.arts.map((id) => C.A[id]).filter((a) => a && a.it).map((a) => ({ t: a.it, s: a.s })));
    for (const c of cands) {
      const m = c.t.match(CIFRA_RX);
      const dup = m && items.some((x) => x.n === m[1].replace(/\s/g, ".") && x.u.toLowerCase() === m[2].toLowerCase());
      if (m && !dup && !/^(19|20)\d\d$/.test(m[1])) {
        items.push({ n: m[1].replace(/\s/g, "."), u: m[2].toLowerCase() === "per cento" ? "%" : m[2], t: c.t, s: c.s, id: s.id });
        break;
      }
    }
  });
  if (items.length < 2) return "";
  return `<section class="cifre mag-only" aria-label="Le cifre del giorno"><h2 class="mono cifre__h">Le cifre del giorno</h2><ol class="cifre__list">${items.map((x) =>
    `<li><a class="cifra" href="/storia/${esc(x.id)}"><span class="cifra__n">${esc(x.n)}<small>${esc(x.u)}</small></span><span class="cifra__t">${esc(x.t)}</span><span class="mono cifra__s">${esc(srcName(x.s))}</span></a></li>`).join("")}</ol></section>`;
}

function topicChipsHTML(arts) {
  const counts = {};
  arts.forEach((a) => { counts[a.k] = (counts[a.k] || 0) + 1; });
  const all = [["tutte", "Tutte", arts.length], ...META.topics.map(([k, n]) => [k, n, counts[k] || 0])];
  return `<div class="chips" role="group" aria-label="Filtra per argomento">${all.map(([k, n, c]) => {
    const on = state.topic === k;
    return `<button class="chip-b${on ? " is-on" : ""}" type="button" data-act="topic" data-k="${k}" aria-pressed="${on}"><span class="mono">${esc(n)}</span><span class="mono chip-b__n">${c}</span></button>`;
  }).join("")}</div>`;
}

function tickerHTML(arts) {
  const items = arts.filter((a) => !LOWVAL[a.x]).slice(0, 14).map((a) => {
    const p = parts(a);
    return `<span><span class="mono tk__s">${esc(srcName(a.s))}</span><span lang="${p.main.lang}">${esc(p.main.txt)}</span></span>`;
  }).join('<span class="tk__sep" aria-hidden="true">/</span>');
  if (!items) return "";
  return `<div class="tk" role="region" aria-label="Ultim’ora in scorrimento"><div class="wrap tk__wrap"><span class="mono tk__lab">Ultim’ora</span>
    <div class="tk__vp"><div class="tk__track"><div class="tk__seq">${items}</div><div class="tk__seq" aria-hidden="true">${items}</div></div></div></div></div>`;
}

function railHTML(F, C) {
  const items = F.rail.map((id) => C.A[id]).filter(Boolean);
  if (!items.length) return "";
  return `<aside class="rail" aria-labelledby="pp-h"><div class="rail__head"><h2 id="pp-h" class="rail__h">Le prime pagine</h2><a class="mono acc" href="/edicola">Edicola →</a></div>
    <p class="mono rail__note">L’apertura di ogni testata</p><ol>${items.map((a) => {
      const p = parts(a);
      return `<li><a class="pp" ${linkFor(a)}><span class="pp__m"><span class="mono">${favMark(a.s)}${esc(srcName(a.s))}</span><span class="mono muted">${a.t}</span></span>
        <span class="pp__t" lang="${p.main.lang}">${esc(p.main.txt)}</span>${p.sub ? `<span class="pp__o" lang="${p.sub.lang}">${esc(p.sub.txt)}</span>` : ""}</a></li>`;
    }).join("")}</ol></aside>`;
}

async function renderHome(params) {
  const day = META.days.includes(params.get("giorno")) ? params.get("giorno") : META.days[0];
  const ek = META.editions.some((e) => e.k === params.get("ed")) ? params.get("ed") : day === META.days[0] ? META.edition : "sera";
  const E = META.editions.find((e) => e.k === ek);
  const F = await api(`front?day=${day}&ed=${ek}`, 30000);
  const C = ctx(F.articles, F.stories);
  const inWin = F.articles.filter((a) => a.ts >= F.a).sort((p, q) => q.ts - p.ts);
  const tf = (x) => state.topic === "tutte" || x.k === state.topic;
  const win = inWin.filter(tf);
  const elig = F.stories.filter((s) => s.solid >= 2 && tf(s));
  let main, heroItems = [], globeSec = "";
  GLOBE = null;
  if (F.future) {
    main = `<div class="empty"><p class="mono muted">Edizione ${E.of}</p><h2 class="empty__t">Questa edizione non è ancora uscita.</h2><p>Apre alle ${E.r.slice(0, 2)}:00, ora di Roma.</p><a class="btn" href="/">Vai all’edizione in corso</a></div>`;
  } else if (!inWin.length) {
    const first = !META.demo && META.count === 0;
    main = `<div class="empty"><p class="mono muted">Edizione ${E.of}${F.closed ? " · chiusa alle " + hm(F.b) : ""}</p>
      <h2 class="empty__t">${first ? "Stiamo sfogliando i giornali." : META.demo ? "L’istantanea di questa demo parte dalle 17:00." : "Nessuna notizia raccolta in questa fascia oraria."}</h2>
      <p>${first ? "Il primo giro di lettura dei feed richiede qualche decina di secondi. La pagina si aggiorna da sola." : META.demo ? `Nel sito reale qui trovi le storie più seguite tra le ${E.r.replace("—", " e le ")}, salvate alla chiusura dell’edizione.` : "I feed delle testate tengono solo le ultime notizie: le edizioni precedenti al primo avvio del server restano vuote."}</p>
      ${first ? "" : `<a class="btn" href="/">Vai all’edizione in corso</a>`}</div>`;
    if (first) setTimeout(() => { if (location.pathname === "/") reload(); }, 8000);
  } else {
    const lead = elig[0], ev = elig.slice(1, 7);
    // Il globo c'è in tutti gli stili; nel Pop apre la prima pagina al posto della copertina a foto
    const list = globeData(win, elig);
    if (list.length) {
      const leadId = lead && ISO[lead.w];
      GLOBE = { list, C, sel: list.some((c) => c.id === leadId) ? leadId : list[0].id };
      globeSec = globeHTML(list, GLOBE.sel, E);
    }
    // La copertina a scorrimento resta nello svizzero: nel magazine apre la foto grande della prima notizia
    if (curStyle() === "svizzero") heroItems = elig.filter((s) => s.img).slice(0, HERO_MAX);
    main = (lead ? leadHTML(lead, C, E.n, heroItems.some((h) => h.id === lead.id)) : `<p class="note">In questa edizione nessuna storia ${state.topic === "tutte" ? "" : "di questo argomento "}è raccontata da più testate. Le notizie sono in Ultim’ora.</p>`) +
      (ev.length ? `<section class="sec sec--ev"><h2 class="sec-h">In evidenza <span class="mono muted">Le notizie raccontate da più testate</span></h2><div class="cards">${ev.map(cardHTML).join("")}</div></section>` : "") +
      cifreHTML(elig.slice(0, 10), C) +
      `<section class="sec sec--uo"><h2 class="sec-h">Ultim’ora <span class="mono muted">${pl(win.length, "notizia", "notizie")}</span></h2>${win.length ? `<ol class="rows">${rowsHTML(win, C, "u")}</ol>` : '<p class="note">Nessuna notizia per questo argomento nell’edizione.</p>'}</section>`;
  }
  return {
    title: null, nav: "prima", watch: !F.closed, after: () => { heroStart(); if (GLOBE) globeStart(); },
    html: edBarHTML(day, ek) + `<div class="wrap">${issueHTML(F, E)}${statusHTML(F, E)}${inWin.length ? topicChipsHTML(inWin) : ""}</div>` +
      (isPop() ? globeSec : "") + (heroItems.length ? heroHTML(heroItems) : "") + (inWin.length ? tickerHTML(inWin) : "") + (isPop() ? "" : globeSec) +
      `<div class="wrap home"><div class="home__main">${main}</div>${railHTML(F, C)}</div>`,
  };
}

/* ---------- Sezioni ---------- */
async function renderSection(k) {
  const D = await api("day", 30000);
  const C = ctx(D.articles, D.stories);
  const all = D.articles.filter((a) => a.k === k && a.ts <= D.now && isToday(a.ts)).sort((p, q) => q.ts - p.ts);
  let arts = all, filters = "";
  if (k === "esteri") {
    const fonti = {}, dove = {};
    all.forEach((a) => { const f = ccName(a.s); fonti[f] = (fonti[f] || 0) + 1; dove[a.w] = (dove[a.w] || 0) + 1; });
    arts = all.filter((a) => (state.fonte === "tutte" || ccName(a.s) === state.fonte) && (state.dove === "tutte" || a.w === state.dove));
    filters = `<div class="filt"><div class="filt__row"><span class="mono filt__lab">Fonte</span>${chipsFor("fonte", fonti, all.length)}</div>
      <div class="filt__row"><span class="mono filt__lab">Dove</span>${chipsFor("dove", dove, all.length)}</div></div>`;
  }
  const ids = new Set(arts.map((a) => a.st).filter(Boolean));
  const stories = D.stories.filter((s) => ids.has(s.id));
  const singles = arts.filter((a) => !(a.st && ids.has(a.st) && C.ST[a.st]));
  return {
    title: TL[k], nav: k, watch: true,
    // Internazionale ha una testata tutta sua: il nome in grande e, sotto, la firma del giornale
    html: `<div class="wrap page"><header class="phead${k === "esteri" ? " phead--intl" : ""}"><p class="mono muted">Sezione</p><h1 class="phead__t">${esc(TL[k])}</h1>${k === "esteri" ? `<p class="phead__sign">Il Grande Giornale</p>` : ""}
      <p class="phead__d">${pl(stories.length, "storia raccontata", "storie raccontate")} da più testate · ${pl(arts.length, "notizia", "notizie")} oggi</p></header>${filters}
      ${stories.length ? `<section class="sec"><h2 class="sec-h">Le notizie <span class="mono muted">raccontate da più testate</span></h2><div class="cards">${stories.map(cardHTML).join("")}</div></section>` : ""}
      <section class="sec sec--live"><h2 class="sec-h"><span class="live-dot" aria-hidden="true"></span>In diretta <span class="mono muted">${pl(singles.length, "notizia", "notizie")}, dalla più recente</span></h2>${singles.length ? `<ol class="rows">${rowsHTML(singles, C, "s")}</ol>` : '<p class="note">Nessuna notizia con questi filtri.</p>'}</section></div>`,
  };
}

function isToday(ts) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(new Date(ts * 1000)) === META.days[0];
}

/* ---------- Storia ---------- */
function voiceHTML(a) {
  const p = parts(a), name = srcName(a.s), cc = SRC[a.s]?.cc || "";
  return `<li class="voice"><div class="voice__m"><span class="mono acc">${esc(name)}</span>${langBadge(a)}${tipoTag(a)}
    <span class="mono muted">${esc(cc)} · ${esc(ccName(a.s))}</span><span class="mono muted">${a.t}</span></div>
    <p class="voice__t" lang="${p.main.lang}">${esc(p.main.txt)}</p>
    ${p.sub ? `<p class="row__o" lang="${p.sub.lang}">${esc(p.sub.txt)}</p>` : ""}
    ${photoHTML(a.img, a.s, "pic--voice", "")}
    ${a.desc ? `<p class="voice__d" lang="${a.l}">${esc(a.desc)}</p>` : ""}
    <a class="mono voice__go" ${ext(a)}>Leggi su ${esc(name)} ↗</a></li>`;
}

async function renderStory(id, params) {
  const V = await api("story/" + encodeURIComponent(id), 30000);
  if (!V) {
    return { title: "Storia non trovata", nav: "", html: `<div class="wrap page"><div class="empty"><p class="mono muted">Storia</p><h2 class="empty__t">Questa notizia non è più in pagina.</h2><p>Le notizie restano disponibili per tre giorni. Puoi cercarne i titoli nell’archivio.</p><a class="btn" href="/cerca">Cerca</a></div></div>` };
  }
  const s = V.story;
  const C = ctx(V.articles.concat(V.related_articles), [s].concat(V.related));
  const arts = V.articles.slice().sort((p, q) => q.ts - p.ts);
  const first = V.articles.slice().sort((p, q) => p.ts - q.ts)[0];
  const tab = params.get("scheda") === "analisi" ? "analisi" : "racconti";
  const base = "/storia/" + encodeURIComponent(s.id);
  const tabs = `<div class="tabs" role="tablist" aria-label="Viste della storia">
      <a class="tab mono" role="tab" href="${base}" aria-selected="${tab === "racconti"}" data-keep="1">Come lo raccontano <span class="tab__n">${arts.length}</span></a>
      <a class="tab mono" role="tab" href="${base}?scheda=analisi" aria-selected="${tab === "analisi"}" data-keep="1">Analisi</a></div>`;
  const panel = tab === "analisi"
    ? `<section class="sec an" role="tabpanel" id="analysis" aria-live="polite">${analysisLoadingHTML()}</section>`
    : `<section class="sec" role="tabpanel"><ol class="voices">${arts.map(voiceHTML).join("")}</ol></section>`;
  return {
    title: s.t, nav: s.k, watch: true,
    after: tab === "analisi" ? () => loadAnalysis(s.id, V) : null,
    html: `<div class="wrap page"><a class="back mono" href="/" data-act="back">← Prima pagina</a>
      <header class="story__h"><div class="kick"><a class="mono acc" href="/${s.k}">${esc(TL[s.k])}</a><span class="mono muted">${esc(s.w)}</span><span class="mono"><b>${pl(s.n, "testata", "testate")}</b></span></div>
      <h1 class="story__t">${esc(s.t)}</h1>${s.d ? `<p class="lead__d">${esc(s.d)}</p>` : ""}
      ${timelineHTML(s, C, true)}
      <p class="firstline">La prima a raccontarla è stata <b>${esc(srcName(first.s))}</b> alle ${first.t}. L’ultimo aggiornamento è delle ${hm(s.last)}.</p></header>
      <div class="sec">${tabs}${panel}</div>
      ${V.related.length ? `<section class="sec"><h2 class="sec-h">Altre notizie · ${esc(TL[s.k])}</h2><div class="cards">${V.related.map(cardHTML).join("")}</div></section>` : ""}</div>`,
  };
}

/* ---------- Scheda Analisi ---------- */
const STATE_LABEL = { concorde: "Concordano", divergente: "Valori diversi", aggiornamento: "Aggiornamento", singolo: "Una sola testata" };
const VOICE_LABEL = { governo: "Governo", opposizione: "Opposizione", istituzione: "Istituzioni", esperto: "Esperti", cittadino: "Cittadini", altra_testata: "Altre testate", altro: "Altri" };
const SRC_LABEL = { agenzia: "agenzia", fonte_ufficiale: "fonte ufficiale", documento: "documento", altra_testata: "altra testata", anonima: "anonima", social: "social" };
let analysisTimer = null;
let PROOFS = {};

const analysisLoadingHTML = () => `<div class="loading loading--in" aria-busy="true"><div class="sk sk--l"></div><div class="sk sk--l"></div><div class="sk sk--s"></div></div>`;

async function loadAnalysis(id, V) {
  clearTimeout(analysisTimer);
  const box = document.getElementById("analysis");
  if (!box) return;
  let R;
  try {
    const r = await fetch("/api/analysis/" + encodeURIComponent(id), { headers: { Accept: "application/json" } });
    R = r.ok ? await r.json() : { status: "error", error: "HTTP " + r.status };
  } catch (e) {
    R = { status: "error", error: e.message };
  }
  const still = document.getElementById("analysis");
  if (!still || !location.pathname.endsWith("/" + id)) return;
  still.innerHTML = analysisHTML(R, V);
  still.classList.toggle("is-story", R.status === "ready");
  if (R.status === "ready") axStart();
  if (R.status === "pending") {
    analysisTimer = setTimeout(() => { if (document.getElementById("analysis")) loadAnalysis(id, V); }, 15000);
  }
}

function analysisNote(kicker, title, body, extra = "") {
  return `<div class="empty an__state"><p class="mono muted">${kicker}</p><h3 class="empty__t">${title}</h3><p>${body}</p>${extra}</div>`;
}

function analysisHTML(R, V) {
  if (R.status === "too_few") return analysisNote("Analisi", "Servono almeno tre testate.", `L’analisi confronta storie raccontate da almeno ${R.min} testate; questa per ora ne ha ${R.n}.`);
  // Il motivo tecnico serve a chi gestisce il server, non ai lettori
  const local = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  if (R.status === "unavailable") return analysisNote("Analisi", "L’analisi automatica non è attiva.", "Su questo server il confronto fra le testate è spento.", R.reason && local ? `<p class="mono muted an__why">${esc(R.reason)}</p>` : "");
  if (R.status === "blocked") return analysisNote("Analisi sospesa", "Raggiunto il limite di spesa di oggi.", "Le nuove analisi riprendono domani. Gli articoli restano consultabili in «Come lo raccontano».");
  if (R.status === "error") return analysisNote("Analisi", "L’analisi non è riuscita.", "Riproviamo in automatico tra qualche minuto.", R.error && local ? `<p class="mono muted an__why">${esc(R.error)}</p>` : "");
  if (R.status === "pending") return `<div class="ax-wait" aria-busy="true"><p class="mono">Analisi in preparazione</p>
    <h3 class="ax-wait__t">Stiamo leggendo gli articoli<span class="ax-wait__dots" aria-hidden="true"><i>.</i><i>.</i><i>.</i></span></h3>
    <ol class="ax-wait__steps"><li>Leggiamo titoli ed estratti di ogni testata</li><li>Controlliamo che ogni frase citata ci sia davvero</li><li>Mettiamo a confronto fatti, cifre, voci e tempi</li></ol>
    <p class="note">Di solito serve meno di un minuto: la pagina si aggiorna da sola.</p></div>`;
  return readyHTML(R, V);
}

/* ---------- La scheda pronta: un racconto a capitoli, a tutta pagina ----------
   Ogni capitolo ha una frase semplice che dice il punto, un elemento da toccare (le prove, le
   categorie di chi parla, le parole scelte) e un'animazione che parte quando arriva sullo
   schermo: numeri che contano, barre che crescono, punti che si accendono. Con "riduci
   movimento" tutto è già al suo posto. */
const AX_CHAPTERS = [["tutti", "Cosa dicono tutti"], ["separano", "Dove si separano"], ["cifre", "Le cifre"], ["voci", "Chi ha la parola"],
  ["fonti", "Da dove arriva"], ["parole", "Le parole scelte"], ["manca", "Cosa manca"], ["tempi", "Chi è arrivato prima"]];
const VOICE_NOUN = { governo: "i governi", opposizione: "l’opposizione", istituzione: "le istituzioni", esperto: "gli esperti", cittadino: "i cittadini", altra_testata: "altre testate", altro: "altre persone" };
const SRC_PLURAL = { agenzia: ["agenzia", "agenzie"], fonte_ufficiale: ["fonte ufficiale", "fonti ufficiali"], documento: ["documento", "documenti"], altra_testata: ["altra testata", "altre testate"], anonima: ["fonte anonima", "fonti anonime"], social: ["post social", "post social"] };
let axIO = null, AXW = [];

const joinIt = (xs) => (xs.length < 2 ? xs.join("") : xs.slice(0, -1).join(", ") + " e " + xs[xs.length - 1]);
const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
const axN = (n) => `<span class="ax-n" data-to="${n}">${n}</span>`;

function readyHTML(R, V) {
  const A = R.analysis, U = {};
  V.articles.forEach((a) => { U[a.id] = a; });
  PROOFS = {};
  const meta = A.meta || {};
  const used = (meta.articles || []).map((id) => U[id]).filter(Boolean);
  const srcs = new Set(used.map((a) => a.s));
  const nSrc = srcs.size || Object.keys(A.voices || {}).length;
  const nCc = new Set([...srcs].map((x) => SRC[x] && SRC[x].cc)).size;
  const nLang = new Set(used.map((a) => a.l)).size;
  const groups = A.claim_groups || [];
  const conc = groups.filter((g) => g.stato === "concorde");
  const div = groups.filter((g) => g.stato === "divergente" || g.stato === "aggiornamento");
  const single = groups.filter((g) => g.stato === "singolo");
  const metrics = new Map();
  (A.numeric_compare || []).forEach((r) => { if (!metrics.has(r.metrica)) metrics.set(r.metrica, []); metrics.get(r.metrica).push(r); });
  const numDiv = [...metrics].filter(([, rows]) => rows[0].stato === "divergente");
  const nDiv = div.length + numDiv.length;

  const ch = (k, n, body, cls = "") => `<section class="ax ${cls}" id="ax-${k}" aria-labelledby="axh-${k}"><div class="wrap ax__in">
    <p class="mono ax__k" data-r><span>${String(n).padStart(2, "0")}</span> ${AX_CHAPTERS[n - 1][1]}</p>${body}</div></section>`;
  const title = (k, html, d = 1) => `<h3 class="ax__t" id="axh-${k}" data-r style="--d:${d}">${html}</h3>`;
  const card = (g, i, tag = "") => {
    const n = new Set(g.evidenze.map((e) => e.source)).size;
    return `<li class="ax__card" data-r style="--d:${Math.min(i, 6) + 2}">${tag}<p class="ax__ct">${esc(g.testo_it)}</p>
      <p class="mono muted">${n === 1 ? "Lo dice" : "Lo dicono"} ${pl(n, "testata", "testate")}</p>${proofChips(g.evidenze, U, g.id)}</li>`;
  };

  // Apertura: quanto abbiamo letto e il verdetto in una frase
  const verdict = [
    conc.length ? `su <b>${pl(conc.length, "punto", "punti")}</b> le testate concordano` : "non c’è un punto che almeno due testate raccontano allo stesso modo",
    nDiv ? `su <b>${nDiv}</b> si separano` : "non ci sono versioni incompatibili",
    single.length ? `<b>${single.length}</b> ${single.length === 1 ? "dettaglio lo racconta" : "dettagli li racconta"} una sola testata` : "",
  ].filter(Boolean);
  const hero = `<section class="ax ax--hero" id="ax-inizio" aria-label="Analisi della storia"><div class="wrap ax__in">
    <p class="mono ax__k" data-r>Analisi · come le testate raccontano questa storia</p>
    ${R.simulated ? `<p class="ax__sim mono" data-r>Simulazione · scheda ricavata con regole semplici dai testi veri, senza modello. Prove, cifre, voci e tempi passano comunque dalle verifiche vere.</p>` : ""}
    <h3 class="ax__big" data-r style="--d:1">Abbiamo letto ${axN(used.length)} ${used.length === 1 ? "articolo" : "articoli"} di ${axN(nSrc)} ${nSrc === 1 ? "testata" : "testate"}, da ${axN(nCc)} ${nCc === 1 ? "paese" : "paesi"} in ${axN(nLang)} ${nLang === 1 ? "lingua" : "lingue"}.</h3>
    <p class="ax__lead" data-r style="--d:2">${cap(joinIt(verdict))}.</p>
    <nav class="ax__toc" data-r style="--d:3" aria-label="Capitoli dell’analisi">${AX_CHAPTERS.map(([k, t], i) => `<button type="button" data-act="ax-go" data-k="${k}"><span>${i + 1}</span>${t}</button>`).join("")}</nav>
    <p class="mono ax__down" data-r style="--d:4" aria-hidden="true">Scorri ↓</p></div></section>`;

  // 1. Cosa dicono tutti
  const c1 = (conc.length
    ? title("tutti", `Su <b>${pl(conc.length, "punto", "punti")}</b> le testate dicono la stessa cosa.`) +
      (A.summary_it ? `<blockquote class="ax__quote" data-r style="--d:2">${esc(A.summary_it)}</blockquote>` : "") +
      `<p class="ax__hint mono" data-r style="--d:2">Tocca il nome di una testata: compare la frase con cui lo dice, e il link all’articolo.</p>
       <ul class="ax__cards">${conc.map((g, i) => card(g, i)).join("")}</ul>`
    : title("tutti", "Non c’è ancora un punto che almeno due testate raccontano allo stesso modo.")) +
    (single.length ? `<details class="ax__more" data-r><summary class="mono">E altri ${single.length} dettagli che racconta una sola testata</summary><ul class="ax__cards">${single.map((g, i) => card(g, i)).join("")}</ul></details>` : "");

  // 2. Dove si separano
  const say = (rows) => joinIt(rows.map((r) => `<b>${esc(srcName(r.source))}</b> scrive ${esc(r.valore)}`));
  const c2 = nDiv
    ? title("separano", `Su <b>${pl(nDiv, "punto", "punti")}</b> le versioni non tornano.`) +
      `<ul class="ax__cards">${div.map((g, i) => card(g, i, `<span class="stag stag--${g.stato}">${g.stato === "aggiornamento" ? "Aggiornato nel tempo" : "Versioni diverse"}</span>`)).join("")}</ul>` +
      numDiv.map(([m, rows], i) => `<p class="ax__say" data-r style="--d:${i + 2}">Sulla cifra «${esc(m)}»: ${say(rows)}. <button class="mono ax__link" type="button" data-act="ax-go" data-k="cifre">Guarda le cifre →</button></p>`).join("")
    : title("separano", "Nessuna versione incompatibile.") +
      `<p class="ax__lead" data-r style="--d:2">Le testate scelgono dettagli diversi, ma quello che raccontano sta insieme: nessuna dice il contrario di un’altra.</p>`;

  // 3. Le cifre: ogni metrica su una riga, i valori come punti
  const scale = (rows) => {
    const vals = rows.map((r) => (r.quantita && typeof r.quantita.value === "number" ? r.quantita.value : null));
    const ok = vals.filter((v) => v !== null);
    const lo = Math.min(...ok), hi = Math.max(...ok);
    const byVal = new Map();
    // Lo stesso numero scritto in lingue diverse («14 años», «14 anni») è un punto solo
    rows.forEach((r, i) => { const k = vals[i] !== null ? "v" + vals[i] : r.valore; if (!byVal.has(k)) byVal.set(k, { r, v: vals[i], who: [] }); byVal.get(k).who.push(srcName(r.source)); });
    const pts = [...byVal.values()];
    if (pts.length === 1 || hi === lo) {
      return `<p class="ax__same" data-r style="--d:2"><b>${esc(pts[0].r.valore)}</b> per ${joinIt(pts.flatMap((p) => p.who).map(esc))}</p>`;
    }
    const xs = pts.map((p) => (p.v === null ? 50 : 4 + ((p.v - lo) / (hi - lo)) * 92));
    const lab = axLabels(xs);
    return `<div class="ax__scale" data-r style="--d:2"><span class="ax__axis"></span>${pts.map((p, i) =>
      `<span class="ax__dot${p.r.fuori ? " is-off" : ""}${lab[i] === 2 ? " is-low" : ""}${axEdge(xs, i)}" style="--x:${xs[i].toFixed(1)}%;--d:${i}" title="${esc(p.r.valore)} · ${esc(p.who.join(", "))}">${lab[i] ? `<b>${esc(p.r.valore)}</b><i>${esc(p.who.join(" · "))}</i>` : ""}</span>`).join("")}</div>`;
  };
  const STATE_SAY = { concorde: "Tutte d’accordo", divergente: "Valori diversi", aggiornamento: "Aggiornata nel tempo", singolo: "Una sola testata" };
  const c3 = metrics.size
    ? title("cifre", `Nei testi ci sono <b>${pl(metrics.size, "cifra", "cifre")}</b> da confrontare.`) +
      `<div class="ax__metrics">${[...metrics].map(([m, rows], i) => `<div class="ax__metric" data-r style="--d:${Math.min(i, 5) + 2}">
        <p class="ax__mh"><span class="ax__mt">${esc(m)}</span><span class="stag stag--${rows[0].stato}">${STATE_SAY[rows[0].stato]}</span></p>
        ${scale(rows)}${proofChips(rows.map((r) => ({ source: r.source, prova: r.prova, url: U[r.article_id] ? U[r.article_id].u : "" })), U, "n" + i)}</div>`).join("")}</div>`
    : title("cifre", "Nei testi analizzati non ci sono cifre da mettere a confronto.");

  // 4. Chi ha la parola: una barra per testata, divisa per categoria
  const VV = A.voices || {};
  const vSrcs = Object.keys(VV).filter((x) => Object.values(VV[x]).some(Boolean));
  const tot = {};
  vSrcs.forEach((x) => Object.entries(VV[x]).forEach(([c, n]) => { tot[c] = (tot[c] || 0) + n; }));
  const cats = Object.keys(VOICE_LABEL).filter((c) => tot[c]);
  const all = Object.values(tot).reduce((p, q) => p + q, 0);
  const top = cats.slice().sort((p, q) => tot[q] - tot[p])[0];
  const maxRow = Math.max(1, ...vSrcs.map((x) => Object.values(VV[x]).reduce((p, q) => p + q, 0)));
  const c4 = all
    ? title("voci", `Parlano soprattutto <b>${VOICE_NOUN[top]}</b>: ${tot[top]} ${tot[top] === 1 ? "voce" : "voci"} su ${all}.`) +
      `<div class="ax__legend" data-r style="--d:2" role="group" aria-label="Mostra una categoria">${cats.map((c) => `<button type="button" class="ax__lg" data-act="ax-cat" data-k="${c}" aria-pressed="false"><i class="cat-${c}"></i>${VOICE_LABEL[c]} <b>${tot[c]}</b></button>`).join("")}</div>
       <div class="ax__voices">${vSrcs.map((x, i) => {
         const row = Object.values(VV[x]).reduce((p, q) => p + q, 0);
         return `<div class="ax__vrow" data-r style="--d:${Math.min(i, 8) + 2}"><span class="ax__vl">${esc(srcName(x))}</span>
           <span class="ax__vb" style="--w:${(row / maxRow * 100).toFixed(1)}%">${cats.filter((c) => VV[x][c]).map((c) => `<i class="cat-${c}" data-c="${c}" style="flex:${VV[x][c]}" title="${VOICE_LABEL[c]}: ${VV[x][c]}"></i>`).join("")}</span><b>${row}</b></div>`;
       }).join("")}</div>`
    : title("voci", "Nei testi analizzati nessuno prende la parola.") +
      `<p class="ax__lead" data-r style="--d:2">Le testate raccontano il fatto senza citare nessuno, né direttamente né indirettamente.</p>`;

  // 5. Da dove arriva: le fonti dichiarate
  const P = A.sources_profile || {};
  const pSrcs = Object.keys(P);
  const withS = pSrcs.filter((x) => P[x].totale);
  const byType = {};
  withS.forEach((x) => Object.entries(P[x].per_tipo).forEach(([t, n]) => { byType[t] = (byType[t] || 0) + n; }));
  const types = Object.keys(byType).filter((t) => byType[t]).sort((p, q) => byType[q] - byType[p]);
  const c5 = withS.length
    ? title("fonti", `<b>${withS.length} ${withS.length === 1 ? "testata" : "testate"} su ${pSrcs.length}</b> ${withS.length === 1 ? "dice" : "dicono"} da dove arrivano le informazioni.`) +
      `<div class="ax__tiles">${types.map((t, i) => `<div class="ax__tile" data-r style="--d:${i + 2}">${axN(byType[t])}<span>${SRC_PLURAL[t][byType[t] === 1 ? 0 : 1]}</span></div>`).join("")}</div>
       <p class="ax__fine mono" data-r style="--d:3">Le citano ${joinIt(withS.map((x) => esc(srcName(x))))}${pSrcs.length > withS.length ? ` · nessuna fonte dichiarata per ${joinIt(pSrcs.filter((x) => !P[x].totale).map((x) => esc(srcName(x))))}` : ""}.</p>`
    : title("fonti", "Nessuna testata dice da dove arrivano le informazioni.") +
      `<p class="ax__lead" data-r style="--d:2">Nei titoli e negli estratti le fonti si citano di rado: con il testo completo degli articoli questo capitolo si riempie.</p>`;

  // 6. Le parole scelte: una nuvola da toccare
  const words = new Map();
  Object.entries(A.lexicon || {}).forEach(([x, list]) => list.forEach((w) => {
    const k = norm(w.termine);
    if (!words.has(k)) words.set(k, { termine: w.termine, srcs: new Set(), refs: new Set(), ev: [] });
    const e = words.get(k);
    e.srcs.add(x);
    if (w.riferito_a) e.refs.add(w.riferito_a);
    e.ev.push({ source: x, prova: w.prova, url: U[w.article_id] ? U[w.article_id].u : "" });
  }));
  AXW = [...words.values()].sort((p, q) => q.srcs.size - p.srcs.size || q.ev.length - p.ev.length).slice(0, 18);
  const fr = (A.framing || []).find((f) => f.tema !== "Titoli");
  const titles = (A.framing || []).find((f) => f.tema === "Titoli");
  const c6 = AXW.length || titles
    ? title("parole", fr ? esc(fr.differenza_it) : AXW.length ? `Le testate scelgono ${pl(AXW.length, "parola", "parole")} per descrivere i protagonisti.` : "Le parole sono simili; cambiano i titoli.") +
      (AXW.length ? `<p class="ax__hint mono" data-r style="--d:2">Tocca una parola: chi la usa, per chi, e con quale frase.</p>
        <div class="ax__cloud" data-r style="--d:2">${AXW.map((w, i) => `<button type="button" class="ax__word" data-act="ax-word" data-k="${i}" aria-expanded="false" style="--s:${Math.min(w.srcs.size, 5)};--d:${i}">${esc(w.termine)}</button>`).join("")}</div>
        <div class="ax__wordbox" id="ax-wordbox" aria-live="polite" hidden></div>` : "") +
      (titles ? `<div class="ax__card ax__card--wide" data-r style="--d:3"><p class="mono muted">I titoli</p><p class="ax__ct">${esc(titles.differenza_it)}</p>${proofChips(titles.evidenze, U, "tit")}</div>` : "")
    : title("parole", "Le testate usano parole simili.") + `<p class="ax__lead" data-r style="--d:2">Nessuna differenza di lessico nei testi analizzati.</p>`;

  // 7. Cosa manca
  const gaps = A.gaps || [];
  const c7 = gaps.length
    ? title("manca", `${gaps.length === 1 ? "Una cosa manca" : pl(gaps.length, "cosa manca", "cose mancano")} nel racconto d’insieme.`) +
      `<ul class="ax__gaps">${gaps.map((g, i) => `<li data-r style="--d:${i + 2}">${esc(g)}</li>`).join("")}</ul>`
    : title("manca", "Non manca niente che si possa ricavare dai dati.") +
      `<p class="ax__lead" data-r style="--d:2">Parlano più parti, scrivono testate di più paesi e il racconto è distribuito nel tempo.</p>`;

  // 8. Chi è arrivato prima: una linea del tempo che si accende
  const firsts = (A.timeline || []).filter((t) => t.prima_della_testata);
  const span = firsts.length ? Math.max(1, ...firsts.map((t) => t.minuti_dopo || 0)) : 1;
  const dayOf = (t) => fmtShort.format(new Date(Date.parse(t.ora)));
  const multi = new Set(firsts.map(dayOf)).size > 1;
  const when = (t) => (multi ? dayOf(t) + " " : "") + hm(Date.parse(t.ora) / 1000);
  const txs = firsts.map((t) => 4 + (t.minuti_dopo || 0) / span * 92);
  const tlab = axLabels(txs);
  const c8 = firsts.length
    ? title("tempi", `La prima è stata <b>${esc(srcName(firsts[0].source))}</b> alle ${when(firsts[0])}.`) +
      (firsts.length > 1 ? `<p class="ax__lead" data-r style="--d:2">Nelle ${fmtDelta(span)} successive l’hanno raccontata altre ${pl(firsts.length - 1, "testata", "testate")}.</p>` : "") +
      `<div class="ax__track" data-r style="--d:2" aria-hidden="true"><span class="ax__axis"></span>${firsts.map((t, i) => `<span class="ax__tick${i ? "" : " is-first"}${tlab[i] === 2 ? " is-low" : ""}${axEdge(txs, i)}" style="--x:${txs[i].toFixed(1)}%;--d:${i}" title="${when(t)} · ${esc(srcName(t.source))}">${tlab[i] ? `<b>${when(t)}</b><i>${esc(srcName(t.source))}</i>` : ""}</span>`).join("")}</div>
       <ol class="ax__times">${firsts.map((t, i) => `<li data-r style="--d:${Math.min(i, 8) + 3}"><time class="mono">${when(t)}</time> <b>${esc(srcName(t.source))}</b>${i ? ` <span class="mono muted">+${fmtDelta(t.minuti_dopo)}</span>` : ' <span class="stag stag--concorde">Prima</span>'}</li>`).join("")}</ol>`
    : title("tempi", "Non ci sono dati sui tempi.");

  const scope = meta.scope === "full" ? "testi completi delle pagine pubbliche" : "titoli ed estratti dei feed";
  const fresh = R.new_articles ? ` Da allora sono arrivati ${pl(R.new_articles, "articolo", "articoli")}: l’analisi si aggiorna al massimo ogni 15 minuti.` : "";
  const foot = `<section class="ax ax--foot"><div class="wrap ax__in">
    <p class="ax__lead" data-r>Questa analisi è automatica e descrive differenze documentate: non dice chi ha ragione. Ogni frase rimanda all’articolo da cui viene: in caso di dubbio, vale l’originale.</p>
    <p class="mono muted ax__fine" data-r>Fatta alle ${hm(R.created_at)} su ${pl(used.length, "articolo", "articoli")} di ${pl(nSrc, "testata", "testate")} · ${scope}${meta.dropped_proofs ? ` · ${pl(meta.dropped_proofs, "dato scartato", "dati scartati")} perché la prova non compariva nel testo` : ""}.${fresh}</p>
    <button type="button" class="btn" data-act="ax-go" data-k="inizio" data-r>↑ Torna all’inizio dell’analisi</button></div></section>`;
  const rail = `<nav class="ax__rail" aria-label="Vai a un capitolo">${AX_CHAPTERS.map(([k, t], i) => `<button type="button" data-act="ax-go" data-k="${k}" data-rail="${k}" title="${t}"><span class="vh">${i + 1}. ${t}</span></button>`).join("")}</nav>`;

  return `<div class="axs">${rail}${hero}${ch("tutti", 1, c1)}${ch("separano", 2, c2, nDiv ? "ax--alert" : "")}${ch("cifre", 3, c3, "ax--alt")}${ch("voci", 4, c4)}${ch("fonti", 5, c5, "ax--alt")}${ch("parole", 6, c6)}${ch("manca", 7, c7, "ax--alt")}${ch("tempi", 8, c8)}${foot}</div>`;
}

/* Quali punti di una linea hanno l'etichetta: 1 sopra, 2 sotto, 0 nessuna (troppo vicino ad
   altri già etichettati sullo stesso lato). Il primo e l'ultimo l'hanno sempre. */
function axLabels(xs, gap = Math.min(50, Math.max(14, 13000 / Math.max(320, window.innerWidth - 64)))) {
  const last = { 1: -1e9, 2: -1e9 }, out = xs.map(() => 0);
  // Sul telefono c'è posto solo per il primo e l'ultimo: gli altri sono nell'elenco sotto
  if (window.innerWidth < 600) {
    const lo = xs.indexOf(Math.min(...xs)), hi = xs.indexOf(Math.max(...xs));
    out[lo] = 1;
    if (hi !== lo) out[hi] = xs[hi] - xs[lo] > 45 ? 1 : 2;
    return out;
  }
  const order = xs.map((x, i) => i);
  if (order.length > 1) order.splice(1, 0, order.pop());          // prima il primo e l'ultimo
  order.forEach((i) => {
    const side = [1, 2].find((sd) => Math.abs(xs[i] - last[sd]) >= gap);
    if (side) { out[i] = side; last[side] = xs[i]; }
  });
  return out;
}

/* Il punto più a sinistra ha l'etichetta allineata a sinistra, quello più a destra a destra */
function axEdge(xs, i) {
  if (xs[i] === Math.min(...xs)) return " is-start";
  if (xs[i] === Math.max(...xs)) return " is-end";
  return "";
}

/* Le animazioni partono quando un capitolo entra nello schermo; la guida laterale segue la lettura */
function axStart() {
  if (axIO) axIO.disconnect();
  axIO = null;
  const root = document.querySelector(".axs");
  if (!root) return;
  const chs = [...root.querySelectorAll(".ax")];
  const reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce || !("IntersectionObserver" in window)) { chs.forEach((c) => c.classList.add("is-in")); return; }
  root.classList.add("is-anim");
  root.querySelectorAll(".ax-n").forEach((n) => { n.textContent = "0"; });
  axIO = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      const c = en.target;
      if (!c.classList.contains("is-in")) { c.classList.add("is-in"); c.querySelectorAll(".ax-n").forEach(axCount); }
      const k = c.id.replace("ax-", "");
      root.querySelectorAll("[data-rail]").forEach((b) => b.setAttribute("aria-current", String(b.dataset.rail === k)));
      root.classList.toggle("is-reading", k !== "inizio");
    });
  }, { threshold: 0.2 });
  chs.forEach((c) => axIO.observe(c));
  // Se l'osservatore tarda (scheda in secondo piano), il capitolo sullo schermo si accende lo stesso
  setTimeout(() => chs.forEach((c) => {
    const r = c.getBoundingClientRect();
    if (r.top < innerHeight && r.bottom > 0 && !c.classList.contains("is-in")) { c.classList.add("is-in"); c.querySelectorAll(".ax-n").forEach(axCount); }
  }), 1200);
}

function axCount(el) {
  const to = Number(el.dataset.to) || 0, t0 = performance.now(), ms = 900;
  const step = (t) => {
    const k = Math.min(1, (t - t0) / ms);
    el.textContent = Math.round(to * (1 - Math.pow(1 - k, 3)));
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
  setTimeout(() => { el.textContent = to; }, ms + 300);      // se l'animazione si ferma, il numero giusto c'è comunque
}

function axGo(k) {
  const el = document.getElementById("ax-" + k);
  if (!el) return;
  const reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 56, behavior: reduce ? "auto" : "smooth" });
}

/* Una categoria di chi parla in evidenza: le altre si spengono */
function axCat(b) {
  const on = b.getAttribute("aria-pressed") !== "true";
  document.querySelectorAll(".ax__lg").forEach((x) => x.setAttribute("aria-pressed", String(x === b && on)));
  document.querySelectorAll(".ax__voices i").forEach((i) => i.classList.toggle("is-dim", on && i.dataset.c !== b.dataset.k));
}

/* Una parola toccata: chi la usa, per chi, con quale frase */
function axWord(b) {
  const box = document.getElementById("ax-wordbox");
  const w = AXW[Number(b.dataset.k)];
  if (!box || !w) return;
  const open = b.getAttribute("aria-expanded") === "true";
  document.querySelectorAll(".ax__word").forEach((x) => x.setAttribute("aria-expanded", "false"));
  if (open) { box.hidden = true; return; }
  b.setAttribute("aria-expanded", "true");
  const who = joinIt([...w.srcs].map((x) => `<b>${esc(srcName(x))}</b>`));
  box.innerHTML = `<p class="ax__wt">«${esc(w.termine)}»</p><p>La ${w.srcs.size === 1 ? "usa" : "usano"} ${who}${w.refs.size ? `, per ${joinIt([...w.refs].map(esc))}` : ""}.</p>${proofChips(w.ev, {}, "w" + b.dataset.k)}`;
  box.hidden = false;
}

/* Ogni prova si apre toccando la testata: frase breve e link all'originale */
function proofChips(evs, U, key) {
  const seen = {};
  return `<div class="pchips">${evs.map((e, i) => {
    const id = key + "-" + i;
    PROOFS[id] = e;
    const dup = seen[e.source] = (seen[e.source] || 0) + 1;
    return `<button class="pchip mono" type="button" data-act="proof" data-p="${esc(id)}" aria-expanded="false">${esc(srcName(e.source))}${dup > 1 ? " " + dup : ""}</button>`;
  }).join("")}</div><div class="proofbox" hidden></div>`;
}

function fmtDelta(min) {
  if (min < 60) return min + " min";
  const h = Math.floor(min / 60), m = min % 60;
  return h + " h" + (m ? " " + m + " min" : "");
}

/* ---------- Edicola ---------- */
async function renderEdicola() {
  const D = await api("day", 30000);
  const C = ctx(D.articles, D.stories);
  const today = D.articles.filter((a) => isToday(a.ts)).sort((p, q) => q.ts - p.ts);
  const live = META.sources.filter((s) => s.ok);
  const hidden = META.sources.filter((s) => !s.ok);
  const groups = META.groups.map((cc) => ({ cc, papers: live.filter((s) => s.cc === cc) })).filter((g) => g.papers.length);
  const html = groups.map(({ cc, papers }) => {
    const n = today.filter((a) => papers.some((s) => s.key === a.s)).length;
    return `<section class="eg" id="eg-${cc}" aria-labelledby="egh-${cc}"><h2 class="eg__h" id="egh-${cc}"><span class="eg__cc mono">${cc}</span><span class="eg__name">${esc(META.countries[cc])}</span>
      <span class="eg__n mono">${pl(papers.length, "testata", "testate")} · ${pl(n, "notizia", "notizie")} oggi</span></h2>
      <div class="eg__grid">${papers.map((s) => paperHTML(s, today, C)).join("")}</div></section>`;
  }).join("");
  // In testa i numeri dell'Edicola e l'indice dei paesi, da toccare per andare al gruppo
  const stat = (n, label) => `<div><dd>${n}</dd><dt class="mono">${label}</dt></div>`;
  const idx = groups.map(({ cc, papers }) => `<button type="button" class="ed-idx__b" data-act="eg-go" data-k="${cc}"><span class="mono">${cc}</span>${esc(META.countries[cc])} <b>${papers.length}</b></button>`).join("");
  return {
    title: "Edicola", nav: "edicola", watch: true,
    html: `<div class="wrap page"><header class="phead phead--edicola"><p class="mono muted">Le testate del mondo, ogni giorno</p><h1 class="phead__t">Edicola</h1>
      <dl class="ed-stats">${stat(live.length, live.length === 1 ? "giornale" : "giornali")}${stat(groups.length, groups.length === 1 ? "paese" : "paesi e aree")}${stat(today.length, "notizie oggi")}</dl>
      <nav class="ed-idx" aria-label="Vai a un paese">${idx}</nav></header>${html}
      <p class="note mono">${hidden.length ? `${pl(hidden.length, "testata ha", "testate hanno")} il feed in verifica (${hidden.map((s) => esc(s.n)).join(", ")}) e ${hidden.length === 1 ? "resta nascosta" : "restano nascoste"} finché non ${hidden.length === 1 ? "torna" : "tornano"} ad aggiornarsi.` : "Le testate con il feed in verifica restano nascoste finché non tornano ad aggiornarsi."}</p></div>`,
  };
}

function paperHTML(S, today, C) {
  const arts = today.filter((a) => a.s === S.key);
  const last = arts.find((a) => !LOWVAL[a.x]) || arts[0];
  const secs = [];
  arts.forEach((a) => { if (!secs.includes(TL[a.k])) secs.push(TL[a.k]); });
  const p = last ? parts(last) : null;
  return `<article class="paper${isFav(S.key) ? " is-fav" : ""}"><h3 class="paper__n"><a href="${esc(safeUrl(S.u))}" target="_blank" rel="noopener">${esc(S.n)}<span class="ext" aria-hidden="true"> ↗</span></a></h3>
    ${secs.length ? `<p class="paper__secs">${secs.map((x) => `<span class="mono">${esc(x)}</span>`).join("")}</p>` : ""}
    ${last ? `<p class="paper__l"><span class="mono muted">${last.t}</span> <a ${linkFor(last)} lang="${p.main.lang}">${esc(p.main.txt)}</a></p>` : '<p class="paper__l muted">Ancora nessuna notizia oggi.</p>'}
    <p class="paper__f"><span class="mono acc">${pl(arts.length, "notizia", "notizie")} oggi</span>
      <button class="mono pfav" type="button" data-act="pref-src" data-k="${S.key}" aria-pressed="${isFav(S.key)}">${isFav(S.key) ? "★ Nella mia edicola" : "☆ Aggiungi alla mia edicola"}</button></p></article>`;
}

/* ---------- Cerca ---------- */
let searchTimer = null;

async function renderSearch(params) {
  const q = params.get("q") || "";
  const sugg = await suggestions();
  setTimeout(() => {
    const input = document.getElementById("q");
    if (!input) return;
    input.addEventListener("input", () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        const v = input.value.trim();
        history.replaceState(null, "", v ? "/cerca?q=" + encodeURIComponent(v) : "/cerca");
        renderResults(v);
      }, 220);
    });
    if (!q) input.focus();
    renderResults(q);
  });
  return {
    title: "Cerca", nav: "",
    html: `<div class="wrap page"><header class="phead"><p class="mono muted">Archivio · ultimi 3 giorni</p><h1 class="phead__t">Cerca</h1></header>
      <form class="sform" id="sform" role="search" onsubmit="return false"><label class="mono muted" for="q">Cerca fra titoli, testate e paesi</label>
      <input id="q" name="q" type="search" autocomplete="off" enterkeyhint="search" placeholder="${esc(sugg.slice(0, 3).join(", ") || "Un nome, un paese, una testata")}…" value="${esc(q)}"></form>
      ${sugg.length ? `<div class="sugg"><span class="mono muted">Le più seguite</span>${sugg.map((w) => `<button class="chip-b" type="button" data-act="sugg" data-q="${esc(w)}"><span class="mono">${esc(w)}</span></button>`).join("")}</div>` : ""}
      <div id="results" class="results" aria-live="polite"></div></div>`,
  };
}

/* Suggerimenti: la parola più caratteristica delle storie più seguite di oggi */
async function suggestions() {
  try {
    const F = await api(`front?day=${META.days[0]}&ed=${META.edition}`, 60000);
    const D = F.stories.length ? F : await api("day", 60000);
    const out = [];
    D.stories.slice(0, 12).forEach((s) => {
      const w = (s.t.match(/[A-ZÀ-Ý][\wÀ-ÿ'’-]{3,}(?:\s[A-ZÀ-Ý][\wÀ-ÿ'’-]+)?/g) || []).find((x) => !/^(Il|La|Le|Lo|Gli|Un|Una|Dopo|Con|Per|Tra)$/.test(x.split(" ")[0]));
      if (w && !out.includes(w) && out.length < 6) out.push(w);
    });
    return out;
  } catch (e) { return []; }
}

async function renderResults(q) {
  const box = document.getElementById("results");
  if (!box) return;
  if (norm(q.trim()).length < 2) {
    box.innerHTML = '<p class="note">Scrivi almeno due lettere. La ricerca guarda titoli tradotti e originali, nomi delle testate e paesi: trovi come lo stesso fatto è stato raccontato da giornali diversi.</p>';
    return;
  }
  const seq = ++searchSeq;
  let R;
  try { R = await api("search?q=" + encodeURIComponent(q.trim()), 15000); } catch (e) { box.innerHTML = `<p class="note">Ricerca non riuscita (${esc(e.message)}).</p>`; return; }
  if (seq !== searchSeq || !document.getElementById("results")) return;
  const C = ctx(R.articles, R.stories);
  const inS = new Set(R.stories.map((s) => s.id));
  const hits = R.hits.map((id) => C.A[id]).filter(Boolean);
  const singles = hits.filter((a) => !(a.st && inS.has(a.st)));
  box.innerHTML = `<p class="status mono">${pl(hits.length, "risultato", "risultati")}${R.stories.length ? " · " + pl(R.stories.length, "storia", "storie") : ""}</p>` +
    (R.stories.length ? `<div class="cards">${R.stories.map(cardHTML).join("")}</div>` : "") +
    (singles.length ? `<ol class="rows">${singles.slice(0, 120).map((a) => rowHTML(a, C)).join("")}</ol>` : "") +
    (!hits.length ? `<p class="note">Nessun titolo contiene «${esc(q)}». Prova con un nome o un paese.</p>` : "");
}

/* ---------- La mia edicola ----------
   Le scelte del lettore (macrotemi, temi personali, testate preferite) restano solo in questo
   browser: è una simulazione senza account. Con gli account basterà salvare lo stesso oggetto
   sul server al posto di localStorage. */
const PREF_KEY = "igg-edicola";
const MAX_THEMES = 10;

function loadPrefs() {
  try {
    const p = JSON.parse(load(PREF_KEY) || "{}");
    return { topics: p.topics || [], themes: p.themes || [], sources: p.sources || [] };
  } catch (e) {
    return { topics: [], themes: [], sources: [] };
  }
}
let PREFS = loadPrefs();
function savePrefs() { save(PREF_KEY, JSON.stringify(PREFS)); }
const hasPrefs = () => PREFS.topics.length + PREFS.themes.length + PREFS.sources.length > 0;
const isFav = (k) => PREFS.sources.includes(k);
const favMark = (k) => (isFav(k) ? '<span class="fav" title="Nella mia edicola">★</span>' : "");
function toggleIn(list, k) { const i = list.indexOf(k); if (i >= 0) list.splice(i, 1); else list.push(k); }

/* Un tema personale corrisponde se compare nel titolo (tradotto o originale) o nel paese della notizia */
function matchTheme(a, theme) {
  const q = norm(theme);
  return norm([a.it || "", a.o || ""].join(" ")).includes(q) || norm(a.w || "") === q;
}

function mineBlock(title, kicker, arts, D, C, key) {
  const ids = new Set(arts.map((a) => a.st).filter(Boolean));
  const stories = D.stories.filter((s) => ids.has(s.id)).slice(0, 3);
  const inStory = new Set(stories.map((s) => s.id));
  const singles = arts.filter((a) => !(a.st && inStory.has(a.st))).slice(0, 8);
  return `<section class="sec mine"><h2 class="sec-h">${esc(title)} <span class="mono muted">${esc(kicker)} · ${pl(arts.length, "notizia", "notizie")} oggi</span></h2>
    ${stories.length ? `<div class="cards">${stories.map(cardHTML).join("")}</div>` : ""}
    ${singles.length ? `<ol class="rows">${rowsHTML(singles, C, key)}</ol>` : ""}
    ${!arts.length ? '<p class="note">Oggi nessuna notizia su questo tema.</p>' : ""}</section>`;
}

function prefPanelHTML(today, open) {
  const tc = {}, sc = {}, wc = {};
  today.forEach((a) => {
    tc[a.k] = (tc[a.k] || 0) + 1;
    sc[a.s] = (sc[a.s] || 0) + 1;
    // "Italia" e "Mondo" non servono come temi: c'è già il macrotema, o non dicono nulla
    if (a.w && a.w !== "Mondo" && a.w !== "Italia") wc[a.w] = (wc[a.w] || 0) + 1;
  });
  const sugg = Object.entries(wc).sort((a, b) => b[1] - a[1]).map(([w]) => w)
    .filter((w) => !PREFS.themes.some((t) => norm(t) === norm(w))).slice(0, 8);
  const topics = META.topics.map(([k, n]) => {
    const on = PREFS.topics.includes(k);
    return `<button class="pchoice" type="button" data-act="pref-topic" data-k="${k}" aria-pressed="${on}"><span>${esc(n)}</span><span class="pchoice__n">${tc[k] || 0}</span></button>`;
  }).join("");
  const themes = PREFS.themes.map((t) => `<span class="ptheme">${esc(t)}<button type="button" data-act="pref-theme-del" data-k="${esc(t)}" aria-label="Togli ${esc(t)}">×</button></span>`).join("");
  const groups = META.groups.map((cc) => {
    const papers = META.sources.filter((s) => s.cc === cc);
    if (!papers.length) return "";
    return `<div class="psrc"><p class="mono muted psrc__h">${esc(META.countries[cc])}</p><div class="psrc__list">${papers.map((s) => {
      const on = isFav(s.key);
      return `<button class="pchoice pchoice--src" type="button" data-act="pref-src" data-k="${s.key}" aria-pressed="${on}"><span>${on ? "★" : "☆"} ${esc(s.n)}</span><span class="pchoice__n">${sc[s.key] || 0}</span></button>`;
    }).join("")}</div></div>`;
  }).join("");
  return `<details class="pref" id="pref" ${open ? "open" : ""}><summary class="pref__sum"><span class="mono">Personalizza</span>
      <span class="mono muted">${pl(PREFS.topics.length, "macrotema", "macrotemi")} · ${pl(PREFS.themes.length, "tema", "temi")} · ${pl(PREFS.sources.length, "testata", "testate")}</span></summary>
    <div class="pref__body">
      <div class="pref__group"><h3 class="pref__h">Macrotemi</h3><p class="note">Le sezioni del giornale che vuoi in testa alla tua pagina. Il numero sono le notizie di oggi.</p><div class="pref__chips">${topics}</div></div>
      <div class="pref__group"><h3 class="pref__h">I tuoi temi</h3><p class="note">Un nome, un paese, un argomento: raccogliamo ogni notizia che lo cita, in qualsiasi testata.</p>
        <form class="ptheme__form" id="theme-form" autocomplete="off"><label class="vh" for="theme-in">Nuovo tema</label>
          <input id="theme-in" type="text" maxlength="40" placeholder="Es. Serbia, intelligenza artificiale, Juventus">
          <button class="btn" type="submit">Aggiungi</button></form>
        ${themes ? `<div class="ptheme__list">${themes}</div>` : ""}
        ${sugg.length ? `<p class="mono muted ptheme__sugg">Di cui si parla oggi: ${sugg.map((w) => `<button class="chip-b" type="button" data-act="pref-theme-add" data-k="${esc(w)}"><span class="mono">+ ${esc(w)}</span></button>`).join("")}</p>` : ""}</div>
      <div class="pref__group"><h3 class="pref__h">Testate preferite</h3><p class="note">Le loro notizie arrivano in una sezione tutta tua e sono segnate con ★ in tutto il sito.</p>${groups}</div>
      <p class="pref__foot"><span class="mono muted">Le scelte restano su questo dispositivo, senza account e senza cookie.</span>${hasPrefs() ? '<button class="mono pref__reset" type="button" data-act="pref-reset">Azzera tutto</button>' : ""}</p>
    </div></details>`;
}

async function renderMyEdicola(params) {
  const D = await api("day", 30000);
  const C = ctx(D.articles, D.stories);
  const today = D.articles.filter((a) => isToday(a.ts)).sort((p, q) => q.ts - p.ts);
  const blocks = [];
  PREFS.topics.forEach((k) => blocks.push(mineBlock(TL[k], "Macrotema", today.filter((a) => a.k === k), D, C, "mt-" + k)));
  PREFS.themes.forEach((t, i) => blocks.push(mineBlock(t, "Tema", today.filter((a) => matchTheme(a, t)), D, C, "th-" + i)));
  if (PREFS.sources.length) {
    const fav = today.filter((a) => isFav(a.s));
    const last = PREFS.sources.map((k) => fav.find((a) => a.s === k)).filter(Boolean);
    blocks.push(`<section class="sec mine"><h2 class="sec-h">Dalle tue testate <span class="mono muted">${pl(PREFS.sources.length, "testata", "testate")} · ${pl(fav.length, "notizia", "notizie")} oggi</span></h2>
      ${last.length ? `<div class="cards mine__front">${last.map((a) => {
        const p = parts(a);
        return `<a class="card" ${linkFor(a)}>${photoHTML(a.img, a.s, "pic--card", "")}<span class="mono card__k"><b class="acc">★ ${esc(srcName(a.s))}</b> · ${a.t}</span><span class="card__t" lang="${p.main.lang}">${esc(p.main.txt)}</span>${p.sub ? `<span class="card__s" lang="${p.sub.lang}">${esc(p.sub.txt)}</span>` : ""}</a>`;
      }).join("")}</div>` : '<p class="note">Le tue testate oggi non hanno ancora pubblicato.</p>'}
      ${fav.length > last.length ? `<ol class="rows">${rowsHTML(fav.filter((a) => !last.includes(a)).slice(0, 12), C, "fv")}</ol>` : ""}</section>`);
  }
  const all = new Set();
  today.forEach((a) => {
    if (PREFS.topics.includes(a.k) || isFav(a.s) || PREFS.themes.some((t) => matchTheme(a, t))) all.add(a.id);
  });
  const intro = hasPrefs()
    ? `<p class="phead__d">Oggi per te ${pl(all.size, "notizia", "notizie")}, da ${pl(new Set(today.filter((a) => all.has(a.id)).map((a) => a.s)).size, "testata", "testate")}.</p>`
    : `<p class="phead__d">Scegli macrotemi, temi e testate: questa pagina si compone da sola con le notizie di oggi.</p>`;
  const empty = !hasPrefs()
    ? `<div class="empty mine__empty"><p class="mono muted">Per iniziare</p><h2 class="empty__t">La tua edicola è vuota.</h2>
        <p>Apri «Personalizza» qui sopra e tocca quello che ti interessa: un macrotema, un paese come tema, una testata. Si aggiorna subito.</p></div>`
    : "";
  return {
    title: "La mia edicola", nav: "mia", watch: true,
    after: () => {
      const f = document.getElementById("theme-form");
      if (f) f.addEventListener("submit", (e) => { e.preventDefault(); addTheme(document.getElementById("theme-in").value); });
    },
    html: `<div class="wrap page"><header class="phead"><p class="mono muted">Personale</p><h1 class="phead__t">La mia edicola</h1>${intro}</header>
      ${prefPanelHTML(today, !hasPrefs() || params.get("modifica") === "1")}${empty}${blocks.join("")}</div>`,
  };
}

function addTheme(raw) {
  const t = String(raw || "").replace(/\s+/g, " ").trim();
  if (t.length < 2 || PREFS.themes.length >= MAX_THEMES || PREFS.themes.some((x) => norm(x) === norm(t))) return;
  PREFS.themes.push(t);
  prefChanged();
}

/* Le scelte cambiano solo la pagina corrente: si ridisegna mantenendo aperto il pannello */
function prefChanged() {
  savePrefs();
  const open = document.getElementById("pref")?.open;
  route({ keep: true }).then(() => { const p = document.getElementById("pref"); if (p && open) p.open = true; });
}

/* ---------- Pagine istituzionali ---------- */
function infoPages() {
  const n = META.sources.length;
  const versione = META.demo
    ? "<h2>Questa versione</h2><p>Stai guardando la modalità demo: un’istantanea di domenica 25 ottobre 2026 alle 20:50, con le notizie dalle 17:00 in poi. I titoli sono sintesi scritte per il prototipo e i link aprono la home page della testata. Avvia il server senza <code>--demo</code> per leggere i feed veri.</p>"
    : `<h2>Da dove arrivano i dati</h2><p>Il server legge i feed RSS pubblici delle testate ogni cinque minuti e tiene le notizie degli ultimi tre giorni. Ogni titolo porta all’articolo sul sito che l’ha pubblicato.</p>${META.translate ? "" : "<p>In questa installazione le traduzioni automatiche non sono attive: i titoli in altre lingue compaiono in originale, con la lingua indicata accanto alla testata.</p>"}`;
  return {
    "come-funziona": { t: "Come funziona", b:
      `<p>Il Grande Giornale raccoglie i titoli di ${n} testate italiane e internazionali e li mette in un’unica prima pagina. Ogni notizia rimanda all’articolo sul sito della testata che l’ha pubblicata.</p>
      <h2>Le notizie</h2><p>Quando più testate raccontano lo stesso fatto, i loro titoli vengono riuniti in una storia. Una storia sale in prima pagina in base a quante testate diverse la raccontano e a quanto è recente. Ogni giornale conta una volta sola, anche se pubblica più articoli sullo stesso fatto.</p>
      <p>Le notizie raccontate da una sola testata restano in Ultim’ora. Dirette, notiziari e anteprime non finiscono mai in apertura. Il raggruppamento è automatico e può sbagliare: se due notizie diverse finiscono nella stessa storia, segnalacelo.</p>
      <h2>Le edizioni</h2><p>La giornata ha quattro edizioni: notte (00–06), mattina (06–12), pomeriggio (12–18) e sera (18–24). Quando un’edizione chiude, la sua prima pagina viene salvata così com’era e resta consultabile per due settimane.</p>
      <h2>Le traduzioni</h2><p>I titoli in altre lingue compaiono tradotti in italiano, con l’originale sotto e la lingua indicata accanto al nome della testata. Il pulsante «Titoli originali» in alto inverte l’ordine. Le traduzioni e i titoli delle storie più seguite sono scritti in automatico da un modello linguistico (Claude) a partire dai soli titoli delle testate.</p>
      <h2>Titoli ed estratti</h2><p>Titoli ed estratti appartengono alle rispettive testate. Mostriamo il titolo e al massimo una riga di sintesi presa dal feed: per leggere la notizia si va sempre sul sito che l’ha pubblicata.</p><p>Le foto sono quelle che le testate stesse mettono nei loro feed: le mostriamo caricandole dai loro siti, senza copiarle, sempre con il nome della testata e il collegamento all’articolo.</p>${versione}` },
    "chi-siamo": { t: "Chi siamo", b:
      '<p><span class="ph">DA COMPILARE</span> Chi cura il progetto, da dove nasce l’idea e come si sostiene.</p><p>Il Grande Giornale non scrive notizie: le raccoglie, le mette in ordine e rimanda a chi le ha pubblicate.</p>' },
    "contatti": { t: "Contatti", b:
      '<p>Per segnalare un errore in un titolo, proporre una testata o scrivere alla redazione: <span class="ph">DA COMPILARE: INDIRIZZO EMAIL</span></p><p>Se segnali una notizia, indica il nome della testata e l’orario che vedi accanto al titolo.</p>' },
    "privacy": { t: "Privacy", b:
      '<p><span class="ph">DA COMPILARE</span> Informativa a cura del titolare del trattamento: dati raccolti, finalità e base giuridica, tempi di conservazione, destinatari, diritti dell’interessato e come esercitarli.</p><p>Nota tecnica per chi la redige: il sito carica il carattere Glacial Indifference dalla rete di distribuzione jsDelivr, quindi l’indirizzo IP del visitatore arriva a jsDelivr. Per evitarlo si può ospitare il carattere sul proprio server.</p><p>Anche le foto delle notizie si caricano direttamente dai siti delle testate che le hanno pubblicate: quei siti ricevono l’indirizzo IP del visitatore (non la pagina da cui arriva, che non viene inviata).</p>' },
    "cookie": { t: "Cookie", b:
      '<p><span class="ph">DA COMPILARE</span> Elenco dei cookie e degli strumenti di analisi effettivamente in uso, con durata e finalità.</p><p>Il sito non usa cookie: salva nel tuo browser solo il tema scelto e la preferenza sui titoli originali.</p>' },
  };
}

function renderInfo(k) {
  const p = infoPages()[k];
  return { title: p.t, nav: "", html: `<div class="wrap page"><header class="phead"><p class="mono muted">Il giornale</p><h1 class="phead__t">${p.t}</h1></header><div class="prose">${p.b}</div></div>` };
}

function render404() {
  return { title: "Pagina non trovata", nav: "", html: `<div class="wrap page"><div class="empty"><p class="mono muted">Errore 404</p><h2 class="empty__t">Questa pagina non c’è.</h2><p>Forse il link è vecchio o c’è un errore di battitura.</p><a class="btn" href="/">Torna alla prima pagina</a></div></div>` };
}

/* ---------- Router ---------- */
const INFO = ["come-funziona", "chi-siamo", "contatti", "privacy", "cookie"];
let current = null;

async function route(opts = {}) {
  readClose(true);
  heroStop();
  globeStop();
  if (axIO) { axIO.disconnect(); axIO = null; }
  const url = new URL(location.href);
  const path = url.pathname.replace(/\/+$/, "") || "/";
  const seg = path.split("/").filter(Boolean);
  const seq = ++renderSeq;
  const key = path + url.search;
  if (key !== current) { state.open = {}; if (!opts.keep) view.innerHTML = loadingHTML(); }
  let out;
  try {
    if (path === "/") out = await renderHome(url.searchParams);
    else if (path === "/internazionale") out = await renderSection("esteri");
    else if (seg.length === 1 && TL[seg[0]]) out = await renderSection(seg[0]);
    else if (path === "/edicola") out = await renderEdicola();
    else if (path === "/la-mia-edicola") out = await renderMyEdicola(url.searchParams);
    else if (path === "/cerca") out = await renderSearch(url.searchParams);
    else if (seg[0] === "storia" && seg.length === 2) out = await renderStory(decodeURIComponent(seg[1]), url.searchParams);
    else if (seg[0] === "paese" && seg.length === 2) out = await renderCountry(decodeURIComponent(seg[1]));
    else if (seg.length === 1 && INFO.includes(seg[0])) out = renderInfo(seg[0]);
    else out = render404();
  } catch (e) {
    if (seq !== renderSeq) return;
    view.innerHTML = errorHTML(e.message);
    return;
  }
  if (seq !== renderSeq) return;
  const y = window.scrollY;
  view.innerHTML = out.html;
  if (opts.keep) window.scrollTo(0, y);
  document.title = out.title ? out.title + " — Il Grande Giornale" : "Il Grande Giornale";
  markNav(out.nav);
  if (key !== current && !opts.keep && !opts.pop) { window.scrollTo(0, 0); view.focus({ preventScroll: true }); }
  current = key;
  if (out.after) out.after();
  watching = !!out.watch;
  seenChanged = META.changed;
  fresh.hidden = true;
}

function markNav(k) {
  const list = document.getElementById("nav");
  let cur = null;
  list.querySelectorAll("a[data-r]").forEach((a) => {
    if (a.dataset.r === k) { a.setAttribute("aria-current", "page"); cur = a; } else a.removeAttribute("aria-current");
  });
  if (cur) list.scrollLeft = cur.offsetLeft - list.clientWidth / 2 + cur.clientWidth / 2;
}

function go(href) {
  history.pushState(null, "", href);
  return route();
}

async function reload() {
  cache.clear();
  await refreshMeta();
  route({ keep: true });
}

window.addEventListener("popstate", () => route({ pop: true }));
document.addEventListener("focusin", (e) => { const c = e.target.closest && e.target.closest(".gchip"); if (c) globeInfo(c.dataset.country); });
document.addEventListener("focusout", (e) => { if (e.target.closest && e.target.closest(".gchip")) globeInfo(null); });

document.addEventListener("click", (e) => {
  const a = e.target.closest("a[href]");
  // Un articolo di una testata: prima l'invito a leggerlo, poi il sito del giornale
  if (a && a.dataset.art && ARTS.has(a.dataset.art) && !e.defaultPrevented && e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) {
    e.preventDefault();
    readOpen(a.dataset.art, a);
    return;
  }
  if (a && !e.defaultPrevented && e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && !a.target) {
    const href = a.getAttribute("href");
    if (href.startsWith("/") && !href.startsWith("//")) {
      e.preventDefault();
      if (a.dataset.country) { countryGo(a.dataset.country); return; }
      if (a.dataset.act === "back" && history.length > 1 && document.referrer.startsWith(location.origin)) { history.back(); return; }
      if (a.dataset.keep) { history.replaceState(null, "", href); route({ keep: true }); return; }
      go(href);
      return;
    }
  }
  const b = e.target.closest("[data-act]");
  if (!b || b.tagName === "A") return;
  const act = b.dataset.act, k = b.dataset.k;
  if (act === "topic") { state.topic = k; route({ keep: true }); }
  else if (act === "expand") { state.open[b.dataset.g] = 1; route({ keep: true }); }
  else if (act === "fonte") { state.fonte = k; route({ keep: true }); }
  else if (act === "dove") { state.dove = k; route({ keep: true }); }
  else if (act === "reload") reload();
  else if (act === "proof") toggleProof(b);
  else if (act === "read-close") readClose();
  else if (act === "ax-go") axGo(k);
  else if (act === "eg-go") { const g = document.getElementById("eg-" + k); if (g) window.scrollTo({ top: g.getBoundingClientRect().top + window.scrollY - 64, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" }); }
  else if (act === "ax-cat") axCat(b);
  else if (act === "ax-word") axWord(b);
  else if (act === "hero-prev") heroGo(hero ? hero.i - 1 : 0, true);
  else if (act === "hero-next") heroGo(hero ? hero.i + 1 : 0, true);
  else if (act === "hero-go") heroGo(Number(k), true);
  else if (act === "hero-pause") heroPause();
  else if (act === "cs-prev") csMove(-1);
  else if (act === "cs-next") csMove(1);
  else if (act === "globe-zoom") { if (globe) globe.zoomBy(Number(k)); }
  else if (act === "globe-spin") { if (globe) { globe.toggleSpin(); syncSpin(b); } }
  else if (act === "pref-topic") { toggleIn(PREFS.topics, k); prefChanged(); }
  else if (act === "pref-src") { toggleIn(PREFS.sources, k); prefChanged(); }
  else if (act === "pref-theme-del") { PREFS.themes = PREFS.themes.filter((t) => t !== k); prefChanged(); }
  else if (act === "pref-theme-add") addTheme(k);
  else if (act === "pref-reset") { if (confirm("Azzerare macrotemi, temi e testate preferite?")) { PREFS = { topics: [], themes: [], sources: [] }; prefChanged(); } }
  else if (act === "sugg") {
    const q = document.getElementById("q");
    if (q) { q.value = b.dataset.q; q.dispatchEvent(new Event("input")); }
  }
});

function toggleProof(b) {
  const row = b.closest(".pchips"), box = row.nextElementSibling, e = PROOFS[b.dataset.p];
  const open = b.getAttribute("aria-expanded") === "true";
  row.querySelectorAll(".pchip").forEach((x) => x.setAttribute("aria-expanded", "false"));
  if (open || !e) { box.hidden = true; return; }
  b.setAttribute("aria-expanded", "true");
  const url = e.url || "";
  box.innerHTML = `<p class="proofbox__q">«${esc(e.prova)}»</p><p class="mono proofbox__m">${esc(srcName(e.source))}${url ? ` · <a href="${esc(safeUrl(url))}" target="_blank" rel="noopener">Leggi l’articolo ↗</a>` : ""}</p>`;
  box.hidden = false;
}

/* ---------- Testata: aggiornamenti, titoli originali, tema, orologio ---------- */
const upd = document.getElementById("upd");
let watching = false;

async function refreshMeta() {
  META = await api("meta");
  META.sources.forEach((s) => { SRC[s.key] = s; });
  META.topics.forEach(([k, n]) => { TL[k] = n; });
  if (META.demo) { upd.textContent = "Demo · istantanea 25.10.2026, 20:50"; upd.classList.remove("is-live"); }
  else if (META.updated) { upd.textContent = "Aggiornato alle " + hm(META.updated); upd.classList.add("is-live"); }
  else { upd.textContent = "Primo aggiornamento in corso…"; upd.classList.remove("is-live"); }
}

async function poll() {
  if (document.hidden || META.demo) return;
  const prev = seenChanged;
  try { await refreshMeta(); } catch (e) { return; }
  if (!watching || prev == null || !META.changed || META.changed <= prev) return;
  // Le notizie nuove non cambiano la pagina sotto gli occhi: si propone di caricarle
  const btn = fresh.querySelector("button");
  btn.textContent = "Nuove notizie · Aggiorna";
  fresh.hidden = false;
}
setInterval(poll, 60000);
document.addEventListener("visibilitychange", () => { if (!document.hidden) poll(); });

const btnOrig = document.getElementById("btn-orig");
function syncOrig() { btnOrig.setAttribute("aria-pressed", state.orig ? "true" : "false"); }
btnOrig.addEventListener("click", () => {
  state.orig = !state.orig;
  save("igg-orig", state.orig ? "1" : "0");
  syncOrig();
  if (location.pathname === "/cerca") renderResults(document.getElementById("q")?.value || "");
  else route({ keep: true });
});
syncOrig();

/* Stile: magazine (predefinito), pop o svizzero; si sceglie in alto o con ?stile= nell'indirizzo */
const STYLE_BTN = { magazine: document.getElementById("st-mag"), pop: document.getElementById("st-pop"), svizzero: document.getElementById("st-swiss") };
const OWN_HOME = ["pop", "magazine"];  // stili con una prima pagina diversa dallo svizzero
const curStyle = () => document.documentElement.getAttribute("data-style") || "svizzero";
function syncStyle() {
  const cur = curStyle();
  Object.entries(STYLE_BTN).forEach(([s, b]) => b && b.setAttribute("aria-pressed", String(s === cur)));
}
function setStyle(s) {
  const before = curStyle();
  if (s === "magazine" || OWN_HOME.includes(s)) document.documentElement.setAttribute("data-style", s);
  else document.documentElement.removeAttribute("data-style");
  save("igg-style", s);
  syncStyle();
  // Pop e magazine hanno una prima pagina diversa (globo in testa, foto grande della prima notizia):
  // si ridisegna; altrimenti basta ridipingere il globo con i colori nuovi
  if (META && before !== s && (OWN_HOME.includes(before) || OWN_HOME.includes(s))) route({ keep: true });
  else if (globe) globe.redraw();
}
Object.entries(STYLE_BTN).forEach(([s, b]) => b && b.addEventListener("click", () => setStyle(s)));
syncStyle();

const thL = document.getElementById("th-light"), thD = document.getElementById("th-dark");
const mq = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
function isDark() {
  const t = document.documentElement.getAttribute("data-theme");
  if (t === "dark") return true;
  if (t === "light") return false;
  return !!(mq && mq.matches);
}
function syncTheme() { const d = isDark(); thD.setAttribute("aria-pressed", String(d)); thL.setAttribute("aria-pressed", String(!d)); }
function setTheme(t) { document.documentElement.setAttribute("data-theme", t); save("igg-theme", t); syncTheme(); if (globe) globe.redraw(); }
thL.addEventListener("click", () => setTheme("light"));
thD.addEventListener("click", () => setTheme("dark"));
if (mq && mq.addEventListener) mq.addEventListener("change", () => { syncTheme(); if (globe) globe.redraw(); });
syncTheme();

const clock = document.getElementById("clock");
const fmtClock = new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
function tick() { clock.textContent = fmtClock.format(new Date()); }
tick();
setInterval(tick, 1000);

/* ---------- Avvio ---------- */
(async function start() {
  try { await refreshMeta(); } catch (e) { view.innerHTML = errorHTML(e.message); upd.textContent = "Non collegato"; return; }
  route();
})();
