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
  // Fetch the TGDD home.min JS
  const jsUrl = 'https://cdn.tgdd.vn/tin-tuc/Scripts/desktop/home.min.v202508111220.js';
  const r = await fetchUrl(jsUrl);
  console.log(`TGDD JS Status: ${r.status}, Length: ${r.html.length}`);

  // Search for More function, viewmore, and ajax calls
  const patterns = ['function More', 'More(', 'viewmore', '.ajax(', 'NewsGrid', 'loadmore', 'pageIndex', 'pageSize', '/aj/', 'cateId'];
  for (const p of patterns) {
    const idx = r.html.indexOf(p);
    if (idx !== -1) {
      console.log(`\nPattern "${p}" at char ${idx}:`);
      console.log(`  Context: ...${r.html.slice(Math.max(0, idx - 100), idx + 300)}...`);
    }
  }
}

test();
