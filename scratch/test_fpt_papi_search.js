const https = require('https');

function fetchJson(url) {
  return new Promise((resolve) => {
    https.get(url, { headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36' } }, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, json: JSON.parse(body) });
        } catch {
          resolve({ status: res.statusCode, raw: body.slice(0, 300) });
        }
      });
    }).on('error', () => resolve({ status: 500 }));
  });
}

async function test() {
  const endpoints = [
    'https://papi.fptshop.com.vn/gw/v1/public/fulltext-search-service/v1/public/news/search?keyword=khuyen+mai&page=1&limit=50',
    'https://papi.fptshop.com.vn/gw/v1/public/fulltext-search-service/v1/public/news?category=tin-khuyen-mai&page=1&limit=50',
    'https://papi.fptshop.com.vn/gw/v1/public/store-front/v1/public/news/category/tin-khuyen-mai?page=1&limit=50',
    'https://fptshop.com.vn/api/news/get-list?category=tin-khuyen-mai&page=1&limit=50',
    'https://fptshop.com.vn/api/news/list?category=tin-khuyen-mai&page=2',
  ];

  for (const ep of endpoints) {
    const res = await fetchJson(ep);
    console.log(`Endpoint: [${ep}]\n  Status: ${res.status}, Output:`, res.json ? JSON.stringify(res.json).slice(0, 300) : res.raw);
  }
}

test();
