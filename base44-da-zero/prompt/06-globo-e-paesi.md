# 06 · Il globo e le pagine dei paesi

## Prompt

```
Aggiungi i pacchetti npm d3-geo, topojson-client e world-atlas. Poi crea, con ESATTAMENTE il
codice che ti incollo:
- components/Globo.jsx: il globo su canvas (proiezione ortografica). Si trascina col dito o col
  mouse, si avvicina con due dita, con Ctrl+rotella o coi pulsanti + e −, gira da solo piano
  finché non lo tocchi. I paesi con notizie sono colorati (più testate = colore più acceso, da 5
  testate in su "caldo"), con i nomi che non si sovrappongono. Toccando un paese: onScegli(id).
- components/FasciaGlobo.jsx (sostituisce quello provvisorio): titolo "Dove si parla di cosa.",
  istruzioni e legenda; passando sopra un paese, al posto del titolo compaiono i suoi NUMERI
  (testate, notizie, storie, lingue, paesi che scrivono, barre per sezione, la storia più
  seguita); sotto il globo la fila dei paesi da toccare.
  Toccando un paese: il globo VOLA sul paese e si avvicina, poi un CERCHIO di colore si allarga dal
  centro del globo con il nome del paese (nello Svizzero è una tendina rossa che scende), si apre la
  pagina del paese e il cerchio svanisce. Con "riduci movimento" si va subito alla pagina.
- pages/Paese.jsx (?nome=cina): "← Il mondo", titolo GRANDISSIMO col nome del paese, una riga con
  quante testate ne parlano; "In primo piano": le notizie principali in GRANDE A SCORRIMENTO
  LATERALE (scatto con scroll-snap, frecce ← → e contatore 1 / 8); poi "Le notizie" raccontate da
  più testate in elenco con titoli grandi; poi "Tutte le notizie" delle ultime 36 ore.
I colori del globo nei tre stili vengono dalle variabili --g-* e --gb-* già in index.css.
```

Poi incolla: `codice/componenti/Globo.jsx`, `codice/componenti/FasciaGlobo.jsx`,
`codice/pagine/Paese.jsx`.

## Verifica

- Il globo gira, si trascina, si avvicina; sul telefono si trascina col dito senza far scorrere
  la pagina.
- Passando sopra la Cina compaiono i suoi numeri a sinistra del globo.
- Toccando un paese: volo, cerchio col nome, pagina del paese. Nello Svizzero la tendina rossa.
- Nella pagina del paese le notizie grandi scorrono di lato e il contatore segue.
- Nel Magazine il globo ha la cornice rotonda sottile; nel Pop apre la prima pagina.
