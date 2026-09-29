'use strict';
/* 临时探针：批量搜索 + 抓页 + 抽取，带限速。用后即删。 */
const r = require('./research.js');
const sleep = (ms) => new Promise(s => setTimeout(s, ms));

const strip = (d) => d
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
  .replace(/\s+/g, ' ').trim();

async function main() {
  const queries = JSON.parse(process.argv[2] || '[]');
  for (const q of queries) {
    console.log('\n===== QUERY: ' + q);
    let res = [];
    try { res = r.brave(q); } catch (e) { console.log('brave err ' + e.message); }
    console.log('brave=' + res.length);
    res.slice(0, 10).forEach((x, i) => console.log('  ' + (i + 1) + '. ' + x.url));
    const gov = res.filter(x => /\.gov\.cn/.test(x.url));
    if (!gov.length) {
      await sleep(2500);
      let d = [];
      try { d = r.ddgLite(q); } catch (e) { console.log('ddg err ' + e.message); }
      console.log('ddg=' + d.length);
      d.slice(0, 10).forEach((x, i) => console.log('  d' + (i + 1) + '. ' + x.url));
      gov.push(...d.filter(x => /\.gov\.cn/.test(x.url)));
    }
    console.log('GOV:');
    gov.slice(0, 8).forEach(x => console.log('  ' + x.url));
    await sleep(2000);
  }
}
main();
