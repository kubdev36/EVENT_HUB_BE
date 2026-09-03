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
  const url = 'https://fptshop.com.vn/tin-tuc/tin-khuyen-mai';
  const res = await fetchUrl(url);
  const $ = cheerio.load(res.html);

  $('script').each((i, el) => {
    const text = $(el).html() || '';
    if (text.length > 100000) {
      console.log(`Script ${i} length: ${text.length}`);
      // Find snippets containing /tin-tuc/tin-khuyen-mai/
      const idx = text.indexOf('/tin-tuc/tin-khuyen-mai/');
      if (idx !== -1) {
        console.log('Snippet around promo link:\n', text.slice(Math.max(0, idx - 200), idx + 400));
      }
    }
  });
}

test();
