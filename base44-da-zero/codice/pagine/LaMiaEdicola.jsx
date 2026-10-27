/* La mia edicola (pages/LaMiaEdicola.jsx): una pagina che si compone da sola con le notizie di oggi
   sui macrotemi, sui temi personali (un nome, un paese) e dalle testate preferite. Le scelte restano
   in questo browser (localStorage "igg-edicola"), senza account: le gestisce GiornaleProvider. */
import { useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { useGiornale, useVista, ctx, pl, norm } from "@/components/giornale";
import { Card, Righe, Foto, LinkArticolo, Caricamento, Errore } from "@/components/Pezzi";

/* Un tema personale vale se compare nel titolo (tradotto o originale) o è il paese della notizia */
const tocca = (a, tema) => { const q = norm(tema); return norm([a.it || "", a.o || ""].join(" ")).includes(q) || norm(a.w || "") === q; };

function Blocco({ titolo, tipo, arts, D, C }) {
  const ids = new Set(arts.map((a) => a.st).filter(Boolean));
  const storie = D.stories.filter((s) => ids.has(s.id)).slice(0, 3);
  const inStoria = new Set(storie.map((s) => s.id));
  const singole = arts.filter((a) => !(a.st && inStoria.has(a.st))).slice(0, 8);
  return (
    <section className="sec mine">
      <h2 className="sec-h">{titolo} <span className="mono muted">{tipo} · {pl(arts.length, "notizia", "notizie")} oggi</span></h2>
      {storie.length > 0 && <div className="cards">{storie.map((s) => <Card key={s.id} s={s} />)}</div>}
      {singole.length > 0 && <Righe arts={singole} C={C} />}
      {!arts.length && <p className="note">Oggi nessuna notizia su questo tema.</p>}
    </section>
  );
}

function Personalizza({ oggi, aperto }) {
  const { meta, prefs, isFav, toggle, aggiungiTema, togliTema, azzera, haPrefs } = useGiornale();
  const [nuovo, setNuovo] = useState("");
  const tc = {}, sc = {}, wc = {};
  oggi.forEach((a) => {
    tc[a.k] = (tc[a.k] || 0) + 1;
    sc[a.s] = (sc[a.s] || 0) + 1;
    // "Italia" e "Mondo" non servono come temi
    if (a.w && a.w !== "Mondo" && a.w !== "Italia") wc[a.w] = (wc[a.w] || 0) + 1;
  });
  const sugg = Object.entries(wc).sort((a, b) => b[1] - a[1]).map(([w]) => w).filter((w) => !prefs.themes.some((t) => norm(t) === norm(w))).slice(0, 8);
  return (
    <details className="pref" open={aperto}>
      <summary className="pref__sum"><span className="mono">Personalizza</span>
        <span className="mono muted">{pl(prefs.topics.length, "macrotema", "macrotemi")} · {pl(prefs.themes.length, "tema", "temi")} · {pl(prefs.sources.length, "testata", "testate")}</span></summary>
      <div className="pref__body">
        <div className="pref__group"><h3 className="pref__h">Macrotemi</h3><p className="note">Le sezioni del giornale che vuoi in testa alla tua pagina. Il numero sono le notizie di oggi.</p>
          <div className="pref__chips">{meta.topics.map(([k, n]) => (
            <button key={k} className="pchoice" type="button" aria-pressed={prefs.topics.includes(k)} onClick={() => toggle("topics", k)}><span>{n}</span><span className="pchoice__n">{tc[k] || 0}</span></button>
          ))}</div></div>
        <div className="pref__group"><h3 className="pref__h">I tuoi temi</h3><p className="note">Un nome, un paese, un argomento: raccogliamo ogni notizia che lo cita, in qualsiasi testata.</p>
          <form className="ptheme__form" autoComplete="off" onSubmit={(e) => { e.preventDefault(); aggiungiTema(nuovo); setNuovo(""); }}>
            <label className="vh" htmlFor="theme-in">Nuovo tema</label>
            <input id="theme-in" type="text" maxLength={40} placeholder="Es. Serbia, intelligenza artificiale, Juventus" value={nuovo} onChange={(e) => setNuovo(e.target.value)} />
            <button className="btn" type="submit">Aggiungi</button>
          </form>
          {prefs.themes.length > 0 && <div className="ptheme__list">{prefs.themes.map((t) => <span key={t} className="ptheme">{t}<button type="button" aria-label={"Togli " + t} onClick={() => togliTema(t)}>×</button></span>)}</div>}
          {sugg.length > 0 && <p className="mono muted ptheme__sugg">Di cui si parla oggi: {sugg.map((w) => <button key={w} className="chip-b" type="button" onClick={() => aggiungiTema(w)}><span className="mono">+ {w}</span></button>)}</p>}
        </div>
        <div className="pref__group"><h3 className="pref__h">Testate preferite</h3><p className="note">Le loro notizie arrivano in una sezione tutta tua e sono segnate con ★ in tutto il sito.</p>
          {meta.groups.map((cc) => {
            const papers = meta.sources.filter((s) => s.cc === cc);
            if (!papers.length) return null;
            return (
              <div key={cc} className="psrc"><p className="mono muted psrc__h">{meta.countries[cc]}</p><div className="psrc__list">
                {papers.map((s) => (
                  <button key={s.key} className="pchoice pchoice--src" type="button" aria-pressed={isFav(s.key)} onClick={() => toggle("sources", s.key)}>
                    <span>{isFav(s.key) ? "★" : "☆"} {s.n}</span><span className="pchoice__n">{sc[s.key] || 0}</span></button>
                ))}</div></div>
            );
          })}
        </div>
        <p className="pref__foot"><span className="mono muted">Le scelte restano su questo dispositivo, senza account e senza cookie.</span>
          {haPrefs && <button className="mono pref__reset" type="button" onClick={azzera}>Azzera tutto</button>}</p>
      </div>
    </details>
  );
}

export default function LaMiaEdicola() {
  const { meta, TL, prefs, isFav, haPrefs, isToday, srcName, parts } = useGiornale();
  const modifica = new URLSearchParams(useLocation().search).get("modifica") === "1";
  const { data: D, errore } = useVista("day", meta ? {} : null, 30000, [!!meta]);
  const v = useMemo(() => {
    if (!D) return null;
    return { C: ctx(D.articles, D.stories), oggi: D.articles.filter((a) => isToday(a.ts)).sort((p, q) => q.ts - p.ts) };
  }, [D, meta]);

  if (errore) return <Errore msg={errore} onRetry={() => location.reload()} />;
  if (!meta || !v) return <Caricamento />;
  const { C, oggi } = v;

  const miei = oggi.filter((a) => prefs.topics.includes(a.k) || isFav(a.s) || prefs.themes.some((t) => tocca(a, t)));
  const fav = oggi.filter((a) => isFav(a.s));
  const ultime = prefs.sources.map((k) => fav.find((a) => a.s === k)).filter(Boolean);

  return (
    <div className="wrap page">
      <header className="phead"><p className="mono muted">Personale</p><h1 className="phead__t">La mia edicola</h1>
        <p className="phead__d">{haPrefs
          ? `Oggi per te ${pl(miei.length, "notizia", "notizie")}, da ${pl(new Set(miei.map((a) => a.s)).size, "testata", "testate")}.`
          : "Scegli macrotemi, temi e testate: questa pagina si compone da sola con le notizie di oggi."}</p></header>
      <Personalizza oggi={oggi} aperto={!haPrefs || modifica} />
      {!haPrefs && (
        <div className="empty mine__empty"><p className="mono muted">Per iniziare</p><h2 className="empty__t">La tua edicola è vuota.</h2>
          <p>Apri «Personalizza» qui sopra e tocca quello che ti interessa: un macrotema, un paese come tema, una testata. Si aggiorna subito.</p></div>
      )}
      {prefs.topics.map((k) => <Blocco key={"mt-" + k} titolo={TL[k]} tipo="Macrotema" arts={oggi.filter((a) => a.k === k)} D={D} C={C} />)}
      {prefs.themes.map((t) => <Blocco key={"th-" + t} titolo={t} tipo="Tema" arts={oggi.filter((a) => tocca(a, t))} D={D} C={C} />)}
      {prefs.sources.length > 0 && (
        <section className="sec mine">
          <h2 className="sec-h">Dalle tue testate <span className="mono muted">{pl(prefs.sources.length, "testata", "testate")} · {pl(fav.length, "notizia", "notizie")} oggi</span></h2>
          {ultime.length
            ? <div className="cards mine__front">{ultime.map((a) => {
                const p = parts(a);
                return (
                  <LinkArticolo key={a.id} a={a} className="card">
                    <Foto src={a.img} testata={a.s} cls="pic--card" />
                    <span className="mono card__k"><b className="acc">★ {srcName(a.s)}</b> · {a.t}</span>
                    <span className="card__t" lang={p.main.lang}>{p.main.txt}</span>
                    {p.sub && <span className="card__s" lang={p.sub.lang}>{p.sub.txt}</span>}
                  </LinkArticolo>
                );
              })}</div>
            : <p className="note">Le tue testate oggi non hanno ancora pubblicato.</p>}
          {fav.length > ultime.length && <Righe arts={fav.filter((a) => !ultime.includes(a)).slice(0, 12)} C={C} />}
        </section>
      )}
    </div>
  );
}
