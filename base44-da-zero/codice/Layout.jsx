/* Il Layout comune a tutte le pagine (Layout.jsx): barra in alto, testata con fenice e logo di testo,
   menu delle sezioni, avviso delle notizie nuove, piè di pagina, scheda d'invito alla lettura. */
import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { GiornaleProvider, useGiornale, useAspetto, url, hm, leggi } from "@/components/giornale";
import SchedaLettura from "@/components/SchedaLettura";

/* Stile e tema prima del primo disegno, se lo script in index.html non c'è (vedi il prompt 03) */
function applicaAspetto() {
  try {
    const t = leggi("igg-theme");
    if (t === "light" || t === "dark") document.documentElement.setAttribute("data-theme", t);
    const q = new URLSearchParams(location.search).get("stile");
    const ok = q === "magazine" || q === "svizzero" || q === "pop";
    const s = ok ? q : leggi("igg-style") || "magazine";
    if (ok) localStorage.setItem("igg-style", q);
    if (s === "svizzero") document.documentElement.removeAttribute("data-style");
    else document.documentElement.setAttribute("data-style", s);
  } catch {}
}
if (typeof document !== "undefined") applicaAspetto();

const SEZIONI = [["italia", "Italia"], ["esteri", "Internazionale"], ["economia", "Economia"], ["sport", "Sport"], ["cultura", "Cultura"], ["scienza", "Scienza e tecnologia"]];

function Orologio() {
  const fmt = new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
  const [ora, setOra] = useState(fmt.format(new Date()));
  useEffect(() => { const t = setInterval(() => setOra(fmt.format(new Date())), 1000); return () => clearInterval(t); }, []);
  return <span className="mono clockw"><i className="dot" aria-hidden="true" /><span className="clock-lab">Ora di Roma</span><time className="clock">{ora}</time></span>;
}

function Selettore({ etichetta, valore, opzioni, onScegli }) {
  return (
    <div className="seg mono" role="group" aria-label={etichetta}>
      {opzioni.map(([v, t]) => <button key={v} type="button" aria-pressed={valore === v} onClick={() => onScegli(v)}>{t}</button>)}
    </div>
  );
}

/* La fenice del Grande Giornale: ali a piume di fiamma, coda di fuoco; si muove piano (vedi app.css) */
export function Fenice() {
  const g = (o) => ({ stopColor: `var(${o})` });
  return (
    <span className="phoenix" aria-hidden="true"><svg viewBox="0 0 64 64" width="64" height="64" focusable="false">
      <defs>
        <linearGradient id="phx-g" x1="56" y1="4" x2="10" y2="62" gradientUnits="userSpaceOnUse">
          <stop offset="0" style={g("--px-1")} /><stop offset=".55" style={g("--px-1")} /><stop offset="1" style={g("--px-2")} />
        </linearGradient>
        <linearGradient id="phx-w" x1="44" y1="20" x2="2" y2="14" gradientUnits="userSpaceOnUse">
          <stop offset="0" style={g("--px-2")} /><stop offset="1" style={g("--px-1")} />
        </linearGradient>
      </defs>
      <g className="phx">
        <g className="phx__wing phx__wing--up" fill="url(#phx-w)"><path d="M41.5 22C38 14.5 35.5 8 35 1.5C39.5 6.5 43 12 45.5 19Z" /></g>
        <g className="phx__wing" fill="url(#phx-w)">
          <path d="M40.5 25C33.5 15 22.5 7 5.5 3C14 9 22 13.5 28 18.5C31.5 21.5 34 25 36 28.5Z" />
          <path d="M39.5 28C31 21.5 18.5 17.5 2.5 17C13.5 22.5 24 26.5 36.5 31.5Z" />
          <path d="M38.5 31C29.5 30.5 19 32.5 7.5 37.5C19 37 29 36.5 37.5 34.5Z" />
        </g>
        <g className="phx__tail" fill="url(#phx-g)">
          <path d="M31 46C24 50 17.5 56 11.5 63.5C20 60.5 26.5 56 32.5 50Z" />
          <path d="M32 47C30 54 31 59.5 35.5 64C36.5 58 35.5 52 34 48Z" />
          <path d="M33.5 46C38.5 51 44 55 52 57C46 52 40.5 48 36 44Z" />
          <path d="M30.5 49C25.5 54 26 60 30.5 62C28.5 58.5 29.5 54.5 33 51Z" />
        </g>
        <path fill="url(#phx-g)" d="M44 9C49.5 9 52 14.5 48 18.5C45 22 43.5 28 42 34C40 41 36 46 29.5 49C30 42 31.5 35 33.5 28.5C35.5 21 39 14 44 9Z" />
        <path fill="url(#phx-g)" d="M44.5 9.5C43 5.5 40.5 3 37 1C41 1.5 44.5 3.5 46.5 8Z" />
        <path fill="url(#phx-g)" d="M43.5 10.5C40.5 7.5 36.5 6.5 33 6.5C36.5 8.5 39.5 10.5 43 12.5Z" />
        <path fill="url(#phx-g)" d="M48 11.5L55 13L48 15Z" />
        <circle cx="46" cy="12.6" r="1.05" style={{ fill: "var(--bg)" }} />
      </g>
    </svg></span>
  );
}

const Logo = ({ piccolo }) => (
  <Link className={"logo" + (piccolo ? " logo--sm" : "")} to={url.home()} aria-label="Il Grande Giornale, prima pagina">
    <span className="logo__name">Il Grande Giornale</span>
    <span className="logo__tag">la vera informazione passa da qui</span>
  </Link>
);

function Testata({ currentPageName }) {
  const { meta, orig, setOrig, nuove, ricarica, lettura, chiudiArticolo } = useGiornale();
  const { stile, setStile, scuro, setTema } = useAspetto();
  const loc = useLocation();
  const k = new URLSearchParams(loc.search).get("k");
  const attiva = (pagina, kk) => (currentPageName === pagina && (!kk || kk === k)) || (kk === "esteri" && currentPageName === "Internazionale");
  const voce = (to, testo, on, cls = "") => <li key={to}><Link to={to} className={cls} aria-current={on ? "page" : undefined}>{testo}</Link></li>;
  return (
    <>
      <a className="skip mono" href="#view">Vai al contenuto</a>
      <header className="top"><div className="wrap top__in">
        <div className="top__left">
          <span className="mono muted">Edizione mondiale · Roma</span>
          <span className={"mono proto" + (meta?.updated ? " is-live" : "")}>{meta?.updated ? "Aggiornato alle " + hm(meta.updated) : meta ? "Primo aggiornamento in corso…" : "Collegamento…"}</span>
        </div>
        <div className="top__right">
          <Orologio />
          <button className="mono tog" type="button" aria-pressed={orig} onClick={() => setOrig(!orig)}><span className="hide-s">Titoli </span>originali</button>
          <Selettore etichetta="Stile" valore={stile} onScegli={setStile} opzioni={[["magazine", "Magazine"], ["pop", "Pop"], ["svizzero", "Svizzero"]]} />
          <Selettore etichetta="Tema" valore={scuro ? "dark" : "light"} onScegli={setTema} opzioni={[["light", "Carta"], ["dark", "Notte"]]} />
        </div>
      </div></header>

      <div className="mast"><div className="wrap mast__in">
        <div className="brand"><Fenice /><Logo /></div>
        <Link className="sbtn mono" to={url.cerca()} aria-label="Cerca fra i titoli">
          <svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5" /><path d="M11 11l3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
          <span>Cerca</span>
        </Link>
      </div></div>

      <nav className="nav" aria-label="Sezioni"><div className="wrap"><ul className="nav__list">
        {voce(url.home(), "Prima pagina", currentPageName === "Home")}
        <li className="nav__sep" aria-hidden="true" />
        {SEZIONI.map(([kk, t]) => voce(url.sezione(kk), t, attiva("Sezione", kk)))}
        <li className="nav__sep" aria-hidden="true" />
        {voce(url.edicola(), "Edicola", currentPageName === "Edicola")}
        {voce(url.mia(), "★ La mia edicola", currentPageName === "LaMiaEdicola", "nav__mine")}
      </ul></div></nav>

      {nuove && <div className="fresh"><div className="wrap fresh__in"><button className="mono fresh__btn" type="button" onClick={ricarica}>Nuove notizie · Aggiorna</button></div></div>}
      {lettura && <SchedaLettura key={lettura.articolo.id} a={lettura.articolo} da={lettura.da} onClose={chiudiArticolo} />}
    </>
  );
}

function Piede() {
  return (
    <footer className="foot">
      <div className="wrap foot__in">
        <div className="foot__about">
          <Logo piccolo />
          <p>Un'unica prima pagina per leggere il mondo come lo raccontano le testate più autorevoli, dalla notte alla sera.</p>
          <p>Titoli ed estratti appartengono alle rispettive testate. Ogni notizia rimanda all'articolo originale.</p>
        </div>
        <div><h3 className="mono">Sezioni</h3><ul>{SEZIONI.map(([k, t]) => <li key={k}><Link to={url.sezione(k)}>{t}</Link></li>)}</ul></div>
        <div><h3 className="mono">Il giornale</h3><ul>
          <li><Link to={url.edicola()}>Edicola</Link></li><li><Link to={url.mia()}>La mia edicola</Link></li>
          <li><Link to={url.info("come-funziona")}>Come funziona</Link></li><li><Link to={url.info("chi-siamo")}>Chi siamo</Link></li>
          <li><Link to={url.info("contatti")}>Contatti</Link></li></ul></div>
        <div><h3 className="mono">Note legali</h3><ul><li><Link to={url.info("privacy")}>Privacy</Link></li><li><Link to={url.info("cookie")}>Cookie</Link></li></ul></div>
      </div>
      <div className="wrap"><p className="mono foot__base">© 2026 Il Grande Giornale · Aggiornamento continuo, ora di Roma</p></div>
    </footer>
  );
}

export default function Layout({ children, currentPageName }) {
  // Si torna in cima cambiando pagina (non quando cambiano solo i filtri)
  const loc = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [loc.pathname]);
  return (
    <GiornaleProvider>
      <Testata currentPageName={currentPageName} />
      <main id="view" tabIndex={-1}>{children}</main>
      <Piede />
    </GiornaleProvider>
  );
}
