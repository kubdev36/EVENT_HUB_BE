const https = require('https');
const http = require('http');
const cheerio = require('cheerio');

function fetchUrl(url) {
  return new Promise((resolve) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, { headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36' } }, (res) => {
      let html = '';
      res.on('data', (c) => (html += c));
      res.on('end', () => resolve({ url, status: res.statusCode, html }));
    }).on('error', () => resolve({ url, status: 500, html: '' }));
  });
}

async function test() {
  const sites = [
    {
      name: 'FPT Shop',
      url: 'https://fptshop.com.vn/tin-tuc/tin-khuyen-mai',
      pages: [
        'https://fptshop.com.vn/tin-tuc/tin-khuyen-mai',
        'https://fptshop.com.vn/tin-tuc/tin-khuyen-mai?page=2',
        'https://fptshop.com.vn/tin-tuc/tin-khuyen-mai?trang=2',
      ],
    },
    {
      name: 'CellphoneS',
      url: 'https://cellphones.com.vn/sforum/khuyen-mai-soc',
      pages: [
        'https://cellphones.com.vn/sforum/khuyen-mai-soc',
        'https://cellphones.com.vn/sforum/khuyen-mai-soc/page/2',
        'https://cellphones.com.vn/sforum/khuyen-mai-soc/page/3',
      ],
    },
    {
      name: 'Thế Giới Di Động',
      url: 'https://www.thegioididong.com/tin-tuc/tin-khuyen-mai',
      pages: [
        'https://www.thegioididong.com/tin-tuc/tin-khuyen-mai',
        'https://www.thegioididong.com/tin-tuc/tin-khuyen-mai/trang-2',
        'https://www.thegioididong.com/tin-tuc/tin-khuyen-mai/trang-3',
      ],
    },
  ];

  for (const site of sites) {
    console.log(`\n=================== ${site.name} ===================`);
    for (const pageUrl of site.pages) {
      const res = await fetchUrl(pageUrl);
      console.log(`Page: [${pageUrl}] Status: ${res.status}, Length: ${res.html.length}`);
      if (res.status === 200 && res.html.length > 1000) {
        const $ = cheerio.load(res.html);
        const items = [];
        $('a[href]').each((_, el) => {
          const href = $(el).attr('href');
          const title = $(el).text().replace(/\s+/g, ' ').trim() || $(el).find('h2, h3, h4, img').text().trim();
          const img = $(el).find('img').attr('src') || $(el).find('img').attr('data-src') || $(el).find('img').attr('data-original');
          if (href && title.length > 12 && !href.includes('javascript') && !href.includes('tel:')) {
            items.push({ title, href, img });
          }
        });
        console.log(`Extracted items count on [${pageUrl}]: ${items.length}`);
        items.slice(0, 5).forEach((it, idx) => console.log(`  ${idx + 1}. [${it.title}] => ${it.href} (Img: ${it.img || 'None'})`));
      }
    }
  }
}

test();
