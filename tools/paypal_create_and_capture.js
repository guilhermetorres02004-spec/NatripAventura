const http = require('http');
function post(path, data, cb) {
  const d = JSON.stringify(data);
  const opts = { hostname: 'localhost', port: 3000, path, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(d) } };
  const req = http.request(opts, res => { let body=''; res.on('data', c=> body+=c); res.on('end', ()=> cb(null, res.statusCode, body)); });
  req.on('error', e=> cb(e)); req.write(d); req.end();
}

post('/api/paypal/create-order', { amount: '1.00' }, (err, status, body) => {
  if (err) return console.error('CREATE_ERR', err.message);
  console.log('CREATE_STATUS', status);
  let parsed;
  try { parsed = JSON.parse(body); } catch(e) { console.log('CREATE_BODY', body); return; }
  const orderID = parsed.id || (parsed.order && parsed.order.id);
  console.log('ORDER_ID', orderID);
  if (!orderID) return console.error('No order id');
  // attempt capture
  post('/api/paypal/capture-order', { orderID }, (err2, status2, body2) => {
    if (err2) return console.error('CAPTURE_ERR', err2.message);
    console.log('CAPTURE_STATUS', status2);
    try { console.log(JSON.parse(body2)); } catch(e) { console.log('CAPTURE_BODY', body2); }
  });
});
