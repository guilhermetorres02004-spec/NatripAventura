# 🔄 Configuração Híbrida de Banco de Dados

## 📋 Visão Geral

O servidor agora detecta automaticamente o ambiente e usa o banco de dados apropriado:

- **Desenvolvimento Local**: SQLite (sem instalação necessária)
- **Produção (Render)**: PostgreSQL (gerenciado e persistente)

## ✅ Vantagens

- ✅ **Zero configuração local**: SQLite funciona instantaneamente
- ✅ **Produção robusta**: PostgreSQL garante persistência e performance
- ✅ **Mesmo código**: API funciona identicamente em ambos ambientes
- ✅ **Fácil deploy**: Render configura PostgreSQL automaticamente
- ✅ **Testes rápidos**: SQLite inicializa em milissegundos

## 🔧 Como Funciona

### Detecção Automática

O servidor verifica a variável `DATABASE_URL`:

```javascript
const USE_POSTGRES = !!process.env.DATABASE_URL;
```

- **Se DATABASE_URL existe** → PostgreSQL (Produção)
- **Se DATABASE_URL não existe** → SQLite (Local)

### Estrutura de Dados Idêntica

Ambos os bancos mantêm a mesma estrutura:
- Tabela `users` (com índices em email e referralCode)
- Tabela `trips` (com índices em date e category)
- Tabela `banners` (com índice em orderIndex)
- Usuário admin criado automaticamente

## 🖥️ Desenvolvimento Local

### 1. Iniciar Servidor

**Certifique-se que `DATABASE_URL` está comentado no `.env`:**

```env
# DATABASE_URL=postgresql://...  ← DEVE ESTAR COMENTADO
```

Inicie o servidor:

```bash
npm start
```

Você verá:
```
🗄️  Database mode: SQLite (Development)
✓ SQLite database opened at C:\...\db\natrip.db
Database tables initialized
Admin user created
🚀 Backend running on port 3000
📝 Database: SQLite (Development)
```

### 2. Verificar Saúde

```bash
curl http://localhost:3000/health
```

Resposta esperada:
```json
{
  "status": "ok",
  "database": "connected",
  "dbType": "SQLite",
  "timestamp": "2026-02-19T23:12:00.000Z",
  "version": "1.2.0"
}
```

### 3. Login de Teste

```bash
curl -X POST http://localhost:3000/api/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@natrip.local","password":"capela9797@"}'
```

### 4. Localização do Banco

- Arquivo: `db/natrip.db`
- Criado automaticamente na primeira execução
- Pode ser deletado para resetar (será recriado)

## ☁️ Produção no Render

### 1. Configuração PostgreSQL

No painel do Render:
1. Vá para **Dashboard** → **New** → **PostgreSQL**
2. Nome: `natrip-db`
3. Database: `natrip`
4. User: `natrip`
5. Region: Oregon (mesma do Web Service)
6. Plano: **Free** (90 dias grátis)
7. Create Database

### 2. Conectar ao Web Service

1. Entre no Web Service
2. Vá em **Environment**
3. Adicione `DATABASE_URL`:
   - Key: `DATABASE_URL`
   - Value: Cole o **Internal Database URL** do PostgreSQL

**IMPORTANTE**: Use o **Internal Database URL** (não o External)

### 3. Deploy

O servidor detectará automaticamente `DATABASE_URL` e usará PostgreSQL:

```
🗄️  Database mode: PostgreSQL (Production)
✓ PostgreSQL connected successfully
  Server time: 2026-02-19T23:15:00.000Z
Database tables initialized
Admin user created
🚀 Backend running on port 10000
📝 Database: PostgreSQL (Production)
```

## 🧪 Testes

### Testar Local (SQLite)

```bash
# Health check
Invoke-WebRequest -Uri "http://localhost:3000/health"

# Login
$body = @{email='admin@natrip.local';password='capela9797@'} | ConvertTo-Json
Invoke-RestMethod -Uri "http://localhost:3000/api/login" -Method POST -Body $body -ContentType "application/json"
```

### Testar Produção (PostgreSQL)

```bash
# Health check
curl https://natrip-backend.onrender.com/health

# Login
curl -X POST https://natrip-backend.onrender.com/api/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@natrip.local","password":"capela9797@"}'
```

## 📁 Estrutura de Arquivos

```
NatripAventura/
├── server.js          ← Servidor híbrido (atual)
├── server_postgres.js ← Backup PostgreSQL puro
├── server_mysql.js    ← Backup MySQL (obsoleto)
├── server_hybrid.js   ← Fonte do híbrido
├── db/
│   └── natrip.db     ← SQLite local (ignorado no Git)
├── .env              ← DATABASE_URL comentado para local
└── package.json      ← Inclui pg e sqlite3
```

## 🔄 Workflow Recomendado

1. **Desenvolver localmente** com SQLite
   ```bash
   npm start  # Usa SQLite automaticamente
   ```

2. **Testar features** sem preocupação com banco

3. **Commit e push** quando satisfeito
   ```bash
   git add .
   git commit -m "feat: nova funcionalidade"
   git push origin main
   ```

4. **Render faz deploy automático** com PostgreSQL

5. **Verificar produção**
   ```bash
   curl https://natrip-backend.onrender.com/health
   # Deve retornar "dbType": "PostgreSQL"
   ```

## 🚨 Solução de Problemas

### Erro: "Cannot find module 'sqlite3'"

```bash
npm install
```

### Erro: "Cannot find module 'pg'"

```bash
npm install
```

### Local usando PostgreSQL por engano

Verifique `.env`:
```env
# Esta linha DEVE estar comentada para desenvolvimento local:
# DATABASE_URL=postgresql://...
```

### Produção usando SQLite por engano

No Render, vá em **Environment** e certifique-se que `DATABASE_URL` está configurado com o Internal Database URL do PostgreSQL.

### Resetar banco local

```bash
# Windows
Remove-Item db\natrip.db
npm start  # Recria banco vazio

# Linux/Mac
rm db/natrip.db
npm start  # Recria banco vazio
```

### Ver logs do servidor

```bash
# Local: veja o console onde rodou npm start

# Render: Dashboard → seu Web Service → Logs
```

## 📊 Diferenças Técnicas

| Aspecto | SQLite | PostgreSQL |
|---------|--------|------------|
| Instalação | Zero (built-in) | Gerenciado pelo Render |
| Performance | Excelente para dev | Otimizado para produção |
| Concurrent Users | Limitado | Ilimitado |
| Persistência | Arquivo local | Cloud (sempre disponível) |
| Custo | Grátis | Grátis por 90 dias |
| Setup | Automático | Um clique no Render |

## 🎯 Credenciais Padrão

**Admin (criado automaticamente em ambos os ambientes):**
- Email: `admin@natrip.local`
- Senha: `capela9797@`

## 📝 Versionamento

- **v1.0.0**: SQLite apenas
- **v1.1.x**: MySQL (obsoleto)
- **v1.2.0**: PostgreSQL puro
- **v1.2.1**: Híbrido SQLite + PostgreSQL ✨

## 🔗 Links Úteis

- [SQLite Documentation](https://www.sqlite.org/docs.html)
- [PostgreSQL on Render](https://render.com/docs/databases)
- [Render Dashboard](https://dashboard.render.com/)

---

**Pronto para desenvolver!** 🚀

O servidor agora se adapta automaticamente ao ambiente. Desenvolva localmente com SQLite e faça deploy com PostgreSQL sem mudar uma linha de código.
