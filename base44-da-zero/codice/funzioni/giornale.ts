/* ======================================================================
   Il Grande Giornale · funzione del server "giornale" (Base44, Deno)

   Fa due lavori:
   1. AGGIORNAMENTO (chiamata senza "azione", da un'automazione ogni 5 minuti): legge i 119 feed
      delle 49 testate, salva gli articoli nuovi, traduce i titoli stranieri se c'è la chiave,
      salva le edizioni appena chiuse e cancella ciò che ha più di 3 giorni.
   2. VISTE (chiamata dalla pagina con { azione: "meta" | "front" | "day" | "story" | "search" |
      "article" }): restituisce gli stessi dati del sito di riferimento, con le stesse chiavi brevi
      (id, t, ts, s, st, k, w, it, o, x, u, l, img…), così le pagine e gli stili sono identici.

   Le storie non si salvano: si ricalcolano dagli articoli delle ultime 72 ore (pochi millisecondi),
   e il risultato resta in memoria per un minuto.
   ====================================================================== */

import { createClientFromRequest } from "npm:@base44/sdk";

/* Dati del Grande Giornale, generati dal progetto Python (sources.py, ingest.py, stories.py).
   Testate e feed, paesi, luoghi riconosciuti nei titoli, regole per sezione e tipo, parole vuote. */

const TOPICS = [
 [
  "italia",
  "Italia"
 ],
 [
  "esteri",
  "Internazionale"
 ],
 [
  "economia",
  "Economia"
 ],
 [
  "sport",
  "Sport"
 ],
 [
  "cultura",
  "Cultura"
 ],
 [
  "scienza",
  "Scienza e tecnologia"
 ]
];

const COUNTRIES = {
 "IT": "Italia",
 "GB": "Regno Unito",
 "US": "Stati Uniti",
 "FR": "Francia",
 "ES": "Spagna",
 "DE": "Germania",
 "EU": "Europa",
 "QA": "Qatar",
 "CH": "Svizzera",
 "IL": "Israele",
 "IN": "India",
 "HK": "Hong Kong",
 "JP": "Giappone",
 "AU": "Australia",
 "CA": "Canada",
 "BR": "Brasile",
 "AR": "Argentina"
};

const GROUPS = [
 "IT",
 "GB",
 "US",
 "FR",
 "ES",
 "DE",
 "CH",
 "EU",
 "QA",
 "IL",
 "IN",
 "HK",
 "JP",
 "AU",
 "CA",
 "BR",
 "AR"
];

const FRONT_ORDER = [
 "guardian",
 "bbc",
 "nyt",
 "ft",
 "lemonde",
 "lefigaro",
 "elpais",
 "spiegel",
 "aljazeera",
 "euronews",
 "politico",
 "france24",
 "corriere",
 "repubblica",
 "lastampa",
 "ansa",
 "sole",
 "wsj",
 "economist",
 "faz",
 "sz",
 "nzz",
 "scmp",
 "japantimes",
 "toi",
 "haaretz"
];

const SOURCES = {
 "guardian": {
  "n": "The Guardian",
  "cc": "GB",
  "l": "en",
  "u": "https://www.theguardian.com",
  "feeds": [
   {
    "url": "https://www.theguardian.com/world/rss",
    "topic": "esteri"
   },
   {
    "url": "https://www.theguardian.com/uk/business/rss",
    "topic": "economia"
   },
   {
    "url": "https://www.theguardian.com/uk/sport/rss",
    "topic": "sport"
   },
   {
    "url": "https://www.theguardian.com/uk/culture/rss",
    "topic": "cultura"
   },
   {
    "url": "https://www.theguardian.com/science/rss",
    "topic": "scienza"
   }
  ]
 },
 "bbc": {
  "n": "BBC News",
  "cc": "GB",
  "l": "en",
  "u": "https://www.bbc.com/news",
  "feeds": [
   {
    "url": "https://feeds.bbci.co.uk/news/world/rss.xml",
    "topic": "esteri"
   },
   {
    "url": "https://feeds.bbci.co.uk/news/business/rss.xml",
    "topic": "economia"
   },
   {
    "url": "https://feeds.bbci.co.uk/sport/rss.xml",
    "topic": "sport"
   },
   {
    "url": "https://feeds.bbci.co.uk/news/entertainment_and_arts/rss.xml",
    "topic": "cultura"
   },
   {
    "url": "https://feeds.bbci.co.uk/news/science_and_environment/rss.xml",
    "topic": "scienza"
   }
  ]
 },
 "nyt": {
  "n": "The New York Times",
  "cc": "US",
  "l": "en",
  "u": "https://www.nytimes.com",
  "feeds": [
   {
    "url": "https://rss.nytimes.com/services/xml/rss/nyt/World.xml",
    "topic": "esteri"
   },
   {
    "url": "https://rss.nytimes.com/services/xml/rss/nyt/Business.xml",
    "topic": "economia"
   },
   {
    "url": "https://rss.nytimes.com/services/xml/rss/nyt/Arts.xml",
    "topic": "cultura"
   },
   {
    "url": "https://rss.nytimes.com/services/xml/rss/nyt/Science.xml",
    "topic": "scienza"
   }
  ]
 },
 "ft": {
  "n": "Financial Times",
  "cc": "GB",
  "l": "en",
  "u": "https://www.ft.com",
  "feeds": [
   {
    "url": "https://www.ft.com/world?format=rss",
    "topic": "esteri"
   },
   {
    "url": "https://www.ft.com/companies?format=rss",
    "topic": "economia"
   }
  ]
 },
 "lemonde": {
  "n": "Le Monde",
  "cc": "FR",
  "l": "fr",
  "u": "https://www.lemonde.fr",
  "feeds": [
   {
    "url": "https://www.lemonde.fr/international/rss_full.xml",
    "topic": "esteri"
   },
   {
    "url": "https://www.lemonde.fr/economie/rss_full.xml",
    "topic": "economia"
   },
   {
    "url": "https://www.lemonde.fr/sport/rss_full.xml",
    "topic": "sport"
   },
   {
    "url": "https://www.lemonde.fr/culture/rss_full.xml",
    "topic": "cultura"
   },
   {
    "url": "https://www.lemonde.fr/sciences/rss_full.xml",
    "topic": "scienza"
   }
  ]
 },
 "lefigaro": {
  "n": "Le Figaro",
  "cc": "FR",
  "l": "fr",
  "u": "https://www.lefigaro.fr",
  "feeds": [
   {
    "url": "https://www.lefigaro.fr/rss/figaro_international.xml",
    "topic": "esteri"
   },
   {
    "url": "https://www.lefigaro.fr/rss/figaro_economie.xml",
    "topic": "economia"
   },
   {
    "url": "https://www.lefigaro.fr/rss/figaro_sport.xml",
    "topic": "sport"
   },
   {
    "url": "https://www.lefigaro.fr/rss/figaro_culture.xml",
    "topic": "cultura"
   },
   {
    "url": "https://www.lefigaro.fr/rss/figaro_sciences.xml",
    "topic": "scienza"
   }
  ]
 },
 "elpais": {
  "n": "El País",
  "cc": "ES",
  "l": "es",
  "u": "https://elpais.com",
  "feeds": [
   {
    "url": "https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/internacional/portada",
    "topic": "esteri"
   },
   {
    "url": "https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/economia/portada",
    "topic": "economia"
   },
   {
    "url": "https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/deportes/portada",
    "topic": "sport"
   },
   {
    "url": "https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/cultura/portada",
    "topic": "cultura"
   },
   {
    "url": "https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/ciencia/portada",
    "topic": "scienza"
   }
  ]
 },
 "spiegel": {
  "n": "Der Spiegel",
  "cc": "DE",
  "l": "de",
  "u": "https://www.spiegel.de",
  "feeds": [
   {
    "url": "https://www.spiegel.de/ausland/index.rss",
    "topic": "esteri"
   },
   {
    "url": "https://www.spiegel.de/wirtschaft/index.rss",
    "topic": "economia"
   },
   {
    "url": "https://www.spiegel.de/sport/index.rss",
    "topic": "sport"
   },
   {
    "url": "https://www.spiegel.de/kultur/index.rss",
    "topic": "cultura"
   },
   {
    "url": "https://www.spiegel.de/wissenschaft/index.rss",
    "topic": "scienza"
   }
  ]
 },
 "dw": {
  "n": "Deutsche Welle",
  "cc": "DE",
  "l": "en",
  "u": "https://www.dw.com",
  "feeds": [
   {
    "url": "https://rss.dw.com/xml/rss-en-world",
    "topic": "esteri"
   },
   {
    "url": "https://rss.dw.com/xml/rss-en-bus",
    "topic": "economia"
   },
   {
    "url": "https://rss.dw.com/xml/rss-en-cul",
    "topic": "cultura"
   }
  ]
 },
 "aljazeera": {
  "n": "Al Jazeera",
  "cc": "QA",
  "l": "en",
  "u": "https://www.aljazeera.com",
  "feeds": [
   {
    "url": "https://www.aljazeera.com/xml/rss/all.xml",
    "topic": null
   }
  ]
 },
 "euronews": {
  "n": "Euronews",
  "cc": "EU",
  "l": "en",
  "u": "https://www.euronews.com",
  "feeds": [
   {
    "url": "https://www.euronews.com/rss",
    "topic": null
   }
  ]
 },
 "politico": {
  "n": "POLITICO Europe",
  "cc": "EU",
  "l": "en",
  "u": "https://www.politico.eu",
  "feeds": [
   {
    "url": "https://www.politico.eu/feed/",
    "topic": "esteri"
   }
  ]
 },
 "france24": {
  "n": "France 24",
  "cc": "FR",
  "l": "en",
  "u": "https://www.france24.com",
  "feeds": [
   {
    "url": "https://www.france24.com/en/rss",
    "topic": null
   },
   {
    "url": "https://www.france24.com/en/business-tech/rss",
    "topic": "economia"
   },
   {
    "url": "https://www.france24.com/en/sport/rss",
    "topic": "sport"
   },
   {
    "url": "https://www.france24.com/en/culture/rss",
    "topic": "cultura"
   }
  ]
 },
 "ansa": {
  "n": "ANSA",
  "cc": "IT",
  "l": "it",
  "u": "https://www.ansa.it",
  "feeds": [
   {
    "url": "https://www.ansa.it/sito/notizie/topnews/topnews_rss.xml",
    "topic": null
   },
   {
    "url": "https://www.ansa.it/sito/notizie/politica/politica_rss.xml",
    "topic": "italia"
   },
   {
    "url": "https://www.ansa.it/sito/notizie/cronaca/cronaca_rss.xml",
    "topic": "italia"
   },
   {
    "url": "https://www.ansa.it/sito/notizie/mondo/mondo_rss.xml",
    "topic": "esteri"
   },
   {
    "url": "https://www.ansa.it/sito/notizie/economia/economia_rss.xml",
    "topic": "economia"
   },
   {
    "url": "https://www.ansa.it/sito/notizie/sport/sport_rss.xml",
    "topic": "sport"
   },
   {
    "url": "https://www.ansa.it/sito/notizie/cultura/cultura_rss.xml",
    "topic": "cultura"
   },
   {
    "url": "https://www.ansa.it/sito/notizie/tecnologia/tecnologia_rss.xml",
    "topic": "scienza"
   }
  ]
 },
 "agi": {
  "n": "AGI",
  "cc": "IT",
  "l": "it",
  "u": "https://www.agi.it",
  "feeds": [
   {
    "url": "https://www.agi.it/politica/rss",
    "topic": "italia"
   },
   {
    "url": "https://www.agi.it/cronaca/rss",
    "topic": "italia"
   },
   {
    "url": "https://www.agi.it/estero/rss",
    "topic": "esteri"
   },
   {
    "url": "https://www.agi.it/economia/rss",
    "topic": "economia"
   },
   {
    "url": "https://www.agi.it/sport/rss",
    "topic": "sport"
   },
   {
    "url": "https://www.agi.it/cultura/rss",
    "topic": "cultura"
   },
   {
    "url": "https://www.agi.it/innovazione/rss",
    "topic": "scienza"
   }
  ]
 },
 "corriere": {
  "n": "Corriere della Sera",
  "cc": "IT",
  "l": "it",
  "u": "https://www.corriere.it",
  "feeds": [
   {
    "url": "https://xml2.corriereobjects.it/rss/homepage.xml",
    "topic": null
   },
   {
    "url": "https://xml2.corriereobjects.it/rss/politica.xml",
    "topic": "italia"
   },
   {
    "url": "https://xml2.corriereobjects.it/rss/cronache.xml",
    "topic": "italia"
   },
   {
    "url": "https://xml2.corriereobjects.it/rss/esteri.xml",
    "topic": "esteri"
   },
   {
    "url": "https://xml2.corriereobjects.it/rss/economia.xml",
    "topic": "economia"
   },
   {
    "url": "https://xml2.corriereobjects.it/rss/sport.xml",
    "topic": "sport"
   },
   {
    "url": "https://xml2.corriereobjects.it/rss/cultura.xml",
    "topic": "cultura"
   },
   {
    "url": "https://xml2.corriereobjects.it/rss/scienze.xml",
    "topic": "scienza"
   }
  ]
 },
 "repubblica": {
  "n": "la Repubblica",
  "cc": "IT",
  "l": "it",
  "u": "https://www.repubblica.it",
  "feeds": [
   {
    "url": "https://www.repubblica.it/rss/homepage/rss2.0.xml",
    "topic": null
   },
   {
    "url": "https://www.repubblica.it/rss/politica/rss2.0.xml",
    "topic": "italia"
   },
   {
    "url": "https://www.repubblica.it/rss/cronaca/rss2.0.xml",
    "topic": "italia"
   },
   {
    "url": "https://www.repubblica.it/rss/esteri/rss2.0.xml",
    "topic": "esteri"
   },
   {
    "url": "https://www.repubblica.it/rss/economia/rss2.0.xml",
    "topic": "economia"
   },
   {
    "url": "https://www.repubblica.it/rss/spettacoli_e_cultura/rss2.0.xml",
    "topic": "cultura"
   },
   {
    "url": "https://www.repubblica.it/rss/tecnologia/rss2.0.xml",
    "topic": "scienza"
   }
  ]
 },
 "lastampa": {
  "n": "La Stampa",
  "cc": "IT",
  "l": "it",
  "u": "https://www.lastampa.it",
  "feeds": [
   {
    "url": "https://www.lastampa.it/rss/copertina.xml",
    "topic": null
   },
   {
    "url": "https://www.lastampa.it/esteri/rss",
    "topic": "esteri"
   },
   {
    "url": "https://www.lastampa.it/politica/rss",
    "topic": "italia"
   }
  ]
 },
 "messaggero": {
  "n": "Il Messaggero",
  "cc": "IT",
  "l": "it",
  "u": "https://www.ilmessaggero.it",
  "feeds": [
   {
    "url": "https://www.ilmessaggero.it/rss/home.xml",
    "topic": null
   },
   {
    "url": "https://www.ilmessaggero.it/rss/italia.xml",
    "topic": "italia"
   },
   {
    "url": "https://www.ilmessaggero.it/rss/mondo.xml",
    "topic": "esteri"
   },
   {
    "url": "https://www.ilmessaggero.it/rss/economia.xml",
    "topic": "economia"
   },
   {
    "url": "https://www.ilmessaggero.it/rss/sport.xml",
    "topic": "sport"
   }
  ]
 },
 "mattino": {
  "n": "Il Mattino",
  "cc": "IT",
  "l": "it",
  "u": "https://www.ilmattino.it",
  "feeds": [
   {
    "url": "https://www.ilmattino.it/rss/home.xml",
    "topic": null
   }
  ]
 },
 "giorno": {
  "n": "Il Giorno",
  "cc": "IT",
  "l": "it",
  "u": "https://www.ilgiorno.it",
  "feeds": [
   {
    "url": "https://www.ilgiorno.it/rss",
    "topic": null
   }
  ]
 },
 "sole": {
  "n": "Il Sole 24 Ore",
  "cc": "IT",
  "l": "it",
  "u": "https://www.ilsole24ore.com",
  "feeds": [
   {
    "url": "https://www.ilsole24ore.com/rss/italia.xml",
    "topic": "italia"
   },
   {
    "url": "https://www.ilsole24ore.com/rss/mondo.xml",
    "topic": "esteri"
   },
   {
    "url": "https://www.ilsole24ore.com/rss/economia.xml",
    "topic": "economia"
   },
   {
    "url": "https://www.ilsole24ore.com/rss/finanza.xml",
    "topic": "economia"
   },
   {
    "url": "https://www.ilsole24ore.com/rss/tecnologia.xml",
    "topic": "scienza"
   },
   {
    "url": "https://www.ilsole24ore.com/rss/cultura.xml",
    "topic": "cultura"
   }
  ]
 },
 "fatto": {
  "n": "Il Fatto Quotidiano",
  "cc": "IT",
  "l": "it",
  "u": "https://www.ilfattoquotidiano.it",
  "feeds": [
   {
    "url": "https://www.ilfattoquotidiano.it/feed/",
    "topic": null
   }
  ]
 },
 "domani": {
  "n": "Domani",
  "cc": "IT",
  "l": "it",
  "u": "https://www.editorialedomani.it",
  "feeds": [
   {
    "url": "https://www.editorialedomani.it/rss",
    "topic": null
   }
  ]
 },
 "open": {
  "n": "Open",
  "cc": "IT",
  "l": "it",
  "u": "https://www.open.online",
  "feeds": [
   {
    "url": "https://www.open.online/feed/",
    "topic": null
   }
  ]
 },
 "rainews": {
  "n": "RaiNews",
  "cc": "IT",
  "l": "it",
  "u": "https://www.rainews.it",
  "feeds": [
   {
    "url": "https://www.rainews.it/rss/tutti",
    "topic": null
   }
  ]
 },
 "cds": {
  "n": "Corriere dello Sport",
  "cc": "IT",
  "l": "it",
  "u": "https://www.corrieredellosport.it",
  "feeds": [
   {
    "url": "https://www.corrieredellosport.it/rss/calcio",
    "topic": "sport"
   }
  ]
 },
 "tuttosport": {
  "n": "Tuttosport",
  "cc": "IT",
  "l": "it",
  "u": "https://www.tuttosport.com",
  "feeds": [
   {
    "url": "https://www.tuttosport.com/rss/calcio",
    "topic": "sport"
   }
  ]
 },
 "artribune": {
  "n": "Artribune",
  "cc": "IT",
  "l": "it",
  "u": "https://www.artribune.com",
  "feeds": [
   {
    "url": "https://www.artribune.com/feed/",
    "topic": "cultura"
   }
  ]
 },
 "exibart": {
  "n": "Exibart",
  "cc": "IT",
  "l": "it",
  "u": "https://www.exibart.com",
  "feeds": [
   {
    "url": "https://www.exibart.com/feed/",
    "topic": "cultura"
   }
  ]
 },
 "espn": {
  "n": "ESPN",
  "cc": "US",
  "l": "en",
  "u": "https://www.espn.com",
  "feeds": [
   {
    "url": "https://www.espn.com/espn/rss/news",
    "topic": "sport"
   }
  ]
 },
 "skysports": {
  "n": "Sky Sports",
  "cc": "GB",
  "l": "en",
  "u": "https://www.skysports.com",
  "feeds": [
   {
    "url": "https://www.skysports.com/rss/12040",
    "topic": "sport"
   }
  ]
 },
 "variety": {
  "n": "Variety",
  "cc": "US",
  "l": "en",
  "u": "https://variety.com",
  "feeds": [
   {
    "url": "https://variety.com/feed/",
    "topic": "cultura"
   }
  ]
 },
 "thr": {
  "n": "The Hollywood Reporter",
  "cc": "US",
  "l": "en",
  "u": "https://www.hollywoodreporter.com",
  "feeds": [
   {
    "url": "https://www.hollywoodreporter.com/feed/",
    "topic": "cultura"
   }
  ]
 },
 "wsj": {
  "n": "The Wall Street Journal",
  "cc": "US",
  "l": "en",
  "u": "https://www.wsj.com",
  "feeds": [
   {
    "url": "https://feeds.a.dj.com/rss/RSSWorldNews.xml",
    "topic": "esteri"
   }
  ]
 },
 "economist": {
  "n": "The Economist",
  "cc": "GB",
  "l": "en",
  "u": "https://www.economist.com",
  "feeds": [
   {
    "url": "https://www.economist.com/international/rss.xml",
    "topic": "esteri"
   }
  ]
 },
 "faz": {
  "n": "Frankfurter Allgemeine",
  "cc": "DE",
  "l": "de",
  "u": "https://www.faz.net",
  "feeds": [
   {
    "url": "https://www.faz.net/rss/aktuell/",
    "topic": null
   }
  ]
 },
 "sz": {
  "n": "Süddeutsche Zeitung",
  "cc": "DE",
  "l": "de",
  "u": "https://www.sueddeutsche.de",
  "feeds": [
   {
    "url": "https://rss.sueddeutsche.de/rss/Topthemen",
    "topic": null
   }
  ]
 },
 "nzz": {
  "n": "Neue Zürcher Zeitung",
  "cc": "CH",
  "l": "de",
  "u": "https://www.nzz.ch",
  "feeds": [
   {
    "url": "https://www.nzz.ch/international.rss",
    "topic": "esteri"
   }
  ]
 },
 "liberation": {
  "n": "Libération",
  "cc": "FR",
  "l": "fr",
  "u": "https://www.liberation.fr",
  "feeds": [
   {
    "url": "https://www.liberation.fr/arc/outboundfeeds/rss/?outputType=xml",
    "topic": null
   }
  ]
 },
 "elmundo": {
  "n": "El Mundo",
  "cc": "ES",
  "l": "es",
  "u": "https://www.elmundo.es",
  "feeds": [
   {
    "url": "https://e00-elmundo.uecdn.es/elmundo/rss/internacional.xml",
    "topic": "esteri"
   }
  ]
 },
 "haaretz": {
  "n": "Haaretz",
  "cc": "IL",
  "l": "en",
  "u": "https://www.haaretz.com",
  "feeds": [
   {
    "url": "https://www.haaretz.com/srv/haaretz-latest-headlines",
    "topic": null
   }
  ]
 },
 "toi": {
  "n": "The Times of India",
  "cc": "IN",
  "l": "en",
  "u": "https://timesofindia.indiatimes.com",
  "feeds": [
   {
    "url": "https://timesofindia.indiatimes.com/rssfeeds/296589292.cms",
    "topic": "esteri"
   }
  ]
 },
 "scmp": {
  "n": "South China Morning Post",
  "cc": "HK",
  "l": "en",
  "u": "https://www.scmp.com",
  "feeds": [
   {
    "url": "https://www.scmp.com/rss/91/feed",
    "topic": "esteri"
   }
  ]
 },
 "japantimes": {
  "n": "The Japan Times",
  "cc": "JP",
  "l": "en",
  "u": "https://www.japantimes.co.jp",
  "feeds": [
   {
    "url": "https://www.japantimes.co.jp/feed/",
    "topic": null
   }
  ]
 },
 "smh": {
  "n": "The Sydney Morning Herald",
  "cc": "AU",
  "l": "en",
  "u": "https://www.smh.com.au",
  "feeds": [
   {
    "url": "https://www.smh.com.au/rss/world.xml",
    "topic": "esteri"
   }
  ]
 },
 "globeandmail": {
  "n": "The Globe and Mail",
  "cc": "CA",
  "l": "en",
  "u": "https://www.theglobeandmail.com",
  "feeds": [
   {
    "url": "https://www.theglobeandmail.com/arc/outboundfeeds/rss/category/world/",
    "topic": "esteri"
   }
  ]
 },
 "folha": {
  "n": "Folha de S.Paulo",
  "cc": "BR",
  "l": "pt",
  "u": "https://www.folha.uol.com.br",
  "feeds": [
   {
    "url": "https://feeds.folha.uol.com.br/mundo/rss091.xml",
    "topic": "esteri"
   }
  ]
 },
 "clarin": {
  "n": "Clarín",
  "cc": "AR",
  "l": "es",
  "u": "https://www.clarin.com",
  "feeds": [
   {
    "url": "https://www.clarin.com/rss/mundo/",
    "topic": "esteri"
   }
  ]
 }
};

const PLACES = {
 "Italia": "palazzo chigi, italia, italy, italie, italien, italiano, italiana, italiani, italiane, italian, italienne, roma, rome, milano, milan, napoli, torino, palermo, firenze, bologna, venezia, genova, bari, quirinale",
 "Francia": "le pen, rassemblement national, orleans, francia, france, frankreich, francese, francesi, french, francais, francaise, parigi, paris, lione, lyon, marsiglia, marseille, macron, eliseo, elysee",
 "Germania": "monaco di baviera, germania, germany, allemagne, deutschland, alemania, tedesco, tedesca, tedeschi, german, allemand, berlino, berlin, munich, amburgo, hamburg, merz, bundestag",
 "Spagna": "spagna, spain, espagne, espana, spanien, spagnolo, spagnola, spanish, espanol, madrid, barcellona, barcelona, siviglia, sevilla, valencia, sanchez",
 "Regno Unito": "downing street, gran bretagna, regno unito, reino unido, uk, britain, royaume-uni, grossbritannien, britannico, britannica, british, londra, london, inghilterra, england, scozia, scotland, galles, wales, starmer",
 "Stati Uniti": "estados unidos, stati uniti, los angeles, casa bianca, white house, new york, usa, america, etats-unis, americano, americana, american, washington, california, texas, florida, chicago, trump, pentagono, pentagon, congress, congresso",
 "Russia": "russia, russie, rusia, russland, russo, russa, russi, russian, moscow, mosca, putin, cremlino, kremlin",
 "Ucraina": "ucraina, ukraine, ucrania, ukrainian, ucraino, ucraini, kiev, kyiv, kharkiv, odessa, zelensky",
 "Cina": "xi jinping, hong kong, cina, china, chine, chinese, cinese, cinesi, pechino, beijing, shanghai",
 "Giappone": "giappone, japan, japon, japanese, giapponese, tokyo, tokio",
 "India": "new delhi, india, inde, indien, indian, indiano, mumbai, modi",
 "Israele": "tel aviv, israele, israel, israeli, israeliano, israeliani, gerusalemme, jerusalem, netanyahu, idf, likud",
 "Palestina": "west bank, palestina, palestine, palestinian, palestinese, palestinesi, gaza, cisgiordania, cisjordanie, hamas, hebron, rafah, anp",
 "Iran": "iran, iranian, iraniano, iraniani, teheran, tehran",
 "Libano": "libano, lebanon, liban, hezbollah, beirut, beyrouth",
 "Siria": "siria, syria, syrie, damasco, damascus",
 "Iraq": "iraq, irak, baghdad, bagdad",
 "Arabia Saudita": "arabie saoudite, arabia saudita, saudi arabia, saudita, sauditi, riad, riyadh",
 "Yemen": "yemen, houthi, huthi",
 "Turchia": "turchia, turkey, turquie, turkiye, erdogan, ankara, istanbul",
 "Egitto": "il cairo, egitto, egypt, egypte, cairo",
 "Venezuela": "venezuela, venezuelan, venezuelano, caracas, maduro, machado",
 "Brasile": "rio de janeiro, sao paulo, brasile, brazil, bresil, brasil, brasilien, brasiliano, brazilian, lula, bolsonaro",
 "Argentina": "buenos aires, argentina, argentine, argentino, milei",
 "Messico": "messico, mexico, mexique, messicano, mexican",
 "Canada": "canada, canadian, canadese, ottawa, toronto, carney",
 "Colombia": "colombia, colombie, bogota",
 "Cile": "cile, chile, chili, santiago",
 "Serbia": "serbia, serbie, serbien, serbian, serbo, belgrado, belgrade, vucic",
 "Bulgaria": "bulgaria, bulgarie, bulgarien, sofia",
 "Romania": "romania, roumanie, rumania, rumanien, bucarest, bucharest",
 "Polonia": "polonia, poland, pologne, polen, varsavia, warsaw",
 "Ungheria": "ungheria, hungary, hongrie, ungarn, budapest, orban",
 "Repubblica Ceca": "repubblica ceca, czech republic, tchequie, praga, prague, prag",
 "Austria": "austria, autriche, osterreich, vienna, wien",
 "Svizzera": "svizzera, switzerland, suisse, schweiz, ginevra, geneva, berna, zurigo, zurich",
 "Belgio": "belgio, belgium, belgique, bruxelles, brussels",
 "Paesi Bassi": "paesi bassi, the hague, olanda, netherlands, pays-bas, niederlande, amsterdam, l'aia",
 "Portogallo": "portogallo, portugal, lisbona, lisbon",
 "Grecia": "grecia, greece, grece, atene, athens",
 "Irlanda": "irlanda, ireland, irlande, dublino, dublin",
 "Svezia": "svezia, sweden, suede, stoccolma, stockholm",
 "Norvegia": "norvegia, norway, norvege, oslo",
 "Danimarca": "danimarca, denmark, danemark, copenaghen, copenhagen, groenlandia, greenland",
 "Finlandia": "finlandia, finland, finlande, helsinki",
 "Moldavia": "moldavia, moldova, chisinau",
 "Georgia": "georgia, tbilisi",
 "Bielorussia": "bielorussia, belarus, minsk, lukashenko",
 "Afghanistan": "afghanistan, kabul, talebani, taliban",
 "Pakistan": "pakistan, islamabad, karachi",
 "Corea del Nord": "corea del nord, coree du nord, north korea, kim jong, pyongyang",
 "Corea del Sud": "corea del sud, coree du sud, south korea, seul, seoul",
 "Taiwan": "taiwan, taipei",
 "Filippine": "filippine, philippines, manila",
 "Indonesia": "indonesia, indonesie, giacarta, jakarta",
 "Australia": "australia, australie, sydney, melbourne, canberra",
 "Nigeria": "nigeria, lagos, abuja",
 "Sudan": "sudan, soudan, khartoum, darfur",
 "Etiopia": "addis abeba, etiopia, ethiopia",
 "Sudafrica": "afrique du sud, citta del capo, south africa, cape town, sudafrica, johannesburg",
 "Congo": "congo, rdc, kinshasa, goma",
 "Uganda": "uganda, kampala",
 "Kenya": "kenya, nairobi",
 "Libia": "libia, libya, libye, tripoli, bengasi",
 "Tunisia": "tunisia, tunisie, tunisi",
 "Algeria": "algeria, algerie, argelia, algeri",
 "Marocco": "marocco, morocco, maroc, rabat, casablanca",
 "Niger": "niger, niamey",
 "Mali": "mali, bamako",
 "Giordania": "giordania, jordan, jordanie, amman",
 "Qatar": "qatar, doha",
 "Emirati Arabi": "abu dhabi, emirati, uae, dubai",
 "Cuba": "cuba, avana, havana",
 "Haiti": "haiti",
 "Europa": "commissione europea, european commission, parlamento europeo, unione europea, european union, von der leyen, europa, europe, ue, eu, bruxelles, nato"
};

const SECTION_WORDS = {
 "sport": "sport sports deportes calcio football soccer formula-1 f1 tennis basket nba nfl mlb nhl ciclismo motogp rugby golf cricket",
 "economia": "economia economy business economie wirtschaft finanza finance markets mercados money companies borsa lavoro",
 "cultura": "cultura culture arts kultur spettacoli entertainment film movies music musica libri books cinema tv televisione mostre arte",
 "scienza": "scienza scienze science sciences wissenschaft ciencia tecnologia technology tech tecnologia pixels netzwelt innovazione salute health ambiente environment spazio",
 "italia": "politica cronaca cronache italia roma milano napoli torino",
 "esteri": "esteri mondo world international internacional ausland europe europa americas africa asia middle-east medio-oriente"
};

const TITLE_HINTS = {
 "sport": "\\b(serie a|champions|premier league|liga|bundesliga|ligue 1|gol|goal|partita|allenatore|campionato|gran premio|grand prix|playoff|nfl|nba|mlb|nhl|tennis|atp|wta|mondiali|olimpiadi|derby|juventus|inter|milan|napoli|roma|lazio|real madrid|barcellona|barcelona)\\b",
 "economia": "\\b(borsa|spread|pil|gdp|inflazione|inflation|bce|ecb|fed|tassi|rates|dazi|tariffs|azioni|shares|stocks|bilancio|manovra|miliardi|billion|ipo|fusione|merger|acquisizione|acquisition)\\b",
 "scienza": "\\b(ia|ai|intelligenza artificiale|artificial intelligence|nasa|esa|spazio|space|clima|climate|ricerca|research|studio|study|scienziati|scientists|vaccino|vaccine|virus|software|app|smartphone|cyber)\\b",
 "cultura": "\\b(film|cinema|festival|mostra|exhibition|album|libro|book|romanzo|novel|teatro|theatre|serie tv|netflix|oscar|museo|museum|concerto|concert)\\b"
};

const KIND_RULES = [
 [
  "live",
  "(/live/|/liveblog|/diretta|/maratona/|/direct/|/en-direct)",
  "(^live\\b|\\blive:|\\blive updates\\b|\\bin diretta\\b|\\bdiretta\\b|\\ben direct\\b|\\ben directo\\b|\\bliveblog\\b|\\bas it happened\\b|\\bminuto per minuto\\b)"
 ],
 [
  "opinione",
  "(/opinion|/commento|/commenti|/editorial|/idees/|/meinung|/commentisfree|/columnists?/|/analisi/)",
  "(^opinion\\b|^opinione\\b|^commento\\b|^editorial\\b|^l'editoriale\\b|^tribune\\b|^the big story\\b)"
 ],
 [
  "bollettino",
  "(/newsletter|/podcast|/notiziario|/briefing)",
  "(\\bnewsletter\\b|\\bnotiziario\\b|\\bpodcast\\b|\\bmorning briefing\\b|\\bevening briefing\\b|\\btg\\d|\\bbriefing:)"
 ],
 [
  "anteprima",
  "(/preview)",
  "(\\bpreview\\b|\\banteprima\\b|\\bprobabili formazioni\\b|\\bdove vederl[ao]\\b|\\bwhere to watch\\b)"
 ]
];

const STOP = [
 "a",
 "about",
 "after",
 "agli",
 "ai",
 "al",
 "all",
 "alla",
 "alle",
 "allo",
 "als",
 "amid",
 "an",
 "anche",
 "ancora",
 "and",
 "anni",
 "anno",
 "ante",
 "apres",
 "après",
 "are",
 "as",
 "at",
 "au",
 "auch",
 "auf",
 "aus",
 "aussi",
 "aux",
 "avant",
 "avec",
 "aveva",
 "be",
 "been",
 "before",
 "bei",
 "but",
 "by",
 "can",
 "ce",
 "ces",
 "cette",
 "che",
 "chi",
 "coi",
 "col",
 "come",
 "comme",
 "como",
 "con",
 "contre",
 "contro",
 "cosa",
 "cosi",
 "così",
 "could",
 "cui",
 "d",
 "da",
 "dagli",
 "dai",
 "dal",
 "dalla",
 "dalle",
 "dallo",
 "dans",
 "das",
 "de",
 "degli",
 "dei",
 "del",
 "della",
 "delle",
 "dello",
 "dem",
 "den",
 "der",
 "des",
 "detto",
 "di",
 "dice",
 "dicono",
 "die",
 "diretta",
 "domani",
 "dopo",
 "dove",
 "du",
 "due",
 "e",
 "ecco",
 "ed",
 "ein",
 "eine",
 "einer",
 "eines",
 "el",
 "en",
 "entre",
 "er",
 "era",
 "es",
 "essere",
 "est",
 "esta",
 "estas",
 "este",
 "estos",
 "et",
 "ete",
 "fa",
 "faire",
 "fait",
 "fare",
 "first",
 "for",
 "foto",
 "fra",
 "from",
 "fue",
 "fur",
 "für",
 "gia",
 "giorni",
 "giorno",
 "già",
 "gli",
 "ha",
 "haben",
 "had",
 "han",
 "hanno",
 "has",
 "hat",
 "have",
 "her",
 "his",
 "ho",
 "how",
 "i",
 "ieri",
 "il",
 "im",
 "in",
 "into",
 "is",
 "ist",
 "it",
 "its",
 "just",
 "l",
 "la",
 "las",
 "last",
 "le",
 "les",
 "leur",
 "leurs",
 "live",
 "lo",
 "loro",
 "los",
 "ma",
 "man",
 "mas",
 "may",
 "mentre",
 "might",
 "mit",
 "more",
 "most",
 "más",
 "nach",
 "negli",
 "nei",
 "nel",
 "nella",
 "nelle",
 "nello",
 "new",
 "news",
 "nicht",
 "no",
 "noch",
 "non",
 "nostro",
 "not",
 "now",
 "nuova",
 "nuove",
 "nuovi",
 "nuovo",
 "nur",
 "o",
 "od",
 "oder",
 "of",
 "off",
 "oggi",
 "oltre",
 "on",
 "ont",
 "or",
 "ora",
 "ore",
 "ou",
 "our",
 "out",
 "over",
 "par",
 "para",
 "parla",
 "people",
 "per",
 "perche",
 "perché",
 "piu",
 "più",
 "plus",
 "por",
 "pour",
 "prima",
 "quando",
 "que",
 "quella",
 "quelle",
 "quelli",
 "quello",
 "questa",
 "queste",
 "questi",
 "questo",
 "qui",
 "quoi",
 "sa",
 "said",
 "sans",
 "sara",
 "say",
 "says",
 "se",
 "selon",
 "sempre",
 "senza",
 "ses",
 "sich",
 "sie",
 "sin",
 "sind",
 "sobre",
 "solo",
 "son",
 "sono",
 "sont",
 "sopra",
 "sotto",
 "sous",
 "stata",
 "stato",
 "su",
 "sua",
 "sue",
 "sugli",
 "sui",
 "sul",
 "sulla",
 "sulle",
 "sullo",
 "suo",
 "suoi",
 "sur",
 "sus",
 "than",
 "that",
 "the",
 "their",
 "these",
 "this",
 "those",
 "three",
 "to",
 "today",
 "tra",
 "tras",
 "tre",
 "tutte",
 "tutti",
 "tutto",
 "two",
 "uber",
 "ultim'ora",
 "ultima",
 "ultime",
 "um",
 "un",
 "una",
 "unas",
 "und",
 "under",
 "une",
 "uno",
 "unos",
 "up",
 "verso",
 "via",
 "video",
 "von",
 "vor",
 "vs",
 "war",
 "was",
 "week",
 "were",
 "what",
 "when",
 "where",
 "who",
 "why",
 "wie",
 "will",
 "wir",
 "with",
 "woman",
 "would",
 "y",
 "year",
 "years",
 "yesterday",
 "your",
 "zu",
 "zum",
 "zur",
 "été",
 "über"
];

const EDITIONS = [
 {
  "k": "notte",
  "n": "Notte",
  "of": "della notte",
  "a": 0,
  "b": 6,
  "r": "00—06"
 },
 {
  "k": "mattina",
  "n": "Mattina",
  "of": "del mattino",
  "a": 6,
  "b": 12,
  "r": "06—12"
 },
 {
  "k": "pomeriggio",
  "n": "Pomeriggio",
  "of": "del pomeriggio",
  "a": 12,
  "b": 18,
  "r": "12—18"
 },
 {
  "k": "sera",
  "n": "Sera",
  "of": "della sera",
  "a": 18,
  "b": 24,
  "r": "18—24"
 }
];



const KEEP_HOURS = 72;            // articoli usati per le storie
const PRUNE_DAYS = 3;             // articoli conservati
const SNAPSHOT_DAYS = 14;         // edizioni chiuse conservate
const STORED_DESC = 1000;         // estratto conservato (per l'Analisi)
const SHOWN_DESC = 240;           // estratto mostrato
const UA = "Mozilla/5.0 (compatible; IlGrandeGiornale/1.0; lettore di feed)";
const LOWVAL = new Set(["live", "bollettino", "anteprima"]);
const ED: Record<string, any> = Object.fromEntries(EDITIONS.map((e: any) => [e.k, e]));

/* ---------- Testo ---------- */

const ENT: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", laquo: "«", raquo: "»",
  rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", hellip: "…", ndash: "–", mdash: "—", egrave: "è", eacute: "é", agrave: "à",
  igrave: "ì", ograve: "ò", ugrave: "ù", Egrave: "È", ccedil: "ç", euro: "€", deg: "°" };
function unescape(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === "#") { const n = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return Number.isFinite(n) ? String.fromCodePoint(n) : m; }
    return ENT[e] ?? m;
  });
}
export function clean(s: string | null | undefined, limit?: number): string {
  if (!s) return "";
  let t = s.replace(/<!\[CDATA\[|\]\]>/g, "").replace(/<[^>]+>/g, " ");
  t = unescape(unescape(t)).replace(/\s+/g, " ").trim();
  if (limit && t.length > limit) t = t.slice(0, limit).replace(/\s+\S*$/, "").replace(/[,;:.\-–— ]+$/, "") + "…";
  return t;
}
export const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/* ---------- Ora di Roma ---------- */

const ROME = "Europe/Rome";
function romeParts(ts: number) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: ROME, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(new Date(ts * 1000)).map((x) => [x.type, x.value]));
  return { y: +p.year, m: +p.month, d: +p.day, h: +p.hour, mi: +p.minute, s: +p.second };
}
/** L'istante (secondi) di "giorno alle ore h" a Roma, corretto anche nei giorni del cambio d'ora */
function romeTime(day: string, h: number): number {
  const [y, m, d] = day.split("-").map(Number);
  let guess = Date.UTC(y, m - 1, d, h) / 1000;
  for (let i = 0; i < 2; i++) {
    const p = romeParts(guess);
    const asUtc = Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi, p.s) / 1000;
    guess -= asUtc - Date.UTC(y, m - 1, d, h) / 1000;
  }
  return guess;
}
const pad = (n: number) => String(n).padStart(2, "0");
export const today = (now: number) => { const p = romeParts(now); return `${p.y}-${pad(p.m)}-${pad(p.d)}`; };
export const hhmm = (ts: number) => { const p = romeParts(ts); return `${pad(p.h)}:${pad(p.mi)}`; };
function addDays(day: string, n: number) { const [y, m, d] = day.split("-").map(Number); const t = new Date(Date.UTC(y, m - 1, d + n)); return t.toISOString().slice(0, 10); }
export const dayBounds = (day: string): [number, number] => [romeTime(day, 0), romeTime(addDays(day, 1), 0)];
export function editionBounds(day: string, ek: string): [number, number] {
  const e = ED[ek];
  return [romeTime(day, e.a), e.b === 24 ? romeTime(addDays(day, 1), 0) : romeTime(day, e.b)];
}
export function currentEdition(now: number) {
  const h = romeParts(now).h;
  return (EDITIONS.find((e: any) => e.a <= h && h < e.b) || EDITIONS[3]).k;
}
const daysList = (now: number) => [0, 1, 2].map((i) => addDays(today(now), -i));

/* ---------- Lettura dei feed ---------- */

async function fetchFeed(url: string): Promise<string> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 20000);
  try {
    const r = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/rss+xml, application/atom+xml, application/xml;q=0.9, */*;q=0.8" }, signal: ctl.signal });
    if (!r.ok) throw new Error("HTTP " + r.status);
    return await r.text();
  } finally { clearTimeout(timer); }
}

function tag(block: string, name: string): string {
  const m = block.match(new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)</${name}>`, "i"));
  if (!m) return "";
  const c = m[1].match(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/);
  return c ? c[1] : m[1];
}
const attr = (t: string, name: string) => (t.match(new RegExp(`\\b${name}=["']?([^"'\\s>]+)`, "i")) || [])[1] || null;
function imgsInTags(markup: string, tags: string, src: string): [string, number][] {
  const out: [string, number][] = [];
  for (const t of markup.match(new RegExp(`<(?:${tags})\\b[^>]*>`, "gi")) || []) {
    const u = attr(t, src);
    if (!u) continue;
    const w = (attr(t, "width") || "").match(/^\d+/);
    out.push([unescape(u), w ? +w[0] : 0]);
  }
  return out;
}
const NOT_PHOTO = /pixel|spacer|blank\.|feedburner|doubleclick|\/ads?\/|logo|avatar|1x1/i;
/** La foto più larga dichiarata dal feed, escluse icone, loghi e pixel di tracciamento */
function bestImage(c: [string, number][]): string | null {
  const ok = c.map(([u, w]) => [u.trim().startsWith("//") ? "https:" + u.trim() : u.trim(), w] as [string, number])
    .filter(([u, w]) => /^https?:\/\//.test(u) && !NOT_PHOTO.test(u) && !(w && w < 120));
  if (!ok.length) return null;
  let url = ok.reduce((a, b) => (b[1] > a[1] ? b : a))[0];
  url = url.replace(/(ichef\.bbci\.co\.uk\/[^/]+\/standard\/)240\//, (_m, p) => p + "976/");
  return url.slice(0, 1000);
}
function parseDate(s: string): number | null {
  const t = Date.parse(clean(s));
  return Number.isFinite(t) ? t / 1000 : null;
}
function canonical(url: string): string {
  try {
    const u = new URL(url);
    for (const k of [...u.searchParams.keys()]) if (/^(utm_|at_|xtor|ref|ns_)/i.test(k)) u.searchParams.delete(k);
    u.hash = "";
    u.hostname = u.hostname.toLowerCase();
    return u.toString();
  } catch { return url; }
}
async function articleId(url: string) {
  const h = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(url));
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 12);
}

/** RSS e Atom con un lettore tollerante (tanti feed hanno XML non valido) */
export function parseFeed(xml: string) {
  const out: any[] = [];
  for (const block of xml.match(/<(?:item|entry)\b[\s\S]*?<\/(?:item|entry)>/gi) || []) {
    let link = clean(tag(block, "link"));
    if (!/^https?:\/\//.test(link)) {
      const m = block.match(/<link\b[^>]*?(?:rel=["']alternate["'][^>]*?)?href=["']([^"']+)["']/i) || block.match(/<guid\b[^>]*>\s*(https?:[^<\s]+)/i);
      link = m ? unescape(m[1]) : "";
    }
    let date: number | null = null;
    for (const n of ["pubDate", "published", "dc:date", "updated"]) { date = parseDate(tag(block, n)); if (date) break; }
    const title = clean(tag(block, "title"), 300);
    if (!title || !/^https?:\/\//.test(link)) continue;
    const desc = tag(block, "description") || tag(block, "summary") || tag(block, "content");
    const imgs = imgsInTags(block, "media:content|media:thumbnail|enclosure", "url")
      .concat(imgsInTags(unescape(block), "img", "src"));
    out.push({ title, link: canonical(unescape(link)), date, desc: clean(desc, STORED_DESC), img: bestImage(imgs) });
  }
  return out;
}

/* ---------- Classificazione: sezione, luogo, tipo ---------- */

const SECTION_MAP: Record<string, string> = {};
for (const [k, v] of Object.entries(SECTION_WORDS)) for (const w of (v as string).split(" ")) if (!(w in SECTION_MAP)) SECTION_MAP[w] = k;
const TITLE_RX = Object.entries(TITLE_HINTS).map(([k, rx]) => [k, new RegExp(rx as string)] as [string, RegExp]);
const KIND_RX = KIND_RULES.map(([k, ur, tr]: string[]) => [k, new RegExp(ur), new RegExp(tr)] as [string, RegExp, RegExp]);
const esc = (w: string) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const PLACE_RX = Object.entries(PLACES).map(([n, v]) => [n, new RegExp("(?<![a-z])(" + (v as string).split(", ").sort((a, b) => b.length - a.length).map(esc).join("|") + ")(?![a-z])")] as [string, RegExp]);

/** Il primo paese citato nel titolo (poi nell'estratto). Europa vale solo se non c'è altro */
export function placeFor(...texts: (string | null)[]): string | null {
  for (const t of texts) {
    if (!t) continue;
    const nt = norm(t);
    let best: [number, string] | null = null;
    for (const [name, rx] of PLACE_RX) {
      const m = nt.match(rx);
      if (m && m.index !== undefined && (!best || m.index < best[0]) && !(name === "Europa" && best)) best = [m.index, name];
    }
    if (best) return best[1];
  }
  return null;
}
export function topicFor(hint: string | null, url: string, title: string, cc: string, place: string | null) {
  if (hint) return hint;
  let segs: string[] = [];
  try { segs = new URL(url).pathname.split("/").filter(Boolean).slice(0, 3).map(norm); } catch {}
  for (const s of segs) if (SECTION_MAP[s]) return SECTION_MAP[s] === "italia" && cc !== "IT" ? "esteri" : SECTION_MAP[s];
  const nt = norm(title);
  for (const [k, rx] of TITLE_RX) if (rx.test(nt)) return k;
  if (cc === "IT") return place === null || place === "Italia" ? "italia" : "esteri";
  return "esteri";
}
export function kindFor(url: string, title: string) {
  const u = url.toLowerCase(), t = norm(title);
  for (const [k, ur, tr] of KIND_RX) if (ur.test(u) || tr.test(t)) return k;
  return "notizia";
}
const defaultPlace = (topic: string, cc: string) => (topic === "esteri" ? "Mondo" : cc === "QA" ? "Mondo" : COUNTRIES[cc] || "Mondo");

/* ---------- Storie: raggruppamento ---------- */

const STOPS = new Set(STOP as string[]);
const stem = (w: string) => (w.length > 6 ? w.slice(0, 6) : w);
function features(title: string, orig?: string | null) {
  const toks = new Map<string, number>(), ents = new Set<string>();
  for (const text of [title, orig]) {
    if (!text) continue;
    for (const raw of text.match(/[\wÀ-ÿ'’\-]+/g) || []) {
      let w = norm(raw).replace(/^['’\-]+|['’\-]+$/g, "").replace(/^(l|d|dell|dall|nell|sull|all|un|qu)['’]/, "");
      if (w.length < 3 || STOPS.has(w) || (/^\d+$/.test(w) && w.length < 3)) continue;
      const st = stem(w);
      toks.set(st, (toks.get(st) || 0) + 1);
      const upperFirst = raw[0] !== raw[0].toLowerCase() && raw !== raw.toUpperCase();
      if (upperFirst || (raw === raw.toUpperCase() && raw.length >= 2 && raw.length <= 5 && /[A-Z]/.test(raw))) ents.add(st);
    }
  }
  return { toks, ents };
}

/** Assegna ogni articolo, in ordine di tempo, alla storia più simile già aperta (36 ore, soglia 0,30) */
export function cluster(arts: any[]): Record<string, string> {
  const sorted = [...arts].sort((a, b) => a.ts - b.ts || (a.id < b.id ? -1 : 1));
  const df = new Map<string, number>(), feat = new Map<string, any>();
  for (const a of sorted) {
    const f = features(a.it || a.o || "", a.it ? a.o : null);
    feat.set(a.id, f);
    for (const t of f.toks.keys()) df.set(t, (df.get(t) || 0) + 1);
  }
  const n = Math.max(sorted.length, 1);
  const idf = new Map([...df].map(([t, c]) => [t, Math.log((n + 1) / (c + 0.5))]));
  const common = new Set([...df].filter(([, c]) => c > Math.max(12, n * 0.04)).map(([t]) => t));
  const clusters: any[] = [], index = new Map<string, Set<number>>(), assign: Record<string, string> = {};
  for (const a of sorted) {
    const { toks, ents } = feat.get(a.id);
    const v = new Map<string, number>();
    for (const t of toks.keys()) v.set(t, (idf.get(t) || 0) * (ents.has(t) ? 2.2 : 1));
    const nv = Math.sqrt([...v.values()].reduce((p, x) => p + x * x, 0)) || 1;
    for (const [t, x] of v) v.set(t, x / nv);
    const cand = new Set<number>();
    for (const t of v.keys()) if (!common.has(t)) for (const ci of index.get(t) || []) cand.add(ci);
    let best = -1, bestS = 0;
    for (const ci of cand) {
      const c = clusters[ci];
      if (a.ts - c.last > 36 * 3600) continue;
      let s = 0;
      for (const [t, x] of v) s += x * (c.c.get(t) || 0);
      s /= c.norm || 1;
      const sharedEnts = [...ents].filter((t: string) => c.ents.has(t) && !common.has(t)).length;
      const shared = [...v.keys()].filter((t) => c.c.has(t) && !common.has(t)).length;
      // Un nome proprio in comune basta solo se c'è anche altro: "Gaza" da solo unisce troppo
      if (shared < 3 && !(sharedEnts >= 2 || (sharedEnts === 1 && shared >= 2))) continue;
      s += 0.06 * Math.min(sharedEnts, 3);
      if (s > bestS) { best = ci; bestS = s; }
    }
    if (best >= 0 && bestS >= 0.30) {
      const c = clusters[best];
      c.ids.push(a.id);
      for (const [t, x] of v) c.c.set(t, (c.c.get(t) || 0) + x);
      c.norm = Math.sqrt([...c.c.values()].reduce((p: number, x: number) => p + x * x, 0));
      for (const e of ents) c.ents.add(e);
      c.last = Math.max(c.last, a.ts);
      for (const t of v.keys()) { if (!index.has(t)) index.set(t, new Set()); index.get(t)!.add(best); }
      assign[a.id] = c.ids[0];
    } else {
      clusters.push({ ids: [a.id], c: new Map(v), norm: 1, ents: new Set(ents), last: a.ts });
      for (const t of v.keys()) { if (!index.has(t)) index.set(t, new Set()); index.get(t)!.add(clusters.length - 1); }
      assign[a.id] = a.id;
    }
  }
  return assign;
}

const AGENCIES = ["ansa", "agi", "rainews"];
const agencyRank = (s: string) => { const i = AGENCIES.indexOf(s); return i < 0 ? 9 : i; };
function headline(members: any[], editorial?: any) {
  if (editorial?.t) return [editorial.t, editorial.d || ""];
  const solid = members.filter((a) => !LOWVAL.has(a.x)).length ? members.filter((a) => !LOWVAL.has(a.x)) : members;
  const ital = solid.filter((a) => a.l === "it");
  let pick;
  if (ital.length) pick = ital.sort((a, b) => agencyRank(a.s) - agencyRank(b.s) || b.ts - a.ts)[0];
  else pick = [...solid].sort((a, b) => (a.it ? 0 : 1) - (b.it ? 0 : 1) || a.ts - b.ts)[0];
  return [pick.it || pick.o, clean(pick.desc || "", SHOWN_DESC)];
}
const mostCommon = (xs: string[]) => { const c = new Map<string, number>(); xs.forEach((x) => c.set(x, (c.get(x) || 0) + 1)); return [...c].sort((a, b) => b[1] - a[1])[0]?.[0]; };

/** Le storie: almeno 2 testate diverse; punteggio = testate × freschezza */
export function buildStories(arts: any[], cut: number, titles: Record<string, any> = {}) {
  const groups = new Map<string, any[]>();
  for (const a of arts) if (a.st) { if (!groups.has(a.st)) groups.set(a.st, []); groups.get(a.st)!.push(a); }
  const out: any[] = [];
  for (const [sid, members] of groups) {
    const srcs: string[] = [];
    for (const a of [...members].sort((p, q) => p.ts - q.ts)) if (!srcs.includes(a.s)) srcs.push(a.s);
    if (srcs.length < 2) continue;
    const solid = new Set(members.filter((a) => !LOWVAL.has(a.x)).map((a) => a.s));
    const first = Math.min(...members.map((a) => a.ts)), last = Math.max(...members.map((a) => a.ts));
    const age = (cut - (first + 2 * last) / 3) / 60;
    const fresh = age <= 180 ? 1 : Math.max(0.3, 1 - (age - 180) / 720);
    const places = members.map((a) => a.w).filter((w) => w && w !== "Mondo");
    const [t, d] = headline(members, titles[sid]);
    const withImg = members.filter((a) => a.img).sort((p, q) => (LOWVAL.has(p.x) ? 1 : 0) - (LOWVAL.has(q.x) ? 1 : 0) || q.ts - p.ts);
    out.push({ id: sid, t, d, k: mostCommon(members.map((a) => a.k)), w: places.length ? mostCommon(places) : "Mondo",
      n: srcs.length, solid: solid.size, srcs, first, last, score: srcs.length * fresh,
      img: withImg[0]?.img || null, img_s: withImg[0]?.s || null,
      arts: [...members].sort((p, q) => q.ts - p.ts).map((a) => a.id) });
  }
  return out.sort((a, b) => b.score - a.score || b.last - a.last);
}

/* ---------- Il modello: articoli delle ultime 72 ore, storie, in memoria per un minuto ---------- */

const ents = (b: any) => b.asServiceRole.entities;
const pub = (x: any) => ({ id: x.id, t: x.t, ts: x.ts, s: x.s, st: x.st, k: x.k, w: x.w, it: x.it, o: x.o, x: x.x, u: x.u, l: x.l, img: x.img });
const pubStory = (s: any) => ({ id: s.id, t: s.t, d: s.d, k: s.k, w: s.w, n: s.n, solid: s.solid, srcs: s.srcs, first: s.first, last: s.last, arts: s.arts, img: s.img, img_s: s.img_s });

/** Tutti i record che rispettano il filtro, a pagine di 500 */
async function all(entity: any, filter: any, sort = "-ts") {
  const out: any[] = [];
  for (let skip = 0; ; skip += 500) {
    const page = await entity.filter(filter, sort, 500, skip);
    out.push(...page);
    if (page.length < 500) return out;
  }
}

let MODEL: any = null;
async function model(b: any, now: number) {
  if (MODEL && now - MODEL.at < 60) return MODEL;
  const rows = await all(ents(b).Article, { ts: { $gte: now - KEEP_HOURS * 3600 } });
  const arts = rows.filter((r) => SOURCES[r.testata] && r.ts <= now + 60).map((r) => ({
    id: r.aid, ts: r.ts, t: hhmm(r.ts), s: r.testata, k: r.sezione, w: r.luogo || defaultPlace(r.sezione, SOURCES[r.testata].cc),
    it: r.titolo_it || null, o: r.titolo_originale || null, x: r.tipo, u: r.url, l: r.lingua, desc: r.estratto || "", img: r.immagine || null, st: null as string | null,
  }));
  const titles = Object.fromEntries((await ents(b).StoryTitle.list("-creato", 500)).map((r: any) => [r.story_id, { t: r.titolo, d: r.sintesi, n: r.n }]));
  const assign = cluster(arts);
  const groups = new Map<string, number>();
  for (const a of arts) { a.st = assign[a.id]; groups.set(a.st, (groups.get(a.st) || 0) + 1); }
  for (const a of arts) if (groups.get(a.st!)! < 2) a.st = null;
  const byId = new Map(arts.map((a) => [a.id, a]));
  const stories = new Map(buildStories(arts, now, titles).map((s) => [s.id, s]));
  // Gli articoli di storie con una sola testata non sono in una storia
  for (const a of arts) if (a.st && !stories.has(a.st)) a.st = null;
  MODEL = { at: now, arts: arts.sort((p, q) => q.ts - p.ts), byId, stories, titles };
  return MODEL;
}

/* ---------- Viste ---------- */

async function sourceHealth(b: any, now: number) {
  const rows = await ents(b).FeedStatus.list("-ultimo_tentativo", 500);
  const h = new Map<string, [number, number]>();
  let updated = 0;
  for (const r of rows) {
    const p = h.get(r.testata) || [0, 0];
    h.set(r.testata, [Math.max(p[0], r.ultimo_ok || 0), Math.max(p[1], r.ultimo_tentativo || 0)]);
    updated = Math.max(updated, r.ultimo_tentativo || 0);
  }
  // Una testata è "in verifica" se nessun suo feed risponde da 6 ore
  const sources = Object.entries(SOURCES).map(([k, s]: [string, any]) => {
    const [ok, tried] = h.get(k) || [0, 0];
    return { key: k, n: s.n, cc: s.cc, l: s.l, u: s.u, ok: !tried || ok >= now - 6 * 3600, checked: !!tried };
  });
  return { sources, updated };
}

/* "updated" e "changed" si leggono dai dati salvati: la memoria della funzione non dura tra una chiamata e l'altra */
async function meta(b: any, now: number, m: any) {
  const { sources, updated } = await sourceHealth(b, now);
  const changed = (await ents(b).Article.list("-letto", 1))[0]?.letto || null;
  return { now, today: today(now), edition: currentEdition(now), days: daysList(now), demo: false,
    translate: !!Deno.env.get("ANTHROPIC_API_KEY"), updated: updated || null, changed, count: m.arts.length,
    sources, topics: TOPICS, countries: COUNTRIES, groups: GROUPS, editions: EDITIONS };
}

async function front(b: any, now: number, m: any, day: string, ek: string) {
  const [a, bb] = editionBounds(day, ek);
  const base = { day, ed: ek, a, b: bb, now };
  if (a > now) return { ...base, future: true, closed: false, articles: [], stories: [], rail: [] };
  const closed = bb <= now;
  if (closed) {
    const snap = (await ents(b).EditionSnapshot.filter({ giorno: day, edizione: ek }, "-salvato", 1))[0];
    if (snap) return snap.payload;
  }
  const cut = closed ? bb : now + 1;
  const upTo = m.arts.filter((x: any) => cut - 30 * 3600 <= x.ts && x.ts < cut);
  const inWin = upTo.filter((x: any) => x.ts >= a);
  const ids = new Set(inWin.map((x: any) => x.st).filter(Boolean));
  const sts = buildStories(upTo.filter((x: any) => ids.has(x.st)), cut, m.titles).slice(0, 40);
  // "Le prime pagine": per ogni testata l'articolo della storia più in alto, o il suo ultimo
  const rank = new Map(sts.filter((s) => s.solid >= 2).map((s, i) => [s.id, i]));
  const rail: string[] = [];
  for (const k of FRONT_ORDER) {
    if (rail.length >= 12) break;
    const cand = upTo.filter((x: any) => x.s === k && !LOWVAL.has(x.x) && x.ts >= a - 7200);
    if (!cand.length) continue;
    const ranked = cand.filter((x: any) => rank.has(x.st));
    rail.push(ranked.length ? ranked.reduce((p: any, q: any) => (rank.get(q.st)! < rank.get(p.st)! ? q : p)).id : cand[0].id);
  }
  const need = new Set([...inWin.map((x: any) => x.id), ...sts.flatMap((s) => s.arts), ...rail]);
  const out = { ...base, closed, cut, papers: new Set(inWin.map((x: any) => x.s)).size, count: inWin.length,
    articles: upTo.filter((x: any) => need.has(x.id)).map(pub), stories: sts.map(pubStory), rail };
  // Si salva solo se un aggiornamento è passato dopo la chiusura, altrimenti mancherebbero le ultime notizie
  if (closed && LAST.cycle && LAST.cycle >= bb) await ents(b).EditionSnapshot.create({ giorno: day, edizione: ek, salvato: now, payload: out });
  return out;
}

function dayView(now: number, m: any) {
  const [a] = dayBounds(today(now));
  const arts = m.arts.filter((x: any) => x.ts >= a);
  const ids = new Set(arts.map((x: any) => x.st).filter(Boolean));
  const sts = [...ids].map((i) => m.stories.get(i)).filter(Boolean).sort((p: any, q: any) => q.score - p.score);
  const extra = sts.flatMap((s: any) => s.arts).map((i: string) => m.byId.get(i)).filter((x: any) => x && x.ts < a);
  return { now, articles: arts.concat(extra).map(pub), stories: sts.map(pubStory) };
}

function storyView(m: any, sid: string) {
  const s = m.stories.get(sid);
  if (!s) return null;
  const related = [...m.stories.values()].filter((o: any) => o.k === s.k && o.id !== sid).sort((p: any, q: any) => q.score - p.score).slice(0, 4);
  const relIds = new Set(related.flatMap((o: any) => o.arts));
  return { story: pubStory(s), articles: s.arts.map((i: string) => ({ ...pub(m.byId.get(i)), desc: clean(m.byId.get(i).desc, SHOWN_DESC) })),
    related: related.map(pubStory), related_articles: [...relIds].map((i) => pub(m.byId.get(i))) };
}

function searchView(m: any, q: string) {
  const nq = norm(q.trim());
  if (nq.length < 2) return { q, hits: [], articles: [], stories: [] };
  const hits: any[] = [];
  for (const x of m.arts) {
    const src = SOURCES[x.s], st = x.st ? m.stories.get(x.st) : null;
    if (norm([x.it, x.o, src.n, x.w, COUNTRIES[src.cc], st?.t].filter(Boolean).join(" ")).includes(nq)) hits.push(x);
    if (hits.length >= 300) break;
  }
  const sts = [...new Set(hits.map((x) => x.st).filter(Boolean))].map((i) => m.stories.get(i)).sort((p: any, q: any) => q.score - p.score).slice(0, 12);
  const need = new Set([...hits.map((x) => x.id), ...sts.flatMap((s: any) => s.arts)]);
  return { q, hits: hits.map((x) => x.id), articles: [...need].map((i) => pub(m.byId.get(i))), stories: sts.map(pubStory) };
}

/* ---------- Aggiornamento dai feed ---------- */

// Momento dell'ultimo aggiornamento fatto da questa istanza: serve solo a decidere se salvare un'edizione chiusa
const LAST = { cycle: 0 };

async function aggiorna(b: any, now: number) {
  const E = ents(b);
  const jobs: [string, any][] = [];
  for (const [k, src] of Object.entries(SOURCES) as [string, any][]) {
    // I feed di sezione prima di quelli generici: l'argomento viene dal feed più preciso
    for (const f of [...src.feeds].sort((p: any, q: any) => (p.topic === null ? 1 : 0) - (q.topic === null ? 1 : 0))) jobs.push([k, f]);
  }
  const results = [];
  for (let i = 0; i < jobs.length; i += 12) {
    results.push(...await Promise.all(jobs.slice(i, i + 12).map(async ([k, f]) => {
      try { return [k, f, parseFeed(await fetchFeed(f.url)), null]; } catch (e) { return [k, f, [], String(e).slice(0, 200)]; }
    })));
  }
  const known = new Map((await all(E.Article, { ts: { $gte: now - PRUNE_DAYS * 86400 } })).map((r: any) => [r.aid, r]));
  const stati = new Map((await E.FeedStatus.list("-ultimo_tentativo", 500)).map((r: any) => [r.url, r]));
  const nuovi: any[] = [], conFoto: any[] = [];
  for (const [k, f, items, err] of results as any[]) {
    const src = SOURCES[k];
    const prev: any = stati.get(f.url);
    const st = { url: f.url, testata: k, ultimo_tentativo: now, ultimo_ok: err ? (prev?.ultimo_ok || null) : now, errore: err, articoli: items.length };
    if (prev) await E.FeedStatus.update(prev.id, st); else await E.FeedStatus.create(st);
    for (const it of items) {
      const aid = await articleId(it.link);
      const old = known.get(aid);
      if (old) { if (it.img && !old.immagine) conFoto.push([old.id, it.img]); continue; }
      const ts = Math.min(it.date || now, now);
      if (ts < now - KEEP_HOURS * 3600) continue;
      const italian = src.l === "it";
      const luogo = placeFor(it.title, it.desc);
      const sezione = topicFor(f.topic, it.link, it.title, src.cc, luogo);
      const rec = { aid, testata: k, url: it.link, titolo: it.title, titolo_it: italian ? it.title : null, titolo_originale: italian ? null : it.title,
        estratto: it.desc, ts, letto: now, sezione, luogo, tipo: kindFor(it.link, it.title), lingua: src.l, immagine: it.img };
      known.set(aid, rec);
      nuovi.push(rec);
    }
  }
  for (let i = 0; i < nuovi.length; i += 200) await E.Article.bulkCreate(nuovi.slice(i, i + 200));
  for (const [id, img] of conFoto.slice(0, 300)) await E.Article.update(id, { immagine: img });
  const tradotti = await traduciTitoli(b, now);
  LAST.cycle = now;
  MODEL = null;
  // Cancella ciò che è troppo vecchio (un po' per volta, per non superare il tempo della funzione)
  for (const r of await E.Article.filter({ ts: { $lt: now - PRUNE_DAYS * 86400 } }, "ts", 300)) await E.Article.delete(r.id);
  for (const r of await E.EditionSnapshot.filter({ salvato: { $lt: now - SNAPSHOT_DAYS * 86400 } }, "salvato", 100)) await E.EditionSnapshot.delete(r.id);
  // Salva le edizioni appena chiuse di oggi e di ieri, così restano com'erano
  const m = await model(b, now);
  for (const day of daysList(now).slice(0, 2)) for (const e of EDITIONS) {
    const [, bb] = editionBounds(day, e.k);
    if (bb <= now && !(await E.EditionSnapshot.filter({ giorno: day, edizione: e.k }, "-salvato", 1)).length) await front(b, now, m, day, e.k);
  }
  return { nuovi: nuovi.length, tradotti, feed: results.length, errori: results.filter((r: any) => r[3]).length };
}

/* ---------- Traduzioni (solo se la chiave è nei secret dell'app) ---------- */

async function traduciTitoli(b: any, now: number) {
  const key = Deno.env.get("ANTHROPIC_API_KEY");
  if (!key) return 0;
  const { default: Anthropic } = await import("npm:@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey: key });
  const E = ents(b);
  // I titoli stranieri senza traduzione delle ultime 36 ore (il filtro sul campo vuoto si fa qui)
  const todo = (await all(E.Article, { ts: { $gte: now - 36 * 3600 } })).filter((r: any) => r.lingua !== "it" && !r.titolo_it).slice(0, 200);
  let done = 0;
  for (let i = 0; i < todo.length; i += 40) {
    const chunk = todo.slice(i, i + 40);
    const items = chunk.map((r: any) => ({ id: r.id, lingua: r.lingua, titolo: r.titolo }));
    const resp = await client.messages.create({
      model: "claude-haiku-5-5", max_tokens: 4000,
      system: "Traduci in italiano titoli di giornale. Registro giornalistico, nomi propri e cifre invariati, niente aggiunte né commenti, maiuscola solo a inizio frase e nei nomi propri, virgolette basse « ». Rispondi solo con JSON: {\"items\":[{\"id\":\"...\",\"it\":\"...\"}]}",
      messages: [{ role: "user", content: JSON.stringify({ items }) }],
    });
    const text = resp.content.filter((c: any) => c.type === "text").map((c: any) => c.text).join("");
    let out: any[] = [];
    try { out = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1)).items || []; } catch { continue; }
    for (const o of out) {
      const r = chunk.find((x: any) => x.id === o.id);
      if (!r || !o.it) continue;
      await E.Article.update(r.id, { titolo_it: String(o.it).slice(0, 300), luogo: r.luogo || placeFor(o.it) });
      done++;
    }
  }
  return done;
}

/* ---------- Ingresso della funzione ---------- */

Deno.serve(async (req) => {
  const b = createClientFromRequest(req);
  const now = Date.now() / 1000;
  let body: any = {};
  try { body = await req.json(); } catch {}
  const azione = body.azione || "aggiorna";
  try {
    if (azione === "aggiorna") return Response.json(await aggiorna(b, now));
    const m = await model(b, now);
    if (azione === "meta") return Response.json(await meta(b, now, m));
    if (azione === "front") {
      const day = daysList(now).includes(body.day) ? body.day : today(now);
      const ed = ED[body.ed] ? body.ed : currentEdition(now);
      return Response.json(await front(b, now, m, day, ed));
    }
    if (azione === "day") return Response.json(dayView(now, m));
    if (azione === "story") return Response.json(storyView(m, String(body.id || "")) || { error: "storia non trovata" }, { status: m.stories.has(body.id) ? 200 : 404 });
    if (azione === "search") return Response.json(searchView(m, String(body.q || "").slice(0, 80)));
    if (azione === "article") {
      const x = m.byId.get(String(body.id || ""));
      return x ? Response.json({ ...pub(x), desc: clean(x.desc, SHOWN_DESC) }) : Response.json({ error: "articolo non trovato" }, { status: 404 });
    }
    return Response.json({ error: "azione sconosciuta" }, { status: 400 });
  } catch (e) {
    console.error(e);
    return Response.json({ error: "errore interno" }, { status: 500 });
  }
});
