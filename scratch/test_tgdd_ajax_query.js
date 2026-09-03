const https = require('https');
const cheerio = require('cheerio');

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
    const payload = JSON.stringify(data);
    const options = {
      hostname: 'www.thegioididong.com',
      path: url,
      method: 'POST',
      headers: {
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'content-type': 'application/json; charset=UTF-8',
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
  // Find query variable on TGDD page
  const tgdd = await fetchUrl('https://www.thegioididong.com/tin-tuc');
  const $t = cheerio.load(tgdd.html);

  // Search ALL inline scripts for 'query =' or 'var query'
  $t('script').each((i, el) => {
    const text = $t(el).html() || '';
    // Search for query initialization patterns
    const patterns = ['query=', 'query =', 'var query', 'query={', 'query = {', 'Index:', 'CateId:'];
    for (const p of patterns) {
      const idx = text.indexOf(p);
      if (idx !== -1) {
        console.log(`Script ${i}: Pattern "${p}" at char ${idx}:`);
        console.log(`  ...${text.slice(Math.max(0, idx - 30), idx + 200)}...\n`);
      }
    }
  });

  // Test with form-urlencoded and various query params
  console.log('\n=== Testing different query params ===');

  const queries = [
    { Index: 1 },
    { Index: 2 },
    { Index: 1, CateId: 31 },
    { Index: 2, CateId: 31 },
  ];

  for (const q of queries) {
    const payload = new URLSearchParams(q).toString();
    const res = await new Promise((resolve) => {
      const options = {
        hostname: 'www.thegioididong.com',
        path: '/tin-tuc/aj/Home/Box',
        method: 'POST',
        headers: {
          'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'content-length': Buffer.byteLength(payload),
          'x-requested-with': 'XMLHttpRequest',
          'referer': 'https://www.thegioididong.com/tin-tuc',
        },
      };
      const req = https.request(options, (r) => {
        let body = '';
        r.on('data', (c) => (body += c));
        r.on('end', () => resolve({ status: r.statusCode, body }));
      });
      req.write(payload);
      req.end();
    });

    const $c = cheerio.load(res.body);
    const ids = [];
    $c('li[data-id]').each((_, el) => ids.push($c(el).attr('data-id')));
    console.log(`Query ${JSON.stringify(q)}: Status=${res.status}, Len=${res.body.length}, Items=${ids.length}, IDs=${ids.slice(0, 5).join(',')}`);
  }
}

test();
