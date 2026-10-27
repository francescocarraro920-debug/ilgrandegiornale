# 08 · Edicola e La mia edicola

## Prompt

```
Crea le due pagine con ESATTAMENTE il codice che ti incollo.

1. pages/Edicola.jsx: in testa "Le testate del mondo, ogni giorno", EDICOLA in grande, tre numeri
   grandi (giornali, paesi e aree, notizie oggi) e l'INDICE DEI PAESI a pillole: toccandone una la
   pagina scorre dolcemente a quel gruppo. Poi un gruppo per paese, con il codice (IT, FR, …) in
   un'etichetta, il nome del paese grande e "N testate · N notizie oggi"; per ogni testata una
   scheda con il nome (link al sito), le sezioni di oggi a pillole, l'ultima notizia e il pulsante
   "☆ Aggiungi alla mia edicola" / "★ Nella mia edicola". In fondo la nota sulle testate con il
   feed in verifica (nascoste finché non tornano ad aggiornarsi).
2. pages/LaMiaEdicola.jsx (?modifica=1 apre il pannello): una pagina personale, senza account:
   le scelte restano in questo browser. Il pannello "Personalizza" ha Macrotemi (le sezioni), I tuoi
   temi (fino a 10 parole: un nome, un paese; con i suggerimenti "Di cui si parla oggi") e Testate
   preferite raggruppate per paese. Sotto, un blocco per ogni scelta con le notizie di oggi, e
   "Dalle tue testate" con l'ultima notizia di ciascuna. Le testate preferite sono segnate con ★ in
   tutto il sito. "Azzera tutto" svuota le scelte.
```

Poi incolla: `codice/pagine/Edicola.jsx`, `codice/pagine/LaMiaEdicola.jsx`.

## Verifica

- In Edicola, toccando "FR Francia" la pagina scorre al gruppo della Francia.
- "☆ Aggiungi" su Le Monde: la scheda si colora, e in Ultim'ora i titoli di Le Monde hanno la ★.
- In La mia edicola, aggiungendo il tema "Serbia" compare il blocco con le notizie sulla Serbia.
- Ricaricando la pagina le scelte restano.
- L'indice dei paesi non fa scorrere la pagina di lato sul telefono.
