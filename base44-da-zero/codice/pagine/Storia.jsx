/* La pagina della notizia (pages/Storia.jsx?id=…&scheda=analisi).
   Testata della notizia con la copertura nel tempo, poi due schede: "Come lo raccontano" (una voce per
   testata, con prime righe e link) e "Analisi" (il racconto a capitoli). In fondo "Altre notizie"
   dello stesso argomento. */
import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useGiornale, useVista, ctx, url, hm, pl } from "@/components/giornale";
import { Foto, LangBadge, TipoTag, LinkArticolo, Timeline, Card, Caricamento, Errore } from "@/components/Pezzi";
import AnalisiRacconto from "@/components/AnalisiRacconto";

function Voce({ a }) {
  const { SRC, srcName, ccName, parts } = useGiornale();
  const p = parts(a), nome = srcName(a.s);
  return (
    <li className="voice">
      <div className="voice__m"><span className="mono acc">{nome}</span><LangBadge a={a} /><TipoTag a={a} />
        <span className="mono muted">{SRC[a.s]?.cc || ""} · {ccName(a.s)}</span><span className="mono muted">{a.t}</span></div>
      <p className="voice__t" lang={p.main.lang}>{p.main.txt}</p>
      {p.sub && <p className="row__o" lang={p.sub.lang}>{p.sub.txt}</p>}
      <Foto src={a.img} testata={a.s} cls="pic--voice" />
      {a.desc && <p className="voice__d" lang={a.l}>{a.desc}</p>}
      <LinkArticolo a={a} className="mono voice__go">Leggi su {nome} ↗</LinkArticolo>
    </li>
  );
}

/* Gli stati della scheda Analisi che non sono il racconto */
const Nota = ({ k, t, d }) => <div className="empty an__state"><p className="mono muted">{k}</p><h3 className="empty__t">{t}</h3><p>{d}</p></div>;

function Analisi({ id, articoli }) {
  const { srcName, SRC } = useGiornale();
  const [R, setR] = useState(null);
  useEffect(() => {
    let vivo = true, t = 0;
    const carica = async () => {
      let r;
      try { const res = await base44.functions.invoke("analisi", { story_id: id }); r = res?.data ?? res; }
      catch (e) { r = { status: "error", error: e.message }; }
      if (!vivo) return;
      setR(r);
      if (r?.status === "pending") t = setTimeout(carica, 15000);   // si riprova da solo ogni 15 secondi
    };
    carica();
    return () => { vivo = false; clearTimeout(t); };
  }, [id]);

  if (!R) return <div className="loading loading--in" aria-busy="true"><div className="sk sk--l" /><div className="sk sk--l" /><div className="sk sk--s" /></div>;
  // Il motivo tecnico serve a chi gestisce l'app, non ai lettori: non si mostra
  if (R.status === "too_few") return <Nota k="Analisi" t="Servono almeno tre testate." d={`L’analisi confronta storie raccontate da almeno ${R.min ?? 3} testate; questa per ora ne ha ${R.n}.`} />;
  if (R.status === "unavailable") return <Nota k="Analisi" t="L’analisi automatica non è attiva." d="Su questo sito il confronto fra le testate è spento." />;
  if (R.status === "blocked") return <Nota k="Analisi sospesa" t="Raggiunto il limite di spesa di oggi." d="Le nuove analisi riprendono domani. Gli articoli restano consultabili in «Come lo raccontano»." />;
  if (R.status === "error" || !R.analysis && R.status !== "pending") return <Nota k="Analisi" t="L’analisi non è riuscita." d="Riproviamo in automatico tra qualche minuto." />;
  if (R.status === "pending") {
    return (
      <div className="ax-wait" aria-busy="true"><p className="mono">Analisi in preparazione</p>
        <h3 className="ax-wait__t">Stiamo leggendo gli articoli<span className="ax-wait__dots" aria-hidden="true"><i>.</i><i>.</i><i>.</i></span></h3>
        <ol className="ax-wait__steps"><li>Leggiamo titoli ed estratti di ogni testata</li><li>Controlliamo che ogni frase citata ci sia davvero</li><li>Mettiamo a confronto fatti, cifre, voci e tempi</li></ol>
        <p className="note">Di solito serve meno di un minuto: la pagina si aggiorna da sola.</p></div>
    );
  }
  return <AnalisiRacconto rec={R} articoli={articoli} nomeTestata={srcName} paeseTestata={(k) => SRC[k]?.cc} />;
}

export default function Storia() {
  const { meta, TL, srcName } = useGiornale();
  const navigate = useNavigate();
  const q = new URLSearchParams(useLocation().search);
  const id = q.get("id") || "";
  const scheda = q.get("scheda") === "analisi" ? "analisi" : "racconti";
  const { data: V, errore, carica } = useVista("story", meta && id ? { id } : null, 30000, [id, !!meta]);

  if (errore) return <Errore msg={errore} onRetry={() => location.reload()} />;
  if (!meta || carica && !V) return <Caricamento />;
  if (!V || V.error || !V.story) {
    return (
      <div className="wrap page"><div className="empty"><p className="mono muted">Storia</p><h2 className="empty__t">Questa notizia non è più in pagina.</h2>
        <p>Le notizie restano disponibili per tre giorni. Puoi cercarne i titoli nell’archivio.</p><Link className="btn" to={url.cerca()}>Cerca</Link></div></div>
    );
  }

  const s = V.story;
  const C = ctx(V.articles.concat(V.related_articles), [s].concat(V.related));
  const arts = V.articles.slice().sort((p, r) => r.ts - p.ts);
  const primo = V.articles.slice().sort((p, r) => p.ts - r.ts)[0];

  return (
    <div className="wrap page">
      <a className="back mono" href={url.home()} onClick={(e) => { if (history.length > 1) { e.preventDefault(); navigate(-1); } }}>← Prima pagina</a>
      <header className="story__h">
        <div className="kick"><Link className="mono acc" to={url.sezione(s.k)}>{TL[s.k]}</Link><span className="mono muted">{s.w}</span><span className="mono"><b>{pl(s.n, "testata", "testate")}</b></span></div>
        <h1 className="story__t">{s.t}</h1>
        {s.d && <p className="lead__d">{s.d}</p>}
        <Timeline s={s} C={C} big />
        <p className="firstline">La prima a raccontarla è stata <b>{srcName(primo.s)}</b> alle {primo.t}. L’ultimo aggiornamento è delle {hm(s.last)}.</p>
      </header>
      <div className="sec">
        <div className="tabs" role="tablist" aria-label="Viste della storia">
          <Link className="tab mono" role="tab" to={url.storia(s.id)} replace aria-selected={scheda === "racconti"}>Come lo raccontano <span className="tab__n">{arts.length}</span></Link>
          <Link className="tab mono" role="tab" to={url.storia(s.id, true)} replace aria-selected={scheda === "analisi"}>Analisi</Link>
        </div>
        {scheda === "analisi"
          ? <section className="sec an" role="tabpanel" id="analysis" aria-live="polite"><Analisi id={s.id} articoli={V.articles} /></section>
          : <section className="sec" role="tabpanel"><ol className="voices">{arts.map((a) => <Voce key={a.id} a={a} />)}</ol></section>}
      </div>
      {V.related.length > 0 && (
        <section className="sec"><h2 className="sec-h">Altre notizie · {TL[s.k]}</h2><div className="cards">{V.related.map((r) => <Card key={r.id} s={r} />)}</div></section>
      )}
    </div>
  );
}
