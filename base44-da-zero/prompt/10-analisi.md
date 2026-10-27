# 10 · Analisi: il motore e il racconto a capitoli

L'Analisi confronta come le testate raccontano la stessa storia (cosa dicono tutte, dove si
separano, cifre, chi parla, fonti, parole, cosa manca, tempi). Descrive differenze documentate:
non dice chi ha ragione e non dà voti alle testate. Serve la chiave `ANTHROPIC_API_KEY` nei secret
(oppure l'LLM integrato di Base44).

Si fa in **tre passi**: 10A (il motore, con i prompt già scritti), 10B (la funzione `analisi` che
le pagine chiamano), 10C (l'interfaccia).

## 10A · Il motore

Usa i prompt **1, 2, 3, 4, 5 e 7** di
[`../../base44-modifiche/riferimenti/base44-analisi-prompt.md`](../../base44-modifiche/riferimenti/base44-analisi-prompt.md),
uno alla volta, con le loro verifiche. **Salta lo 0** (la ricognizione non serve: i dati li hai
appena creati) **e il 6** (l'interfaccia è la 10C). Prima di incollare il prompt 1, scrivi:

```
Nota per i prossimi prompt sull'Analisi. In questa app le storie NON sono un'entità: le calcola la
funzione "giornale". Per avere una storia e i suoi articoli chiama la funzione "giornale" con
{ azione: "story", id } (dal backend, per esempio con base44.asServiceRole.functions.invoke, o
riusando lo stesso codice). Risponde { story: { id, t, w, n, srcs, arts, … }, articles: [ { id, s,
l, ts, t, it, o, u, x, desc, … } ] } dove: s = chiave della testata, l = lingua, ts = ora di
pubblicazione in secondi, it = titolo italiano, o = titolo originale, u = link, x = tipo
(live, bollettino, anteprima, opinione), desc = estratto. Il paese della testata è in
{ azione: "meta" } → sources[].cc. Le storie di oggi con più testate sono in { azione: "front" }
→ stories. "Storia" nei prompt seguenti vuol dire questo.
```

## 10B · La funzione `analisi`

```
Crea la funzione di backend "analisi", chiamata dalla pagina della notizia con
base44.functions.invoke("analisi", { story_id }), anche dai visitatori non registrati.
Risponde SEMPRE con un oggetto con "status":
- { status: "ready", analysis, created_at, new_articles, simulated: false } se c'è una
  StoryAnalysis pronta per quella storia (o per una con almeno il 60% degli stessi articoli):
  "analysis" è il JSON salvato, "created_at" la data ISO, "new_articles" quanti articoli sono
  arrivati dopo;
- { status: "pending" } se non c'è ancora: in quel caso segna la storia come "richiesta da un
  lettore", così l'automazione del prompt 5 la analizza per prima;
- { status: "too_few", min: 3, n } se la storia ha meno di 3 testate;
- { status: "unavailable" } se non c'è né la chiave né l'LLM di Base44;
- { status: "blocked" } se il tetto di spesa di oggi è raggiunto;
- { status: "error" } se l'ultima analisi è fallita (il motivo resta solo nei log, mai ai lettori).
Non deve mai lanciare l'analisi lei stessa (la fa l'automazione): deve rispondere in meno di un
secondo.
```

## 10C · Il racconto a capitoli

```
Sostituisci components/AnalisiRacconto.jsx (era provvisorio) con ESATTAMENTE il codice che ti
incollo. La pagina della notizia (pages/Storia.jsx) lo usa già quando "analisi" risponde
"ready", e mostra da sola gli altri stati (in preparazione con nuovo controllo ogni 15 secondi,
meno di 3 testate, non attiva, limite di spesa, errore).
Il racconto: un'apertura a tutto schermo nel colore dello stile ("Abbiamo letto 12 articoli di 12
testate, da 7 paesi in 3 lingue", con i numeri che contano) e il verdetto in una frase; poi otto
capitoli larghi quanto la finestra: 01 Cosa dicono tutti, 02 Dove si separano, 03 Le cifre (linea
con i valori), 04 Chi ha la parola (barre per categoria), 05 Da dove arriva, 06 Le parole scelte
(nuvola), 07 Cosa manca, 08 Chi è arrivato prima. Ogni frase rimanda alla prova (massimo 20
parole) e all'articolo. Gli stili (.axs, .ax, --ax-*) sono già in index.css.
```

Poi incolla: `codice/componenti/AnalisiRacconto.jsx`.

## Verifica

- Una storia con almeno 3 testate: «Analisi» mostra prima "Analisi in preparazione", poi entro
  qualche minuto il racconto a capitoli.
- Una storia con 2 testate: "Servono almeno tre testate."
- Toccando il nome di una testata compare la frase prova tra «» con "Leggi l'articolo ↗".
- Sul telefono nessuno scorrimento orizzontale; sopra i 1200 px compaiono gli 8 pallini a destra.
- I casi di controllo del prompt 4 del motore (Serbia, Machado), se quelle storie sono ancora
  nell'app.
