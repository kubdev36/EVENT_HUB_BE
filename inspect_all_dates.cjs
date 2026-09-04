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
    SELECT id, title, "eventDate", "sourceId", url, "rawData", "createdAt"
    FROM events
    ORDER BY "eventDate" DESC
    LIMIT 60
  `);

  console.log(`--- TOP 60 LATEST EVENT DATES IN DB ---`);
  events.forEach((e, idx) => {
    console.log(`[${idx + 1}] Source: ${e.sourceId} | Date: ${e.eventDate ? new Date(e.eventDate).toISOString().slice(0, 10) : 'null'}`);
    console.log(`     Title: ${e.title}`);
    console.log(`     URL: ${e.url}`);
    console.log('------------------------------------------------------');
  });

  await AppDataSource.destroy();
}

run();
