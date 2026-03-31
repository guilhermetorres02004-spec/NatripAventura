const http = require('http');
const data = JSON.stringify({ name: 'Node Client', cpf: '12345678904', phone: '31966666666', email: 'nodeclient@example.com', password: 'secret123' });
const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/signup',
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
