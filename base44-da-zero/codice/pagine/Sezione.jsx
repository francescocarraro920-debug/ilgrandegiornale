/* Le pagine di sezione (pages/Sezione.jsx?k=italia|economia|sport|cultura|scienza).
   Internazionale ("esteri") ha una pagina tutta sua che usa questo stesso componente: il nome in grande,
   sotto la firma "Il Grande Giornale", e i filtri Fonte (paese della testata) e Dove (paese della notizia).
   In alto "Le notizie" raccontate da più testate, sotto "In diretta" tutte le altre, dalla più recente. */
import { useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { useGiornale, useVista, ctx, pl } from "@/components/giornale";
import { Card, Righe, Caricamento, Errore } from "@/components/Pezzi";

function Filtri({ etichetta, conti, totale, scelto, onScegli }) {
  const voci = [["tutte", "Tutte", totale], ...Object.entries(conti).sort((a, b) => b[1] - a[1]).map(([k, n]) => [k, k, n])];
  return (
    <div className="filt__row"><span className="mono filt__lab">{etichetta}</span>
      {voci.map(([k, t, n]) => (
        <button key={k} className={"chip-b" + (scelto === k ? " is-on" : "")} type="button" aria-pressed={scelto === k} onClick={() => onScegli(k)}>
          <span className="mono">{t}</span><span className="mono chip-b__n">{n}</span>
        </button>
      ))}
    </div>
  );
}

export function PaginaSezione({ k }) {
  const { meta, TL, ccName, isToday } = useGiornale();
  const { data: D, errore } = useVista("day", meta ? {} : null, 30000, [!!meta]);
  const [fonte, setFonte] = useState("tutte");
  const [dove, setDove] = useState("tutte");
  const intl = k === "esteri";

  const v = useMemo(() => {
    if (!D || !meta) return null;
    const C = ctx(D.articles, D.stories);
    const tutti = D.articles.filter((a) => a.k === k && a.ts <= D.now && isToday(a.ts)).sort((p, q) => q.ts - p.ts);
    const fonti = {}, luoghi = {};
    tutti.forEach((a) => { const f = ccName(a.s); fonti[f] = (fonti[f] || 0) + 1; luoghi[a.w] = (luoghi[a.w] || 0) + 1; });
    const arts = intl ? tutti.filter((a) => (fonte === "tutte" || ccName(a.s) === fonte) && (dove === "tutte" || a.w === dove)) : tutti;
    const ids = new Set(arts.map((a) => a.st).filter(Boolean));
    const storie = D.stories.filter((s) => ids.has(s.id));
    const singole = arts.filter((a) => !(a.st && ids.has(a.st) && C.ST[a.st]));
    return { C, tutti, fonti, luoghi, arts, storie, singole };
  }, [D, meta, k, fonte, dove]);

  if (errore) return <Errore msg={errore} onRetry={() => location.reload()} />;
  if (!v) return <Caricamento />;
  const { C, tutti, fonti, luoghi, arts, storie, singole } = v;

  return (
    <div className="wrap page">
      <header className={"phead" + (intl ? " phead--intl" : "")}>
        <p className="mono muted">Sezione</p>
        <h1 className="phead__t">{TL[k]}</h1>
        {intl && <p className="phead__sign">Il Grande Giornale</p>}
        <p className="phead__d">{pl(storie.length, "storia raccontata", "storie raccontate")} da più testate · {pl(arts.length, "notizia", "notizie")} oggi</p>
      </header>
      {intl && (
        <div className="filt">
          <Filtri etichetta="Fonte" conti={fonti} totale={tutti.length} scelto={fonte} onScegli={setFonte} />
          <Filtri etichetta="Dove" conti={luoghi} totale={tutti.length} scelto={dove} onScegli={setDove} />
        </div>
      )}
      {storie.length > 0 && (
        <section className="sec"><h2 className="sec-h">Le notizie <span className="mono muted">raccontate da più testate</span></h2>
          <div className="cards">{storie.map((s) => <Card key={s.id} s={s} />)}</div></section>
      )}
      <section className="sec sec--live">
        <h2 className="sec-h"><span className="live-dot" aria-hidden="true" />In diretta <span className="mono muted">{pl(singole.length, "notizia", "notizie")}, dalla più recente</span></h2>
        {singole.length ? <Righe arts={singole} C={C} /> : <p className="note">Nessuna notizia con questi filtri.</p>}
      </section>
    </div>
  );
}

const SEZIONI = ["italia", "economia", "sport", "cultura", "scienza", "esteri"];

export default function Sezione() {
  const k = new URLSearchParams(useLocation().search).get("k");
  return <PaginaSezione key={k} k={SEZIONI.includes(k) ? k : "italia"} />;
}
