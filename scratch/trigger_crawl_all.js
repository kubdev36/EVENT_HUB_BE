const http = require('http');

function post(path) {
  return new Promise((resolve) => {
    const req = http.request(
      {
        host: 'localhost',
        port: 3000,
        path,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      },
      (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => resolve({ status: res.statusCode, body }));
      },
    );
    req.on('error', () => resolve({ status: 500, body: '' }));
    req.end();
  });
}

async function run() {
  console.log('Triggering POST /crawlers/run...');
  const res = await post('/crawlers/run');
  console.log(`Status: ${res.status}, Body: ${res.body.slice(0, 500)}`);
}

run();
