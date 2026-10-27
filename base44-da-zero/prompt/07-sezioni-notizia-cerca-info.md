# 07 · Sezioni, Internazionale, notizia, Cerca, Info

## Prompt

```
Crea queste pagine con ESATTAMENTE il codice che ti incollo. Per ora crea anche
components/AnalisiRacconto.jsx provvisorio:
export default function AnalisiRacconto() { return null; }
(quello vero arriva nel prompt 10).

1. pages/Sezione.jsx (?k=italia|economia|sport|cultura|scienza): titolo della sezione, "Le
   notizie" raccontate da più testate in schede, poi "In diretta" (con il puntino rosso che pulsa):
   tutte le altre notizie di oggi, dalla più recente.
2. pages/Internazionale.jsx: la sezione "esteri" con la sua testata: INTERNAZIONALE in grande e,
   sotto, la firma "Il Grande Giornale"; in più due file di filtri: Fonte (paese della testata) e
   Dove (paese della notizia). Il menu "Internazionale" porta qui.
3. pages/Storia.jsx (?id=…&scheda=analisi): sezione, luogo, numero di testate; titolo grande,
   sintesi, linea del tempo grande, "La prima a raccontarla è stata …"; due schede: "Come lo
   raccontano" (una voce per articolo: testata, paese, ora, titolo e originale, foto, prime righe,
   "Leggi su … ↗") e "Analisi"; in fondo "Altre notizie" dello stesso argomento. La scheda Analisi
   chiama la funzione "analisi" (prompt 10): finché non esiste mostra "L'analisi non è riuscita".
4. pages/Cerca.jsx (?q=…): campo di ricerca, suggerimenti dalle storie più seguite, risultati
   mentre si scrive (storie in schede, poi le singole notizie).
5. pages/Info.jsx (?p=come-funziona|chi-siamo|contatti|privacy|cookie): le pagine di testo. Le
   parti "DA COMPILARE" restano evidenziate: le scrivo io.
```

Poi incolla: `codice/pagine/Sezione.jsx`, `codice/pagine/Internazionale.jsx`,
`codice/pagine/Storia.jsx`, `codice/pagine/Cerca.jsx`, `codice/pagine/Info.jsx`.

## Verifica

- Menu → Internazionale: titolo enorme "INTERNAZIONALE" con sotto "Il Grande Giornale"; i filtri
  Fonte e Dove riducono l'elenco.
- In ogni sezione le intestazioni sono "Le notizie" e "In diretta" (non "Le storie" né "Altre").
- Una notizia raccontata da più testate si apre nella sua pagina; "← Prima pagina" torna indietro.
- Cerca "Serbia": compaiono storie e notizie; l'indirizzo diventa `?q=Serbia`.
