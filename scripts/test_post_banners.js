const fetch = require('node-fetch');
(async function(){
  try {
    const payload = { banners: [{ title: 'Teste', subtitle: 'Sub', category: 'test', image: '', link: '', orderIndex: 0, createdBy: 'admin@natrip.local', createdAt: new Date().toISOString() }] };
    const resp = await fetch('http://localhost:3000/api/banners/upsert', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    console.log('status:', resp.status);
    const txt = await resp.text();
    console.log('body:', txt);
  } catch (e) {
    console.error('error:', e.message || e);
    process.exit(1);
  }
})();
