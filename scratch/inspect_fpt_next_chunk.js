const https = require('https');

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
  const jsUrl = 'https://fptshop.com.vn/_next/static/chunks/app/tin-tuc/%5Bcate%5D/page-1fd56962f2e99abb.js';
  const res = await fetchUrl(jsUrl);
  console.log(`JS Chunk Status: ${res.status}, Length: ${res.html.length}`);

  // Search for API endpoints in the page chunk JS
  const apis = res.html.match(/https?:\/\/[^"'\s\)]+/g) || [];
  console.log('HTTP URLs in chunk JS:');
  Array.from(new Set(apis)).forEach((a) => console.log('  ', a));

  const pathMatches = res.html.match(/"\/gw\/[^"]+"/g) || res.html.match(/"\/api\/[^"]+"/g) || [];
  console.log('Path matches in chunk JS:');
  Array.from(new Set(pathMatches)).forEach((p) => console.log('  ', p));
}

test();
