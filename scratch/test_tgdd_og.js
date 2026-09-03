const https = require('https');
const cheerio = require('cheerio');

function fetchOgImage(url) {
  return new Promise((resolve) => {
    https.get(url, { headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36' } }, (res) => {
      let html = '';
      res.on('data', (c) => (html += c));
      res.on('end', () => {
        try {
          const $ = cheerio.load(html);
          const og = $('meta[property="og:image"]').attr('content') || $('meta[name="twitter:image"]').attr('content') || $('img').eq(1).attr('src');
          resolve(og || null);
        } catch {
          resolve(null);
        }
      });
    }).on('error', () => resolve(null));
  });
}

async function test() {
  const urls = [
    'https://www.thegioididong.com/tin-tuc/hotsale-mo-ban-poco-f9-ultra-1597906',
    'https://www.thegioididong.com/tin-tuc/thu-tai-cung-galaxy-s26-fe-san-qua-cuc-khung-1597866',
    'https://www.thegioididong.com/tin-tuc/back-to-school-nhieu-laptop-msi-gia-tot-1597901',
    'https://www.thegioididong.com/tin-tuc/mo-ban-micro-thu-am-jbl-mic-mini-duo-gia-tu-3-99-trieu-1597873',
  ];

  for (const u of urls) {
    const img = await fetchOgImage(u);
    console.log(`[TGDD OG] ${u} => ${img}`);
  }
}

test();
