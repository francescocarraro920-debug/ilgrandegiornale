# 11 · Controlli e pubblicazione

## Prompt

```
Fai un controllo completo dell'app senza cambiare l'aspetto, e dimmi cosa hai trovato prima di
correggere:
1. Ogni pagina (Home, Sezione per ogni k, Internazionale, Storia, Paese, Edicola, LaMiaEdicola,
   Cerca, Info per ogni p) si apre senza errori nella console, nei tre stili e nei due temi.
2. A 375 px di larghezza nessuna pagina scorre di lato.
3. Tutti i link agli articoli esterni aprono la scheda d'invito; i link interni cambiano pagina.
4. Le chiavi API non compaiono MAI nel codice delle pagine né nelle risposte delle funzioni.
5. Le funzioni "giornale" e "analisi" rispondono anche a un visitatore non registrato.
6. L'automazione ogni 5 minuti gira senza errori da almeno un'ora; quella dell'Analisi ogni minuto.
7. Con "riduci movimento" attivo: niente rotazione del globo, niente copertina che scorre, niente
   cerchio animato, numeri dell'Analisi già al loro valore.
8. Tastiera: Tab arriva a tutti i comandi, il fuoco si vede, Esc chiude la scheda d'invito.
```

## Note legali (da fare tu, prima di pubblicare)

- Compila le parti «DA COMPILARE» in `Info` (chi siamo, contatti, privacy, cookie): non sono testi
  legali pronti.
- Titoli ed estratti appartengono alle testate: il sito mostra solo titolo e una riga, e rimanda
  sempre all'originale. Le foto si caricano dai siti delle testate, senza copiarle, con il credito.
- I caratteri arrivano da jsDelivr e le foto dai siti delle testate: l'indirizzo IP dei visitatori
  arriva a loro. Va scritto nella privacy (c'è già una nota tecnica).
- L'Analisi è automatica: la pagina lo dice, e non dà giudizi sulle testate.

## Pubblicazione

- Pubblica l'app dall'editor di Base44 e prova l'indirizzo pubblico da un telefono.
- Controlla i costi: traduzioni e Analisi usano la chiave Anthropic; il tetto giornaliero
  dell'Analisi è `ANALYSIS_DAILY_CAP` (predefinito 3 $).
