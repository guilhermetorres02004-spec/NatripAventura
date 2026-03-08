const http = require('http');
const data = JSON.stringify({ amount: '1.00' });
const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/paypal/create-order',
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
    console.log('BODY_LENGTH', body.length);
    const preview = body.slice(0, 2000);
    console.log('BODY_PREVIEW:', preview);
    try { const parsed = JSON.parse(body); console.log('ORDER_ID:', parsed.id || (parsed.order && parsed.order.id)); } catch(e) { /* ignore */ }
  });
});
req.on('error', e => { console.error('ERR', e.message); process.exit(1); });
req.write(data);
req.end();

// after creating order, attempt capture (may fail without payer approval)
setTimeout(() => {
  const createdBody = require('fs').readFileSync('./tools/last_order_id.txt', 'utf8').trim();
  if (!createdBody) return;
  const orderID = createdBody;
  const data2 = JSON.stringify({ orderID });
  const opts2 = { hostname: 'localhost', port: 3000, path: '/api/paypal/capture-order', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data2) } };
  const r2 = http.request(opts2, res2 => {
    let b2=''; res2.on('data', c=>b2+=c); res2.on('end', ()=>{ console.log('CAPTURE_STATUS', res2.statusCode); console.log('CAPTURE_BODY_PREVIEW', b2.slice(0,1000)); });
  });
  r2.on('error', e=>console.error('CAP_ERR', e.message));
  r2.write(data2); r2.end();
}, 800);
