# 00 · Come usare questi prompt

Questa cartella costruisce **Il Grande Giornale su Base44 partendo da un'app vuota**, fino al prodotto
di oggi: Magazine nero e arancione (predefinito), Pop, Svizzero; globo interattivo e pagine dei paesi;
Internazionale; Edicola e La mia edicola; Analisi a capitoli; invito alla lettura; logo di testo con
la fenice; 49 testate.

Non sostituisce `../base44-modifiche/`: quella cartella descrive le modifiche **una alla volta** su
un'app che esisteva già. Questa invece parte da zero e porta direttamente al risultato finale.

## Regole

1. **Un prompt alla volta**, nell'ordine dei numeri. Dopo ogni prompt fai i controlli della sezione
   «Verifica» e passa al successivo solo se tornano.
2. Quando il prompt dice «incolla il file `codice/…`», apri quel file, copia **tutto** il contenuto e
   incollalo nella chat dopo il testo del prompt (o chiedi a Base44 di creare il file e incollalo
   nell'editor del codice). I file sono lunghi: è voluto, così Base44 non deve inventare niente.
3. Se Base44 «semplifica» (riscrive il codice a modo suo, cambia nomi di classe o di campo),
   rispondi: «Usa il codice esattamente come te l'ho dato, senza cambiare nomi né struttura».
4. Le chiavi API stanno **solo nei secret** dell'app (Impostazioni → Secrets), mai nel codice
   della pagina e mai nella chat.

## Prima di iniziare

- Piano Base44 con **funzioni di backend e automazioni** (Builder o superiore).
- Facoltativo: una chiave Anthropic da salvare come secret `ANTHROPIC_API_KEY` (traduzioni dei
  titoli e Analisi). Senza chiave il giornale funziona lo stesso: titoli in originale, Analisi spenta.

## L'ordine

| N. | Prompt | Cosa ottieni |
|---|---|---|
| 01 | Progetto ed entità | L'app, le 4 entità dei dati |
| 02 | Funzione `giornale` e automazione | Il server: feed, storie, edizioni, viste |
| 03 | Stili e caratteri | I tre stili e i due temi, identici al sito |
| 04 | Libreria comune e Layout | Testata con fenice e logo, menu, piè di pagina |
| 05 | Prima pagina | Edizioni, apertura, In evidenza, cifre, Ultim'ora, prime pagine |
| 06 | Globo e pagine dei paesi | Globo da trascinare, volo e cerchio, pagina del paese |
| 07 | Sezioni, Internazionale, notizia, Cerca, Info | Le pagine interne |
| 08 | Edicola e La mia edicola | Le testate per paese, la pagina personale |
| 09 | Invito alla lettura | La scheda prima del sito della testata |
| 10 | Analisi | Motore di confronto e racconto a capitoli |
| 11 | Controlli e pubblicazione | Prova completa, telefono, note legali |

## Mappa dei file

| File in questa cartella | Dove va in Base44 |
|---|---|
| `codice/entita/*.json` | Entità (Data) con lo stesso nome |
| `codice/funzioni/giornale.ts` | Funzione di backend `giornale` |
| `codice/stili/app.css` + `magazine.css` + `pop.css` + `base44.css` | `index.css`, in quest'ordine |
| `codice/componenti/giornale.jsx` | `components/giornale.jsx` |
| `codice/componenti/Pezzi.jsx`, `Copertina.jsx`, `Globo.jsx`, `FasciaGlobo.jsx`, `SchedaLettura.jsx`, `AnalisiRacconto.jsx` | `components/` con lo stesso nome |
| `codice/Layout.jsx` | `Layout.jsx` |
| `codice/pagine/*.jsx` | `pages/` con lo stesso nome (Home, Sezione, Internazionale, Storia, Paese, Edicola, LaMiaEdicola, Cerca, Info) |
| `codice/lib/*-riferimento.*` | **Non** vanno in Base44: sono il sito di riferimento, da consultare |
