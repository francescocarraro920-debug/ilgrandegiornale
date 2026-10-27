/* Pezzi riusabili del giornale (components/Pezzi.jsx).
   Stesso HTML e stesse classi del sito di riferimento, così app.css, magazine.css e pop.css
   funzionano senza modifiche. */
import { useState } from "react";
import { Link } from "react-router-dom";
import { useGiornale, hm, pl, url, safeUrl, LOWVAL } from "@/components/giornale";

/* Le foto restano sul sito della testata: si caricano da lì, con il credito; se non si caricano spariscono */
export function Foto({ src, testata, cls = "pic--card", alt = "" }) {
  const { srcName } = useGiornale();
  const [rotta, setRotta] = useState(false);
  if (!src || !/^https?:\/\//i.test(src) || rotta) return null;
  return (
    <figure className={`pic ${cls}`}>
      <img src={src} alt={alt} loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setRotta(true)} />
      {testata && <figcaption className="mono">Foto · {srcName(testata)}</figcaption>}
    </figure>
  );
}

export const LangBadge = ({ a }) => (a.l !== "it" ? <span className="badge" title="Lingua originale">{a.l.toUpperCase()}</span> : null);
const TIPI = { live: "Live", bollettino: "Notiziario", anteprima: "Anteprima", opinione: "Commento" };
export const TipoTag = ({ a }) => (TIPI[a.x] ? <span className={`tag tag--${a.x}`}>{TIPI[a.x]}</span> : null);

/* Un articolo di una testata: il link porta all'originale, ma il clic apre prima l'invito alla lettura */
export function LinkArticolo({ a, className, children, ...resto }) {
  const { apriArticolo } = useGiornale();
  return (
    <a className={className} href={safeUrl(a.u)} target="_blank" rel="noopener" {...resto}
      onClick={(e) => {
        if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        apriArticolo(a, e.currentTarget);
      }}>{children}</a>
  );
}

/* Se l'articolo fa parte di una notizia raccontata da più testate si va alla sua pagina, altrimenti all'invito */
export function LinkNotizia({ a, className, children, ...resto }) {
  if (a.st) return <Link className={className} to={url.storia(a.st)} {...resto}>{children}</Link>;
  return <LinkArticolo a={a} className={className} {...resto}>{children}</LinkArticolo>;
}

/* La copertura nel tempo: una tacca per articolo, la prima in rosso */
export function Timeline({ s, C, big }) {
  const { srcName } = useGiornale();
  const arts = s.arts.map((id) => C.A[id]).filter(Boolean).sort((p, q) => p.ts - q.ts);
  if (!arts.length) return null;
  const min = arts[0].ts, max = arts[arts.length - 1].ts, span = Math.max(max - min, 1200);
  return (
    <figure className={`tl${big ? " tl--big" : ""}`} aria-label={`Copertura nel tempo: prima testata alle ${hm(min)}, ultima alle ${hm(max)}`}>
      <div className="tl__bar">{arts.map((a, i) => (
        <i key={a.id} className={i === 0 ? "first" : ""} style={{ left: `${(((a.ts - min) / span) * 100).toFixed(2)}%` }} title={`${srcName(a.s)} · ${a.t}`} />
      ))}</div>
      <figcaption className="tl__cap mono"><span>{hm(min)} · prima {srcName(arts[0].s)}</span><span>{pl(arts.length, "articolo", "articoli")}</span><span>{hm(max)}</span></figcaption>
    </figure>
  );
}

/* Quattro titoli, possibilmente da paesi diversi e con l'originale in lingua */
export function pickTakes(s, C, SRC, n) {
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

export function Take({ a }) {
  const { srcName, parts } = useGiornale();
  const p = parts(a), name = srcName(a.s);
  return (
    <LinkArticolo a={a} className="take">
      <span className="take__m"><span className="mono acc">{name}</span><LangBadge a={a} /><span className="mono muted">{a.t}</span></span>
      <span className="take__t" lang={p.main.lang}>{p.main.txt}</span>
      {p.sub && <span className="take__o" lang={p.sub.lang}>{p.sub.txt}</span>}
      <span className="mono take__go">Vai a {name} ↗</span>
    </LinkArticolo>
  );
}

/* La scheda di una notizia raccontata da più testate */
export function Card({ s }) {
  const { TL, srcNames } = useGiornale();
  return (
    <Link className={`card${s.img ? " has-img" : ""}`} to={url.storia(s.id)}>
      <Foto src={s.img} testata={s.img_s} cls="pic--card" />
      <span className="mono card__k"><b className="acc">{pl(s.n, "testata", "testate")}</b> · {TL[s.k]} · {s.w}</span>
      <span className="card__t">{s.t}</span>
      <span className="card__s">{srcNames(s, 4)}</span>
      <span className="mono muted">Aggiornata alle {hm(s.last)}</span>
    </Link>
  );
}

function Miniatura({ a }) {
  const [rotta, setRotta] = useState(false);
  if (!a.img || rotta) return null;
  const img = <img src={a.img} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setRotta(true)} />;
  return a.st
    ? <Link className="row__img" to={url.storia(a.st)} tabIndex={-1} aria-hidden="true">{img}</Link>
    : <LinkArticolo a={a} className="row__img" tabIndex={-1} aria-hidden="true">{img}</LinkArticolo>;
}

/* Una riga di Ultim'ora / In diretta */
export function Riga({ a, C }) {
  const { srcName, ccName, parts, isFav } = useGiornale();
  const p = parts(a), s = a.st && C.ST[a.st];
  const [fotoOk] = useState(!!a.img);
  return (
    <li className={`row${fotoOk ? " has-img" : ""}`}>
      <div className="row__meta mono"><time>{a.t}</time><span>{ccName(a.s)}</span></div>
      <div className="row__b">
        <div className="row__src">
          {isFav(a.s) && <span className="fav" title="Nella mia edicola">★</span>}
          <span className="mono acc">{srcName(a.s)}</span><LangBadge a={a} /><TipoTag a={a} />
          {s ? <span className="mono muted">Storia · {pl(s.n, "testata", "testate")}</span> : a.st ? <span className="mono muted">Storia</span> : null}
        </div>
        <LinkNotizia a={a} className="row__t" lang={p.main.lang}>{p.main.txt}{!a.st && <span className="ext" aria-hidden="true"> ↗</span>}</LinkNotizia>
        {p.sub && <p className="row__o" lang={p.sub.lang}>{p.sub.txt}</p>}
      </div>
      <Miniatura a={a} />
    </li>
  );
}

/* Righe con al massimo due titoli di fila dalla stessa testata: gli altri si aprono con "+N da …" */
export function Righe({ arts, C }) {
  const { srcName } = useGiornale();
  const [aperti, setAperti] = useState({});
  const out = [];
  for (let i = 0; i < arts.length;) {
    let j = i;
    while (j < arts.length && arts[j].s === arts[i].s) j++;
    const run = arts.slice(i, j), gid = run[0].id;
    if (run.length > 2 && !aperti[gid]) {
      run.slice(0, 2).forEach((a) => out.push(<Riga key={a.id} a={a} C={C} />));
      out.push(<li key={"+" + gid} className="row row--more"><button className="mono morebtn" type="button" onClick={() => setAperti({ ...aperti, [gid]: 1 })}>+{run.length - 2} da {srcName(run[0].s)}</button></li>);
    } else run.forEach((a) => out.push(<Riga key={a.id} a={a} C={C} />));
    i = j;
  }
  return <ol className="rows">{out}</ol>;
}

/* Caricamento ed errore */
export const Caricamento = () => (
  <div className="wrap loading" aria-busy="true" aria-label="Caricamento"><div className="sk sk--s" /><div className="sk sk--t" /><div className="sk sk--l" /><div className="sk sk--l" /><div className="sk sk--s" /></div>
);
export const Errore = ({ msg, onRetry }) => (
  <div className="wrap page"><div className="empty"><p className="mono muted">Errore</p><h2 className="empty__t">Non riesco a raggiungere il server.</h2><p>{msg}</p>
    {onRetry && <button className="btn" type="button" onClick={onRetry}>Riprova</button>}</div></div>
);
