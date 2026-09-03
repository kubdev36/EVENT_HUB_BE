const https = require('https');
const cheerio = require('cheerio');

function fetchHtml(url) {
  return new Promise((resolve) => {
    https.get(url, { headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36' } }, (res) => {
      let html = '';
      res.on('data', (c) => (html += c));
      res.on('end', () => resolve({ url, html }));
    });
  });
}

async function test() {
  const { html } = await fetchHtml('https://cellphones.com.vn/uu-dai-doi-tac');
  
  // Find all links containing uu-dai-doi-tac
  const matches = html.match(/https?:\/\/[^\s"'<>]+\/uu-dai-doi-tac\/[^\s"'<>]+/gi) || [];
  console.log('Unique uu-dai-doi-tac links:', [...new Set(matches)]);

  // Find all promo cards or banners in Next.js JSON state inside HTML
  const altSrcMatches = html.match(/\{[^{}]*"alt"\s*:\s*"([^"]+)"[^{}]*"src"\s*:\s*"([^"]+)"[^{}]*\}/gi) || [];
  console.log('Found alt/src matches:', altSrcMatches.length);
  altSrcMatches.slice(0, 15).forEach((m) => console.log(' ->', m.slice(0, 200)));
}

test();
