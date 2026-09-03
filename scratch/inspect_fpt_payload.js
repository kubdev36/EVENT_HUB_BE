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

  console.log('--- Inspecting Next.js payload / JSON scripts in FPT Shop ---');

  const items = [];
  $('script').each((_, el) => {
    const text = $(el).html() || '';
    if (text.length > 10000) {
      // Find all article URLs matching /tin-tuc/tin-khuyen-mai/ in script JSON
      const matches = text.match(/\/tin-tuc\/tin-khuyen-mai\/[a-z0-9-]+(?:\?[^"\\]*)?/g) || [];
      matches.forEach((m) => {
        const fullUrl = `https://fptshop.com.vn${m.split('?')[0]}`;
        if (!items.includes(fullUrl)) {
          items.push(fullUrl);
        }
      });
    }
  });

  console.log(`Extracted ${items.length} unique promo article URLs from FPT Shop script payloads:`);
  items.forEach((it, idx) => console.log(`${idx + 1}. ${it}`));

  // Check if FPT Shop has GraphQL or Next.js action API
  const actionMatches = res.html.match(/https?:\/\/[^"\s]+\/api\/[^"\s]+/g) || [];
  console.log('\n--- FPT Shop API endpoints found in page ---');
  console.log(Array.from(new Set(actionMatches)).slice(0, 10));
}

test();
