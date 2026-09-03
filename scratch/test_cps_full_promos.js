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

  const allItems = [];

  for (const pageUrl of targetUrls) {
    const { html } = await fetchHtml(pageUrl);
    const $ = cheerio.load(html);

    // 1. Extract block banners and promo links
    $('a[href], section, div[class*="banner"], div[class*="promo"], div[class*="item"]').each((_, el) => {
      const block = $(el);
      const href = block.attr('href') || block.find('a[href]').attr('href');
      let title =
        block.find('h1, h2, h3, h4, h5, p, span, div[class*="title"]').first().text().replace(/\s+/g, ' ').trim() ||
        block.attr('title') ||
        block.find('img').attr('alt') ||
        block.attr('aria-label') ||
        '';
      
      let img =
        block.find('img').attr('src') ||
        block.find('img').attr('data-src') ||
        block.find('source').attr('srcset') ||
        null;

      if (href && title.length > 5 && !title.includes('1800') && !title.includes('Cửa hàng') && !title.includes('Bảo hành')) {
        const fullUrl = href.startsWith('http') ? href : `https://cellphones.com.vn${href}`;
        allItems.push({ title, url: fullUrl, img });
      }
    });

    // 2. Extract Next.js JSON images & titles from inline scripts
    const scriptMatches = html.match(/\{[^{}]*"alt":\s*"([^"]+)"[^{}]*"src":\s*"([^"]+)"[^{}]*\}/gi) || [];
    scriptMatches.forEach((m) => {
      const alt = m.match(/"alt":\s*"([^"]+)"/)?.[1];
      const src = m.match(/"src":\s*"([^"]+)"/)?.[1];
      if (alt && alt.length > 5 && !alt.includes('logo') && !alt.includes('social') && !alt.includes('QR')) {
        allItems.push({ title: alt, url: pageUrl, img: src });
      }
    });
  }

  // Deduplicate
  const unique = [];
  const seen = new Set();
  allItems.forEach((it) => {
    const key = `${it.title.toLowerCase()}|${it.url}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(it);
    }
  });

  console.log('Total extracted CellphoneS promo items:', unique.length);
  unique.forEach((it, idx) => {
    console.log(`${idx + 1}. [${it.title}]\n   URL: ${it.url}\n   Img: ${it.image || it.img}\n`);
  });
}

test();
