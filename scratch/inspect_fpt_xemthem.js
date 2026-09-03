const https = require('https');
const cheerio = require('cheerio');

function fetchUrl(url) {
  return new Promise((resolve) => {
    https.get(url, { headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36' } }, (res) => {
      let html = '';
      res.on('data', (c) => (html += c));
      res.on('end', () => resolve({ url, status: res.statusCode, html }));
    });
  });
}

async function test() {
  const url = 'https://fptshop.com.vn/tin-tuc/tin-khuyen-mai';
  const res = await fetchUrl(url);
  console.log(`FPT Status: ${res.status}, Length: ${res.html.length}`);

  const $ = cheerio.load(res.html);

  console.log('--- Searching for Next.js / Nuxt data script tags ---');
  $('script').each((i, el) => {
    const text = $(el).html() || '';
    if (text.includes('__NEXT_DATA__') || text.includes('self.__next_f') || text.includes('tin-khuyen-mai')) {
      console.log(`Script ${i + 1} contains data! Length: ${text.length}`);
    }
  });

  console.log('\n--- Extracting ALL links starting with /tin-tuc/tin-khuyen-mai/ ---');
  const promoLinks = new Map();
  $('a[href*="/tin-tuc/tin-khuyen-mai/"]').each((_, el) => {
    const href = $(el).attr('href');
    const title = $(el).text().replace(/\s+/g, ' ').trim();
    if (href && !href.includes('tin-khuyen-mai?')) {
      const fullUrl = href.startsWith('http') ? href : `https://fptshop.com.vn${href}`;
      if (!promoLinks.has(fullUrl) || promoLinks.get(fullUrl).length < title.length) {
        promoLinks.set(fullUrl, title);
      }
    }
  });

  console.log(`Found ${promoLinks.size} unique FPT promo links on main page HTML:`);
  Array.from(promoLinks.entries()).forEach(([u, t], idx) => {
    console.log(`${idx + 1}. [${t || 'NO TITLE'}] => ${u}`);
  });

  // Test FPT Shop news API endpoints
  console.log('\n--- Testing FPT Shop API endpoints ---');
  const apiUrls = [
    'https://fptshop.com.vn/api-tin-tuc/news/get-news-by-category?slug=tin-khuyen-mai&page=1&pageSize=30',
    'https://fptshop.com.vn/api-tin-tuc/news/list?category=tin-khuyen-mai&page=1&limit=30',
    'https://fptshop.com.vn/_next/data/latest/tin-tuc/tin-khuyen-mai.json',
  ];

  for (const apiUrl of apiUrls) {
    const apiRes = await fetchUrl(apiUrl);
    console.log(`API [${apiUrl}] => Status: ${apiRes.status}, Length: ${apiRes.html.length}`);
    if (apiRes.status === 200 && apiRes.html.length > 50) {
      console.log('API Sample Output:', apiRes.html.slice(0, 300));
    }
  }
}

test();
