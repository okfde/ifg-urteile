const fs = require('fs');
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');
const _ = require('lodash');

const host = 'https://www.lda.brandenburg.de';
const siteUrl = (page) => `${host}/sixcms/detail.php?template=rechtsprechungsdb_erg_d&sort=datum&order=desc&datum_von=&datum_bis=&gerichte_title=&title=&vt_db=&art2_title=&rechtsgrundlage_db_title=%2F&regelungsgegenstand_title=&max=20&skip=${page * 20}`;

async function main() {
  let { data } = await axios.get(siteUrl(0));

  const $ = cheerio.load(data);
  const totalRegex = /^(\d+) Treffer -nach Datum sortiert-.*$/gm;
  const totalText = $('div#content div.beitrag div').text().split('\n')[2];
  const [, total] = totalRegex.exec(totalText);
  const pageTotal = Math.ceil(total / 20);

  const urteile = [];
  const downloadQueue = [];

  for (let page = 0; page < pageTotal; page++) {
    const { data } = await axios.get(siteUrl(page));
    const $ = cheerio.load(data);

    const $rows = $('div#content div.beitrag div div:not([id])');

    for (const row of $rows.toArray()) {
      const $row = $(row);
      const metaEls = _.chunk($('dt, dd', $row).toArray(), 2);
      let meta = {};

      for (const [dt, dd] of metaEls) {
        const key = $(dt).text().replace(':', '').split(' ')[0].toLowerCase();
        meta[key] = $(dd).text().trim()
      }

      delete meta.download;

      urteile.push(meta);

      const url = $('.eins a', $row).attr('href');

      const download = async () => {
        const file = path.resolve(__dirname, '../urteile', `${meta.gericht} ${meta.aktenzeichen.replace(/\//gm, '-')}.pdf`);
        const stream = fs.createWriteStream(file);
        const response = await axios.get(`${host}${url}`, {
          responseType: 'stream'
        })
        response.data.pipe(stream);
      };

      downloadQueue.push(download);
    }

    console.info(`done with page ${page} / ${pageTotal}`)
  }

  const metaFile = path.resolve(__dirname, '../urteile', '_urteile.json');
  await fs.promises.writeFile(metaFile, JSON.stringify(urteile), 'utf-8');

  let downloaded = 0;
  const chunkedQueue = _.chunk(downloadQueue, 3);
  for (const item of chunkedQueue) {
    const promises = item.map(fn => fn());
    promises.forEach(p => {
      p.then(() => {
        downloaded++;
        console.log(`downloaded pdf ${downloaded} / ${downloadQueue.length}`)
      });
    });

    await Promise.all(promises);
  }
}

main();