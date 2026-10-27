/* L'Edicola (pages/Edicola.jsx): tutte le testate, raggruppate per paese. In testa i numeri
   (giornali, paesi, notizie di oggi) e l'indice dei paesi da toccare; per ogni testata le sezioni
   di oggi, l'ultima notizia e il pulsante per metterla nella propria edicola. */
import { useMemo } from "react";
import { useGiornale, useVista, safeUrl, pl, LOWVAL, riduciMovimento } from "@/components/giornale";
import { LinkArticolo, Caricamento, Errore } from "@/components/Pezzi";

function Giornale({ S, oggi }) {
  const { TL, parts, isFav, toggle } = useGiornale();
  const arts = oggi.filter((a) => a.s === S.key);
  const ultima = arts.find((a) => !LOWVAL[a.x]) || arts[0];
  const sezioni = [...new Set(arts.map((a) => TL[a.k]))];
  const p = ultima && parts(ultima), fav = isFav(S.key);
  return (
    <article className={"paper" + (fav ? " is-fav" : "")}>
      <h3 className="paper__n"><a href={safeUrl(S.u)} target="_blank" rel="noopener">{S.n}<span className="ext" aria-hidden="true"> ↗</span></a></h3>
      {sezioni.length > 0 && <p className="paper__secs">{sezioni.map((x) => <span key={x} className="mono">{x}</span>)}</p>}
      {ultima
        ? <p className="paper__l"><span className="mono muted">{ultima.t}</span> <LinkArticolo a={ultima} lang={p.main.lang}>{p.main.txt}</LinkArticolo></p>
        : <p className="paper__l muted">Ancora nessuna notizia oggi.</p>}
      <p className="paper__f"><span className="mono acc">{pl(arts.length, "notizia", "notizie")} oggi</span>
        <button className="mono pfav" type="button" aria-pressed={fav} onClick={() => toggle("sources", S.key)}>{fav ? "★ Nella mia edicola" : "☆ Aggiungi alla mia edicola"}</button></p>
    </article>
  );
}

export default function Edicola() {
  const { meta, isToday } = useGiornale();
  const { data: D, errore } = useVista("day", meta ? {} : null, 30000, [!!meta]);

  const v = useMemo(() => {
    if (!D || !meta) return null;
    const oggi = D.articles.filter((a) => isToday(a.ts)).sort((p, q) => q.ts - p.ts);
    const vive = meta.sources.filter((s) => s.ok);
    const nascoste = meta.sources.filter((s) => !s.ok);
    const gruppi = meta.groups.map((cc) => ({ cc, papers: vive.filter((s) => s.cc === cc) })).filter((g) => g.papers.length);
    return { oggi, vive, nascoste, gruppi };
  }, [D, meta]);

  if (errore) return <Errore msg={errore} onRetry={() => location.reload()} />;
  if (!v) return <Caricamento />;
  const { oggi, vive, nascoste, gruppi } = v;
  const num = (n, t) => <div><dd>{n}</dd><dt className="mono">{t}</dt></div>;
  const vai = (cc) => {
    const el = document.getElementById("eg-" + cc);
    if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 64, behavior: riduciMovimento() ? "auto" : "smooth" });
  };

  return (
    <div className="wrap page">
      <header className="phead phead--edicola">
        <p className="mono muted">Le testate del mondo, ogni giorno</p>
        <h1 className="phead__t">Edicola</h1>
        <dl className="ed-stats">{num(vive.length, vive.length === 1 ? "giornale" : "giornali")}{num(gruppi.length, gruppi.length === 1 ? "paese" : "paesi e aree")}{num(oggi.length, "notizie oggi")}</dl>
        <nav className="ed-idx" aria-label="Vai a un paese">
          {gruppi.map(({ cc, papers }) => <button key={cc} type="button" className="ed-idx__b" onClick={() => vai(cc)}><span className="mono">{cc}</span>{meta.countries[cc]} <b>{papers.length}</b></button>)}
        </nav>
      </header>
      {gruppi.map(({ cc, papers }) => {
        const n = oggi.filter((a) => papers.some((s) => s.key === a.s)).length;
        return (
          <section key={cc} className="eg" id={"eg-" + cc} aria-labelledby={"egh-" + cc}>
            <h2 className="eg__h" id={"egh-" + cc}><span className="eg__cc mono">{cc}</span><span className="eg__name">{meta.countries[cc]}</span>
              <span className="eg__n mono">{pl(papers.length, "testata", "testate")} · {pl(n, "notizia", "notizie")} oggi</span></h2>
            <div className="eg__grid">{papers.map((S) => <Giornale key={S.key} S={S} oggi={oggi} />)}</div>
          </section>
        );
      })}
      <p className="note mono">{nascoste.length
        ? `${pl(nascoste.length, "testata ha", "testate hanno")} il feed in verifica (${nascoste.map((s) => s.n).join(", ")}) e ${nascoste.length === 1 ? "resta nascosta" : "restano nascoste"} finché non ${nascoste.length === 1 ? "torna" : "tornano"} ad aggiornarsi.`
        : "Le testate con il feed in verifica restano nascoste finché non tornano ad aggiornarsi."}</p>
    </div>
  );
}
