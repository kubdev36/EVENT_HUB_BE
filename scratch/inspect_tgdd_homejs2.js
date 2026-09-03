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
  const jsUrl = 'https://cdn.tgdd.vn/tin-tuc/Scripts/desktop/home.min.v202508111220.js';
  const r = await fetchUrl(jsUrl);

  // Case insensitive search
  const lower = r.html.toLowerCase();
  const patterns = ['more', 'viewmore', 'ajax', 'xem', 'load', 'page', 'cateid', 'catid', 'newsid', 'newsgrid'];
  for (const p of patterns) {
    const idx = lower.indexOf(p);
    if (idx !== -1) {
      console.log(`Pattern "${p}" at char ${idx}:`);
      console.log(`  Context: ...${r.html.slice(Math.max(0, idx - 50), idx + 200)}...\n`);
    }
  }

  // Also dump the first 2000 chars to understand the JS structure
  console.log('\n--- First 1000 chars ---');
  console.log(r.html.slice(0, 1000));
}

test();
