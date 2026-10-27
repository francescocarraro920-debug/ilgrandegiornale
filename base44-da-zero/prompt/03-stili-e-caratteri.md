# 03 · Stili e caratteri

Il sito ha **tre stili** (attributo `data-style` su `<html>`) e **due temi** (attributo `data-theme`):

| Stile | Attributo | Com'è |
|---|---|---|
| Magazine (predefinito) | `data-style="magazine"` | Nero e arancione, Newsreader e Inter, prima notizia con foto grande e titolo sopra, globo in una cornice rotonda |
| Pop | `data-style="pop"` | Rosso, giallo e blu, Bodoni Moda corsivo e Jost, bordi neri spessi, ombre nette, il globo apre la pagina |
| Svizzero | nessun attributo | Glacial Indifference, griglia, rosso, copertina a foto che scorre |

Temi: «Carta» (`light`) e «Notte» (`dark`); senza scelta segue il sistema.

## Prompt

```
Metti in index.css ESATTAMENTE i quattro fogli di stile che ti incollo, in quest'ordine:
app.css, magazine.css, pop.css, base44.css. Non convertirli in Tailwind, non cambiare i nomi
delle classi e non togliere regole: le pagine che creeremo usano proprio queste classi. I
caratteri si caricano da cdn.jsdelivr.net con le @font-face già dentro i file.

Nell'<head> dell'app (index.html), prima di tutto il resto, aggiungi:
- <html lang="it" data-style="magazine">
- <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
- <meta name="theme-color" content="#FFFFFF" media="(prefers-color-scheme: light)">
- <meta name="theme-color" content="#000000" media="(prefers-color-scheme: dark)">
- <link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin>
- questo script, che applica stile e tema prima del primo disegno (niente lampo bianco):

<script>
  try { var t = localStorage.getItem("igg-theme"); if (t === "light" || t === "dark") document.documentElement.setAttribute("data-theme", t); } catch (e) {}
  try {
    var q = new URLSearchParams(location.search).get("stile");
    var ok = q === "magazine" || q === "svizzero" || q === "pop";
    var s = ok ? q : localStorage.getItem("igg-style");
    if (ok) localStorage.setItem("igg-style", q);
    if (s === "svizzero") document.documentElement.removeAttribute("data-style");
    if (s === "pop") document.documentElement.setAttribute("data-style", "pop");
  } catch (e) {}
</script>

Titolo della pagina: "Il Grande Giornale". Descrizione: "Un'unica prima pagina per leggere il
mondo come lo raccontano le testate più autorevoli, dalla notte alla sera."
Se Base44 non permette di modificare index.html, dimmelo: lo stesso lavoro lo fa già il Layout
(prompt 04), con un attimo di ritardo.
```

Poi incolla, nell'ordine: `codice/stili/app.css`, `codice/stili/magazine.css`,
`codice/stili/pop.css`, `codice/stili/base44.css`.

## Verifica

- `index.css` contiene i quattro file per intero (circa 130 KB in tutto).
- Aprendo l'app con `?stile=pop` lo sfondo cambia; con `?stile=svizzero` torna bianco e rosso.
