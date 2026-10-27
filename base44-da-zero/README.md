# Il Grande Giornale su Base44 · da zero

Questa cartella costruisce **Il Grande Giornale su Base44 partendo da un'app vuota**, fino al prodotto
dell'ultima modifica:
- tre stili: Magazine nero e arancione (predefinito), Pop, Svizzero; due temi, Carta e Notte;
- testata con logo di testo e fenice animata;
- globo interattivo con volo, cerchio e pagina del paese;
- Internazionale con il titolo in grande;
- «Le notizie» e «In diretta»;
- Edicola moderna e La mia edicola;
- Analisi a capitoli;
- invito alla lettura prima del sito della testata;
- 49 testate e 119 feed.

**Si comincia da [`prompt/00-come-usare.md`](prompt/00-come-usare.md)** e si va avanti un prompt alla
volta, fino all'11.

## Com'è fatta

| Parte | Come funziona |
|---|---|
| **Dati** | 4 entità: `Article`, `StoryTitle`, `EditionSnapshot`, `FeedStatus`. Per l'Analisi se ne aggiungono altre 3: `StoryAnalysis`, `ArticleExtraction`, `LLMUsage`. |
| **Server** | Una sola funzione Deno, `giornale`. Senza parametri (automazione ogni 5 minuti) legge i feed e salva. Con `{ azione }` restituisce le viste `meta`, `front`, `day`, `story`, `search` e `article`. Le storie non si salvano: si ricalcolano dagli articoli delle ultime 72 ore. |
| **Analisi** | Il motore segue i prompt già scritti in `../base44-modifiche/riferimenti/base44-analisi-prompt.md`. Le pagine leggono il risultato dalla funzione `analisi`, il cui contratto è nel prompt 10. |
| **Pagine** | React, con gli stessi nomi di classe del sito di riferimento. Per questo i fogli di stile finali si usano così come sono. Le risposte usano le chiavi brevi: `id`, `t`, `ts`, `s`, `st`, `k`, `w`, `it`, `o`, `x`, `u`, `l`, `img`. |
| **Chiavi** | La chiave `ANTHROPIC_API_KEY` sta solo nei secret dell'app, mai nelle pagine. Senza chiave il giornale funziona, ma con i titoli in originale e l'Analisi spenta. |

## I file e dove vanno in Base44

| In questa cartella | In Base44 |
|---|---|
| `codice/entita/Article.json`, `StoryTitle.json`, `EditionSnapshot.json`, `FeedStatus.json` | Entità con lo stesso nome (prompt 01) |
| `codice/funzioni/giornale.ts` | Funzione di backend `giornale` (prompt 02) |
| `codice/stili/app.css`, `magazine.css`, `pop.css`, `base44.css` | `index.css`, in quest'ordine (prompt 03) |
| `codice/componenti/giornale.jsx` | `components/giornale.jsx`: dati, cache, preferenze, stile e tema, indirizzi (prompt 04) |
| `codice/componenti/Pezzi.jsx` | `components/Pezzi.jsx`: foto, link agli articoli, schede, righe (prompt 04) |
| `codice/Layout.jsx` | `Layout.jsx`: barra in alto, fenice e logo, menu, piè di pagina (prompt 04) |
| `codice/componenti/Copertina.jsx` | `components/Copertina.jsx`: la copertina a foto dello Svizzero (prompt 05) |
| `codice/pagine/Home.jsx` | `pages/Home.jsx`: la prima pagina (prompt 05) |
| `codice/componenti/Globo.jsx`, `FasciaGlobo.jsx` | `components/` (prompt 06); servono i pacchetti npm `d3-geo`, `topojson-client` e `world-atlas` |
| `codice/pagine/Paese.jsx` | `pages/Paese.jsx` (prompt 06) |
| `codice/pagine/Sezione.jsx`, `Internazionale.jsx`, `Storia.jsx`, `Cerca.jsx`, `Info.jsx` | `pages/` (prompt 07) |
| `codice/pagine/Edicola.jsx`, `LaMiaEdicola.jsx` | `pages/` (prompt 08) |
| `codice/componenti/SchedaLettura.jsx` | `components/SchedaLettura.jsx`: l'invito alla lettura (prompt 09) |
| `codice/componenti/AnalisiRacconto.jsx` | `components/AnalisiRacconto.jsx`: l'Analisi a capitoli (prompt 10) |
| `codice/lib/app-riferimento.js`, `globo-riferimento.js`, `index-riferimento.html` | **Non vanno in Base44.** Sono il codice del sito di riferimento, da consultare se una pagina non torna. |

## Cosa è controllato e cosa no

- Il codice **non è stato eseguito su Base44**: qui non ci sono Base44 né Node.
- Ho controllato a macchina che in ogni file le parentesi siano bilanciate e che ogni `import` tra i file trovi il suo `export`.
- La logica è la stessa del sito Python, che funziona, tradotta funzione per funzione.
- Da verificare al primo giro (sono indicati anche nella «Verifica» del prompt 02):
  - nell'SDK di Base44: i filtri `$gte`/`$lt`, la paginazione con `skip`, `bulkCreate` e la forma della risposta di `base44.functions.invoke`. `chiama()` accetta sia `res.data` sia la risposta diretta;
  - l'SDK Anthropic importato in Deno con `npm:@anthropic-ai/sdk`;
  - che le funzioni rispondano ai visitatori non registrati.
- La funzione `analisi` e il motore dell'Analisi li scrive Base44 dai prompt: qui c'è il contratto (prompt 10B), non il codice.

## Rapporto con `base44-modifiche/`

`../base44-modifiche/` contiene le modifiche **una alla volta** (00–13) per un'app Base44 che
esisteva già. Questa cartella porta allo stesso risultato **partendo da zero**. Bisogna usarne una
sola, non tutte e due sulla stessa app. Fa eccezione il file di riferimento dell'Analisi, che il
prompt 10 richiama.
