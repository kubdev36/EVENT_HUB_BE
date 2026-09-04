const { DataSource } = require('typeorm');
const dotenv = require('dotenv');
dotenv.config();

const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || '123456',
  database: process.env.DB_NAME || 'event_hub',
  synchronize: false,
});

async function run() {
  await AppDataSource.initialize();

  const events = await AppDataSource.query(`
    SELECT id, title, "eventDate", "sourceId", "url", "description", "rawData", "createdAt"
    FROM events
    WHERE title LIKE '%Redmi 17%' OR title LIKE '%redmi-17%' OR url LIKE '%redmi-17%'
  `);

  console.log('--- REDMI 17 EVENTS IN DB ---');
  events.forEach(e => {
    console.log('ID:', e.id);
    console.log('Title:', e.title);
    console.log('URL:', e.url);
    console.log('EventDate in DB:', e.eventDate);
    console.log('RawData:', JSON.stringify(e.rawData));
    console.log('Description:', e.description);
    console.log('---');
  });

  await AppDataSource.destroy();
}

run().catch(err => console.error(err));
