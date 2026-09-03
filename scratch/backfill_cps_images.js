const { Client } = require('pg');
const https = require('https');
const cheerio = require('cheerio');

function fetchOgImage(url) {
  return new Promise((resolve) => {
    https.get(url, { headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36' } }, (res) => {
      let html = '';
      res.on('data', (c) => (html += c));
      res.on('end', () => {
        try {
          const $ = cheerio.load(html);
          const og = $('meta[property="og:image"]').attr('content') || $('meta[name="twitter:image"]').attr('content') || $('img').eq(1).attr('src');
          resolve(og || null);
        } catch {
          resolve(null);
        }
      });
    }).on('error', () => resolve(null));
  });
}

async function backfill() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: '030605',
    database: 'event_hub',
  });

  await client.connect();
  const res = await client.query('SELECT id, url, title, image FROM events WHERE "sourceId" = \'cellphones\' AND (image IS NULL OR image = \'\');');
  console.log(`Backfilling images for ${res.rows.length} CellphoneS events...`);

  for (const row of res.rows) {
    const img = await fetchOgImage(row.url);
    if (img) {
      console.log(`[UPDATED] ${row.title} => ${img}`);
      await client.query('UPDATE events SET image = $1 WHERE id = $2;', [img, row.id]);
    } else {
      console.log(`[NO OG] ${row.title}`);
    }
  }

  // Delete 'Trang chủ' or short garbage titles from DB
  await client.query("DELETE FROM events WHERE LOWER(title) LIKE '%trang chủ%' OR LOWER(title) LIKE '%trang chu%' OR LENGTH(title) < 8;");

  console.log('Backfill finished successfully!');
  await client.end();
}

backfill();
