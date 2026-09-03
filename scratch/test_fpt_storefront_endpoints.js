const https = require('https');

function fetchJson(url) {
  return new Promise((resolve) => {
    https.get(url, { headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36' } }, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => resolve({ status: res.statusCode, body }));
    }).on('error', () => resolve({ status: 500, body: '' }));
  });
}

async function test() {
  const base = 'https://papi.fptshop.com.vn/gw/v1/public/store-front';
  const paths = [
    '/news-categories',
    '/news-list',
    '/news',
    '/news/list',
    '/news/category?slug=tin-khuyen-mai',
    '/news/category/tin-khuyen-mai',
    '/landing-page/tin-khuyen-mai',
    '/post/tin-khuyen-mai',
    '/posts',
  ];

  for (const p of paths) {
    const res = await fetchJson(`${base}${p}`);
    console.log(`Endpoint: [${p}] Status: ${res.status}, Length: ${res.body.length}`);
    if (res.status === 200) {
      console.log('  DATA:', res.body.slice(0, 300));
    }
  }
}

test();
