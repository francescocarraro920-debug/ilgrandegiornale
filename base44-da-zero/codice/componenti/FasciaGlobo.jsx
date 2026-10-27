/* La fascia del globo in prima pagina (components/FasciaGlobo.jsx): titolo o numeri del paese sotto il
   mouse, il globo con i pulsanti, la fila dei paesi; toccando un paese il globo ci vola sopra, un cerchio
   (una tendina nello svizzero) si allarga con il nome e si apre la pagina del paese. */
import { useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Globo from "@/components/Globo";
import { useGiornale, ISO, HOT, url, hm, pl, riduciMovimento } from "@/components/giornale";

/* I paesi delle notizie dell'edizione: testate diverse, notizie, storie */
export function globeData(win, elig) {
  const by = new Map();
  win.forEach((a) => {
    const id = ISO[a.w];
    if (!id) return;
    if (!by.has(id)) by.set(id, { id, name: a.w, srcs: new Set(), arts: [] });
    by.get(id).srcs.add(a.s);
    by.get(id).arts.push(a);
  });
  return [...by.values()].map((c) => ({ ...c, n: c.srcs.size, hot: c.srcs.size >= HOT, stories: elig.filter((s) => s.w === c.name) }))
    .sort((p, q) => q.n - p.n || q.arts.length - p.arts.length);
}

const attendi = (ms) => new Promise((r) => setTimeout(r, ms));

/* I numeri del paese, a sinistra del globo */
function InfoPaese({ c }) {
  const { SRC, TL } = useGiornale();
  const langs = new Set(c.arts.map((a) => a.l)).size;
  const from = new Set(c.arts.map((a) => SRC[a.s]?.cc)).size;
  const per = {};
  c.arts.forEach((a) => { per[a.k] = (per[a.k] || 0) + 1; });
  const secs = Object.entries(per).sort((p, q) => q[1] - p[1]).slice(0, 4);
  const max = secs.length ? secs[0][1] : 1;
  const last = c.arts.reduce((m, a) => Math.max(m, a.ts), 0);
  const top = c.stories[0];
  const num = (n, s, p) => <div><dd>{n}</dd><dt className="mono">{n === 1 ? s : p}</dt></div>;
  return (
    <div className="ginfo">
      <p className="mono">{c.hot ? "Paese caldo" : "Paese"} · aggiornato alle {hm(last)}</p>
      <h3 className="ginfo__t">{c.name}</h3>
      <dl className="ginfo__n">{num(c.n, "testata", "testate")}{num(c.arts.length, "notizia", "notizie")}{num(c.stories.length, "storia", "storie")}{num(langs, "lingua", "lingue")}{num(from, "paese che scrive", "paesi che scrivono")}</dl>
      <ul className="ginfo__bars">{secs.map(([k, n]) => <li key={k}><span className="mono">{TL[k]}</span><i style={{ "--w": `${Math.round((n / max) * 100)}%` }} /><b>{n}</b></li>)}</ul>
      {top && <p className="ginfo__top"><span className="mono">La più seguita · {pl(top.n, "testata", "testate")}</span>{top.t}</p>}
      <p className="mono ginfo__go">Tocca il paese per aprire le sue notizie →</p>
    </div>
  );
}

export default function FasciaGlobo({ elenco, iniziale, edizione }) {
  const navigate = useNavigate();
  const [scelto, setScelto] = useState(iniziale);
  const [sopra, setSopra] = useState(null);
  const [gira, setGira] = useState(!riduciMovimento());
  const comandi = useRef(null), stage = useRef(null), inCorso = useRef(false);
  const mappa = useMemo(() => new Map(elenco.map((c) => [c.id, { nome: c.name, n: c.n, caldo: c.hot }])), [elenco]);
  const info = sopra && elenco.find((c) => c.id === sopra);

  /* Volo sul paese, cerchio (o tendina) col nome, pagina del paese, poi il cerchio svanisce */
  async function vaiAlPaese(id) {
    const c = elenco.find((x) => x.id === id);
    if (!c || inCorso.current) return;
    if (riduciMovimento() || !comandi.current) { navigate(url.paese(c.name)); return; }
    inCorso.current = true;
    setScelto(id);
    await Promise.race([comandi.current.volaA(id, { adatta: true, ms: 1000 }), attendi(1500)]);
    const r = stage.current.getBoundingClientRect();
    const iride = document.createElement("div");
    iride.className = "iris";
    iride.setAttribute("aria-hidden", "true");
    iride.style.setProperty("--x", Math.round(r.left + r.width / 2) + "px");
    iride.style.setProperty("--y", Math.round(r.top + r.height / 2) + "px");
    const t = document.createElement("span");
    t.className = "iris__t";
    t.textContent = c.name;
    iride.appendChild(t);
    document.body.appendChild(iride);
    await attendi(620);
    navigate(url.paese(c.name));
    await attendi(150);
    iride.classList.add("is-out");
    await attendi(500);
    iride.remove();
    inCorso.current = false;
  }

  return (
    <section className="globe" aria-labelledby="globe-t"><div className="wrap globe__in">
      <div className={"globe__head" + (info ? " is-info" : "")}>
        <div className="globe__intro" aria-hidden={!!info}>
          <p className="mono">Il mondo adesso · Edizione {edizione}</p>
          <h2 className="globe__t" id="globe-t">Dove si parla <em>di cosa.</em></h2>
          <p className="globe__help">Trascina il globo per farlo girare, avvicinalo con due dita o con + e −. Passa sopra un paese per i suoi numeri, toccalo per aprire le sue notizie.</p>
          <ul className="globe__legend mono">
            <li><i style={{ background: "var(--g-low)" }} />1–{HOT - 1} testate</li>
            <li><i style={{ background: "var(--g-high)" }} />{HOT} o più</li>
            <li><i style={{ background: "var(--g-land)" }} />Nessuna notizia</li>
          </ul>
        </div>
        {info && <InfoPaese key={info.id} c={info} />}
      </div>
      <div className="globe__wrap" ref={stage}>
        <Globo paesi={mappa} scelto={scelto} onScegli={vaiAlPaese} onSopra={setSopra} comandi={comandi} />
        <div className="globe__ctrl">
          <button type="button" aria-label="Avvicina" onClick={() => comandi.current?.zoom(1.5)}>+</button>
          <button type="button" aria-label="Allontana" onClick={() => comandi.current?.zoom(0.667)}>−</button>
          <button type="button" aria-pressed={!gira} aria-label={gira ? "Ferma la rotazione automatica" : "Fai girare il globo da solo"}
            onClick={() => setGira(comandi.current?.giraOFerma() ?? gira)}>{gira ? "❚❚" : "⟳"}</button>
        </div>
      </div>
      <nav className="globe__chips" aria-label="Paesi nelle notizie">
        {elenco.map((c) => (
          <Link key={c.id} to={url.paese(c.name)} className={"gchip" + (c.hot ? " is-hot" : "")}
            onClick={(e) => { if (e.metaKey || e.ctrlKey) return; e.preventDefault(); vaiAlPaese(c.id); }}
            onFocus={() => setSopra(c.id)} onBlur={() => setSopra(null)}>
            <i aria-hidden="true" />{c.name} <b>{c.n}</b>
          </Link>
        ))}
      </nav>
    </div></section>
  );
}
