const http = require('http');
const data = JSON.stringify({ users: [{ name: 'Upsert Test', cpf: '99999999999', phone: '31955555555', email: 'upserttest@example.com', password: 'pwd123', role: 'user' }] });
const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/users/upsert',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data)
  }
};
const req = http.request(options, res => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    console.log('STATUS', res.statusCode);
    console.log(body);
  });
});
req.on('error', e => { console.error('ERR', e.message); process.exit(1); });
req.write(data);
req.end();
