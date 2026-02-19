# Troubleshooting - NatripAventura

## ❌ Erro: ECONNREFUSED no Render

### Sintomas:
```
Error logging in:
code: 'ECONNREFUSED',
errno: undefined,
```

### Causa:
O servidor Node.js não consegue conectar ao banco de dados MySQL.

### ✅ Solução Passo a Passo:

#### 1. O Render NÃO tem MySQL integrado

O Render oferece apenas PostgreSQL gratuitamente. Para MySQL, você precisa usar um **serviço externo**.

#### 2. Configurar MySQL Externo

**Opção A: Railway (RECOMENDADO - Mais Fácil)**

1. Acesse https://railway.app
2. Crie uma conta (pode usar GitHub)
3. Clique em "New Project"
4. Selecione "Deploy MySQL"
5. Aguarde provisionar
6. Clique no MySQL → aba "Connect"
7. Copie as credenciais:
   - `MYSQLHOST`
   - `MYSQLUSER`
   - `MYSQLPASSWORD`
   - `MYSQLDATABASE` (ou crie um banco chamado 'natrip')
   - `MYSQLPORT` (geralmente 3306)

**Opção B: PlanetScale**

1. Acesse https://planetscale.com
2. Crie uma conta
3. Create Database → nome: `natrip`
4. Get Connection String
5. Copie as credenciais

**Opção C: Aiven**

1. Acesse https://aiven.io
2. Create Service → MySQL
3. Aguarde provisionar
4. Copie as credenciais de conexão

#### 3. Configurar Variáveis no Render

1. Acesse seu Web Service no Render
2. Vá em **Environment** (menu lateral esquerdo)
3. Adicione as variáveis:

**Para Railway:**
```
DB_HOST=containers-us-west-XXX.railway.app
DB_USER=root
DB_PASSWORD=sua_senha_railway
DB_NAME=railway
DB_PORT=3306
PORT=10000
NODE_ENV=production
```

**Para PlanetScale:**
```
DB_HOST=aws.connect.psdb.cloud
DB_USER=seu_usuario_planetscale
DB_PASSWORD=pscale_pw_XXXXXXX
DB_NAME=natrip
PORT=10000
NODE_ENV=production
```

4. Clique em "Save Changes"
5. O Render vai fazer **redeploy automático**

#### 4. Criar Tabelas no MySQL

**Opção A: Via Railway Dashboard**
1. No Railway, clique no MySQL
2. Aba "Data"
3. Query editor
4. Cole e execute o SQL do arquivo `setup_database.sql`

**Opção B: Via MySQL Client**
```bash
mysql -h seu_host -u seu_usuario -p
# Digite a senha quando solicitado

# Cole o conteúdo de setup_database.sql
```

**Opção C: Deixar o servidor criar automaticamente**
- O servidor criará as tabelas na primeira execução
- Verifique nos logs do Render: "Database tables initialized"

#### 5. Verificar Logs

No Render, vá em **Logs** e procure por:

✅ **Sucesso:**
```
Database configuration: { host: '...', user: '...', database: '...' }
✓ MySQL connected successfully
  Host: containers-us-west-XXX.railway.app
  Database: railway
Database tables initialized
Admin user created
Backend running on port 10000
```

❌ **Falha:**
```
✗ MySQL connection error (attempt 1/3): connect ECONNREFUSED
  Error code: ECONNREFUSED
  Host: localhost
```

Se aparecer "Host: localhost" significa que as variáveis de ambiente **não foram configuradas**.

#### 6. Testar o Servidor

Depois do deploy com sucesso, teste:

```bash
# Health check
curl https://seu-app.onrender.com/health

# Login admin
curl -X POST https://seu-app.onrender.com/api/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@natrip.local","password":"capela9797@"}'
```

Ou use o script de teste:
```bash
node test_server.js https://seu-app.onrender.com
```

---

## ❌ Erro: Access denied for user

### Sintomas:
```
Error code: ER_ACCESS_DENIED_ERROR
Access denied for user 'root'@'XXX' (using password: YES)
```

### Solução:
- Senha incorreta no `DB_PASSWORD`
- Usuário não existe ou não tem permissões
- Verifique as credenciais no painel do seu serviço MySQL

---

## ❌ Erro: Unknown database

### Sintomas:
```
Error code: ER_BAD_DB_ERROR
Unknown database 'natrip'
```

### Solução:
1. Crie o banco de dados manualmente:
```sql
CREATE DATABASE natrip CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

2. Ou use o nome do banco padrão do serviço (ex: 'railway')

---

## ❌ Deploy funciona mas site não carrega

### Sintomas:
- Logs mostram "Backend running on port X"
- Mas o site não abre

### Solução:
Verifique se a porta está correta:
- Render usa `process.env.PORT` (geralmente 10000)
- **NUNCA** fixe a porta como 3000 em produção

No `server.js`, deve estar:
```javascript
const PORT = process.env.PORT || 3000;
```

---

## ❌ Login funciona localmente mas não no Render

### Possíveis causas:

1. **Banco de dados vazio no Render**
   - Verificar se as tabelas foram criadas
   - Verificar se o usuário admin foi criado
   - Logs: "Admin user created"

2. **CORS bloqueando requisições**
   - Já configurado para aceitar todas origens
   - Se precisar restringir, configure `ALLOWED_ORIGINS`

3. **Timeout do MySQL**
   - Já configurado com 10 segundos
   - Se ainda der timeout, aumente no código

---

## 🔍 Comandos Úteis de Diagnóstico

### Ver configuração do banco (nos logs do Render):
```
Database configuration: { host: '...', user: '...', database: '...' }
```

### Testar conexão MySQL local:
```bash
mysql -h seu_host -u seu_usuario -p -e "SELECT 1"
```

### Ver tabelas criadas:
```bash
mysql -h seu_host -u seu_usuario -p seu_banco -e "SHOW TABLES"
```

### Verificar se admin existe:
```bash
mysql -h seu_host -u seu_usuario -p seu_banco -e "SELECT email, role FROM users WHERE role='admin'"
```

---

## 📞 Checklist Final

Antes de fazer deploy no Render, verifique:

- [ ] MySQL externo configurado (Railway/PlanetScale/Aiven)
- [ ] Variáveis de ambiente definidas no Render:
  - [ ] DB_HOST
  - [ ] DB_USER
  - [ ] DB_PASSWORD
  - [ ] DB_NAME
  - [ ] PORT (deixe o Render definir ou use 10000)
  - [ ] NODE_ENV=production
- [ ] Banco de dados criado
- [ ] Código atualizado no GitHub (v1.1.1 ou superior)
- [ ] Deploy realizado no Render
- [ ] Logs mostram "MySQL connected successfully"
- [ ] Logs mostram "Database tables initialized"
- [ ] Health check retorna status 200: `/health`
- [ ] Login admin funciona

---

## 💡 Dicas

1. **Free tier do Render hiberna após 15 min**
   - Primeira requisição pode demorar 30-60s
   - Considere plano pago para sites em produção

2. **Railway oferece 500h/mês grátis**
   - Mais que suficiente para desenvolvimento
   - ~16 horas por dia

3. **Use o endpoint /health para monitorar**
   - Configure UptimeRobot para fazer ping a cada 5 min
   - Evita que o Render hiberne

4. **Backups do banco de dados**
   - Railway tem backups automáticos
   - PlanetScale também
   - Considere exportar periodicamente

---

## 🆘 Ainda com problemas?

1. Verifique os logs completos no Render
2. Execute `node test_server.js https://seu-app.onrender.com`
3. Verifique se o MySQL externo está acessível
4. Teste a conexão MySQL manualmente
5. Verifique se não há firewall bloqueando
