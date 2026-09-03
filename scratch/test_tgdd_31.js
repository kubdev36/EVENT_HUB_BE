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
  const url = 'https://www.thegioididong.com/tin-tuc/tin-khuyen-mai/31';
  const res = await fetchUrl(url);
  const $ = cheerio.load(res.html);

  console.log('--- All <a> tags inside main content ---');
  $('a[href*="/tin-tuc/"]').each((i, el) => {
    const href = $(el).attr('href');
    const title = $(el).text().replace(/\s+/g, ' ').trim();
    const parent = $(el).closest('li, div, article');
    const img = parent.find('img').attr('data-src') || parent.find('img').attr('src') || parent.find('img').attr('srcset');
    if (href && title.length > 10) {
      console.log(`${i + 1}. [${title}] => ${href} (Img: ${img})`);
    }
  });
}

test();
