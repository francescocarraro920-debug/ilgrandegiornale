/* ======================================================================
   Il Grande Giornale · libreria comune delle pagine (components/giornale.jsx)

   - chiama(azione, dati): la funzione del server "giornale", con una piccola cache;
   - GiornaleProvider / useGiornale(): i dati generali (testate, sezioni, edizioni), i titoli
     originali, le preferenze di "La mia edicola", la scheda di invito alla lettura;
   - piccole utilità: plurali, ore, titoli, nomi delle testate, link alle notizie.
   Le chiavi dei dati sono quelle brevi della funzione: id, t, ts, s, st, k, w, it, o, x, u, l, img.
   ====================================================================== */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { createPageUrl } from "@/utils";

/* ---------- Chiamate alla funzione del server ---------- */

const CACHE = new Map();
export async function chiama(azione, dati = {}, maxAge = 0) {
  const key = azione + JSON.stringify(dati);
  const hit = CACHE.get(key);
  if (hit && Date.now() - hit.at < maxAge) return hit.data;
  const res = await base44.functions.invoke("giornale", { azione, ...dati });
  const data = res?.data ?? res;               // a seconda della versione dell'SDK
  if (data && data.error && azione !== "story" && azione !== "article") throw new Error(data.error);
  CACHE.set(key, { at: Date.now(), data });
  return data;
}
export const svuotaCache = () => CACHE.clear();

/* ---------- Memoria del browser ---------- */

export const leggi = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
export const scrivi = (k, v) => { try { localStorage.setItem(k, v); } catch {} };

/* ---------- Testi e ore ---------- */

export const pl = (n, s, p) => `${n} ${n === 1 ? s : p}`;
export const norm = (s) => String(s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const fmtTime = new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", hour: "2-digit", minute: "2-digit", hour12: false });
export const fmtDay = new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", weekday: "long", day: "numeric", month: "long" });
export const fmtShort = new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", day: "numeric", month: "short" });
export const hm = (ts) => fmtTime.format(new Date(ts * 1000));
export const dayDate = (d) => new Date(d + "T12:00:00Z");
export const safeUrl = (u) => (/^https?:\/\//i.test(u || "") ? u : "#");
export const LOWVAL = { live: 1, bollettino: 1, anteprima: 1 };
export const riduciMovimento = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
export const slugOf = (name) => norm(name).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
export const joinIt = (xs) => (xs.length < 2 ? xs.join("") : xs.slice(0, -1).join(", ") + " e " + xs[xs.length - 1]);

/* ---------- Indirizzi delle pagine ---------- */

export const url = {
  home: (q = "") => createPageUrl("Home") + q,
  sezione: (k) => (k === "esteri" ? createPageUrl("Internazionale") : createPageUrl("Sezione") + "?k=" + k),
  storia: (id, analisi) => createPageUrl("Storia") + "?id=" + encodeURIComponent(id) + (analisi ? "&scheda=analisi" : ""),
  paese: (name) => createPageUrl("Paese") + "?nome=" + slugOf(name),
  edicola: () => createPageUrl("Edicola"),
  mia: () => createPageUrl("LaMiaEdicola"),
  cerca: (q) => createPageUrl("Cerca") + (q ? "?q=" + encodeURIComponent(q) : ""),
  info: (p) => createPageUrl("Info") + "?p=" + p,
};

/* ---------- Il contesto del giornale ---------- */

const Ctx = createContext(null);
export const useGiornale = () => useContext(Ctx);

const PREF_KEY = "igg-edicola";
const MAX_TEMI = 10;
const prefsVuote = { topics: [], themes: [], sources: [] };
function leggiPrefs() {
  try { const p = JSON.parse(leggi(PREF_KEY) || "{}"); return { topics: p.topics || [], themes: p.themes || [], sources: p.sources || [] }; }
  catch { return prefsVuote; }
}

export function GiornaleProvider({ children }) {
  const [meta, setMeta] = useState(null);
  const [errore, setErrore] = useState(null);
  const [orig, setOrigState] = useState(leggi("igg-orig") === "1");
  const [prefs, setPrefsState] = useState(leggiPrefs);
  const [lettura, setLettura] = useState(null);     // { articolo, da } per la scheda d'invito
  const [nuove, setNuove] = useState(false);        // ci sono notizie nuove da caricare
  const [visto, setVisto] = useState(null);

  // I dati generali si rileggono ogni minuto; se sono arrivate notizie nuove lo si dice, senza cambiare la pagina
  const rileggi = useCallback(async (primo) => {
    try {
      const m = await chiama("meta");
      setMeta(m);
      setErrore(null);
      setVisto((v) => { if (primo || v === null) return m.changed; if (m.changed && m.changed > v) setNuove(true); return v; });
    } catch (e) { if (primo) setErrore(e.message); }
  }, []);
  useEffect(() => {
    rileggi(true);
    const t = setInterval(() => { if (!document.hidden) rileggi(false); }, 60000);
    return () => clearInterval(t);
  }, [rileggi]);

  const setOrig = (v) => { setOrigState(v); scrivi("igg-orig", v ? "1" : "0"); };
  const setPrefs = (p) => { setPrefsState(p); scrivi(PREF_KEY, JSON.stringify(p)); };

  const value = useMemo(() => {
    const SRC = {}, TL = {};
    (meta?.sources || []).forEach((s) => { SRC[s.key] = s; });
    (meta?.topics || []).forEach(([k, n]) => { TL[k] = n; });
    const srcName = (k) => SRC[k]?.n || k;
    const ccName = (k) => meta?.countries?.[SRC[k]?.cc] || "";
    const isToday = (ts) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(new Date(ts * 1000)) === meta?.days?.[0];
    const srcNames = (s, max) => {
      const names = s.srcs.map(srcName);
      return names.slice(0, max).join(" · ") + (names.length > max ? " e altre " + (names.length - max) : "");
    };
    /* Titolo principale e secondario: italiano sopra, originale sotto (o il contrario con "Titoli originali") */
    const parts = (a) => {
      if (a.it && a.o) return orig ? { main: { txt: a.o, lang: a.l }, sub: { txt: a.it, lang: "it" } } : { main: { txt: a.it, lang: "it" }, sub: { txt: a.o, lang: a.l } };
      return { main: { txt: a.it || a.o, lang: a.it ? "it" : a.l }, sub: null };
    };
    const isFav = (k) => prefs.sources.includes(k);
    const toggle = (lista, k) => {
      const l = prefs[lista].includes(k) ? prefs[lista].filter((x) => x !== k) : [...prefs[lista], k];
      setPrefs({ ...prefs, [lista]: l });
    };
    const aggiungiTema = (testo) => {
      const t = String(testo || "").replace(/\s+/g, " ").trim();
      if (t.length < 2 || prefs.themes.length >= MAX_TEMI || prefs.themes.some((x) => norm(x) === norm(t))) return;
      setPrefs({ ...prefs, themes: [...prefs.themes, t] });
    };
    return {
      meta, errore, SRC, TL, srcName, ccName, srcNames, isToday, parts, orig, setOrig,
      prefs, setPrefs, isFav, toggle, aggiungiTema, togliTema: (t) => setPrefs({ ...prefs, themes: prefs.themes.filter((x) => x !== t) }),
      azzera: () => setPrefs(prefsVuote), haPrefs: prefs.topics.length + prefs.themes.length + prefs.sources.length > 0,
      lettura, apriArticolo: (articolo, da) => setLettura({ articolo, da }), chiudiArticolo: () => setLettura(null),
      nuove, ricarica: () => { svuotaCache(); setNuove(false); setVisto(meta?.changed ?? null); rileggi(false); window.dispatchEvent(new Event("igg-ricarica")); },
    };
  }, [meta, errore, orig, prefs, lettura, nuove, rileggi]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/* Le pagine si rifanno quando il lettore tocca "Nuove notizie · Aggiorna" */
export function useRicarica(fn) {
  useEffect(() => { window.addEventListener("igg-ricarica", fn); return () => window.removeEventListener("igg-ricarica", fn); }, [fn]);
}

/* Carica una vista; si ripete quando cambiano le dipendenze o il lettore chiede di aggiornare.
   Con dati = null aspetta (per esempio finché non arrivano i dati generali). */
export function useVista(azione, dati, maxAge, deps = []) {
  const [stato, setStato] = useState({ data: null, errore: null, carica: true });
  const [giro, setGiro] = useState(0);
  useRicarica(useCallback(() => setGiro((g) => g + 1), []));
  useEffect(() => {
    if (dati === null) return;
    let vivo = true;
    setStato((s) => ({ ...s, carica: true }));
    chiama(azione, dati, maxAge).then((data) => vivo && setStato({ data, errore: null, carica: false }))
      .catch((e) => vivo && setStato({ data: null, errore: e.message, carica: false }));
    return () => { vivo = false; };
  }, [...deps, giro]);
  return stato;
}

/* Indici veloci degli articoli e delle storie di una vista */
export function ctx(articles, stories) {
  const A = {}, ST = {};
  (articles || []).forEach((a) => { A[a.id] = a; });
  (stories || []).forEach((s) => { ST[s.id] = s; });
  return { A, ST };
}

/* ---------- Aspetto: stile (magazine, pop, svizzero) e tema (Carta, Notte) ---------- */

export function useAspetto() {
  const html = () => document.documentElement;
  const mq = typeof window !== "undefined" ? window.matchMedia?.("(prefers-color-scheme: dark)") : null;
  const [stile, setStileState] = useState(() => html().getAttribute("data-style") || "svizzero");
  const [scuro, setScuro] = useState(() => { const t = html().getAttribute("data-theme"); return t ? t === "dark" : !!mq?.matches; });
  useEffect(() => {
    const su = () => { if (!html().getAttribute("data-theme")) setScuro(!!mq?.matches); };
    mq?.addEventListener?.("change", su);
    return () => mq?.removeEventListener?.("change", su);
  }, []);
  const setStile = (s) => {
    if (s === "magazine" || s === "pop") html().setAttribute("data-style", s); else html().removeAttribute("data-style");
    scrivi("igg-style", s);
    setStileState(s);
    window.dispatchEvent(new Event("igg-aspetto"));
  };
  const setTema = (t) => { html().setAttribute("data-theme", t); scrivi("igg-theme", t); setScuro(t === "dark"); window.dispatchEvent(new Event("igg-aspetto")); };
  return { stile, setStile, scuro, setTema };
}
/* Lo stile corrente, che si aggiorna quando il lettore lo cambia (serve alla prima pagina) */
export function useStile() {
  const [s, set] = useState(() => (typeof document !== "undefined" ? document.documentElement.getAttribute("data-style") || "svizzero" : "magazine"));
  useEffect(() => {
    const su = () => set(document.documentElement.getAttribute("data-style") || "svizzero");
    window.addEventListener("igg-aspetto", su);
    return () => window.removeEventListener("igg-aspetto", su);
  }, []);
  return s;
}

/* ---------- Paesi del globo: nome (come lo scrive la funzione) -> codice ISO numerico ---------- */

export const ISO = {
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
export const HOT = 5;   // da quante testate un paese è "caldo"
