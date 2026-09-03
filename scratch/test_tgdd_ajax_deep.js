const https = require('https');
const cheerio = require('cheerio');

function postAjax(path, data) {
  return new Promise((resolve) => {
    const payload = new URLSearchParams(data).toString();
    const options = {
      hostname: 'www.thegioididong.com',
      path,
      method: 'POST',
      headers: {
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'content-length': Buffer.byteLength(payload),
        'x-requested-with': 'XMLHttpRequest',
        'referer': 'https://www.thegioididong.com/tin-tuc',
      },
    };
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', () => resolve({ status: 500, body: '' }));
    req.write(payload);
    req.end();
  });
}

async function test() {
  const allArticles = new Map();

  // ID=1169 is the main page category, Size=10, paginate with Index
  for (let idx = 0; idx <= 10; idx++) {
    const res = await postAjax('/tin-tuc/aj/Home/Box', { ID: 1169, Size: 10, Index: idx });
    if (res.status !== 200 || res.body.length < 100) {
      console.log(`Page ${idx}: EMPTY (Status=${res.status}, Len=${res.body.length}) - stopping`);
      break;
    }
    const $ = cheerio.load(res.body);
    let count = 0;
    $('li[data-id] a[href]').each((_, el) => {
      const href = $(el).attr('href');
      const title = $(el).text().replace(/\s+/g, ' ').trim();
      if (href && title.length > 10 && href.includes('/tin-tuc/')) {
        const fullUrl = `https://www.thegioididong.com${href}`;
        if (!allArticles.has(fullUrl)) {
          allArticles.set(fullUrl, title.slice(0, 80));
          count++;
        }
      }
    });
    console.log(`Page ${idx}: ${count} new articles (total: ${allArticles.size})`);
  }

  console.log(`\n===== TOTAL: ${allArticles.size} unique TGDD articles from AJAX =====`);
  Array.from(allArticles.entries()).slice(0, 20).forEach(([u, t], i) => {
    console.log(`${i + 1}. [${t}] => ${u}`);
  });
}

test();
