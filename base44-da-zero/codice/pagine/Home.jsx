/* La prima pagina (pages/Home.jsx).
   Dall'alto: barra delle edizioni (Notte, Mattina, Pomeriggio, Sera) e dei giorni; numero e stato
   dell'edizione; filtri per argomento; il globo (nel Pop prima di tutto, negli altri stili dopo
   l'Ultim'ora in scorrimento); la copertina a foto (solo svizzero); l'apertura (nel magazine con la
   foto grande e il titolo sopra); In evidenza; Le cifre del giorno (magazine); Ultim'ora; a destra
   Le prime pagine delle testate. */
import { useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useGiornale, useVista, useStile, ctx, url, hm, pl, fmtDay, dayDate, LOWVAL, ISO } from "@/components/giornale";
import { Foto, Timeline, pickTakes, Take, Card, Righe, LinkArticolo, Caricamento, Errore } from "@/components/Pezzi";
import FasciaGlobo, { globeData } from "@/components/FasciaGlobo";
import Copertina from "@/components/Copertina";

const HERO_MAX = 6;

/* "Oggi", "Ieri" o la data breve */
function etichettaGiorno(d, days) {
  if (d === days[0]) return "Oggi";
  if (d === days[1]) return "Ieri";
  return new Intl.DateTimeFormat("it-IT", { timeZone: "UTC", weekday: "short", day: "numeric" }).format(dayDate(d));
}

function BarraEdizioni({ meta, day, ek }) {
  const oraRoma = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Rome", hour: "2-digit", hour12: false }).format(new Date(meta.now * 1000))) % 24;
  const oggi = day === meta.days[0];
  return (
    <div className="edbar"><div className="wrap edbar__in">
      <span className="mono muted edbar__lab">Edizioni</span>
      <div className="edbar__list" role="group" aria-label="Edizioni">
        {meta.editions.map((e) => {
          const on = e.k === ek, futura = oggi && e.a > oraRoma;
          return (
            <Link key={e.k} className={"ed" + (on ? " is-on" : "")} to={url.home(`?giorno=${day}&ed=${e.k}`)} aria-current={on}
              aria-disabled={futura || undefined} tabIndex={futura ? -1 : undefined} style={futura ? { opacity: 0.38, pointerEvents: "none" } : undefined}>
              <span className="mono">{e.n}</span><span className="ed__r">{e.r}</span>
            </Link>
          );
        })}
      </div>
      {!meta.demo && (
        <div className="days" role="group" aria-label="Giorno">
          {meta.days.map((d) => <Link key={d} className="day mono" to={url.home(`?giorno=${d}&ed=${d === meta.days[0] ? meta.edition : "sera"}`)} aria-pressed={d === day}>{etichettaGiorno(d, meta.days)}</Link>)}
        </div>
      )}
    </div></div>
  );
}

function Stato({ F, E, meta }) {
  const giorno = F.day === meta.days[0] ? "" : " di " + fmtDay.format(dayDate(F.day));
  const conta = F.count ? ` · ${pl(F.count, "notizia", "notizie")} da ${pl(F.papers, "testata", "testate")}` : "";
  if (F.closed) return <p className="status mono">Edizione {E.of}{giorno} · chiusa {hm(F.b) === "00:00" ? "a mezzanotte" : "alle " + hm(F.b)}{conta}</p>;
  return <p className="status mono"><span className="on">Edizione {E.of}</span> · in aggiornamento{meta.updated ? " · ultimo controllo alle " + hm(meta.updated) : ""}{conta}</p>;
}

/* Testata del numero, solo nel magazine: "N. 298 · Sera · Il mondo raccontato da 49 testate · domenica 25 ottobre 2026" */
function Numero({ F, E, meta }) {
  const d = dayDate(F.day);
  const num = Math.floor((d - Date.UTC(d.getUTCFullYear(), 0, 0)) / 86400000);
  return (
    <div className="issue mag-only" aria-hidden="true">
      <span>N. {num} · {E.n}</span><span>Il mondo raccontato da {meta.sources.length} testate</span><span>{fmtDay.format(d)} {d.getUTCFullYear()}</span>
    </div>
  );
}

function FiltriArgomento({ arts, topics, scelto, onScegli }) {
  const conta = {};
  arts.forEach((a) => { conta[a.k] = (conta[a.k] || 0) + 1; });
  const tutti = [["tutte", "Tutte", arts.length], ...topics.map(([k, n]) => [k, n, conta[k] || 0])];
  return (
    <div className="chips" role="group" aria-label="Filtra per argomento">
      {tutti.map(([k, n, c]) => (
        <button key={k} className={"chip-b" + (scelto === k ? " is-on" : "")} type="button" aria-pressed={scelto === k} onClick={() => onScegli(k)}>
          <span className="mono">{n}</span><span className="mono chip-b__n">{c}</span>
        </button>
      ))}
    </div>
  );
}

/* Ultim'ora in scorrimento: due copie della stessa fila, così il giro non si vede */
function Ticker({ arts }) {
  const { srcName, parts } = useGiornale();
  const voci = arts.filter((a) => !LOWVAL[a.x]).slice(0, 14);
  if (!voci.length) return null;
  const fila = (copia) => (
    <div className="tk__seq" aria-hidden={copia || undefined}>
      {voci.map((a, i) => {
        const p = parts(a);
        return (
          <span key={a.id + (copia ? "-c" : "")} style={{ display: "contents" }}>
            {i > 0 && <span className="tk__sep" aria-hidden="true">/</span>}
            <span><span className="mono tk__s">{srcName(a.s)}</span><span lang={p.main.lang}>{p.main.txt}</span></span>
          </span>
        );
      })}
    </div>
  );
  return (
    <div className="tk" role="region" aria-label="Ultim’ora in scorrimento"><div className="wrap tk__wrap">
      <span className="mono tk__lab">Ultim’ora</span>
      <div className="tk__vp"><div className="tk__track">{fila(false)}{fila(true)}</div></div>
    </div></div>
  );
}

/* L'apertura: nel magazine la foto grande con il titolo sopra; se la notizia è già nella copertina, il titolo "eco" senza foto */
function Apertura({ s, C, etichetta, inCopertina, stile }) {
  const { TL, SRC, srcName, srcNames } = useGiornale();
  const [fotoRotta, setFotoRotta] = useState(false);
  const coda = (
    <>
      <p className="mono srcline">Ne parlano <b>{srcNames(s, 5)}</b></p>
      <Timeline s={s} C={C} />
      <h3 className="mono takes__h">Come lo raccontano</h3>
      <div className="takes">{pickTakes(s, C, SRC, 4).map((a) => <Take key={a.id} a={a} />)}</div>
      <Link className="more mono" to={url.storia(s.id)}>Tutte le {s.n} testate →</Link>
    </>
  );
  if (stile === "magazine" && s.img && !inCopertina) {
    return (
      <article className="lead lead--cover">
        <Link className={"lead__cover" + (fotoRotta ? " no-img" : "")} to={url.storia(s.id)}>
          {!fotoRotta && <img src={s.img} alt="" fetchpriority="high" decoding="async" referrerPolicy="no-referrer" onError={() => setFotoRotta(true)} />}
          <span className="lead__over">
            <span className="kick"><span className="chip">{etichetta}</span><span className="mono"><b>{pl(s.n, "testata", "testate")}</b></span><span className="mono">{TL[s.k]} · {s.w} · {hm(s.last)}</span></span>
            <h2 className="lead__t">{s.t}</h2>
            {s.d && <span className="lead__d">{s.d}</span>}
          </span>
        </Link>
        {s.img_s && <p className="mono lead__credit">Foto · {srcName(s.img_s)}</p>}
        {coda}
      </article>
    );
  }
  return (
    <article className="lead">
      <div className="kick"><span className="chip">{etichetta}</span><span className="mono"><b>{pl(s.n, "testata", "testate")}</b></span><span className="mono muted">{TL[s.k]} · {s.w}</span><span className="mono muted">Aggiornata alle {hm(s.last)}</span></div>
      <h2 className={"lead__t" + (inCopertina ? " lead__t--echo" : "")}><Link to={url.storia(s.id)}>{s.t}</Link></h2>
      {!inCopertina && <Foto src={s.img} testata={s.img_s} cls="pic--lead" alt={s.t} />}
      {s.d && <p className="lead__d">{s.d}</p>}
      {coda}
    </article>
  );
}

/* Le cifre del giorno (magazine): il primo numero con unità nei titoli italiani delle storie più seguite */
const CIFRA_RX = /(\d{1,3}(?:[.\s]\d{3})*(?:,\d+)?|\d+(?:,\d+)?)\s?(%|(?:per cento|mila|milioni|miliardi|morti|feriti|anni|mesi|euro|dollari|voti)(?![a-zà-ÿ]))/i;
function Cifre({ storie, C }) {
  const { srcName } = useGiornale();
  const voci = [];
  for (const s of storie) {
    if (voci.length >= 4) break;
    const cand = [{ t: s.t, s: s.srcs[0] }].concat(s.arts.map((id) => C.A[id]).filter((a) => a && a.it).map((a) => ({ t: a.it, s: a.s })));
    for (const c of cand) {
      const m = c.t.match(CIFRA_RX);
      if (!m || /^(19|20)\d\d$/.test(m[1])) continue;
      const n = m[1].replace(/\s/g, ".");
      if (voci.some((x) => x.n === n && x.u.toLowerCase() === m[2].toLowerCase())) continue;
      voci.push({ n, u: m[2].toLowerCase() === "per cento" ? "%" : m[2], t: c.t, s: c.s, id: s.id });
      break;
    }
  }
  if (voci.length < 2) return null;
  return (
    <section className="cifre mag-only" aria-label="Le cifre del giorno">
      <h2 className="mono cifre__h">Le cifre del giorno</h2>
      <ol className="cifre__list">{voci.map((x) => (
        <li key={x.id + x.n}><Link className="cifra" to={url.storia(x.id)}>
          <span className="cifra__n">{x.n}<small>{x.u}</small></span><span className="cifra__t">{x.t}</span><span className="mono cifra__s">{srcName(x.s)}</span>
        </Link></li>
      ))}</ol>
    </section>
  );
}

/* Le prime pagine: l'apertura di ogni testata */
function PrimePagine({ F, C }) {
  const { srcName, parts, isFav } = useGiornale();
  const voci = F.rail.map((id) => C.A[id]).filter(Boolean);
  if (!voci.length) return null;
  return (
    <aside className="rail" aria-labelledby="pp-h">
      <div className="rail__head"><h2 id="pp-h" className="rail__h">Le prime pagine</h2><Link className="mono acc" to={url.edicola()}>Edicola →</Link></div>
      <p className="mono rail__note">L’apertura di ogni testata</p>
      <ol>{voci.map((a) => {
        const p = parts(a);
        return (
          <li key={a.id}><LinkArticolo a={a} className="pp">
            <span className="pp__m"><span className="mono">{isFav(a.s) && <span className="fav">★ </span>}{srcName(a.s)}</span><span className="mono muted">{a.t}</span></span>
            <span className="pp__t" lang={p.main.lang}>{p.main.txt}</span>
            {p.sub && <span className="pp__o" lang={p.sub.lang}>{p.sub.txt}</span>}
          </LinkArticolo></li>
        );
      })}</ol>
    </aside>
  );
}

export default function Home() {
  const { meta, errore } = useGiornale();
  const stile = useStile();
  const q = new URLSearchParams(useLocation().search);
  const [argomento, setArgomento] = useState("tutte");

  const day = meta && (meta.days.includes(q.get("giorno")) ? q.get("giorno") : meta.days[0]);
  const ek = meta && (meta.editions.some((e) => e.k === q.get("ed")) ? q.get("ed") : day === meta.days[0] ? meta.edition : "sera");
  const { data: F, errore: errF } = useVista("front", meta ? { day, ed: ek } : null, 30000, [day, ek]);

  const vista = useMemo(() => {
    if (!F || !F.articles) return null;
    const C = ctx(F.articles, F.stories);
    const inWin = F.articles.filter((a) => a.ts >= F.a).sort((p, r) => r.ts - p.ts);
    const tf = (x) => argomento === "tutte" || x.k === argomento;
    const win = inWin.filter(tf);
    const elig = F.stories.filter((s) => s.solid >= 2 && tf(s));
    const elenco = globeData(win, elig);
    const leadId = elig[0] && ISO[elig[0].w];
    const iniziale = elenco.some((c) => c.id === leadId) ? leadId : elenco[0]?.id;
    return { C, inWin, win, elig, elenco, iniziale };
  }, [F, argomento]);

  if (errore || errF) return <Errore msg={errore || errF} onRetry={() => location.reload()} />;
  if (!meta || !F || !vista) return <Caricamento />;

  const E = meta.editions.find((e) => e.k === ek);
  const { C, inWin, win, elig, elenco, iniziale } = vista;
  const lead = elig[0], ev = elig.slice(1, 7);
  const copertina = stile === "svizzero" && inWin.length ? elig.filter((s) => s.img).slice(0, HERO_MAX) : [];
  const globo = inWin.length && elenco.length ? <FasciaGlobo key={`${day}-${ek}-${argomento}`} elenco={elenco} iniziale={iniziale} edizione={E.n} /> : null;

  let main;
  if (F.future) {
    main = (
      <div className="empty"><p className="mono muted">Edizione {E.of}</p><h2 className="empty__t">Questa edizione non è ancora uscita.</h2>
        <p>Apre alle {E.r.slice(0, 2)}:00, ora di Roma.</p><Link className="btn" to={url.home()}>Vai all’edizione in corso</Link></div>
    );
  } else if (!inWin.length) {
    const primo = meta.count === 0;
    main = (
      <div className="empty"><p className="mono muted">Edizione {E.of}{F.closed ? " · chiusa alle " + hm(F.b) : ""}</p>
        <h2 className="empty__t">{primo ? "Stiamo sfogliando i giornali." : "Nessuna notizia raccolta in questa fascia oraria."}</h2>
        <p>{primo ? "Il primo giro di lettura dei feed richiede qualche minuto. Torna tra poco." : "I feed delle testate tengono solo le ultime notizie: le edizioni precedenti al primo aggiornamento restano vuote."}</p>
        {!primo && <Link className="btn" to={url.home()}>Vai all’edizione in corso</Link>}</div>
    );
  } else {
    main = (
      <>
        {lead
          ? <Apertura s={lead} C={C} etichetta={E.n} inCopertina={copertina.some((h) => h.id === lead.id)} stile={stile} />
          : <p className="note">In questa edizione nessuna storia {argomento === "tutte" ? "" : "di questo argomento "}è raccontata da più testate. Le notizie sono in Ultim’ora.</p>}
        {ev.length > 0 && (
          <section className="sec sec--ev"><h2 className="sec-h">In evidenza <span className="mono muted">Le notizie raccontate da più testate</span></h2>
            <div className="cards">{ev.map((s) => <Card key={s.id} s={s} />)}</div></section>
        )}
        <Cifre storie={elig.slice(0, 10)} C={C} />
        <section className="sec sec--uo"><h2 className="sec-h">Ultim’ora <span className="mono muted">{pl(win.length, "notizia", "notizie")}</span></h2>
          {win.length ? <Righe arts={win} C={C} /> : <p className="note">Nessuna notizia per questo argomento nell’edizione.</p>}</section>
      </>
    );
  }

  return (
    <>
      <BarraEdizioni meta={meta} day={day} ek={ek} />
      <div className="wrap">
        <Numero F={F} E={E} meta={meta} />
        <Stato F={F} E={E} meta={meta} />
        {inWin.length > 0 && <FiltriArgomento arts={inWin} topics={meta.topics} scelto={argomento} onScegli={setArgomento} />}
      </div>
      {stile === "pop" && globo}
      {copertina.length > 0 && <Copertina storie={copertina} />}
      {inWin.length > 0 && <Ticker arts={inWin} />}
      {stile !== "pop" && globo}
      <div className="wrap home">
        <div className="home__main">{main}</div>
        <PrimePagine F={F} C={C} />
      </div>
    </>
  );
}
