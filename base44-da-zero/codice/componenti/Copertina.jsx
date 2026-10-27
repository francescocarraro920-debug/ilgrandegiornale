/* La copertina a scorrimento della prima pagina, nello stile svizzero (components/Copertina.jsx).
   Una foto larga quanto la pagina per ognuna delle 6 storie più seguite con foto; cambia ogni 7 secondi
   insieme al titolo sotto. Si ferma col mouse sopra, col fuoco della tastiera, con "Pausa", a scheda nascosta. */
import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useGiornale, url, hm, pl, riduciMovimento } from "@/components/giornale";

const DURATA = 7000;
const due = (n) => String(n).padStart(2, "0");

export default function Copertina({ storie }) {
  const { TL, srcName } = useGiornale();
  const n = storie.length;
  const [i, setI] = useState(0);
  const [pausa, setPausa] = useState(riduciMovimento());
  const [ferma, setFerma] = useState(false);
  const [giro, setGiro] = useState(0);
  const [daUtente, setDaUtente] = useState(false);
  const x0 = useRef(null), trascinato = useRef(false);

  const vai = useCallback((k, utente = false) => {
    setI(((k % n) + n) % n);
    setDaUtente(utente);
    if (utente) setGiro((g) => g + 1);
  }, [n]);

  useEffect(() => {
    if (n < 2 || pausa || ferma) return;
    const t = setInterval(() => { if (!document.hidden) vai(i + 1); }, DURATA);
    return () => clearInterval(t);
  }, [n, i, pausa, ferma, giro, vai]);

  if (!n) return null;
  const tieni = (v) => () => { setFerma(v); if (!v) setGiro((g) => g + 1); };

  return (
    <section className={`hero${n > 1 ? "" : " is-single"}${pausa ? " is-paused" : ""}${ferma ? " is-held" : ""}`}
      aria-roledescription="carosello" aria-label="Le notizie in primo piano"
      onMouseEnter={tieni(true)} onMouseLeave={tieni(false)} onFocus={tieni(true)} onBlur={tieni(false)}>
      <div className="hero__frame"
        onPointerDown={(e) => { x0.current = e.clientX; }}
        onPointerUp={(e) => {
          if (x0.current == null) return;
          const dx = e.clientX - x0.current; x0.current = null;
          if (Math.abs(dx) > 40) { trascinato.current = true; vai(i + (dx < 0 ? 1 : -1), true); }
        }}
        onClickCapture={(e) => { if (trascinato.current) { e.preventDefault(); trascinato.current = false; } }}>
        <div className="hero__track">
          {storie.map((s, k) => (
            <Link key={s.id} to={url.storia(s.id)} className={`hero__slide${k === i ? " is-on" : ""}`} tabIndex={k === i ? 0 : -1} aria-hidden={k !== i}>
              <img src={s.img} alt={s.t} loading={k ? "lazy" : "eager"} decoding="async" referrerPolicy="no-referrer" draggable="false" />
            </Link>
          ))}
        </div>
        {n > 1 && <>
          <button className="hero__nav hero__nav--prev" type="button" aria-label="Storia precedente" onClick={() => vai(i - 1, true)}><span aria-hidden="true">‹</span></button>
          <button className="hero__nav hero__nav--next" type="button" aria-label="Storia successiva" onClick={() => vai(i + 1, true)}><span aria-hidden="true">›</span></button>
          <div className="hero__progress" aria-hidden="true"><i key={`${i}-${giro}`} /></div>
        </>}
      </div>
      <div className="wrap hero__below">
        <div className="hero__caps" aria-live={daUtente ? "polite" : "off"}>
          {storie.map((s, k) => (
            <div key={s.id} className={`hero__cap${k === i ? " is-on" : ""}`} aria-hidden={k !== i}>
              <p className="kick"><span className="chip">{due(k + 1)} / {due(n)}</span><span className="mono"><b>{pl(s.n, "testata", "testate")}</b></span><span className="mono muted">{TL[s.k]} · {s.w}</span></p>
              <h2 className="hero__t"><Link to={url.storia(s.id)} tabIndex={k === i ? 0 : -1}>{s.t}</Link></h2>
              <p className="mono muted hero__credit">Foto · {srcName(s.img_s)} · aggiornata alle {hm(s.last)}</p>
            </div>
          ))}
        </div>
        {n > 1 && (
          <div className="hero__ctrl">
            <div className="hero__dots" role="group" aria-label="Scegli la storia">
              {storie.map((s, k) => <button key={s.id} className="hero__dot" type="button" aria-label={`Storia ${k + 1} di ${n}`} aria-current={k === i} onClick={() => vai(k, true)} />)}
            </div>
            <button className="mono hero__pause" type="button" aria-pressed={pausa} onClick={() => { setPausa(!pausa); setGiro((g) => g + 1); }}>{pausa ? "Riprendi" : "Pausa"}</button>
          </div>
        )}
      </div>
    </section>
  );
}
