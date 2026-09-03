const { Client } = require('pg');
const client = new Client({
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  password: '030605',
  database: 'event_hub',
});

client.connect()
  .then(() => client.query('SELECT COUNT(*) as count FROM events'))
  .then((r) => {
    console.log('Total events:', r.rows[0].count);
    return client.query('SELECT id, title, "eventDate", "eventTime", type, "sourceId" FROM events ORDER BY "createdAt" DESC LIMIT 20');
  })
  .then((r) => {
    console.log(JSON.stringify(r.rows, null, 2));
    return client.end();
  })
  .catch((e) => {
    console.error('Error:', e.message);
    process.exit(1);
  });