/* L'invito alla lettura (components/SchedaLettura.jsx): prima di andare sul sito della testata si apre
   questa scheda con nome della testata, foto, titolo, prime righe e il grande pulsante
   «Leggi l'articolo su Le Monde ↗». È un <dialog> modale: Esc, × o un tocco fuori la chiudono;
   alla chiusura il fuoco torna al link da cui si è partiti. La apre LinkArticolo (components/Pezzi.jsx). */
import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useGiornale, chiama, url, safeUrl, riduciMovimento } from "@/components/giornale";

const RIGHE = new Map();   // prime righe già lette, per id

export default function SchedaLettura({ a, da, onClose }) {
  const { SRC, TL, srcName, ccName, parts } = useGiornale();
  const ref = useRef(null);
  const loc = useLocation();
  const inizio = useRef(loc.pathname + loc.search);
  const [righe, setRighe] = useState(a.desc ?? RIGHE.get(a.id));
  const [fotoOk, setFotoOk] = useState(!!a.img);

  const chiudi = () => {
    const d = ref.current;
    if (!d?.open) return;
    if (riduciMovimento()) { d.close(); return; }
    d.classList.add("is-closing");
    setTimeout(() => { d.classList.remove("is-closing"); if (d.open) d.close(); }, 200);
  };

  useEffect(() => {
    const d = ref.current;
    if (typeof d.showModal === "function") d.showModal(); else d.setAttribute("open", "");
    document.documentElement.classList.add("has-read");
    d.querySelector(".read__go")?.focus({ preventScroll: true });
    const allaChiusura = () => { document.documentElement.classList.remove("has-read"); da?.focus?.({ preventScroll: true }); onClose(); };
    d.addEventListener("close", allaChiusura);
    return () => { d.removeEventListener("close", allaChiusura); document.documentElement.classList.remove("has-read"); };
  }, []);

  // Le prime righe arrivano dal server solo per l'articolo aperto
  useEffect(() => {
    if (righe !== undefined) return;
    chiama("article", { id: a.id }).then((r) => r?.desc || "").catch(() => "").then((t) => { RIGHE.set(a.id, t); setRighe(t); });
  }, [a.id]);

  // Cambiando pagina la scheda si chiude
  useEffect(() => { if (loc.pathname + loc.search !== inizio.current) chiudi(); }, [loc.pathname, loc.search]);

  const p = parts(a), nome = srcName(a.s), cc = SRC[a.s]?.cc || "";
  let sito = "";
  try { sito = new URL(a.u).hostname.replace(/^www\./, ""); } catch {}
  const urlStoria = a.st ? url.storia(a.st) : null;
  const giaQui = urlStoria && loc.pathname + loc.search === urlStoria;

  return (
    <dialog ref={ref} className="read" aria-labelledby="read-t" onClick={(e) => { if (e.target === ref.current) chiudi(); }}
      onCancel={(e) => { e.preventDefault(); chiudi(); }}>
      <div className="read__panel">
        <button className="read__x" type="button" aria-label="Chiudi" onClick={chiudi}>×</button>
        <p className="read__src">
          <span className="read__name">{nome}</span>
          {a.l !== "it" && <span className="badge">{a.l.toUpperCase()}</span>}
          {a.x === "live" && <span className="tag tag--live">Diretta</span>}
        </p>
        <p className="mono muted read__meta">{cc} · {ccName(a.s)} · {TL[a.k] || ""} · pubblicato alle {a.t}</p>
        {fotoOk && <figure className="read__pic"><img src={a.img} alt="" decoding="async" referrerPolicy="no-referrer" onError={() => setFotoOk(false)} /></figure>}
        <h2 className="read__t" id="read-t" lang={p.main.lang}>{p.main.txt}</h2>
        {p.sub && <p className="read__o" lang={p.sub.lang}>{p.sub.txt}</p>}
        {righe === undefined
          ? <p className="read__d" lang={a.l} aria-busy="true"><span className="sk sk--l" /><span className="sk sk--s" /></p>
          : righe && <p className="read__d is-in" lang={a.l}>{righe}</p>}
        <div className="read__cta">
          <a className="read__go" href={safeUrl(a.u)} target="_blank" rel="noopener" onClick={() => setTimeout(chiudi, 150)}>
            Leggi l’articolo su {nome}<span aria-hidden="true">↗</span>
          </a>
          {sito && <span className="mono muted read__host">{sito}</span>}
        </div>
        <p className="read__note">L’articolo completo è sul sito di <b>{nome}</b>. Il Grande Giornale raccoglie i titoli e ti porta alla fonte: leggerlo lì sostiene il lavoro di chi l’ha scritto.</p>
        {urlStoria && !giaQui && <Link className="mono read__story" to={urlStoria}>Come lo raccontano le altre testate →</Link>}
      </div>
    </dialog>
  );
}
