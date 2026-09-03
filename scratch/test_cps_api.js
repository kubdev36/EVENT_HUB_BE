const https = require('https');

function getJson(url) {
  return new Promise((resolve) => {
    https.get(url, { headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', accept: 'application/json' } }, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, json: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, data: data.slice(0, 200) });
        }
      });
    }).on('error', (err) => resolve({ error: err.message }));
  });
}

async function test() {
  const endpoints = [
    'https://cellphones.com.vn/api/v2/promotion/list',
    'https://cellphones.com.vn/api/v2/promotion/danh-sach-khuyen-mai',
    'https://cellphones.com.vn/api/v2/banner/list',
    'https://cellphones.com.vn/api/v2/home/payment-promotion',
    'https://cellphones.com.vn/api/v2/home/flash-sale',
    'https://cellphones.com.vn/_next/data/latest/danh-sach-khuyen-mai.json',
  ];

  for (const ep of endpoints) {
    const res = await getJson(ep);
    console.log(`Endpoint [${ep}]: Status ${res.status || 'ERR'}`);
    if (res.json) {
      console.log('JSON keys:', Object.keys(res.json));
      if (res.json.data) console.log('Data preview:', JSON.stringify(res.json.data).slice(0, 300));
    } else if (res.data) {
      console.log('Text preview:', res.data);
    }
  }
}

test();
