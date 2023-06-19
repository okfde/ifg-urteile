const fs = require('fs');
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');
const _ = require('lodash');

const host = 'https://www.lda.brandenburg.de';
const siteUrl = (page) => `${host}/lda/de/akteneinsicht/rechtsprechungsdatenbank/?skip380673=${page * 10}`;

const ECLI_RE = /^(ECLI:[^ ]+)$/gm;

const downloadDetail = async (meta) => {
  console.log("downloading detail", meta.detailUrl)
  const { data } = await axios.get(meta.detailUrl)
  const $ = cheerio.load(data);
  const $dl = $('dl')[0];
  const detail = extractDl($, $dl);
  meta = {
    ...meta,
    ...detail
  }
  return meta
};

const tryFindingECLI = async (meta) => {
  console.log(meta)
  meta.ecli = null
  if (!meta.quelleUrl) {
    return meta
  }
  console.log("Try finding ECLI", meta.quelleUrl)
  let data
  try {
    const response = await axios.get(meta.quelleUrl)
    data = response.data
  } catch (e) {
    console.warn(e)
    return meta
  }
  const match = ECLI_RE.exec(data)
  if (match) {
    meta.ecli = match[1];
  }
  return meta
}

const downloadPDF = async (meta) => {
  if (!meta.downloadUrl) {
    return meta
  }
  console.log("Download PDF", meta.aktenzeichen)
  const filename = `${meta.gericht} ${meta.aktenzeichen.replace(/\//gm, '-')}.pdf`
  const file = path.resolve(__dirname, '../urteile', filename);
  if (fs.existsSync(file)) {
    meta.pdfFile = filename
    return meta;
  }
  const downloadUrl = `${host}${meta.downloadUrl}`
  meta.downloadUrl = downloadUrl
  const stream = fs.createWriteStream(file);
  const response = await axios.get(downloadUrl, {
    responseType: 'stream'
  })
  response.data.pipe(stream);
  meta.pdfFile = filename
  return meta
};

const extractDl = ($, $dl) => {
  const metaEls = _.chunk($('dt, dd', $dl).toArray(), 2);
  const meta = {};
  for (const [dt, dd] of metaEls) {
    const key = $(dt).text().replace(':', '').split(' ')[0].toLowerCase();
    meta[key] = $(dd).text().trim()
    const href = $(dd).find("a").attr('href')
    if (href) {
      meta[`${key}Url`] = href
    }
  }
  return meta
}


async function main() {
  let { data } = await axios.get(siteUrl(0));

  const $ = cheerio.load(data);
  const totalRegex = /^Es wurden (\d+) Ergebnisse gefunden.*$/gm;
  const totalText = $('.row .columns > p').text();
  const [, total] = totalRegex.exec(totalText);
  const pageTotal = Math.ceil(total / 20);

  const urteile = [];

  for (let page = 0; page < pageTotal; page++) {
    const { data } = await axios.get(siteUrl(page));
    const $ = cheerio.load(data);

    const $rows = $('.row.ldardb');

    for (const row of $rows.toArray()) {
      const $row = $(row);
      const detailUrl = $row.find('p a').attr('href');
      let meta = {
        detailUrl: `${host}${detailUrl}`,
        ...extractDl($, $row)
      };
      console.log(meta);
      meta = await downloadDetail(meta);
      meta = await tryFindingECLI(meta);
      meta = await downloadPDF(meta);
      urteile.push(meta);
    }

    console.info(`done with page ${page} / ${pageTotal}`)
  }

  const metaFile = path.resolve(__dirname, '../urteile', '_urteile.json');
  await fs.promises.writeFile(metaFile, JSON.stringify(urteile), 'utf-8');

  // let downloaded = 0;
  // const chunkedQueue = _.chunk(downloadQueue, 3);
  // for (const item of chunkedQueue) {
  //   const promises = item.map(fn => fn());
  //   promises.forEach(p => {
  //     p.then(() => {
  //       downloaded++;
  //       console.log(`downloaded pdf ${downloaded} / ${downloadQueue.length}`)
  //     });
  //   });

  //   await Promise.all(promises);
  // }
}

main();