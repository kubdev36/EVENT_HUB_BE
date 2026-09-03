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

  console.log('--- Checking ALL <a> links under /tin-tuc/ in FPT Shop ---');
  const items = new Map();

  $('a[href*="/tin-tuc/"]').each((_, el) => {
    const href = $(el).attr('href');
    const title = $(el).text().replace(/\s+/g, ' ').trim();
    if (href && title.length > 8 && !href.includes('/category') && !href.includes('/dien-may') && !href.includes('/danh-gia') && !href.includes('/for-gamers')) {
      const cleanUrl = href.startsWith('http') ? href : `https://fptshop.com.vn${href}`;
      if (!items.has(cleanUrl) || items.get(cleanUrl).length < title.length) {
        items.set(cleanUrl, title);
      }
    }
  });

  console.log(`Found ${items.size} promo / news links on FPT Shop main page:`);
  Array.from(items.entries()).forEach(([u, t], i) => {
    console.log(`${i + 1}. [${t}] => ${u}`);
  });
}

test();
