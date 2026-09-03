const https = require('https');
const cheerio = require('cheerio');

function fetchOgImage(url) {
  return new Promise((resolve) => {
    https.get(url, { headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36' } }, (res) => {
      let html = '';
      res.on('data', (c) => (html += c));
      res.on('end', () => {
        try {
          const $ = cheerio.load(html);
          const og = $('meta[property="og:image"]').attr('content') || $('meta[name="twitter:image"]').attr('content');
          resolve(og || null);
        } catch {
          resolve(null);
        }
      });
    }).on('error', () => resolve(null));
  });
}

async function test() {
  const urls = [
    'https://fptshop.com.vn/tin-tuc/tin-khuyen-mai/uu-dai-goi-dung-thu-google-ai-pro-6-thang-danh-cho-chu-so-huu-galaxy-z8-series-211719',
    'https://fptshop.com.vn/tin-tuc/tin-khuyen-mai/back-to-school-2026-cung-msi-211390',
    'https://cellphones.com.vn/sforum/cellphones-mo-ban-poco-f9-ultra',
    'https://www.thegioididong.com/tin-tuc/giam-gia-uu-dai-uu-dai-dac-quyen-samsung-galaxy-1582910',
  ];

  for (const url of urls) {
    const img = await fetchOgImage(url);
    console.log(`URL: ${url}\n  => OG Image: ${img}\n`);
  }
}

test();
