const { Client } = require('pg');

async function test() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: '030605',
    database: 'event_hub',
  });

  await client.connect();

  console.log('--- Checking current targetUrls in DB settings ---');
  const res = await client.query(`SELECT value FROM settings WHERE key = 'crawler_sources'`);
  if (res.rows.length > 0) {
    const sources = res.rows[0].value;
    sources.forEach((s) => {
      console.log(`Source: [${s.name}] (${s.id}) => URLs:`, s.targetUrls);
    });
  }

  await client.end();
}

test();
