/* Le pagine istituzionali (pages/Info.jsx?p=come-funziona|chi-siamo|contatti|privacy|cookie).
   I testi "DA COMPILARE" li scrive chi pubblica il sito: non sono consulenza legale. */
import { Link, useLocation } from "react-router-dom";
import { useGiornale, url } from "@/components/giornale";

const DaCompilare = ({ children }) => <span className="ph">{children}</span>;

function pagine(n, traduce) {
  return {
    "come-funziona": ["Come funziona", <>
      <p>Il Grande Giornale raccoglie i titoli di {n} testate italiane e internazionali e li mette in un’unica prima pagina. Ogni notizia rimanda all’articolo sul sito della testata che l’ha pubblicata.</p>
      <h2>Le notizie</h2>
      <p>Quando più testate raccontano lo stesso fatto, i loro titoli vengono riuniti in una storia. Una storia sale in prima pagina in base a quante testate diverse la raccontano e a quanto è recente. Ogni giornale conta una volta sola, anche se pubblica più articoli sullo stesso fatto.</p>
      <p>Le notizie raccontate da una sola testata restano in Ultim’ora. Dirette, notiziari e anteprime non finiscono mai in apertura. Il raggruppamento è automatico e può sbagliare: se due notizie diverse finiscono nella stessa storia, segnalacelo.</p>
      <h2>Le edizioni</h2>
      <p>La giornata ha quattro edizioni: notte (00–06), mattina (06–12), pomeriggio (12–18) e sera (18–24). Quando un’edizione chiude, la sua prima pagina viene salvata così com’era e resta consultabile.</p>
      <h2>Il globo</h2>
      <p>Il globo in prima pagina colora i paesi di cui si parla nell’edizione: più testate ne parlano, più il colore è acceso. Toccando un paese si apre la pagina con le sue notizie.</p>
      <h2>Le traduzioni</h2>
      <p>I titoli in altre lingue compaiono tradotti in italiano, con l’originale sotto e la lingua indicata accanto al nome della testata. Il pulsante «Titoli originali» in alto inverte l’ordine. Le traduzioni e i titoli delle storie più seguite sono scritti in automatico da un modello linguistico (Claude) a partire dai soli titoli delle testate.</p>
      {!traduce && <p>In questa installazione le traduzioni automatiche non sono attive: i titoli in altre lingue compaiono in originale.</p>}
      <h2>L’Analisi</h2>
      <p>Per le notizie raccontate da almeno tre testate, la scheda Analisi confronta cosa dicono tutte, dove si separano, le cifre, chi parla e le parole scelte. È automatica, descrive differenze documentate e non dice chi ha ragione: ogni frase rimanda all’articolo da cui viene.</p>
      <h2>Titoli ed estratti</h2>
      <p>Titoli ed estratti appartengono alle rispettive testate. Mostriamo il titolo e al massimo una riga di sintesi presa dal feed: per leggere la notizia si va sempre sul sito che l’ha pubblicata.</p>
      <p>Le foto sono quelle che le testate stesse mettono nei loro feed: le mostriamo caricandole dai loro siti, senza copiarle, sempre con il nome della testata e il collegamento all’articolo.</p>
      <h2>Da dove arrivano i dati</h2>
      <p>Il sito legge i feed RSS pubblici delle testate ogni cinque minuti e tiene le notizie degli ultimi tre giorni.</p>
    </>],
    "chi-siamo": ["Chi siamo", <>
      <p><DaCompilare>DA COMPILARE</DaCompilare> Chi cura il progetto, da dove nasce l’idea e come si sostiene.</p>
      <p>Il Grande Giornale non scrive notizie: le raccoglie, le mette in ordine e rimanda a chi le ha pubblicate.</p>
    </>],
    "contatti": ["Contatti", <>
      <p>Per segnalare un errore in un titolo, proporre una testata o scrivere alla redazione: <DaCompilare>DA COMPILARE: INDIRIZZO EMAIL</DaCompilare></p>
      <p>Se segnali una notizia, indica il nome della testata e l’orario che vedi accanto al titolo.</p>
    </>],
    "privacy": ["Privacy", <>
      <p><DaCompilare>DA COMPILARE</DaCompilare> Informativa a cura del titolare del trattamento: dati raccolti, finalità e base giuridica, tempi di conservazione, destinatari, diritti dell’interessato e come esercitarli.</p>
      <p>Nota tecnica per chi la redige: il sito carica i caratteri (Glacial Indifference, Fraunces, Newsreader, Inter, JetBrains Mono, Bodoni Moda, Jost) dalla rete jsDelivr, quindi l’indirizzo IP del visitatore arriva a jsDelivr. Anche le foto delle notizie si caricano direttamente dai siti delle testate: quei siti ricevono l’indirizzo IP del visitatore (non la pagina da cui arriva, che non viene inviata). Va considerata anche la piattaforma che ospita il sito (Base44).</p>
    </>],
    "cookie": ["Cookie", <>
      <p><DaCompilare>DA COMPILARE</DaCompilare> Elenco dei cookie e degli strumenti di analisi effettivamente in uso, con durata e finalità.</p>
      <p>Le pagine del giornale salvano nel tuo browser solo lo stile e il tema scelti, la preferenza sui titoli originali e le scelte di «La mia edicola». Verifica quali cookie tecnici aggiunge la piattaforma che ospita il sito.</p>
    </>],
  };
}

export default function Info() {
  const { meta } = useGiornale();
  const k = new URLSearchParams(useLocation().search).get("p");
  const p = pagine(meta?.sources?.length ?? 49, !!meta?.translate)[k];
  if (!p) {
    return <div className="wrap page"><div className="empty"><p className="mono muted">Errore 404</p><h2 className="empty__t">Questa pagina non c’è.</h2>
      <p>Forse il link è vecchio o c’è un errore di battitura.</p><Link className="btn" to={url.home()}>Torna alla prima pagina</Link></div></div>;
  }
  return (
    <div className="wrap page">
      <header className="phead"><p className="mono muted">Il giornale</p><h1 className="phead__t">{p[0]}</h1></header>
      <div className="prose">{p[1]}</div>
    </div>
  );
}
