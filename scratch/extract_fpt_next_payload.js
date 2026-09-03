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

  console.log('--- Searching for Next.js JSON state in script tags ---');

  const items = [];

  $('script').each((_, el) => {
    const text = $(el).html() || '';
    if (!text.includes('tin-khuyen-mai')) return;

    // Search for JSON objects containing title and url/slug
    const matches = text.match(/\{[^{}]*?"(?:title|name|heading)":\s*"([^"]+)"[^{}]*?\}/g) || [];
    matches.forEach((m) => {
      const titleMatch = m.match(/"(?:title|name|heading)":\s*"([^"]+)"/);
      const urlMatch = m.match(/"(?:url|slug|path|href)":\s*"([^"]+)"/);
      const imgMatch = m.match(/"(?:image|avatar|thumbnail|src|desktop)":\s*"([^"]+)"/);

      if (titleMatch) {
        const title = titleMatch[1];
        const href = urlMatch ? urlMatch[1] : '';
        const img = imgMatch ? imgMatch[1] : '';

        if (title.length > 8 && !title.includes('FPT Shop') && !items.some((i) => i.title === title)) {
          items.push({ title, href, img });
        }
      }
    });
  });

  console.log(`Found ${items.length} items from Next.js payload JSON objects:`);
  items.forEach((it, idx) => console.log(`${idx + 1}. [${it.title}] => ${it.href} (Img: ${it.img || 'None'})`));
}

test();
