# 02 · La funzione `giornale` e l'automazione

## Prompt

```
Crea la funzione di backend "giornale" con ESATTAMENTE il codice che ti incollo sotto (Deno,
TypeScript, usa npm:@base44/sdk e, solo se c'è la chiave, npm:@anthropic-ai/sdk). Non riscriverla e
non dividerla: contiene già i dati delle 49 testate e dei loro feed, i luoghi, le regole delle
sezioni e le edizioni.

Cosa fa:
1. AGGIORNAMENTO — chiamata senza body (o con { "azione": "aggiorna" }): legge i feed RSS,
   salva gli articoli nuovi in Article (con foto, sezione, luogo, tipo, lingua), aggiorna
   FeedStatus, salva le edizioni appena chiuse in EditionSnapshot, cancella gli articoli più vecchi
   di 3 giorni e, se nei secret c'è ANTHROPIC_API_KEY, traduce i titoli stranieri con
   claude-haiku-5-5.
2. VISTE — chiamata dalle pagine con { "azione": ... }:
   - "meta": testate, sezioni, paesi, edizioni, giorni, ora dell'ultimo aggiornamento;
   - "front" con { day, ed }: la prima pagina di un'edizione (notte, mattina, pomeriggio, sera);
   - "day": tutte le notizie di oggi e le loro storie;
   - "story" con { id }: una storia con i suoi articoli e le storie collegate;
   - "search" con { q }: ricerca nei titoli degli ultimi 3 giorni;
   - "article" con { id }: un articolo con le sue prime righe.
   Le risposte usano chiavi brevi (id, t, ts, s, st, k, w, it, o, x, u, l, img): non cambiarle,
   le pagine le usano così.

Poi:
- crea un'AUTOMAZIONE che chiama la funzione "giornale" ogni 5 minuti, senza parametri;
- la funzione deve poter essere chiamata dalle pagine con
  base44.functions.invoke("giornale", { azione: "meta" }) anche dai visitatori non registrati;
- (facoltativo) nei secret dell'app aggiungi ANTHROPIC_API_KEY: la inserisco io dalle
  impostazioni, tu non chiedermela e non scriverla mai nel codice.
```

Poi incolla tutto `codice/funzioni/giornale.ts`.

## Verifica

1. Lancia la funzione a mano una volta (senza parametri). Risponde con qualcosa come
   `{ "nuovi": 900, "tradotti": 0, "feed": 119, "errori": 3 }`. Il primo giro può durare un minuto.
2. In Data → Article ci sono centinaia di righe; in FeedStatus una riga per feed.
3. Prova la funzione con `{ "azione": "meta" }`: risponde con `sources` (49 testate), `editions`
   (4), `days`, `updated`.
4. Prova `{ "azione": "front" }`: risponde con `articles`, `stories`, `rail`.
5. Dopo 10 minuti l'automazione ha girato da sola (il registro delle esecuzioni lo mostra).

**Se qualcosa non va**, i punti da controllare per primi (il codice non è stato eseguito su Base44):
- i filtri con `$gte`/`$lt` e la paginazione (`skip`) di `entities.Article.filter`;
- `bulkCreate` (se non esiste nella tua versione dell'SDK, chiedi di sostituirlo con un ciclo di
  `create`);
- l'import dinamico di `npm:@anthropic-ai/sdk` in Deno.
