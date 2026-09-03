const { Client } = require('pg');

function stripAuthor(title) {
  if (!title) return '';
  let cleaned = title
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const authorRegex = /^(nguyễn\s+[a-zà-ỹ\s]{2,15}|lê\s+[a-zà-ỹ\s]{2,15}|trần\s+[a-zà-ỹ\s]{2,15}|phạm\s+[a-zà-ỹ\s]{2,15}|võ\s+[a-zà-ỹ\s]{2,15}|đặng\s+[a-zà-ỹ\s]{2,15}|bùi\s+[a-zà-ỹ\s]{2,15}|nam\s+anh|hải\s+nam|hải\s+trần|công\s+minh|hoàng\s+[a-zà-ỹ\s]{2,15})\s+/i;

  if (authorRegex.test(cleaned)) {
    const stripped = cleaned.replace(authorRegex, '').trim();
    if (stripped.length >= 8) {
      cleaned = stripped;
    }
  }

  return cleaned;
}

async function cleanDb() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: '030605',
    database: 'event_hub',
  });

  await client.connect();

  console.log('--- Cleaning Garbage / Company Intro / Terms links from DB ---');
  const deleteRes = await client.query(`
    DELETE FROM events 
    WHERE LOWER(title) LIKE '%trang chủ%' 
       OR LOWER(title) LIKE '%trang chu%'
       OR LOWER(title) LIKE '%giới thiệu về công ty%'
       OR LOWER(title) LIKE '%giới thiệu công ty%'
       OR LOWER(title) LIKE '%quy chế%'
       OR LOWER(title) LIKE '%câu hỏi thường gặp%'
       OR LOWER(title) LIKE '%tra cứu%'
       OR LOWER(title) LIKE '%quy trình%'
       OR LOWER(title) LIKE '%các điều kiện%'
       OR LOWER(title) LIKE '%dự án doanh nghiệp%'
       OR LOWER(title) LIKE '%hướng dẫn mua hàng%'
       OR LOWER(title) LIKE '%đại lý uỷ quyền%'
       OR LOWER(title) LIKE '%danh sách người có ảnh hưởng%'
       OR LOWER(title) LIKE '%quy định về%'
       OR LENGTH(title) < 8;
  `);
  console.log(`Deleted ${deleteRes.rowCount} noise/garbage rows.`);

  console.log('--- Stripping author names from Hoàng Hà titles in DB ---');
  const res = await client.query('SELECT id, title FROM events;');
  let updatedCount = 0;
  for (const row of res.rows) {
    const clean = stripAuthor(row.title);
    if (clean !== row.title) {
      await client.query('UPDATE events SET title = $1 WHERE id = $2;', [clean, row.id]);
      updatedCount++;
    }
  }
  console.log(`Stripped author names for ${updatedCount} events.`);

  await client.end();
}

cleanDb();
