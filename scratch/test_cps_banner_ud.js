const https = require('https');

function getJson(url) {
  return new Promise((resolve) => {
    https.get(url, { headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', accept: 'application/json, text/plain, */*' } }, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, json: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, data: data.slice(0, 300) });
        }
      });
    }).on('error', (err) => resolve({ error: err.message }));
  });
}

async function test() {
  const bannerUds = [
    'sinhvien_km',
    'ds_km_uu_dai_the',
    'ds_km_mo_the',
    'ds_km_mua_truoc_tra_sau',
    'ds_km_vi_dien_tu',
    'ds_km_deal_hot',
  ];

  for (const ud of bannerUds) {
    const url = `https://cellphones.com.vn/api/v2/banner/get-banner-ud?banner_ud=${ud}`;
    const res = await getJson(url);
    console.log(`\n================ Ud [${ud}] (Status: ${res.status}) ================`);
    if (res.json) {
      console.log('JSON structure:', JSON.stringify(res.json).slice(0, 400));
    } else {
      console.log('Text:', res.data);
    }
  }
}

test();
