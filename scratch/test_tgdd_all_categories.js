const https = require('https');
const cheerio = require('cheerio');

function fetchUrl(url) {
  return new Promise((resolve) => {
    https.get(url, { headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36' } }, (res) => {
      let html = '';
      res.on('data', (c) => (html += c));
      res.on('end', () => resolve({ url, status: res.statusCode, html }));
    });
  });
}

async function test() {
  const urls = [
    'https://www.thegioididong.com/tin-tuc/tin-khuyen-mai/31',
    'https://www.thegioididong.com/tin-tuc',
    'https://www.thegioididong.com/tin-tuc/thi-truong/1141',
    'https://www.thegioididong.com/tin-tuc/danh-gia/210',
    'https://www.thegioididong.com/tin-tuc/laptop/1269',
  ];

  const allArticles = new Map();

  for (const u of urls) {
    const res = await fetchUrl(u);
    console.log(`URL [${u}] => Status: ${res.status}, Length: ${res.html.length}`);
    if (res.status === 200) {
      const $ = cheerio.load(res.html);
      let count = 0;
      $('a[href]').each((_, el) => {
        const href = $(el).attr('href');
        const title = $(el).text().replace(/\s+/g, ' ').trim();
        if (
          href &&
          title.length > 10 &&
          href.includes('/tin-tuc/') &&
          !href.includes('/category') &&
          !href.includes('/meo-hay') &&
          !href.endsWith('/tin-tuc')
        ) {
          const cleanUrl = href.startsWith('http') ? href : `https://www.thegioididong.com${href}`;
          if (!allArticles.has(cleanUrl)) {
            allArticles.set(cleanUrl, title);
            count++;
          }
        }
      });
      console.log(`  Extracted ${count} new articles from this page!`);
    }
  }

  console.log(`\nTOTAL unique TGDD articles across all 5 categories: ${allArticles.size}`);
  Array.from(allArticles.entries()).slice(0, 20).forEach(([u, t], i) => {
    console.log(`${i + 1}. [${t}] => ${u}`);
  });
}

test();
