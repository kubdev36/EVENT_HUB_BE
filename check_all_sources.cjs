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
  
  const sources = await AppDataSource.query(`
    SELECT "sourceId", COUNT(*) as total, 
           COUNT(image) as with_image,
           COUNT(*) - COUNT(image) as null_image
    FROM events
    GROUP BY "sourceId"
  `);
  console.log('--- EVENT IMAGE SUMMARY BY SOURCE ---');
  console.table(sources);

  const sampleNullImages = await AppDataSource.query(`
    SELECT id, title, image, "sourceId", "url", "eventDate"
    FROM events
    WHERE image IS NULL OR image = '' OR image LIKE 'data:image%'
    LIMIT 15
  `);
  console.log(`\n--- SAMPLE 15 EVENTS WITH MISSING/INVALID IMAGES (${sampleNullImages.length} found) ---`);
  sampleNullImages.forEach((e, idx) => {
    console.log(`[${idx + 1}] Source: ${e.sourceId}`);
    console.log(`    Title: ${e.title}`);
    console.log(`    URL: ${e.url}`);
    console.log(`    Image: '${e.image}'`);
    console.log(`    EventDate: ${e.eventDate}`);
  });

  const sampleNullDates = await AppDataSource.query(`
    SELECT id, title, "sourceId", "eventDate", "createdAt"
    FROM events
    ORDER BY "createdAt" DESC
    LIMIT 15
  `);
  console.log('\n--- RECENT 15 EVENT DATES ---');
  sampleNullDates.forEach((e, idx) => {
    console.log(`[${idx + 1}] Source: ${e.sourceId} | Date: ${e.eventDate} | Created: ${e.createdAt}`);
    console.log(`    Title: ${e.title}`);
  });

  await AppDataSource.destroy();
}

run().catch(err => console.error(err));
