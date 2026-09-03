const { Client } = require('pg');

async function test() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: '030605',
    database: 'event_hub',
  });

  try {
    await client.connect();
    const res = await client.query('SELECT id, "sourceId", title, image, url FROM events WHERE "sourceId" = \'cellphones\' ORDER BY "createdAt" DESC LIMIT 35;');
    console.log(`Found ${res.rows.length} CellphoneS events in DB:`);
    res.rows.forEach((r, i) => {
      console.log(`${i + 1}. [${r.title}]\n   Image: ${r.image || 'NULL'}\n   URL: ${r.url}\n`);
    });
  } catch (err) {
    console.error('DB Error:', err.message);
  } finally {
    await client.end();
  }
}

test();
