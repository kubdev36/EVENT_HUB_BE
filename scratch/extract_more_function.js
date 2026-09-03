const https = require('https');
const zlib = require('zlib');

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

async function test() {
  const js = await fetchGzip('https://cdn.tgdd.vn/tin-tuc/Scripts/desktop/home.min.v202508111220.js');

  // Find the query object initialization near More() function
  const moreIdx = js.indexOf('function More()');
  // Search backwards to find 'query' initialization
  const before = js.slice(Math.max(0, moreIdx - 2000), moreIdx);
  console.log('=== Code before More() function (last 2000 chars) ===');
  console.log(before);
  console.log('\n\n=== More() function body ===');
  console.log(js.slice(moreIdx, moreIdx + 600));
}

test();
