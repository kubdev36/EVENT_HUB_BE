const https = require('https');
const zlib = require('zlib');
const cheerio = require('cheerio');

function fetchUrl(url, acceptGzip = false) {
  return new Promise((resolve) => {
    const headers = {
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    };
    if (acceptGzip) headers['accept-encoding'] = 'gzip, deflate';

    https.get(url, { headers }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        const encoding = res.headers['content-encoding'];
        if (encoding === 'gzip') {
          zlib.gunzip(buf, (err, decoded) => {
            resolve({ url, status: res.statusCode, html: decoded ? decoded.toString() : buf.toString() });
          });
        } else if (encoding === 'deflate') {
          zlib.inflate(buf, (err, decoded) => {
            resolve({ url, status: res.statusCode, html: decoded ? decoded.toString() : buf.toString() });
          });
        } else {
          resolve({ url, status: res.statusCode, html: buf.toString() });
        }
      });
    });
  });
}

async function test() {
  // Fetch TGDD home JS with gzip support
  const jsUrl = 'https://cdn.tgdd.vn/tin-tuc/Scripts/desktop/home.min.v202508111220.js';
  const r = await fetchUrl(jsUrl, true);
  console.log(`TGDD JS Status: ${r.status}, Length: ${r.html.length}`);

  // Search for More function and AJAX patterns
  const lower = r.html.toLowerCase();
  const searchPatterns = [
    { term: 'function more', label: 'function More' },
    { term: 'more(', label: 'More(' },
    { term: 'viewmore', label: 'viewmore' },
    { term: 'loadmore', label: 'loadmore' },
    { term: '.ajax', label: '.ajax' },
    { term: 'pageindex', label: 'pageIndex' },
    { term: 'cateid', label: 'cateId' },
    { term: '/aj/', label: '/aj/' },
    { term: 'newsgrid', label: 'NewsGrid' },
  ];

  for (const { term, label } of searchPatterns) {
    let startIdx = 0;
    let count = 0;
    while (true) {
      const idx = lower.indexOf(term, startIdx);
      if (idx === -1 || count > 2) break;
      console.log(`\nPattern "${label}" at char ${idx}:`);
      console.log(`  ...${r.html.slice(Math.max(0, idx - 80), idx + 300)}...`);
      startIdx = idx + term.length;
      count++;
    }
  }
}

test();
