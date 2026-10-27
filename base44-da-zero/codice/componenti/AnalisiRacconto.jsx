import { useEffect, useMemo, useRef, useState } from "react";

/* La scheda Analisi come racconto a capitoli (components/AnalisiRacconto.jsx). Props:
   rec: StoryAnalysis pronta ({ analysis, created_at, new_articles, simulated });
   articoli: gli articoli della storia, con le chiavi brevi della funzione ({ id, s, l, u });
   nomeTestata(chiave) -> nome; paeseTestata(chiave) -> codice paese. */

const CAPITOLI = [["tutti", "Cosa dicono tutti"], ["separano", "Dove si separano"], ["cifre", "Le cifre"], ["voci", "Chi ha la parola"],
  ["fonti", "Da dove arriva"], ["parole", "Le parole scelte"], ["manca", "Cosa manca"], ["tempi", "Chi è arrivato prima"]];
const CATEGORIE = { governo: "Governo", opposizione: "Opposizione", istituzione: "Istituzioni", esperto: "Esperti", cittadino: "Cittadini", altra_testata: "Altre testate", altro: "Altri" };
const CHI = { governo: "i governi", opposizione: "l’opposizione", istituzione: "le istituzioni", esperto: "gli esperti", cittadino: "i cittadini", altra_testata: "altre testate", altro: "altre persone" };
const FONTI = { agenzia: ["agenzia", "agenzie"], fonte_ufficiale: ["fonte ufficiale", "fonti ufficiali"], documento: ["documento", "documenti"], altra_testata: ["altra testata", "altre testate"], anonima: ["fonte anonima", "fonti anonime"], social: ["post social", "post social"] };
const STATO_CIFRA = { concorde: "Tutte d’accordo", divergente: "Valori diversi", aggiornamento: "Aggiornata nel tempo", singolo: "Una sola testata" };

const pl = (n, s, p) => `${n} ${n === 1 ? s : p}`;
const unisci = (xs) => (xs.length < 2 ? xs.join("") : xs.slice(0, -1).join(", ") + " e " + xs[xs.length - 1]);
const norm = (s) => String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const ora = (iso) => new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
const giorno = (iso) => new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", day: "numeric", month: "short" }).format(new Date(iso));
const durata = (min) => (min < 60 ? `${min} min` : `${Math.floor(min / 60)} h${min % 60 ? ` ${min % 60} min` : ""}`);
const riduci = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/* Il capitolo si "accende" quando entra per il 20% nello schermo; poi resta acceso */
function useAcceso() {
  const ref = useRef(null);
  const [acceso, setAcceso] = useState(riduci());
  useEffect(() => {
    if (acceso || !ref.current) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) setAcceso(true); }, { threshold: 0.2 });
    io.observe(ref.current);
    const t = setTimeout(() => {          // se l'osservatore tarda, il capitolo sullo schermo si accende lo stesso
      const r = ref.current?.getBoundingClientRect();
      if (r && r.top < innerHeight && r.bottom > 0) setAcceso(true);
    }, 1200);
    return () => { io.disconnect(); clearTimeout(t); };
  }, [acceso]);
  return [ref, acceso];
}

/* Un numero che conta da 0 quando il capitolo si accende */
function Conta({ a, acceso }) {
  const [n, setN] = useState(riduci() ? a : 0);
  useEffect(() => {
    if (!acceso || riduci()) { if (riduci()) setN(a); return; }
    const t0 = performance.now();
    let raf = 0;
    const passo = (t) => {
      const k = Math.min(1, (t - t0) / 900);
      setN(Math.round(a * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(passo);
    };
    raf = requestAnimationFrame(passo);
    const fine = setTimeout(() => setN(a), 1200);
    return () => { cancelAnimationFrame(raf); clearTimeout(fine); };
  }, [acceso, a]);
  return <span className="ax-n">{n}</span>;
}

/* Le pillole delle testate: ognuna apre la frase prova e il link */
function Prove({ evidenze, nomeTestata }) {
  const [aperta, setAperta] = useState(null);
  const e = aperta !== null ? evidenze[aperta] : null;
  return (
    <>
      <div className="pchips">{evidenze.map((ev, i) => (
        <button key={i} type="button" className="pchip mono" aria-expanded={aperta === i} onClick={() => setAperta(aperta === i ? null : i)}>
          {nomeTestata(ev.source)}
        </button>
      ))}</div>
      {e && (
        <div className="proofbox">
          <p className="proofbox__q">«{e.prova}»</p>
          <p className="mono proofbox__m">{nomeTestata(e.source)}{e.url && <> · <a href={e.url} target="_blank" rel="noopener">Leggi l’articolo ↗</a></>}</p>
        </div>
      )}
    </>
  );
}

/* Quali punti di una linea hanno l'etichetta: 1 sopra, 2 sotto, 0 nessuna */
function etichette(xs) {
  const out = xs.map(() => 0);
  if (window.innerWidth < 600) {               // sul telefono solo il primo e l'ultimo
    const lo = xs.indexOf(Math.min(...xs)), hi = xs.indexOf(Math.max(...xs));
    out[lo] = 1;
    if (hi !== lo) out[hi] = xs[hi] - xs[lo] > 45 ? 1 : 2;
    return out;
  }
  const gap = Math.min(50, Math.max(14, 13000 / Math.max(320, window.innerWidth - 64)));
  const ultimo = { 1: -1e9, 2: -1e9 };
  const ordine = xs.map((x, i) => i);
  if (ordine.length > 1) ordine.splice(1, 0, ordine.pop());
  ordine.forEach((i) => {
    const lato = [1, 2].find((l) => Math.abs(xs[i] - ultimo[l]) >= gap);
    if (lato) { out[i] = lato; ultimo[lato] = xs[i]; }
  });
  return out;
}
const bordo = (xs, i) => (xs[i] === Math.min(...xs) ? " is-start" : xs[i] === Math.max(...xs) ? " is-end" : "");

function Linea({ punti, classe }) {      // punti: [{ x (0–100), sopra, sotto, rosso, titolo }]
  const xs = punti.map((p) => p.x);
  const lab = etichette(xs);
  return (
    <div className={classe} data-r style={{ "--d": 2 }} aria-hidden="true">
      <span className="ax__axis" />
      {punti.map((p, i) => (
        <span key={i} className={`${classe === "ax__track" ? "ax__tick" : "ax__dot"}${p.rosso ? (classe === "ax__track" ? " is-first" : " is-off") : ""}${lab[i] === 2 ? " is-low" : ""}${bordo(xs, i)}`}
          style={{ "--x": `${p.x.toFixed(1)}%`, "--d": i }} title={p.titolo}>
          {lab[i] ? <><b>{p.sopra}</b><i>{p.sotto}</i></> : null}
        </span>
      ))}
    </div>
  );
}

function Capitolo({ k, n, alt, allerta, children }) {
  const [ref, acceso] = useAcceso();
  return (
    <section ref={ref} id={`ax-${k}`} aria-labelledby={`axh-${k}`} className={`ax${alt ? " ax--alt" : ""}${allerta ? " ax--alert" : ""}${acceso ? " is-in" : ""}`}>
      <div className="wrap ax__in">
        <p className="mono ax__k" data-r><span>{String(n).padStart(2, "0")}</span> {CAPITOLI[n - 1][1]}</p>
        {typeof children === "function" ? children(acceso) : children}
      </div>
    </section>
  );
}

const Titolo = ({ k, children }) => <h3 className="ax__t" id={`axh-${k}`} data-r style={{ "--d": 1 }}>{children}</h3>;

function Scheda({ g, i, etichetta, nomeTestata }) {
  const n = new Set(g.evidenze.map((e) => e.source)).size;
  return (
    <li className="ax__card" data-r style={{ "--d": Math.min(i, 6) + 2 }}>
      {etichetta}
      <p className="ax__ct">{g.testo_it}</p>
      <p className="mono muted">{n === 1 ? "Lo dice" : "Lo dicono"} {pl(n, "testata", "testate")}</p>
      <Prove evidenze={g.evidenze} nomeTestata={nomeTestata} />
    </li>
  );
}

function vai(k) {
  const el = document.getElementById("ax-" + k);
  if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 56, behavior: riduci() ? "auto" : "smooth" });
}

export default function AnalisiRacconto({ rec, articoli, nomeTestata, paeseTestata }) {
  const A = rec.analysis, meta = A.meta || {};
  const [heroRef, heroAcceso] = useAcceso();
  const [categoria, setCategoria] = useState(null);
  const [parola, setParola] = useState(null);
  const [capitolo, setCapitolo] = useState("inizio");

  const d = useMemo(() => {
    const perId = Object.fromEntries(articoli.map((a) => [a.id, a]));
    const usati = (meta.articles || []).map((id) => perId[id]).filter(Boolean);
    const testate = new Set(usati.map((a) => a.s));
    const gruppi = A.claim_groups || [];
    const metriche = new Map();
    (A.numeric_compare || []).forEach((r) => { if (!metriche.has(r.metrica)) metriche.set(r.metrica, []); metriche.get(r.metrica).push(r); });
    const parole = new Map();
    Object.entries(A.lexicon || {}).forEach(([t, lista]) => lista.forEach((w) => {
      const k = norm(w.termine);
      if (!parole.has(k)) parole.set(k, { termine: w.termine, testate: new Set(), riferiti: new Set(), evidenze: [] });
      const p = parole.get(k);
      p.testate.add(t);
      if (w.riferito_a) p.riferiti.add(w.riferito_a);
      p.evidenze.push({ source: t, prova: w.prova, url: perId[w.article_id]?.u || "" });
    }));
    return {
      perId, usati, nTestate: testate.size, nPaesi: new Set([...testate].map(paeseTestata)).size, nLingue: new Set(usati.map((a) => a.l)).size,
      conc: gruppi.filter((g) => g.stato === "concorde"),
      div: gruppi.filter((g) => g.stato === "divergente" || g.stato === "aggiornamento"),
      singoli: gruppi.filter((g) => g.stato === "singolo"),
      metriche, cifreDiv: [...metriche].filter(([, rows]) => rows[0].stato === "divergente"),
      parole: [...parole.values()].sort((p, q) => q.testate.size - p.testate.size || q.evidenze.length - p.evidenze.length).slice(0, 18),
    };
  }, [rec]);

  // La guida laterale segue il capitolo sullo schermo
  useEffect(() => {
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) setCapitolo(e.target.id.replace("ax-", "")); }), { threshold: 0.2 });
    document.querySelectorAll(".axs .ax").forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, []);

  const nDiv = d.div.length + d.cifreDiv.length;
  // Il verdetto in una frase: ogni pezzo sa se è il primo (e allora inizia con la maiuscola)
  const verdetto = [
    d.conc.length ? (m) => <>{m ? "Su" : "su"} <b>{pl(d.conc.length, "punto", "punti")}</b> le testate concordano</> : (m) => (m ? "Non" : "non") + " c’è un punto che almeno due testate raccontano allo stesso modo",
    nDiv ? (m) => <>{m ? "Su" : "su"} <b>{nDiv}</b> si separano</> : (m) => (m ? "Non" : "non") + " ci sono versioni incompatibili",
    d.singoli.length ? () => <><b>{d.singoli.length}</b> {d.singoli.length === 1 ? "dettaglio lo racconta" : "dettagli li racconta"} una sola testata</> : null,
  ].filter(Boolean);
  const verdettoUnito = verdetto.flatMap((f, i) => (i === 0 ? [f(true)] : [i === verdetto.length - 1 ? " e " : ", ", f(false)]));

  // Chi ha la parola
  const V = A.voices || {};
  const vTestate = Object.keys(V).filter((t) => Object.values(V[t]).some(Boolean));
  const tot = {};
  vTestate.forEach((t) => Object.entries(V[t]).forEach(([c, n]) => { tot[c] = (tot[c] || 0) + n; }));
  const cats = Object.keys(CATEGORIE).filter((c) => tot[c]);
  const tutte = Object.values(tot).reduce((p, q) => p + q, 0);
  const top = cats.slice().sort((p, q) => tot[q] - tot[p])[0];
  const maxRiga = Math.max(1, ...vTestate.map((t) => Object.values(V[t]).reduce((p, q) => p + q, 0)));

  // Fonti
  const P = A.sources_profile || {};
  const pTestate = Object.keys(P), conFonti = pTestate.filter((t) => P[t].totale);
  const perTipo = {};
  conFonti.forEach((t) => Object.entries(P[t].per_tipo).forEach(([k, n]) => { perTipo[k] = (perTipo[k] || 0) + n; }));
  const tipi = Object.keys(perTipo).filter((k) => perTipo[k]).sort((p, q) => perTipo[q] - perTipo[p]);

  // Tempi
  const primi = (A.timeline || []).filter((t) => t.prima_della_testata);
  const arco = primi.length ? Math.max(1, ...primi.map((t) => t.minuti_dopo || 0)) : 1;
  const piuGiorni = new Set(primi.map((t) => giorno(t.ora))).size > 1;
  const quando = (t) => (piuGiorni ? giorno(t.ora) + " " : "") + ora(t.ora);
  const framing = (A.framing || []).find((f) => f.tema !== "Titoli");
  const titoli = (A.framing || []).find((f) => f.tema === "Titoli");
  const sel = parola !== null ? d.parole[parola] : null;

  return (
    <div className={`axs${riduci() ? "" : " is-anim"}${capitolo !== "inizio" ? " is-reading" : ""}`}>
      <nav className="ax__rail" aria-label="Vai a un capitolo">
        {CAPITOLI.map(([k, t], i) => <button key={k} type="button" aria-current={capitolo === k} title={t} onClick={() => vai(k)}><span className="vh">{i + 1}. {t}</span></button>)}
      </nav>

      <section ref={heroRef} id="ax-inizio" className={`ax ax--hero${heroAcceso ? " is-in" : ""}`} aria-label="Analisi della storia"><div className="wrap ax__in">
        <p className="mono ax__k" data-r>Analisi · come le testate raccontano questa storia</p>
        {rec.simulated && <p className="ax__sim mono" data-r>Simulazione · scheda ricavata con regole semplici dai testi veri, senza modello.</p>}
        <h3 className="ax__big" data-r style={{ "--d": 1 }}>
          Abbiamo letto <Conta a={d.usati.length} acceso={heroAcceso} /> {d.usati.length === 1 ? "articolo" : "articoli"} di <Conta a={d.nTestate} acceso={heroAcceso} /> {d.nTestate === 1 ? "testata" : "testate"},
          da <Conta a={d.nPaesi} acceso={heroAcceso} /> {d.nPaesi === 1 ? "paese" : "paesi"} in <Conta a={d.nLingue} acceso={heroAcceso} /> {d.nLingue === 1 ? "lingua" : "lingue"}.
        </h3>
        <p className="ax__lead" data-r style={{ "--d": 2 }}>{verdettoUnito}.</p>
        <nav className="ax__toc" data-r style={{ "--d": 3 }} aria-label="Capitoli dell’analisi">
          {CAPITOLI.map(([k, t], i) => <button key={k} type="button" onClick={() => vai(k)}><span>{i + 1}</span>{t}</button>)}
        </nav>
        <p className="mono ax__down" data-r style={{ "--d": 4 }} aria-hidden="true">Scorri ↓</p>
      </div></section>

      <Capitolo k="tutti" n={1}>
        {d.conc.length ? <>
          <Titolo k="tutti">Su <b>{pl(d.conc.length, "punto", "punti")}</b> le testate dicono la stessa cosa.</Titolo>
          {A.summary_it && <blockquote className="ax__quote" data-r style={{ "--d": 2 }}>{A.summary_it}</blockquote>}
          <p className="ax__hint mono" data-r style={{ "--d": 2 }}>Tocca il nome di una testata: compare la frase con cui lo dice, e il link all’articolo.</p>
          <ul className="ax__cards">{d.conc.map((g, i) => <Scheda key={g.id} g={g} i={i} nomeTestata={nomeTestata} />)}</ul>
        </> : <Titolo k="tutti">Non c’è ancora un punto che almeno due testate raccontano allo stesso modo.</Titolo>}
        {d.singoli.length > 0 && (
          <details className="ax__more" data-r><summary className="mono">E altri {d.singoli.length} dettagli che racconta una sola testata</summary>
            <ul className="ax__cards">{d.singoli.map((g, i) => <Scheda key={g.id} g={g} i={i} nomeTestata={nomeTestata} />)}</ul></details>
        )}
      </Capitolo>

      <Capitolo k="separano" n={2} allerta={nDiv > 0}>
        {nDiv ? <>
          <Titolo k="separano">Su <b>{pl(nDiv, "punto", "punti")}</b> le versioni non tornano.</Titolo>
          <ul className="ax__cards">{d.div.map((g, i) => <Scheda key={g.id} g={g} i={i} nomeTestata={nomeTestata}
            etichetta={<span className={`stag stag--${g.stato}`}>{g.stato === "aggiornamento" ? "Aggiornato nel tempo" : "Versioni diverse"}</span>} />)}</ul>
          {d.cifreDiv.map(([m, rows], i) => (
            <p key={m} className="ax__say" data-r style={{ "--d": i + 2 }}>Sulla cifra «{m}»: {unisci(rows.map((r) => `${nomeTestata(r.source)} scrive ${r.valore}`))}.
              <button className="mono ax__link" type="button" onClick={() => vai("cifre")}>Guarda le cifre →</button></p>
          ))}
        </> : <>
          <Titolo k="separano">Nessuna versione incompatibile.</Titolo>
          <p className="ax__lead" data-r style={{ "--d": 2 }}>Le testate scelgono dettagli diversi, ma quello che raccontano sta insieme: nessuna dice il contrario di un’altra.</p>
        </>}
      </Capitolo>

      <Capitolo k="cifre" n={3} alt>
        {d.metriche.size ? <>
          <Titolo k="cifre">Nei testi ci sono <b>{pl(d.metriche.size, "cifra", "cifre")}</b> da confrontare.</Titolo>
          <div className="ax__metrics">{[...d.metriche].map(([m, rows], i) => {
            // Lo stesso numero scritto in lingue diverse è un punto solo
            const val = (r) => (r.quantita && typeof r.quantita.value === "number" ? r.quantita.value : null);
            const perValore = new Map();
            rows.forEach((r) => { const k = val(r) !== null ? "v" + val(r) : r.valore; if (!perValore.has(k)) perValore.set(k, { r, v: val(r), chi: [] }); perValore.get(k).chi.push(nomeTestata(r.source)); });
            const pts = [...perValore.values()], ok = pts.map((p) => p.v).filter((v) => v !== null);
            const lo = Math.min(...ok), hi = Math.max(...ok);
            return (
              <div key={m} className="ax__metric" data-r style={{ "--d": Math.min(i, 5) + 2 }}>
                <p className="ax__mh"><span className="ax__mt">{m}</span><span className={`stag stag--${rows[0].stato}`}>{STATO_CIFRA[rows[0].stato]}</span></p>
                {pts.length === 1 || hi === lo
                  ? <p className="ax__same" data-r style={{ "--d": 2 }}><b>{pts[0].r.valore}</b> per {unisci(pts.flatMap((p) => p.chi))}</p>
                  : <Linea classe="ax__scale" punti={pts.map((p) => ({ x: p.v === null ? 50 : 4 + ((p.v - lo) / (hi - lo)) * 92, sopra: p.r.valore, sotto: p.chi.join(" · "), rosso: p.r.fuori, titolo: `${p.r.valore} · ${p.chi.join(", ")}` }))} />}
                <Prove evidenze={rows.map((r) => ({ source: r.source, prova: r.prova, url: d.perId[r.article_id]?.u || "" }))} nomeTestata={nomeTestata} />
              </div>
            );
          })}</div>
        </> : <Titolo k="cifre">Nei testi analizzati non ci sono cifre da mettere a confronto.</Titolo>}
      </Capitolo>

      <Capitolo k="voci" n={4}>
        {tutte ? <>
          <Titolo k="voci">Parlano soprattutto <b>{CHI[top]}</b>: {tot[top]} {tot[top] === 1 ? "voce" : "voci"} su {tutte}.</Titolo>
          <div className="ax__legend" data-r style={{ "--d": 2 }} role="group" aria-label="Mostra una categoria">
            {cats.map((c) => <button key={c} type="button" className="ax__lg" aria-pressed={categoria === c} onClick={() => setCategoria(categoria === c ? null : c)}><i className={`cat-${c}`} />{CATEGORIE[c]} <b>{tot[c]}</b></button>)}
          </div>
          <div className="ax__voices">{vTestate.map((t, i) => {
            const riga = Object.values(V[t]).reduce((p, q) => p + q, 0);
            return (
              <div key={t} className="ax__vrow" data-r style={{ "--d": Math.min(i, 8) + 2 }}>
                <span className="ax__vl">{nomeTestata(t)}</span>
                <span className="ax__vb" style={{ "--w": `${(riga / maxRiga * 100).toFixed(1)}%` }}>
                  {cats.filter((c) => V[t][c]).map((c) => <i key={c} className={`cat-${c}${categoria && categoria !== c ? " is-dim" : ""}`} style={{ flex: V[t][c] }} title={`${CATEGORIE[c]}: ${V[t][c]}`} />)}
                </span><b>{riga}</b>
              </div>
            );
          })}</div>
        </> : <>
          <Titolo k="voci">Nei testi analizzati nessuno prende la parola.</Titolo>
          <p className="ax__lead" data-r style={{ "--d": 2 }}>Le testate raccontano il fatto senza citare nessuno, né direttamente né indirettamente.</p>
        </>}
      </Capitolo>

      <Capitolo k="fonti" n={5} alt>{(acceso) => conFonti.length ? <>
        <Titolo k="fonti"><b>{conFonti.length} {conFonti.length === 1 ? "testata" : "testate"} su {pTestate.length}</b> {conFonti.length === 1 ? "dice" : "dicono"} da dove arrivano le informazioni.</Titolo>
        <div className="ax__tiles">{tipi.map((k, i) => <div key={k} className="ax__tile" data-r style={{ "--d": i + 2 }}><Conta a={perTipo[k]} acceso={acceso} /><span>{FONTI[k][perTipo[k] === 1 ? 0 : 1]}</span></div>)}</div>
        <p className="ax__fine mono" data-r style={{ "--d": 3 }}>Le citano {unisci(conFonti.map(nomeTestata))}{pTestate.length > conFonti.length ? ` · nessuna fonte dichiarata per ${unisci(pTestate.filter((t) => !P[t].totale).map(nomeTestata))}` : ""}.</p>
      </> : <>
        <Titolo k="fonti">Nessuna testata dice da dove arrivano le informazioni.</Titolo>
        <p className="ax__lead" data-r style={{ "--d": 2 }}>Nei titoli e negli estratti le fonti si citano di rado: con il testo completo degli articoli questo capitolo si riempie.</p>
      </>}</Capitolo>

      <Capitolo k="parole" n={6}>
        {d.parole.length || titoli ? <>
          <Titolo k="parole">{framing ? framing.differenza_it : d.parole.length ? `Le testate scelgono ${pl(d.parole.length, "parola", "parole")} per descrivere i protagonisti.` : "Le parole sono simili; cambiano i titoli."}</Titolo>
          {d.parole.length > 0 && <>
            <p className="ax__hint mono" data-r style={{ "--d": 2 }}>Tocca una parola: chi la usa, per chi, e con quale frase.</p>
            <div className="ax__cloud" data-r style={{ "--d": 2 }}>
              {d.parole.map((w, i) => <button key={i} type="button" className="ax__word" aria-expanded={parola === i} style={{ "--s": Math.min(w.testate.size, 5), "--d": i }} onClick={() => setParola(parola === i ? null : i)}>{w.termine}</button>)}
            </div>
            {sel && (
              <div className="ax__wordbox" aria-live="polite">
                <p className="ax__wt">«{sel.termine}»</p>
                <p>La {sel.testate.size === 1 ? "usa" : "usano"} <b>{unisci([...sel.testate].map(nomeTestata))}</b>{sel.riferiti.size ? `, per ${unisci([...sel.riferiti])}` : ""}.</p>
                <Prove evidenze={sel.evidenze} nomeTestata={nomeTestata} />
              </div>
            )}
          </>}
          {titoli && <div className="ax__card ax__card--wide" data-r style={{ "--d": 3 }}><p className="mono muted">I titoli</p><p className="ax__ct">{titoli.differenza_it}</p><Prove evidenze={titoli.evidenze} nomeTestata={nomeTestata} /></div>}
        </> : <>
          <Titolo k="parole">Le testate usano parole simili.</Titolo>
          <p className="ax__lead" data-r style={{ "--d": 2 }}>Nessuna differenza di lessico nei testi analizzati.</p>
        </>}
      </Capitolo>

      <Capitolo k="manca" n={7} alt>
        {(A.gaps || []).length ? <>
          <Titolo k="manca">{A.gaps.length === 1 ? "Una cosa manca" : `${A.gaps.length} cose mancano`} nel racconto d’insieme.</Titolo>
          <ul className="ax__gaps">{A.gaps.map((g, i) => <li key={i} data-r style={{ "--d": i + 2 }}>{g}</li>)}</ul>
        </> : <>
          <Titolo k="manca">Non manca niente che si possa ricavare dai dati.</Titolo>
          <p className="ax__lead" data-r style={{ "--d": 2 }}>Parlano più parti, scrivono testate di più paesi e il racconto è distribuito nel tempo.</p>
        </>}
      </Capitolo>

      <Capitolo k="tempi" n={8}>
        {primi.length ? <>
          <Titolo k="tempi">La prima è stata <b>{nomeTestata(primi[0].source)}</b> alle {quando(primi[0])}.</Titolo>
          {primi.length > 1 && <p className="ax__lead" data-r style={{ "--d": 2 }}>Nelle {durata(arco)} successive l’hanno raccontata altre {pl(primi.length - 1, "testata", "testate")}.</p>}
          <Linea classe="ax__track" punti={primi.map((t, i) => ({ x: 4 + (t.minuti_dopo || 0) / arco * 92, sopra: quando(t), sotto: nomeTestata(t.source), rosso: i === 0, titolo: `${quando(t)} · ${nomeTestata(t.source)}` }))} />
          <ol className="ax__times">{primi.map((t, i) => (
            <li key={i} data-r style={{ "--d": Math.min(i, 8) + 3 }}><time className="mono">{quando(t)}</time> <b>{nomeTestata(t.source)}</b>
              {i ? <span className="mono muted"> +{durata(t.minuti_dopo)}</span> : <> <span className="stag stag--concorde">Prima</span></>}</li>
          ))}</ol>
        </> : <Titolo k="tempi">Non ci sono dati sui tempi.</Titolo>}
      </Capitolo>

      <section className="ax ax--foot is-in"><div className="wrap ax__in">
        <p className="ax__lead">Questa analisi è automatica e descrive differenze documentate: non dice chi ha ragione. Ogni frase rimanda all’articolo da cui viene: in caso di dubbio, vale l’originale.</p>
        <p className="mono muted ax__fine">Fatta alle {ora(rec.created_at)} su {pl(d.usati.length, "articolo", "articoli")} di {pl(d.nTestate, "testata", "testate")} · {meta.scope === "full" ? "testi completi delle pagine pubbliche" : "titoli ed estratti dei feed"}
          {meta.dropped_proofs ? ` · ${pl(meta.dropped_proofs, "dato scartato", "dati scartati")} perché la prova non compariva nel testo` : ""}.
          {rec.new_articles ? ` Da allora sono arrivati ${pl(rec.new_articles, "articolo", "articoli")}: l’analisi si aggiorna al massimo ogni 15 minuti.` : ""}</p>
        <button type="button" className="btn" onClick={() => vai("inizio")}>↑ Torna all’inizio dell’analisi</button>
      </div></section>
    </div>
  );
}
