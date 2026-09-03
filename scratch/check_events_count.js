const { Client } = require('pg');

async function checkEventsCount() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: '030605',
    database: 'event_hub',
  });

  await client.connect();
  const res = await client.query(`
    SELECT "sourceId", "sourceName", COUNT(*) as total, COUNT(image) as with_image 
    FROM events 
    GROUP BY "sourceId", "sourceName";
  `);

  console.log('\n--- Events Count in Database ---');
  res.rows.forEach((r) => {
    console.log(`Brand: ${r.sourceName} (${r.sourceId}) => Total: ${r.total} events, With Image: ${r.with_image}`);
  });

  await client.end();
}

checkEventsCount();
