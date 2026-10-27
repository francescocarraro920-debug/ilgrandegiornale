/* Cerca (pages/Cerca.jsx?q=…): fra titoli tradotti e originali, nomi delle testate e paesi degli
   ultimi tre giorni. I risultati arrivano mentre si scrive (dopo 220 ms di pausa); l'indirizzo
   tiene la ricerca, così si può condividere. Sopra, le parole delle storie più seguite di oggi. */
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useGiornale, chiama, ctx, url, pl, norm } from "@/components/giornale";
import { Card, Riga } from "@/components/Pezzi";

/* La parola più caratteristica di ciascuna delle storie più seguite di oggi */
function useSuggerimenti(meta) {
  const [out, setOut] = useState([]);
  useEffect(() => {
    if (!meta) return;
    chiama("front", { day: meta.days[0], ed: meta.edition }, 60000).then(async (F) => {
      const D = F.stories?.length ? F : await chiama("day", {}, 60000);
      const r = [];
      D.stories.slice(0, 12).forEach((s) => {
        const w = (s.t.match(/[A-ZÀ-Ý][\wÀ-ÿ'’-]{3,}(?:\s[A-ZÀ-Ý][\wÀ-ÿ'’-]+)?/g) || []).find((x) => !/^(Il|La|Le|Lo|Gli|Un|Una|Dopo|Con|Per|Tra)$/.test(x.split(" ")[0]));
        if (w && !r.includes(w) && r.length < 6) r.push(w);
      });
      setOut(r);
    }).catch(() => {});
  }, [!!meta]);
  return out;
}

function Risultati({ q }) {
  const [R, setR] = useState(null);
  const [err, setErr] = useState(null);
  const corto = norm(q.trim()).length < 2;
  useEffect(() => {
    if (corto) return;
    let vivo = true;
    setErr(null);
    chiama("search", { q: q.trim() }, 15000).then((r) => vivo && setR(r)).catch((e) => vivo && setErr(e.message));
    return () => { vivo = false; };
  }, [q]);
  const v = useMemo(() => {
    if (!R) return null;
    const C = ctx(R.articles, R.stories);
    const inS = new Set(R.stories.map((s) => s.id));
    const hits = R.hits.map((id) => C.A[id]).filter(Boolean);
    return { C, hits, singole: hits.filter((a) => !(a.st && inS.has(a.st))) };
  }, [R]);

  if (corto) return <p className="note">Scrivi almeno due lettere. La ricerca guarda titoli tradotti e originali, nomi delle testate e paesi: trovi come lo stesso fatto è stato raccontato da giornali diversi.</p>;
  if (err) return <p className="note">Ricerca non riuscita ({err}).</p>;
  if (!v) return <div className="loading loading--in" aria-busy="true"><div className="sk sk--l" /><div className="sk sk--l" /></div>;
  const { C, hits, singole } = v;
  return (
    <>
      <p className="status mono">{pl(hits.length, "risultato", "risultati")}{R.stories.length ? " · " + pl(R.stories.length, "storia", "storie") : ""}</p>
      {R.stories.length > 0 && <div className="cards">{R.stories.map((s) => <Card key={s.id} s={s} />)}</div>}
      {singole.length > 0 && <ol className="rows">{singole.slice(0, 120).map((a) => <Riga key={a.id} a={a} C={C} />)}</ol>}
      {!hits.length && <p className="note">Nessun titolo contiene «{q}». Prova con un nome o un paese.</p>}
    </>
  );
}

export default function Cerca() {
  const { meta } = useGiornale();
  const navigate = useNavigate();
  const iniziale = new URLSearchParams(useLocation().search).get("q") || "";
  const [testo, setTesto] = useState(iniziale);
  const [q, setQ] = useState(iniziale);
  const campo = useRef(null);
  const sugg = useSuggerimenti(meta);

  useEffect(() => { if (!iniziale) campo.current?.focus(); }, []);
  useEffect(() => {
    const t = setTimeout(() => { const v = testo.trim(); setQ(v); navigate(url.cerca(v), { replace: true }); }, 220);
    return () => clearTimeout(t);
  }, [testo]);

  return (
    <div className="wrap page">
      <header className="phead"><p className="mono muted">Archivio · ultimi 3 giorni</p><h1 className="phead__t">Cerca</h1></header>
      <form className="sform" role="search" onSubmit={(e) => e.preventDefault()}>
        <label className="mono muted" htmlFor="q">Cerca fra titoli, testate e paesi</label>
        <input id="q" ref={campo} name="q" type="search" autoComplete="off" enterKeyHint="search"
          placeholder={(sugg.slice(0, 3).join(", ") || "Un nome, un paese, una testata") + "…"} value={testo} onChange={(e) => setTesto(e.target.value)} />
      </form>
      {sugg.length > 0 && (
        <div className="sugg"><span className="mono muted">Le più seguite</span>
          {sugg.map((w) => <button key={w} className="chip-b" type="button" onClick={() => setTesto(w)}><span className="mono">{w}</span></button>)}</div>
      )}
      <div className="results" aria-live="polite"><Risultati q={q} /></div>
    </div>
  );
}
