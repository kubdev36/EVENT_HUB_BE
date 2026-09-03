const https = require('https');

function fetchJson(url) {
  return new Promise((resolve) => {
    https.get(url, { headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36' } }, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, json: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, raw: data.slice(0, 300) });
        }
      });
    }).on('error', () => resolve({ status: 500 }));
  });
}

async function test() {
  const endpoints = [
    'https://papi.fptshop.com.vn/gw/v1/public/store-front/news?category=tin-khuyen-mai&page=1&limit=20',
    'https://papi.fptshop.com.vn/gw/v1/public/store-front/news/tin-khuyen-mai?page=1&limit=20',
    'https://papi.fptshop.com.vn/gw/v1/public/fulltext-search-service/news?keyword=khuyen+mai',
  ];

  for (const ep of endpoints) {
    const res = await fetchJson(ep);
    console.log(`Endpoint: ${ep}\n  Status: ${res.status}, Output:`, res.json ? JSON.stringify(res.json).slice(0, 300) : res.raw);
  }
}

test();
