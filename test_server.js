// Script para testar o servidor e a API
// Usage: node test_server.js [URL]
// Exemplo: node test_server.js https://natrip-aventura.onrender.com

const fetch = require('node-fetch');

const BASE_URL = process.argv[2] || 'http://localhost:3000';

console.log('='.repeat(60));
console.log('Testando servidor NatripAventura');
console.log('URL:', BASE_URL);
console.log('='.repeat(60));
console.log('');

async function testEndpoint(name, url, options = {}) {
  try {
    console.log(`🔍 Testando ${name}...`);
    const response = await fetch(url, options);
    const contentType = response.headers.get('content-type');
    
    let data;
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }
    
    if (response.ok) {
      console.log(`   ✅ OK (${response.status})`);
      if (typeof data === 'object') {
        console.log('   Resposta:', JSON.stringify(data, null, 2).substring(0, 200));
      }
    } else {
      console.log(`   ❌ Erro (${response.status})`);
      console.log('   Erro:', data);
    }
    console.log('');
    return { success: response.ok, status: response.status, data };
  } catch (error) {
    console.log(`   ❌ Falha na conexão`);
    console.log('   Erro:', error.message);
    console.log('');
    return { success: false, error: error.message };
  }
}

async function runTests() {
  // Test 1: Health check
  await testEndpoint('Health Check', `${BASE_URL}/health`);
  
  // Test 2: Home page
  await testEndpoint('Home Page', `${BASE_URL}/`);
  
  // Test 3: Get trips
  await testEndpoint('GET /api/trips', `${BASE_URL}/api/trips`);
  
  // Test 4: Get banners
  await testEndpoint('GET /api/banners', `${BASE_URL}/api/banners`);
  
  // Test 5: Get users (may require auth)
  await testEndpoint('GET /api/users', `${BASE_URL}/api/users`);
  
  // Test 6: Login with admin
  const loginResult = await testEndpoint('POST /api/login (admin)', `${BASE_URL}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'admin@natrip.local',
      password: 'capela9797@'
    })
  });
  
  if (loginResult.success) {
    console.log('✅ Login funcionando! Usuário admin existe.');
  } else {
    console.log('⚠️  Login falhou. Verifique se o banco de dados foi inicializado.');
  }
  
  console.log('');
  console.log('='.repeat(60));
  console.log('Teste concluído!');
  console.log('='.repeat(60));
}

runTests().catch(console.error);
