const https = require('https');

function get(url) {
  return new Promise((resolve) => {
    https.get(url, { headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } }, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => resolve({ status: res.statusCode, data }));
    });
  });
}

async function run() {
  const feeds = [
    'https://cellphones.com.vn/sforum/tag/khuyen-mai/feed',
    'https://cellphones.com.vn/sforum/tag/uu-dai/feed',
    'https://cellphones.com.vn/sforum/tag/tin-khuyen-mai/feed',
    'https://cellphones.com.vn/sforum/tag/hàng-mới-về/feed',
    'https://cellphones.com.vn/sforum/feed',
  ];

  for (const f of feeds) {
    const res = await get(encodeURI(f));
    console.log(f, '=> STATUS:', res.status, 'LENGTH:', res.data.length);
    if (res.status === 200 && res.data.includes('<item>')) {
      const titles = (res.data.match(/<title>(.*?)<\/title>/g) || []).map((t) => t.replace(/<\/?title>/g, '').replace('<![CDATA[', '').replace(']]>', ''));
      console.log(' TITLES:', titles.slice(2, 8));
    }
  }
}

run();
