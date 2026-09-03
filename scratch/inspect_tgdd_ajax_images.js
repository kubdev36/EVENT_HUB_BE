const https = require('https');
const cheerio = require('cheerio');

function postAjax(path, data) {
  return new Promise((resolve) => {
    const payload = data;
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
      res.on('end', () => resolve(body));
    });
    req.write(payload);
    req.end();
  });
}

async function test() {
  const res = await postAjax('/tin-tuc/aj/Home/Box', 'ID=1169&Size=10&Index=0');
  const $ = cheerio.load(res);

  console.log('--- Inspecting TGDD AJAX response HTML for images ---');
  $('li[data-id]').each((i, el) => {
    const li = $(el);
    const title = li.find('a[href*="/tin-tuc/"]').first().text().replace(/\s+/g, ' ').trim().slice(0, 60);
    const imgs = [];
    li.find('img').each((_, img) => {
      const $img = $(img);
      imgs.push({
        src: $img.attr('src'),
        dataSrc: $img.attr('data-src'),
        dataOriginal: $img.attr('data-original'),
        lazySrc: $img.attr('data-lazy-src'),
        alt: $img.attr('alt'),
      });
    });
    console.log(`\nItem ${i + 1}: [${title}]`);
    console.log('  Images:', JSON.stringify(imgs));
  });
}

test();
