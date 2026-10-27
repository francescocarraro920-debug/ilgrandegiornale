# 01 · Progetto ed entità

## Prompt

```
Creiamo da zero "Il Grande Giornale": un'unica prima pagina che raccoglie i titoli di 49 testate
italiane e internazionali, li riunisce in "storie" quando più testate raccontano lo stesso fatto e
rimanda sempre all'articolo originale. Il sito è in italiano, con l'ora di Roma.

In questo passo crea SOLO le entità dei dati, esattamente con questi schemi (te li incollo sotto in
JSON). Nessuna pagina, nessuna funzione per ora. Non aggiungere campi e non rinominarli.

1. Article — un articolo letto dal feed di una testata. "aid" è il nostro identificativo (12
   caratteri, ricavato dal link); "ts" e "letto" sono secondi dal 1970.
2. StoryTitle — il titolo italiano scritto per una storia (cache delle traduzioni).
3. EditionSnapshot — la prima pagina di un'edizione chiusa, salvata com'era.
4. FeedStatus — lo stato di ogni feed (ultimo successo, ultimo errore).

Permessi: tutte e quattro le entità si leggono e si scrivono SOLO dalle funzioni di backend (service
role). I visitatori non hanno bisogno di accedere: le pagine ricevono i dati dalla funzione
"giornale" che creeremo nel prossimo passo. L'app è pubblica: niente login per leggere.
```

Poi incolla, uno dopo l'altro, i quattro file:
- `codice/entita/Article.json`
- `codice/entita/StoryTitle.json`
- `codice/entita/EditionSnapshot.json`
- `codice/entita/FeedStatus.json`

## Verifica

- In Data ci sono le 4 entità, con i campi e i tipi dei file JSON.
- L'app è pubblica (le pagine si aprono senza login).
