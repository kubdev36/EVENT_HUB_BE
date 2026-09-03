const https = require('https');
const cheerio = require('cheerio');

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
  const targetUrls = [
    'https://cellphones.com.vn/danh-sach-khuyen-mai',
    'https://cellphones.com.vn/uu-dai-smember',
    'https://cellphones.com.vn/uu-dai-doi-tac',
    'https://cellphones.com.vn/dich-vu-khach-hang-doanh-nghiep',
  ];

  for (const u of targetUrls) {
    const { html } = await fetchHtml(u);
    const $ = cheerio.load(html);

    console.log(`\n================ PAGE: ${u} ================`);
    $('a[href]').each((_, el) => {
      const a = $(el);
      const href = a.attr('href');
      const text = a.text().replace(/\s+/g, ' ').trim() || a.attr('title') || a.find('img').attr('alt') || '';
      const img = a.find('img').attr('src') || a.find('img').attr('data-src') || '';
      
      if (href && text.length > 5 && !href.includes('tel:') && !href.includes('mobile.html') && !href.includes('tuyendung') && !href.includes('smember.com.vn/order')) {
        console.log(`- [${text}] => ${href} (img: ${img || 'None'})`);
      }
    });
  }
}

test();
