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
    'https://fptshop.com.vn/tin-tuc/tin-khuyen-mai',
    'https://fptshop.com.vn/tin-tuc/tin-khuyen-mai?trang=2',
    'https://fptshop.com.vn/tin-tuc/tin-khuyen-mai?page=2',
    'https://fptshop.com.vn/tin-tuc/tin-khuyen-mai/trang-2',
    'https://fptshop.com.vn/tin-tuc/tin-khuyen-mai/page/2',
    'https://fptshop.com.vn/tin-tuc/tin-khuyen-mai/2',
  ];

  for (const u of urls) {
    const res = await fetchUrl(u);
    console.log(`URL: [${u}] Status: ${res.status}, Length: ${res.html.length}`);
    if (res.status === 200) {
      const $ = cheerio.load(res.html);
      const links = new Set();
      $('a[href*="/tin-tuc/tin-khuyen-mai/"]').each((_, el) => {
        const href = $(el).attr('href');
        if (href && !href.includes('?') && href !== '/tin-tuc/tin-khuyen-mai/') {
          links.add(href);
        }
      });
      console.log(`  Found ${links.size} unique promo links:`, Array.from(links).slice(0, 3));
    }
  }
}

test();
