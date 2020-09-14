# IFG Urteile

Alle deutschen Gerichtsurteile mit Bezug zu Informationsfreiheit. [Quelle](https://www.lda.brandenburg.de/sixcms/detail.php?template=rechtsprechungsdb_erg_d&sort=datum&order=desc&datum_von=&datum_bis=&gerichte_title=&title=&vt_db=&art2_title=&rechtsgrundlage_db_title=%2F&regelungsgegenstand_title=&max=20&skip=0)

## Daten

Alle Urteile liegen im PDF-Format vor. Die Metadaten zu den jeweiligen Urteilen sind in der Datei [`_urteile.json`](https://github.com/okfde/ifg-urteile/blob/master/urteile/_urteile.json) gespeichert.

## Scraping

```bash
git clone https://github.com/okfde/ifg-urteile.git
rm urteile/*
yarn install
yarn scrape
```