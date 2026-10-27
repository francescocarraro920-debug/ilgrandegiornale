/* Il globo interattivo (components/Globo.jsx): canvas, proiezione ortografica, si trascina, si avvicina,
   gira da solo; i paesi con notizie sono colorati. Pacchetti npm: d3-geo, topojson-client, world-atlas. */
import { useEffect, useRef } from "react";
import { geoOrthographic, geoPath, geoGraticule10, geoDistance, geoContains, geoCentroid, geoArea } from "d3-geo";
import { feature } from "topojson-client";
import mondo from "world-atlas/countries-110m.json";

const PAESI = feature(mondo, mondo.objects.countries).features;
const SPIN = 0.06, IDLE_MS = 6000, ZOOM_MIN = 1, ZOOM_MAX = 6;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const css = (el, n) => getComputedStyle(el).getPropertyValue(n).trim();

/* Centro e area del pezzo più grande: la Francia sta in Europa, non in Guyana */
function pezzoPrincipale(f) {
  if (f.geometry.type !== "MultiPolygon") return { c: geoCentroid(f), area: geoArea(f) };
  let best = null, area = -1;
  for (const c of f.geometry.coordinates) { const p = { type: "Polygon", coordinates: c }, a = geoArea(p); if (a > area) { area = a; best = p; } }
  return { c: geoCentroid(best), area };
}

/**
 * paesi: Map(id -> { nome, n, caldo }); scelto: id; onScegli(id): tocco su un paese con notizie;
 * onSopra(id | null): col mouse, il paese con notizie sotto il puntatore (null quando si esce);
 * comandi: ref che riceve { volaA(id, { adatta, ms }) -> Promise, zoom(f), giraOFerma() -> bool, gira() -> bool }.
 */
export default function Globo({ paesi, scelto, onScegli, onSopra = () => {}, comandi }) {
  const stageRef = useRef(null), canvasRef = useRef(null), tipRef = useRef(null);
  const sceltoRef = useRef(scelto);
  // Le funzioni del genitore possono cambiare a ogni disegno: il globo legge sempre le ultime
  const cb = useRef(null);
  cb.current = { onScegli, onSopra };
  const ridisegna = useRef(() => {});

  useEffect(() => { sceltoRef.current = scelto; ridisegna.current(); }, [scelto]);

  useEffect(() => {
    const stage = stageRef.current, canvas = canvasRef.current, ctx = canvas.getContext("2d"), tip = tipRef.current;
    const perId = new Map(PAESI.map((f) => [f.id, f]));
    const centri = new Map(), aree = new Map();
    paesi.forEach((v, id) => {
      if (!perId.has(id)) return;
      const m = pezzoPrincipale(perId.get(id));
      centri.set(id, m.c); aree.set(id, m.area);
    });
    const etichette = [...paesi.entries()].filter(([id]) => centri.has(id)).sort((a, b) => b[1].n - a[1].n).slice(0, 8).map(([id]) => id);
    const proj = geoOrthographic().clipAngle(90).precision(0.4);
    const path = geoPath(proj, ctx);
    const grat = geoGraticule10();
    const riduci = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    let W = 0, base = 0, dpr = 1, zoom = 1, rot = [-12, -38], spin = !riduci, fermoFino = 0;
    let volo = null, sporco = true, vivo = true, raf = 0, visibile = true, drag = null, pizzico = null, sopra = null;
    const dita = new Map();
    const centroVista = () => [-rot[0], -rot[1]];
    const ll0 = centri.get(sceltoRef.current);
    if (ll0) rot = [-ll0[0], clamp(-ll0[1], -70, 70)];

    function misura() {
      const w = Math.round(canvas.clientWidth);         // il disegno, non il contenitore: nel magazine ha una cornice
      if (!w || w === W) return;
      W = w; dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = W * dpr; canvas.height = W * dpr;
      base = W / 2 - 6; proj.translate([W / 2, W / 2]); sporco = true;
    }

    function pillola(x, y, w, h, r) {
      ctx.beginPath(); ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
    }

    function disegna() {
      const c = Object.fromEntries(["ocean", "grat", "land", "low", "high", "border", "sel", "rim", "label", "label-ink", "sel-ink"].map((k) => [k, css(stage, "--g-" + k)]));
      const sel = sceltoRef.current;
      proj.rotate(rot).scale(base * zoom);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, W);
      ctx.beginPath(); path({ type: "Sphere" }); ctx.fillStyle = c.ocean; ctx.fill();
      ctx.beginPath(); path(grat); ctx.strokeStyle = c.grat; ctx.lineWidth = 0.6; ctx.stroke();
      for (const f of PAESI) {
        const d = paesi.get(f.id);
        ctx.beginPath(); path(f);
        ctx.fillStyle = d ? (d.caldo ? c.high : c.low) : c.land; ctx.fill();
        ctx.strokeStyle = c.border; ctx.lineWidth = 0.7; ctx.stroke();
      }
      if (sel && perId.has(sel)) { ctx.beginPath(); path(perId.get(sel)); ctx.lineWidth = 3; ctx.strokeStyle = c.sel; ctx.stroke(); }
      ctx.beginPath(); path({ type: "Sphere" }); ctx.lineWidth = 3; ctx.strokeStyle = c.rim; ctx.stroke();
      // Etichette: prima il paese scelto, poi i più raccontati; quelle che si toccano si saltano
      ctx.font = "600 13px Jost, Futura, Arial, sans-serif"; ctx.textBaseline = "middle";
      const ids = sel && centri.has(sel) ? [sel, ...etichette.filter((x) => x !== sel)] : etichette;
      const prese = [];
      for (const id of ids) {
        const ll = centri.get(id);
        if (geoDistance(ll, centroVista()) > 1.3) continue;
        const [x, y] = proj(ll), d = paesi.get(id), txt = `${d.nome} ${d.n}`, w = ctx.measureText(txt).width + 18;
        const box = [x - w / 2 - 3, y - 15, x + w / 2 + 3, y + 15];
        if (prese.some((b) => box[0] < b[2] && box[2] > b[0] && box[1] < b[3] && box[3] > b[1])) continue;
        prese.push(box);
        const on = id === sel;
        ctx.fillStyle = on ? c.sel : c.label; pillola(x - w / 2, y - 12, w, 24, 12); ctx.fill();
        ctx.fillStyle = on ? c["sel-ink"] : c["label-ink"]; ctx.fillText(txt, x - w / 2 + 9, y + 1);
      }
    }

    function fotogramma(t) {
      if (!vivo) return;
      if (volo) {
        const k = clamp((t - volo.t0) / volo.ms, 0, 1), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
        rot = [volo.da[0] + volo.d[0] * e, volo.da[1] + volo.d[1] * e];
        zoom = volo.z0 + volo.dz * e;
        if (k >= 1) { const fatto = volo.fatto; volo = null; fatto(); }
        sporco = true;
      } else if (spin && visibile && !document.hidden && !drag && !pizzico && performance.now() > fermoFino) {
        rot[0] += SPIN; sporco = true;
      }
      if (sporco && visibile) { disegna(); sporco = false; }
      raf = requestAnimationFrame(fotogramma);
    }

    const tocca = () => { fermoFino = performance.now() + IDLE_MS; volo = null; };
    const locale = (e) => { const b = canvas.getBoundingClientRect(); return [e.clientX - b.left, e.clientY - b.top]; };
    function paeseIn(x, y) {
      if (Math.hypot(x - W / 2, y - W / 2) > base * zoom) return null;
      const ll = proj.invert([x, y]);
      if (!ll || geoDistance(ll, centroVista()) > Math.PI / 2) return null;
      const f = PAESI.find((p) => geoContains(p, ll));
      return f ? f.id : null;
    }

    const giu = (e) => {
      canvas.setPointerCapture(e.pointerId); dita.set(e.pointerId, locale(e)); tocca();
      if (dita.size === 1) { const [x, y] = locale(e); drag = { x0: x, y0: y, rot: rot.slice(), t: performance.now(), mosso: false }; }
      else if (dita.size === 2) { const [a, b] = [...dita.values()]; pizzico = { d: Math.hypot(a[0] - b[0], a[1] - b[1]) || 1, zoom }; drag = null; }
    };
    const muovi = (e) => {
      const p = locale(e);
      if (dita.has(e.pointerId)) {
        dita.set(e.pointerId, p);
        if (pizzico && dita.size === 2) {
          const [a, b] = [...dita.values()];
          zoom = clamp(pizzico.zoom * Math.hypot(a[0] - b[0], a[1] - b[1]) / pizzico.d, ZOOM_MIN, ZOOM_MAX); sporco = true;
        } else if (drag) {
          const dx = p[0] - drag.x0, dy = p[1] - drag.y0;
          if (Math.abs(dx) + Math.abs(dy) > 4) { drag.mosso = true; canvas.classList.add("is-drag"); }
          const k = 180 / Math.PI / (base * zoom);
          rot = [drag.rot[0] + dx * k, clamp(drag.rot[1] - dy * k, -85, 85)]; sporco = true;
        }
        tocca();
        return;
      }
      if (e.pointerType !== "mouse") return;
      const id = paeseIn(...p), d = id && paesi.get(id);
      canvas.classList.toggle("is-over", !!d);
      const ora = d ? id : null;
      if (ora !== sopra) { sopra = ora; cb.current.onSopra(ora); }
      if (d) { tip.textContent = `${d.nome} · ${d.n} ${d.n === 1 ? "testata" : "testate"}`; tip.style.left = p[0] + canvas.offsetLeft + "px"; tip.style.top = p[1] + canvas.offsetTop + "px"; tip.hidden = false; }
      else tip.hidden = true;
    };
    const su = (e) => {
      const era = drag;
      dita.delete(e.pointerId); canvas.classList.remove("is-drag");
      if (dita.size < 2) pizzico = null;
      if (dita.size === 0) drag = null;
      if (e.type === "pointerup" && era && !era.mosso && performance.now() - era.t < 500) {
        const id = paeseIn(...locale(e));
        if (id && paesi.has(id)) cb.current.onScegli(id);
      }
    };
    const rotella = (e) => {
      if (!e.ctrlKey && !e.metaKey) return;          // la rotella da sola scorre la pagina
      e.preventDefault(); zoom = clamp(zoom * Math.exp(-e.deltaY * 0.01), ZOOM_MIN, ZOOM_MAX); tocca(); sporco = true;
    };
    const esci = () => { tip.hidden = true; canvas.classList.remove("is-over"); if (sopra) { sopra = null; cb.current.onSopra(null); } };

    canvas.addEventListener("pointerdown", giu);
    canvas.addEventListener("pointermove", muovi);
    canvas.addEventListener("pointerup", su);
    canvas.addEventListener("pointercancel", su);
    canvas.addEventListener("pointerleave", esci);
    canvas.addEventListener("wheel", rotella, { passive: false });
    const ro = new ResizeObserver(misura); ro.observe(stage);
    const io = new IntersectionObserver(([x]) => { visibile = x.isIntersecting; if (visibile) sporco = true; }); io.observe(stage);
    // Il tema cambia gli attributi di <html>: si ridisegna con i colori nuovi
    const mo = new MutationObserver(() => { sporco = true; });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "data-style"] });
    document.fonts?.load("600 13px Jost").then(() => { sporco = true; });
    misura();
    ridisegna.current = () => { sporco = true; };

    if (comandi) comandi.current = {
      /* Gira fino a mettere il paese al centro; con adatta si avvicina secondo la sua grandezza
         (Italia o Israele molto, Russia o Cina poco). La promessa si risolve all'arrivo. */
      volaA(id, { adatta = false, ms = 900 } = {}) {
        const ll = centri.get(id);
        if (!ll) return Promise.resolve();
        const a = [-ll[0], clamp(-ll[1], -70, 70)], dl = ((a[0] - rot[0]) % 360 + 540) % 360 - 180;   // strada più corta
        const z1 = adatta ? clamp(0.8 / Math.sqrt(aree.get(id) || 0.01), 1.4, 5) : zoom;
        fermoFino = performance.now() + IDLE_MS;
        if (riduci) { rot = a; zoom = z1; sporco = true; return Promise.resolve(); }
        return new Promise((fatto) => { volo = { da: rot.slice(), d: [dl, a[1] - rot[1]], z0: zoom, dz: z1 - zoom, t0: performance.now(), ms, fatto }; });
      },
      zoom(f) { zoom = clamp(zoom * f, ZOOM_MIN, ZOOM_MAX); tocca(); sporco = true; },
      giraOFerma() { spin = !spin; fermoFino = 0; return spin; },
      gira: () => spin,
    };
    raf = requestAnimationFrame(fotogramma);
    return () => {
      vivo = false; cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); mo.disconnect();
      canvas.removeEventListener("pointerdown", giu); canvas.removeEventListener("pointermove", muovi);
      canvas.removeEventListener("pointerup", su); canvas.removeEventListener("pointercancel", su);
      canvas.removeEventListener("pointerleave", esci); canvas.removeEventListener("wheel", rotella);
    };
  }, [paesi]);

  return (
    <div className="globe__stage" ref={stageRef}>
      <canvas ref={canvasRef} className="globe__cv" role="img"
        aria-label="Globo con i paesi di cui parlano le testate in questa edizione. Per sceglierne uno con la tastiera usa l’elenco dei paesi." />
      <div className="globe__tip" ref={tipRef} hidden />
    </div>
  );
}
