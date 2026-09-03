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

function extractFptNextPayload(html, sourceUrl) {
  const items = [];
  const seen = new Set();

  const unescaped = html.replace(/\\"/g, '"').replace(/\\\\/g, '\\').replace(/\\u0026/g, '&');

  // Match any href containing tin-khuyen-mai
  const hrefMatches = unescaped.match(/https:\/\/fptshop\.com\.vn\/tin-tuc\/tin-khuyen-mai\/[a-z0-9-]+/g) || [];

  hrefMatches.forEach((rawHref) => {
    const cleanUrl = rawHref.split('?')[0].replace(/\/$/, '');
    if (!seen.has(cleanUrl)) {
      seen.add(cleanUrl);

      // Find nearby title in script around this URL
      const idx = unescaped.indexOf(rawHref);
      const snippet = unescaped.slice(Math.max(0, idx - 300), idx + 300);

      const titleMatch = snippet.match(/"(?:title|name|alt|label|heading)":\s*"([^"]+)"/) || snippet.match(/"([^"]{10,120})"/);
      const imgMatch = snippet.match(/"(?:src|image|avatar|thumbnail)":\s*"(https:\/\/cdn2\.fptshop\.com\.vn\/[^"]+)"/);

      const title = titleMatch ? titleMatch[1].replace(/\\u0026/g, '&') : cleanUrl.split('/').pop().replace(/-/g, ' ');
      const img = imgMatch ? imgMatch[1] : null;

      items.push({
        title,
        url: cleanUrl,
        image: img,
      });
    }
  });

  return items;
}

async function test() {
  const url = 'https://fptshop.com.vn/tin-tuc/tin-khuyen-mai';
  const res = await fetchUrl(url);
  const items = extractFptNextPayload(res.html, res.url);

  console.log(`\nExtracted ${items.length} FPT promo items from Next.js payload:`);
  items.forEach((it, idx) => console.log(`${idx + 1}. [${it.title}]\n   URL: ${it.url}\n   Image: ${it.image || 'None'}\n`));
}

test();
