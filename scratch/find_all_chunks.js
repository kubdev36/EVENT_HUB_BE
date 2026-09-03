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

  const scripts = [];
  $('script[src*="_next/static/chunks/"]').each((_, el) => {
    const src = $(el).attr('src');
    if (src) scripts.push(src.startsWith('http') ? src : `https://fptshop.com.vn${src}`);
  });

  console.log(`Found ${scripts.length} JS script chunks! Searching for API calls...`);
  for (const s of scripts) {
    const r = await fetchUrl(s);
    if (r.status === 200) {
      const apis = r.html.match(/\/gw\/[a-zA-Z0-9_/.-]+/g) || r.html.match(/\/api\/[a-zA-Z0-9_/.-]+/g) || [];
      if (apis.length > 0) {
        console.log(`\nChunk [${s.split('/').pop()}]:`);
        Array.from(new Set(apis)).forEach((a) => console.log('  ', a));
      }
    }
  }
}

test();
