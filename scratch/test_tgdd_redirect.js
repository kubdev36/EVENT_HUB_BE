const https = require('https');
const cheerio = require('cheerio');

function fetchWithRedirect(url, maxRedirects = 5) {
  return new Promise((resolve) => {
    https.get(url, { headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const nextUrl = new URL(res.headers.location, url).toString();
        console.log(`Redirecting [${res.statusCode}] ${url} => ${nextUrl}`);
        if (maxRedirects > 0) return resolve(fetchWithRedirect(nextUrl, maxRedirects - 1));
      }
      let html = '';
      res.on('data', (c) => (html += c));
      res.on('end', () => resolve({ url, status: res.statusCode, html }));
    });
  });
}

async function test() {
  const res = await fetchWithRedirect('https://www.thegioididong.com/tin-tuc/tin-khuyen-mai');
  console.log(`Final URL: ${res.url}, Status: ${res.status}, Length: ${res.html.length}`);

  const $ = cheerio.load(res.html);
  const items = [];
  $('a[href*="/tin-tuc/"]').each((_, el) => {
    const a = $(el);
    const href = a.attr('href');
    const title = a.text().replace(/\s+/g, ' ').trim();
    const img = a.find('img').attr('data-src') || a.find('img').attr('src') || a.parent().find('img').attr('data-src') || a.parent().find('img').attr('src');
    if (href && title.length > 10) {
      items.push({ title, href, img });
    }
  });

  console.log(`TGDD Final Page Extracted Items: ${items.length}`);
  items.slice(0, 10).forEach((it, i) => console.log(`${i + 1}. [${it.title}] => ${it.href} (Img: ${it.img})`));
}

test();
