const https = require('https');
const fs = require('fs');

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
  const { html } = await fetchHtml('https://cellphones.com.vn/danh-sach-khuyen-mai');
  fs.writeFileSync('scratch/cps_page.html', html);

  // Search for API endpoints or promo data in script tags
  const scripts = html.match(/<script[\s\S]*?<\/script>/gi) || [];
  console.log('Total script tags:', scripts.length);

  scripts.forEach((s, idx) => {
    if (s.includes('http') || s.includes('api') || s.includes('promotion') || s.includes('khuyen-mai') || s.includes('banner')) {
      console.log(`Script #${idx}:`, s.slice(0, 300));
    }
  });

  // Search for API URLs inside HTML
  const apiMatches = html.match(/https?:\/\/[^\s"'<>]*(?:api|promotion|banner|khuyen-mai)[^\s"'<>]*/gi) || [];
  console.log('\nFound API/Data URLs:', [...new Set(apiMatches)]);
}

test();
