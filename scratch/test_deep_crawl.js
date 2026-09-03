const https = require('https');
const http = require('http');
const cheerio = require('cheerio');

function fetchUrl(url) {
  return new Promise((resolve) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, { headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const nextUrl = new URL(res.headers.location, url).toString();
        return resolve(fetchUrl(nextUrl));
      }
      let html = '';
      res.on('data', (c) => (html += c));
      res.on('end', () => resolve({ url, status: res.statusCode, html }));
    }).on('error', () => resolve({ url, status: 500, html: '' }));
  });
}

async function testDeepCrawl() {
  const targets = [
    { name: 'CellphoneS', base: 'https://cellphones.com.vn/sforum/khuyen-mai-soc' },
    { name: 'Hoàng Hà Mobile', base: 'https://hoanghamobile.com/tin-tuc/category/khuyen-mai/' },
    { name: 'FPT Shop', base: 'https://fptshop.com.vn/tin-tuc/tin-khuyen-mai' },
    { name: 'Thế Giới Di Động', base: 'https://www.thegioididong.com/tin-tuc/tin-khuyen-mai/31' },
  ];

  for (const t of targets) {
    console.log(`\n=================== Deep Crawling ${t.name} ===================`);
    const pages = [t.base];
    for (let p = 2; p <= 5; p++) {
      if (t.base.includes('?')) {
        pages.push(`${t.base}&page=${p}`);
      } else {
        pages.push(t.base.endsWith('/') ? `${t.base}page/${p}/` : `${t.base}/page/${p}/`);
        pages.push(t.base.endsWith('/') ? `${t.base}trang-${p}` : `${t.base}/trang-${p}`);
      }
    }

    const allLinks = new Map();
    for (const pageUrl of pages) {
      const res = await fetchUrl(pageUrl);
      if (res.status === 200 && res.html.length > 5000) {
        const $ = cheerio.load(res.html);
        $('a[href]').each((_, el) => {
          const href = $(el).attr('href');
          const title = $(el).text().replace(/\s+/g, ' ').trim();
          if (href && title.length > 10 && !href.includes('javascript:') && !href.includes('tel:')) {
            try {
              const fullUrl = new URL(href, pageUrl).toString().split('?')[0].replace(/\/$/, '');
              if (!allLinks.has(fullUrl)) {
                allLinks.set(fullUrl, title);
              }
            } catch {}
          }
        });
      }
    }

    console.log(`Total unique links collected across 5 pages for ${t.name}: ${allLinks.size}`);
    const sample = Array.from(allLinks.entries()).slice(0, 8);
    sample.forEach(([u, title], idx) => console.log(`  ${idx + 1}. [${title}] => ${u}`));
  }
}

testDeepCrawl();
