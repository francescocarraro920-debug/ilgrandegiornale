# 05 · La prima pagina

## Prompt

```
Crea la pagina Home e il componente components/Copertina.jsx con ESATTAMENTE il codice che ti
incollo. Per ora crea anche components/FasciaGlobo.jsx con questo contenuto provvisorio (il globo
vero arriva nel prompt 06):

export function globeData() { return []; }
export default function FasciaGlobo() { return null; }

La prima pagina, dall'alto:
1. BARRA DELLE EDIZIONI: Notte 00–06, Mattina 06–12, Pomeriggio 12–18, Sera 18–24 (quelle non
   ancora uscite oggi sono spente) e i giorni (Oggi, Ieri, …). L'indirizzo tiene la scelta:
   ?giorno=2026-10-27&ed=sera.
2. Solo nel Magazine: la riga del numero "N. 300 · Sera · Il mondo raccontato da 49 testate ·
   martedì 27 ottobre 2026".
3. Lo stato: "Edizione della sera · in aggiornamento · ultimo controllo alle 21:05 · 412 notizie
   da 46 testate" (o "chiusa alle 18:00").
4. I filtri per argomento (Tutte, Italia, Internazionale, …) con il numero di notizie.
5. Il GLOBO: nel Pop subito qui, negli altri stili dopo la striscia dell'Ultim'ora.
6. Solo nello Svizzero: la COPERTINA A SCORRIMENTO con le foto delle 6 storie più seguite, che
   cambia ogni 7 secondi (si ferma col mouse sopra, col fuoco, con "Pausa", a scheda nascosta; si
   trascina col dito).
7. ULTIM'ORA IN SCORRIMENTO: una striscia con 14 titoli che scorre da sola.
8. L'APERTURA, la storia raccontata da più testate: nel Magazine la FOTO GRANDE con sopra
   etichetta, titolo e sintesi; negli altri stili titolo, foto e sintesi uno sotto l'altro. Poi "Ne
   parlano …", la linea del tempo della copertura, "Come lo raccontano" (4 titoli di paesi diversi,
   con l'originale sotto) e "Tutte le N testate →".
9. IN EVIDENZA: altre 6 storie in schede con foto.
10. Solo nel Magazine: LE CIFRE DEL GIORNO, fino a 4 numeri grandi presi dai titoli.
11. ULTIM'ORA: tutte le notizie dell'edizione, dalla più recente.
12. A destra (sotto, sul telefono): LE PRIME PAGINE, l'apertura di ogni testata, con "Edicola →".
Stati vuoti: edizione non ancora uscita, edizione senza notizie, primo giro dei feed in corso.
```

Poi incolla: `codice/componenti/Copertina.jsx`, `codice/pagine/Home.jsx`.

## Verifica

- Nel Magazine la prima notizia apre con la foto grande e il titolo bianco sopra.
- Nello Svizzero c'è la copertina che scorre; nel Pop e nel Magazine no.
- Toccando "Mattina" l'indirizzo cambia e la pagina mostra quell'edizione.
- Toccando un titolo singolo per ora non succede niente: la scheda d'invito alla lettura arriva
  nel prompt 09 (con Ctrl/⌘ + clic il sito della testata si apre già).
- A 375 px di larghezza non c'è scorrimento orizzontale.
