const https = require('https');
const cheerio = require('cheerio');

function requestUrl(url) {
  return new Promise((resolve) => {
    https.get(url, { headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36' } }, (res) => {
      let html = '';
      res.on('data', (c) => (html += c));
      res.on('end', () => resolve({ url, status: res.statusCode, headers: res.headers, html }));
    });
  });
}

async function test() {
  console.log('--- Checking TGDD Redirect ---');
  const tgddRes = await requestUrl('https://www.thegioididong.com/tin-tuc/tin-khuyen-mai');
  console.log('TGDD Location:', tgddRes.headers.location);

  const tgddReal = await requestUrl('https://www.thegioididong.com/tin-tuc/khuyen-mai');
  console.log(`TGDD Real URL Status: ${tgddReal.status}, Length: ${tgddReal.html.length}`);
  const $tgdd = cheerio.load(tgddReal.html);
  console.log('TGDD items count:', $tgdd('article, .item, .news-item, li.news, div.news-list a').length);
  $tgdd('a[href*="/tin-tuc/"]').each((i, el) => {
    if (i < 10) {
      const a = $tgdd(el);
      const img = a.find('img').attr('src') || a.find('img').attr('data-src') || a.parent().find('img').attr('data-src') || a.parent().find('img').attr('src');
      console.log(`TGDD Item ${i + 1}: ${a.text().trim()} => ${a.attr('href')} (Img: ${img})`);
    }
  });

  console.log('\n--- Checking FPT Shop Article Images ---');
  const fptRes = await requestUrl('https://fptshop.com.vn/tin-tuc/tin-khuyen-mai');
  const $fpt = cheerio.load(fptRes.html);
  console.log('FPT Articles found:');
  $fpt('a[href*="/tin-tuc/tin-khuyen-mai/"]').each((i, el) => {
    if (i < 10) {
      const a = $fpt(el);
      const parent = a.closest('div, article, li');
      const img = parent.find('img').attr('src') || parent.find('img').attr('data-src') || parent.find('img').attr('srcset') || parent.find('source').attr('srcset');
      console.log(`FPT Item ${i + 1}: ${a.text().replace(/\s+/g, ' ').trim()} => ${a.attr('href')}\n   Image: ${img}`);
    }
  });

  // Check how FPT Shop handles Load More ("Xem thêm")
  console.log('\n--- Checking FPT Shop "Xem thêm" / API ---');
  const fptApiRes = await requestUrl('https://fptshop.com.vn/api-tin-tuc/news/get-news-by-category?slug=tin-khuyen-mai&page=1&pageSize=20');
  console.log(`FPT API Status: ${fptApiRes.status}, Length: ${fptApiRes.html.length}`);
  if (fptApiRes.status === 200 && fptApiRes.html.startsWith('{')) {
    console.log('FPT API returned JSON!');
  }
}

test();
