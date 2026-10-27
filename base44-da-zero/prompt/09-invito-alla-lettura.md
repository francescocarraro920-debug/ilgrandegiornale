# 09 · Invito alla lettura

Quando un lettore apre una notizia di un giornale non va subito sul sito della testata: si apre una
scheda che presenta l'articolo e lo invita a leggerlo lì, con un grande pulsante
«Leggi l'articolo su Le Monde ↗».

## Prompt

```
Sostituisci components/SchedaLettura.jsx (era provvisorio) con ESATTAMENTE il codice che ti
incollo. Non serve cambiare altro: tutti i link agli articoli esterni usano già LinkArticolo
(components/Pezzi.jsx), che al clic normale apre questa scheda tramite useGiornale().apriArticolo;
con Ctrl/⌘ o il tasto centrale aprono il sito come sempre. Il Layout mostra la scheda.

La scheda, dall'alto: × per chiudere; il NOME DELLA TESTATA grande nel colore d'accento, con la
lingua se è straniera e "Diretta" se è una diretta; "FR · Francia · Internazionale · pubblicato
alle 12:40"; la FOTO in 16:9 se c'è; il TITOLO grande e sotto l'originale; le PRIME RIGHE (chieste
alla funzione con { azione: "article", id }: intanto due righe grigie che pulsano); il PULSANTE
"Leggi l'articolo su <testata> ↗" con sotto l'indirizzo del sito (es. lemonde.fr), che apre il
sito in una nuova scheda e chiude questa; la nota "L'articolo completo è sul sito di <testata>…
leggerlo lì sostiene il lavoro di chi l'ha scritto"; "Come lo raccontano le altre testate →" se
l'articolo fa parte di una storia e non sei già nella sua pagina.

È un <dialog> modale: Esc, × o un tocco fuori la chiudono; cambiando pagina si chiude; il fuoco va
sul pulsante e alla chiusura torna al link. Le animazioni (fondo che si scurisce, scheda che sale
al centro su computer o dal basso su telefono) sono già in index.css (classi .read, .has-read).
```

Poi incolla: `codice/componenti/SchedaLettura.jsx`.

## Verifica

- In Ultim'ora tocca un titolo di Le Monde: si apre la scheda, il sito NON si apre.
- Il pulsante apre lemonde.fr in una nuova scheda e la scheda si chiude.
- Ctrl/⌘ + clic sul titolo apre direttamente il sito.
- Sul telefono la scheda sale dal basso e il pulsante è largo quanto lo schermo; se lo schermo è
  basso la scheda scorre e niente si schiaccia.
- Nei tre stili: Svizzero angoli vivi e filetto rosso; Magazine pulsante nero con freccia arancione;
  Pop bordo nero spesso e pulsante giallo.
