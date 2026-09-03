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
  const url = 'https://fptshop.com.vn/tin-tuc/tin-khuyen-mai';
  const res = await fetchUrl(url);

  console.log('--- Inspecting script tags for fetch / axios / API calls ---');
  const matches = res.html.match(/fetch\([^)]+\)|axios\.[a-z]+\([^)]+\)|\/api\/[^"'\s]+/gi) || [];
  console.log('Found fetch/axios/api matches:');
  Array.from(new Set(matches)).slice(0, 30).forEach((m) => console.log('  ', m));

  // Search for _next/data or Server Action IDs
  const serverActions = res.html.match(/\"[a-f0-9]{40}\"/gi) || [];
  console.log('\nServer actions count:', serverActions.length);

  // Search for any slug/category pagination endpoint pattern
  const pageMatches = res.html.match(/\"([^\"]*?page[^\"]*?)\"/gi) || [];
  console.log('\nPagination strings found in script:');
  Array.from(new Set(pageMatches)).slice(0, 20).forEach((p) => console.log('  ', p));
}

test();
