/* La pagina del paese (pages/Paese.jsx?nome=cina), dove porta il globo.
   Titolo grande, le notizie principali in grande a scorrimento laterale, poi a scendere l'elenco
   delle storie e di tutte le notizie delle ultime 36 ore che parlano di quel paese. */
import { useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useGiornale, useVista, ctx, url, hm, pl, slugOf, riduciMovimento, ISO } from "@/components/giornale";
import { Righe, LinkArticolo, Caricamento, Errore } from "@/components/Pezzi";

const ORE = 36;
const MAX_GRANDI = 8;
const due = (n) => String(n).padStart(2, "0");

function Immagine({ src, eager }) {
  const [rotta, setRotta] = useState(false);
  if (!src || rotta) return null;
  return <span className="cs__img"><img src={src} alt="" loading={eager ? "eager" : "lazy"} decoding="async" referrerPolicy="no-referrer" onError={() => setRotta(true)} /></span>;
}

/* Le notizie grandi a scorrimento laterale: lo scatto lo fa il CSS (scroll-snap), qui solo frecce e contatore */
function Carosello({ voci }) {
  const { TL, srcName, srcNames, parts } = useGiornale();
  const pista = useRef(null), timer = useRef(0);
  const [i, setI] = useState(0);
  const n = voci.length;
  const indice = () => {
    const t = pista.current, primo = t?.children[0];
    if (!t) return 0;
    const passo = primo ? primo.getBoundingClientRect().width + parseFloat(getComputedStyle(t).columnGap || 0) : t.clientWidth;
    return Math.round(t.scrollLeft / passo);
  };
  const muovi = (d) => {
    const t = pista.current;
    if (!t) return;
    const k = Math.max(0, Math.min(n - 1, indice() + d));
    t.scrollTo({ left: t.children[k].offsetLeft - t.offsetLeft, behavior: riduciMovimento() ? "auto" : "smooth" });
  };
  const testa = (k, chi, quando) => <span className="kick"><span className="chip">{due(k + 1)} / {due(n)}</span><span className="mono"><b>{chi}</b></span><span className="mono">{quando}</span></span>;

  return (
    <section className="cs" aria-label="In primo piano">
      <div className="cs__head"><h2 className="mono">In primo piano</h2>
        {n > 1 && (
          <div className="cs__nav">
            <button type="button" className="cs__btn" aria-label="Notizia precedente" onClick={() => muovi(-1)}>←</button>
            <span className="mono cs__count" aria-live="polite">{i + 1} / {n}</span>
            <button type="button" className="cs__btn" aria-label="Notizia successiva" onClick={() => muovi(1)}>→</button>
          </div>
        )}
      </div>
      <ol className="cs__track" ref={pista} tabIndex={0} aria-label="Notizie principali: scorri di lato"
        onScroll={() => { clearTimeout(timer.current); timer.current = setTimeout(() => setI(indice()), 80); }}>
        {voci.map((x, k) => {
          if (x.s) {
            const s = x.s;
            return (
              <li key={s.id} className="cs__slide"><Link className="cs__card" to={url.storia(s.id)}>
                <Immagine src={s.img} eager={k === 0} />
                <span className="cs__body">{testa(k, pl(s.n, "testata", "testate"), `${TL[s.k]} · ${hm(s.last)}`)}
                  <span className="cs__t">{s.t}</span><span className="cs__s">{srcNames(s, 4)}</span></span>
              </Link></li>
            );
          }
          const a = x.a, p = parts(a);
          return (
            <li key={a.id} className="cs__slide"><LinkArticolo a={a} className="cs__card">
              <Immagine src={a.img} />
              <span className="cs__body">{testa(k, srcName(a.s), `${TL[a.k]} · ${a.t}`)}
                <span className="cs__t" lang={p.main.lang}>{p.main.txt}</span>
                {p.sub && <span className="cs__s" lang={p.sub.lang}>{p.sub.txt}</span>}</span>
            </LinkArticolo></li>
          );
        })}
      </ol>
    </section>
  );
}

export default function Paese() {
  const { meta, TL } = useGiornale();
  const slug = new URLSearchParams(useLocation().search).get("nome") || "";
  const nome = Object.keys(ISO).find((n) => slugOf(n) === slug);
  const { data: D, errore } = useVista("day", meta && nome ? {} : null, 30000, [!!meta, nome]);

  const v = useMemo(() => {
    if (!D || !nome) return null;
    const C = ctx(D.articles, D.stories);
    const da = D.now - ORE * 3600;
    const arts = D.articles.filter((a) => a.w === nome && a.ts <= D.now && a.ts >= da).sort((p, q) => q.ts - p.ts);
    const storie = D.stories.filter((s) => s.w === nome && s.solid >= 2);
    const inStoria = new Set(storie.map((s) => s.id));
    // In grande: prima le storie raccontate da più testate, poi le notizie singole con una foto
    const grandi = storie.slice(0, MAX_GRANDI).map((s) => ({ s }))
      .concat(arts.filter((a) => a.img && !(a.st && inStoria.has(a.st))).slice(0, Math.max(0, MAX_GRANDI - storie.length)).map((a) => ({ a })));
    return { C, arts, storie, grandi, testate: new Set(arts.map((a) => a.s)).size };
  }, [D, nome]);

  if (!nome) {
    return <div className="wrap page"><div className="empty"><p className="mono muted">Paese</p><h2 className="empty__t">Questo paese non è sulla mappa.</h2><Link className="btn" to={url.home()}>Torna al globo</Link></div></div>;
  }
  if (errore) return <Errore msg={errore} onRetry={() => location.reload()} />;
  if (!v) return <Caricamento />;
  const { C, arts, storie, grandi, testate } = v;

  return (
    <div className="wrap page country">
      <Link className="back mono" to={url.home()}>← Il mondo</Link>
      <header className="country__h">
        <p className="mono">Paese · notizie delle ultime {ORE} ore</p>
        <h1 className="country__t">{nome}</h1>
        <p className="country__d">{arts.length
          ? <>Ne parlano <b>{pl(testate, "testata", "testate")}</b>: {pl(arts.length, "notizia", "notizie")}, {pl(storie.length, "storia", "storie")} raccontate da più giornali.</>
          : "In questo momento nessuna testata ne parla."}</p>
      </header>
      {grandi.length > 0 && <Carosello voci={grandi} />}
      {storie.length > 0 && (
        <section className="sec country__stories"><h2 className="sec-h">Le notizie <span className="mono muted">{pl(storie.length, "raccontata", "raccontate")} da più testate</span></h2>
          <ol className="country__list">{storie.map((s) => (
            <li key={s.id}><Link to={url.storia(s.id)}><span className="mono muted">{pl(s.n, "testata", "testate")} · {TL[s.k]} · {hm(s.last)}</span><span className="country__lt">{s.t}</span></Link></li>
          ))}</ol></section>
      )}
      {arts.length > 0 && (
        <section className="sec"><h2 className="sec-h">Tutte le notizie <span className="mono muted">{pl(arts.length, "notizia", "notizie")} · ultime {ORE} ore</span></h2><Righe arts={arts} C={C} /></section>
      )}
      {!arts.length && <div className="empty"><h2 className="empty__t">Nessuna notizia da qui nelle ultime {ORE} ore.</h2><Link className="btn" to={url.home()}>Torna al globo</Link></div>}
    </div>
  );
}
