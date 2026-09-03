const https = require('https');

function postJson(url, payload) {
  return new Promise((resolve) => {
    const data = JSON.stringify(payload);
    const req = https.request(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(data),
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      },
    }, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, json: JSON.parse(body) });
        } catch {
          resolve({ status: res.statusCode, body: body.slice(0, 300) });
        }
      });
    });
    req.on('error', (err) => resolve({ error: err.message }));
    req.write(data);
    req.end();
  });
}

function getJson(url) {
  return new Promise((resolve) => {
    https.get(url, { headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } }, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, json: JSON.parse(body) });
        } catch {
          resolve({ status: res.statusCode, body: body.slice(0, 300) });
        }
      });
    });
  });
}

async function test() {
  // Test GraphQL
  const gql = await postJson('https://cellphones.com.vn/graphql', { query: '{ __typename }' });
  console.log('GraphQL test status:', gql.status, gql.json || gql.body);

  // Test api.cellphones.com.vn
  const apiGql = await postJson('https://api.cellphones.com.vn/v2/graphql', { query: '{ __typename }' });
  console.log('api.cellphones.com.vn GraphQL status:', apiGql.status, apiGql.json || apiGql.body);

  // Search JS chunk files in next.js
  const jsChunk = await getJson('https://cellphones.com.vn/_next/static/chunks/f8025e75-faf90b4d3e75731b.js');
  console.log('JS chunk status:', jsChunk.status);
  if (jsChunk.body) {
    const urls = jsChunk.body.match(/https?:\/\/[^\s"']+/gi) || [];
    console.log('URLs in chunk:', urls.slice(0, 10));
  }
}

test();
