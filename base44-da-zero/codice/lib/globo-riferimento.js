/* Il Grande Giornale · globo interattivo dello stile Pop
   Un globo su canvas (proiezione ortografica di d3-geo) che si gira trascinando, si avvicina con due
   dita, con Ctrl + rotella o con i pulsanti, e gira piano da solo quando nessuno lo tocca. I paesi
   di cui parlano le testate sono colorati; toccandone uno si chiama onPick(id).
   Confini: Natural Earth 1:110m (pubblico dominio) via world-atlas, salvati in /vendor come le
   librerie: il globo non chiama servizi esterni. */

const LIBS = ["/vendor/d3-array.min.js", "/vendor/d3-geo.min.js", "/vendor/topojson-client.min.js"];
const SPIN = 0.06;          // gradi per fotogramma quando gira da solo (circa 3,6° al secondo)
const IDLE_MS = 6000;       // dopo un tocco, riprende a girare da solo dopo questo tempo
const ZOOM_MIN = 1, ZOOM_MAX = 6;

let world = null;

function script(src) {
  return new Promise((ok, ko) => {
    const s = document.createElement("script");
    s.src = src;
    s.onload = ok;
    s.onerror = () => ko(new Error("non riesco a caricare " + src));
    document.head.appendChild(s);
  });
}

function loadWorld() {
  if (!world) {
    world = (async () => {
      for (const src of LIBS) if (!document.querySelector(`script[src="${src}"]`)) await script(src);
      const r = await fetch("/vendor/countries-110m.json");
      if (!r.ok) throw new Error("confini dei paesi non disponibili");
      const topo = await r.json();
      return window.topojson.feature(topo, topo.objects.countries).features;
    })();
    world.catch(() => { world = null; });
  }
  return world;
}

/* Centro e area del pezzo più grande: la Francia sta in Europa, non in Guyana */
function mainPart(d3, f) {
  if (f.geometry.type !== "MultiPolygon") return { c: d3.geoCentroid(f), area: d3.geoArea(f) };
  let best = null, area = -1;
  for (const coords of f.geometry.coordinates) {
    const p = { type: "Polygon", coordinates: coords }, a = d3.geoArea(p);
    if (a > area) { area = a; best = p; }
  }
  return { c: d3.geoCentroid(best), area };
}

const css = (el, name) => getComputedStyle(el).getPropertyValue(name).trim();
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/**
 * stage: contenitore con dentro un <canvas>; data: Map(id ISO numerico -> {name, n, hot});
 * selected: id iniziale; onPick(id): un paese con dati è stato toccato;
 * onHover(id | null): col mouse, il paese con dati sotto il puntatore (null quando si esce).
 */
export async function mountGlobe(stage, { data, selected, onPick, onHover = () => {} }) {
  const features = await loadWorld();
  const d3 = window.d3;
  const canvas = stage.querySelector("canvas");
  const ctx = canvas.getContext("2d");
  const tip = stage.querySelector(".globe__tip");
  const byId = new Map(features.map((f) => [f.id, f]));
  const centers = new Map(), areas = new Map();
  data.forEach((v, id) => {
    if (!byId.has(id)) return;
    const m = mainPart(d3, byId.get(id));
    centers.set(id, m.c);
    areas.set(id, m.area);
  });
  // Le etichette sul globo solo per i paesi più raccontati, per non coprirlo
  const labelled = [...data.entries()].filter(([id]) => centers.has(id)).sort((a, b) => b[1].n - a[1].n).slice(0, 8).map(([id]) => id);

  const proj = d3.geoOrthographic().clipAngle(90).precision(0.4);
  const path = d3.geoPath(proj, ctx);
  const grat = d3.geoGraticule10();
  const reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

  let W = 0, base = 0, dpr = 1, zoom = 1;
  let rot = [-12, -38];
  let sel = selected;
  let spin = !reduce;                 // scelta del lettore (pulsante): girare da solo o no
  let idleUntil = 0;
  let anim = null;                    // volo verso un paese
  let dirty = true, alive = true, raf = 0, visible = true;
  const pointers = new Map();
  let drag = null, pinch = null, over = null;

  const center = () => [-rot[0], -rot[1]];

  function resize() {
    const w = Math.round(canvas.clientWidth);         // il canvas, non il contenitore: può avere una cornice
    if (!w || w === W) return;
    W = w;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = W * dpr;
    canvas.height = W * dpr;
    base = W / 2 - 6;
    proj.translate([W / 2, W / 2]);
    dirty = true;
  }

  function draw() {
    const c = {
      ocean: css(stage, "--g-ocean"), grat: css(stage, "--g-grat"), land: css(stage, "--g-land"),
      low: css(stage, "--g-low"), high: css(stage, "--g-high"), border: css(stage, "--g-border"),
      sel: css(stage, "--g-sel"), rim: css(stage, "--g-rim"), label: css(stage, "--g-label"), ink: css(stage, "--g-label-ink"), selInk: css(stage, "--g-sel-ink"),
    };
    proj.rotate(rot).scale(base * zoom);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, W);

    ctx.beginPath(); path({ type: "Sphere" }); ctx.fillStyle = c.ocean; ctx.fill();
    ctx.beginPath(); path(grat); ctx.strokeStyle = c.grat; ctx.lineWidth = 0.6; ctx.stroke();

    for (const f of features) {
      const d = data.get(f.id);
      ctx.beginPath(); path(f);
      ctx.fillStyle = d ? (d.hot ? c.high : c.low) : c.land;
      ctx.fill();
      ctx.strokeStyle = c.border; ctx.lineWidth = 0.7; ctx.stroke();
    }
    const fs = sel && byId.get(sel);
    if (fs) {
      ctx.beginPath(); path(fs);
      ctx.lineWidth = 3; ctx.strokeStyle = c.sel; ctx.stroke();
    }
    ctx.beginPath(); path({ type: "Sphere" }); ctx.lineWidth = 3; ctx.strokeStyle = c.rim; ctx.stroke();

    // Etichette: pillole con nome e testate, solo sulla faccia visibile
    ctx.font = "600 13px Jost, Futura, Arial, sans-serif";
    ctx.textBaseline = "middle";
    // Prima il paese scelto, poi i più raccontati; un'etichetta che ne tocca una già messa si salta
    const ids = sel && centers.has(sel) ? [sel, ...labelled.filter((x) => x !== sel)] : labelled;
    const taken = [];
    for (const id of ids) {
      const ll = centers.get(id);
      if (d3.geoDistance(ll, center()) > 1.3) continue;
      const [x, y] = proj(ll);
      const d = data.get(id), txt = `${d.name} ${d.n}`;
      const w = ctx.measureText(txt).width + 18;
      const box = [x - w / 2 - 3, y - 15, x + w / 2 + 3, y + 15];
      if (taken.some((b) => box[0] < b[2] && box[2] > b[0] && box[1] < b[3] && box[3] > b[1])) continue;
      taken.push(box);
      const on = id === sel;
      ctx.fillStyle = on ? c.sel : c.label;
      roundRect(x - w / 2, y - 12, w, 24, 12);
      ctx.fill();
      ctx.fillStyle = on ? c.selInk : c.ink;
      ctx.fillText(txt, x - w / 2 + 9, y + 1);
    }
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function frame(t) {
    if (!alive) return;
    if (anim) {
      const k = clamp((t - anim.t0) / anim.ms, 0, 1), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      rot = [anim.from[0] + anim.d[0] * e, anim.from[1] + anim.d[1] * e];
      zoom = anim.z0 + anim.dz * e;
      if (k >= 1) { const done = anim.done; anim = null; if (done) done(); }
      dirty = true;
    } else if (spin && visible && !document.hidden && !drag && !pinch && performance.now() > idleUntil) {
      rot[0] += SPIN;
      dirty = true;
    }
    if (dirty && visible) { draw(); dirty = false; }
    raf = requestAnimationFrame(frame);
  }

  function touched() { idleUntil = performance.now() + IDLE_MS; anim = null; }

  function pickAt(x, y) {
    const r = Math.hypot(x - W / 2, y - W / 2);
    if (r > base * zoom) return null;
    const ll = proj.invert([x, y]);
    if (!ll || d3.geoDistance(ll, center()) > Math.PI / 2) return null;
    for (const f of features) if (d3.geoContains(f, ll)) return f.id;
    return null;
  }

  const local = (e) => { const b = canvas.getBoundingClientRect(); return [e.clientX - b.left, e.clientY - b.top]; };

  function onDown(e) {
    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, local(e));
    touched();
    if (pointers.size === 1) {
      const [x, y] = local(e);
      drag = { x, y, x0: x, y0: y, rot: rot.slice(), t: performance.now(), moved: false };
    } else if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]) || 1, zoom };
      drag = null;
    }
  }

  function onMove(e) {
    const p = local(e);
    if (pointers.has(e.pointerId)) {
      pointers.set(e.pointerId, p);
      if (pinch && pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        zoom = clamp(pinch.zoom * Math.hypot(a[0] - b[0], a[1] - b[1]) / pinch.d, ZOOM_MIN, ZOOM_MAX);
        dirty = true;
      } else if (drag) {
        const dx = p[0] - drag.x0, dy = p[1] - drag.y0;
        if (Math.abs(dx) + Math.abs(dy) > 4) { drag.moved = true; canvas.classList.add("is-drag"); }
        const k = 180 / Math.PI / (base * zoom);          // gradi per pixel al centro del globo
        rot = [drag.rot[0] + dx * k, clamp(drag.rot[1] - dy * k, -85, 85)];
        dirty = true;
      }
      touched();
      return;
    }
    if (e.pointerType === "mouse") hover(p);
  }

  function onUp(e) {
    const was = drag;
    pointers.delete(e.pointerId);
    canvas.classList.remove("is-drag");
    if (pointers.size < 2) pinch = null;
    if (pointers.size === 0) drag = null;
    if (e.type === "pointerup" && was && !was.moved && performance.now() - was.t < 500) {
      const id = pickAt(...local(e));
      if (id && data.has(id)) { sel = id; dirty = true; onPick(id); }
    }
  }

  function hover([x, y]) {
    const id = pickAt(x, y);
    const d = id && data.get(id);
    canvas.classList.toggle("is-over", !!d);
    const now = d ? id : null;
    if (now !== over) { over = now; onHover(now); }
    if (!tip) return;
    if (d) {
      tip.textContent = `${d.name} · ${d.n} ${d.n === 1 ? "testata" : "testate"}`;
      tip.style.left = x + canvas.offsetLeft + "px";
      tip.style.top = y + canvas.offsetTop + "px";
      tip.hidden = false;
    } else tip.hidden = true;
  }

  function onWheel(e) {
    // Solo con Ctrl/⌘ (e il pizzico del trackpad, che arriva così): la rotella da sola scorre la pagina
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    zoom = clamp(zoom * Math.exp(-e.deltaY * 0.01), ZOOM_MIN, ZOOM_MAX);
    touched();
    dirty = true;
  }

  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerup", onUp);
  canvas.addEventListener("pointercancel", onUp);
  canvas.addEventListener("pointerleave", () => {
    if (tip) tip.hidden = true;
    canvas.classList.remove("is-over");
    if (over) { over = null; onHover(null); }
  });
  canvas.addEventListener("wheel", onWheel, { passive: false });

  const ro = new ResizeObserver(() => { resize(); });
  ro.observe(stage);
  const io = new IntersectionObserver(([en]) => { visible = en.isIntersecting; if (visible) dirty = true; });
  io.observe(stage);
  resize();

  const ctl = {
    /** Gira il globo fino a mettere il paese al centro; con fit si avvicina secondo la sua grandezza.
        La promessa si risolve all'arrivo. */
    flyTo(id, { fit = false, ms = 900 } = {}) {
      const ll = centers.get(id);
      if (!ll) return Promise.resolve();
      const to = [-ll[0], clamp(-ll[1], -70, 70)];
      const dl = ((to[0] - rot[0]) % 360 + 540) % 360 - 180;     // la strada più corta
      // Italia o Israele molto vicini, Russia o Cina appena: lo zoom va con la radice dell'area
      const z1 = fit ? clamp(0.8 / Math.sqrt(areas.get(id) || 0.01), 1.4, 5) : zoom;
      idleUntil = performance.now() + IDLE_MS;
      if (reduce) { rot = to; zoom = z1; dirty = true; return Promise.resolve(); }
      return new Promise((done) => {
        anim = { from: rot.slice(), d: [dl, to[1] - rot[1]], z0: zoom, dz: z1 - zoom, t0: performance.now(), ms, done };
      });
    },
    select(id) { sel = id; dirty = true; },
    zoomBy(f) { zoom = clamp(zoom * f, ZOOM_MIN, ZOOM_MAX); touched(); dirty = true; },
    toggleSpin() { spin = !spin; idleUntil = 0; return spin; },
    spinning: () => spin,
    redraw() { dirty = true; },
    destroy() {
      alive = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
    },
  };

  // Le etichette usano Jost: si ridisegna appena il carattere è pronto
  if (document.fonts && document.fonts.load) document.fonts.load("600 13px Jost").then(() => { dirty = true; });
  if (sel) { const ll = centers.get(sel); if (ll) rot = [-ll[0], clamp(-ll[1], -70, 70)]; }
  raf = requestAnimationFrame(frame);
  return ctl;
}
