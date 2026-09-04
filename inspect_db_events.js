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
  console.log('Database connected!');
  const events = await AppDataSource.query(`
    SELECT id, title, image, "eventDate", "sourceId", "rawData", "createdAt"
    FROM events
    ORDER BY "createdAt" DESC
    LIMIT 30
  `);

  console.log(`Found ${events.length} recent events:`);
  events.forEach((e, idx) => {
    console.log(`[${idx + 1}] Source: ${e.sourceId}`);
    console.log(`    Title: ${e.title}`);
    console.log(`    Image: ${e.image || 'NULL/EMPTY'}`);
    console.log(`    EventDate: ${e.eventDate}`);
    console.log(`    RawData:`, e.rawData ? JSON.stringify(e.rawData).slice(0, 100) : 'null');
    console.log('---');
  });

  const nullImages = events.filter(e => !e.image);
  console.log(`Summary: ${nullImages.length}/${events.length} events have NULL/EMPTY images.`);
  await AppDataSource.destroy();
}

run().catch(err => console.error(err));
