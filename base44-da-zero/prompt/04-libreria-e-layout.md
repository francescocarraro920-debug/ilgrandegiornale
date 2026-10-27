# 04 · Libreria comune, pezzi e Layout

## Prompt

```
Crea tre file di codice, ESATTAMENTE come te li incollo (React, react-router-dom, nessun'altra
libreria). Usano le classi di index.css: non cambiarle e non aggiungere Tailwind.

1. components/giornale.jsx — la libreria comune:
   - chiama(azione, dati): base44.functions.invoke("giornale", { azione, ...dati }) con una
     piccola cache;
   - GiornaleProvider / useGiornale(): testate, sezioni, paesi (dalla vista "meta", riletta ogni
     minuto), "Titoli originali", le preferenze di "La mia edicola" (salvate nel browser con la
     chiave igg-edicola), la scheda d'invito alla lettura, l'avviso "Nuove notizie · Aggiorna";
   - useVista(azione, dati): carica una vista e la ricarica quando il lettore chiede di aggiornare;
   - useAspetto() / useStile(): stile (magazine, pop, svizzero) e tema (Carta, Notte);
   - url.*: gli indirizzi delle pagine, fatti con createPageUrl;
   - ISO: nome del paese → codice numerico per il globo.
2. components/Pezzi.jsx — i pezzi riusati: Foto (si carica dal sito della testata, sparisce se
   non si carica), LinkArticolo (apre la scheda d'invito invece del sito; con Ctrl/⌘ apre il sito),
   Timeline, Take, Card, Riga, Righe ("+N da Testata" quando una testata ha più di due titoli di
   fila), Caricamento, Errore.
3. Layout.jsx — il Layout di tutte le pagine:
   - barra in alto: "Edizione mondiale · Roma", "Aggiornato alle HH:MM", orologio di Roma con i
     secondi, pulsante "Titoli originali", selettori Stile (Magazine, Pop, Svizzero) e Tema (Carta,
     Notte);
   - testata: la FENICE (svg animato: ali, coda di fuoco) accanto al LOGO DI TESTO
     "IL GRANDE GIORNALE" con sotto "la vera informazione passa da qui"; a destra "Cerca";
   - menu: Prima pagina | Italia, Internazionale, Economia, Sport, Cultura, Scienza e tecnologia |
     Edicola, ★ La mia edicola;
   - la fascia "Nuove notizie · Aggiorna" quando la funzione ha letto articoli nuovi;
   - il piè di pagina con sezioni, pagine del giornale e note legali.
   Il Layout avvolge tutto in GiornaleProvider e importa components/SchedaLettura (che creeremo nel
   prompt 09): per ora crea components/SchedaLettura.jsx con
   export default function SchedaLettura(){ return null; }

Nomi delle pagine (le creiamo nei prossimi prompt; createPageUrl deve trovarle con questi nomi):
Home, Sezione, Internazionale, Storia, Paese, Edicola, LaMiaEdicola, Cerca, Info.
Home è la pagina iniziale.
```

Poi incolla: `codice/componenti/giornale.jsx`, `codice/componenti/Pezzi.jsx`, `codice/Layout.jsx`.

## Verifica

- In alto si vedono la fenice che si muove piano e "IL GRANDE GIORNALE" in maiuscolo spaziato.
- Il selettore Stile cambia subito l'aspetto; la scelta resta dopo aver ricaricato la pagina.
- L'orologio segna l'ora di Roma; "Aggiornato alle…" compare dopo il primo giro della funzione.
- Con "riduci movimento" attivo nel sistema la fenice sta ferma.
