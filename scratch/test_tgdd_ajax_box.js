const https = require('https');
const zlib = require('zlib');
const cheerio = require('cheerio');

function fetchGzip(url) {
  return new Promise((resolve) => {
    https.get(url, { headers: { 'user-agent': 'Mozilla/5.0', 'accept-encoding': 'gzip, deflate' } }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        if (res.headers['content-encoding'] === 'gzip') {
          zlib.gunzip(buf, (_, d) => resolve(d ? d.toString() : buf.toString()));
        } else {
          resolve(buf.toString());
        }
      });
    });
  });
}

function fetchUrl(url) {
  return new Promise((resolve) => {
    https.get(url, { headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } }, (res) => {
      let html = '';
      res.on('data', (c) => (html += c));
      res.on('end', () => resolve({ status: res.statusCode, html }));
    });
  });
}

function postAjax(url, data) {
  return new Promise((resolve) => {
    const payload = new URLSearchParams(data).toString();
    const options = {
      hostname: 'www.thegioididong.com',
      path: url,
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
  // First find query initialization on TGDD page
  const tgdd = await fetchUrl('https://www.thegioididong.com/tin-tuc');
  const $t = cheerio.load(tgdd.html);

  // Search inline scripts for 'query' variable initialization
  $t('script').each((i, el) => {
    const text = $t(el).html() || '';
    if (text.includes('query') && text.includes('Index') && text.includes('CateId')) {
      console.log(`Script ${i} contains query init! Snippet:`);
      const idx = text.indexOf('query');
      console.log(text.slice(Math.max(0, idx - 20), idx + 300));
    }
  });

  // Try calling the AJAX endpoint directly
  console.log('\n=== Testing POST /tin-tuc/aj/Home/Box ===');
  for (let idx = 0; idx <= 3; idx++) {
    const res = await postAjax('/tin-tuc/aj/Home/Box', { Index: idx, CateId: 0 });
    console.log(`\nPage ${idx}: Status=${res.status}, Length=${res.body.length}`);
    if (res.status === 200 && res.body.length > 100) {
      const $c = cheerio.load(res.body);
      const links = [];
      $c('a[href]').each((_, a) => {
        const href = $c(a).attr('href');
        const title = $c(a).text().replace(/\s+/g, ' ').trim();
        if (href && title.length > 10 && href.includes('/tin-tuc/')) {
          links.push({ title: title.slice(0, 60), href });
        }
      });
      console.log(`  Found ${links.length} article links`);
      links.slice(0, 3).forEach((l, i) => console.log(`    ${i + 1}. [${l.title}] => ${l.href}`));
    }
  }
}

test();
