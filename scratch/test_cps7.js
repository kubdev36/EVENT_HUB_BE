const https = require('https');
const cheerio = require('cheerio');

function fetchHtml(url) {
  return new Promise((resolve) => {
    https.get(url, { headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } }, (res) => {
      let html = '';
      res.on('data', (c) => (html += c));
      res.on('end', () => resolve({ url, html }));
    });
  });
}

async function test() {
  const detail = await fetchHtml('https://cellphones.com.vn/sforum/flash-sale-it-09-05');
  const $ = cheerio.load(detail.html);
  const ogImage = $('meta[property="og:image"]').attr('content') || $('meta[name="twitter:image"]').attr('content') || $('img').first().attr('src');
  console.log('OG IMAGE FOR SFORUM ARTICLE:', ogImage);
}

test();
