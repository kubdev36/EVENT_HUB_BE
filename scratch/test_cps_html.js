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
  const { html } = await fetchHtml('https://cellphones.com.vn/danh-sach-khuyen-mai');
  console.log('HTML Length:', html.length);

  // Check if __NUXT__ window state exists
  const nuxtMatch = html.match(/window\.__NUXT__\s*=\s*([\s\S]*?);?\s*<\/script>/);
  if (nuxtMatch) {
    console.log('__NUXT__ script found! Length:', nuxtMatch[1].length);
    // Find all titles, images, urls inside __NUXT__ state
    const matches = html.match(/"title":"([^"]+)".*?"image":"([^"]+)".*?"link":"([^"]+)"/g) || [];
    console.log('Nuxt promo matches count:', matches.length);
  }

  const $ = cheerio.load(html);
  const links = [];
  $('a[href]').each((_, el) => {
    const a = $(el);
    const href = a.attr('href');
    const title = a.text().replace(/\s+/g, ' ').trim() || a.find('img').attr('alt') || a.attr('title');
    const img = a.find('img').attr('src') || a.find('img').attr('data-src');
    if (href && (href.includes('uu-dai') || href.includes('khuyen-mai') || href.includes('smember') || href.includes('s-student') || href.includes('tra-gop'))) {
      links.push({ title, href, img });
    }
  });

  console.log('Cheerio found promo links:', links.length);
  links.forEach((l, idx) => {
    console.log(`${idx + 1}. [${l.title || 'No Title'}] => ${l.href} (Img: ${l.img})`);
  });
}

test();
