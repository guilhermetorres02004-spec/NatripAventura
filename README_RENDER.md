# Deploy NatripAventura no Render

Este guia explica como fazer deploy da aplicação NatripAventura (v1.1) no Render com MySQL.

## Pré-requisitos

- Conta no Render: https://render.com
- Conta no Railway/PlanetScale/Aiven para MySQL (ou outro serviço de banco MySQL)
- Repositório GitHub atualizado

## Passo 1: Criar Banco de Dados MySQL

O Render não oferece MySQL gratuito, então você precisa usar um serviço externo:

### Opção A: Railway (Recomendado)
1. Acesse https://railway.app
2. Crie um novo projeto
3. Adicione MySQL
4. Copie as credenciais de conexão

### Opção B: PlanetScale
1. Acesse https://planetscale.com
2. Crie um novo database
3. Copie a connection string

### Opção C: Aiven
1. Acesse https://aiven.io
2. Crie um serviço MySQL
3. Copie as credenciais

## Passo 2: Configurar Web Service no Render

1. Acesse https://dashboard.render.com
2. Clique em "New +" → "Web Service"
3. Conecte seu repositório GitHub
4. Configure:
   - **Name:** natrip-aventura
   - **Environment:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
   - **Plan:** Free (ou outro)

## Passo 3: Configurar Variáveis de Ambiente

No painel do Render, vá em "Environment" e adicione:

```
DB_HOST=seu_host_mysql
DB_USER=seu_usuario_mysql
DB_PASSWORD=sua_senha_mysql
DB_NAME=natrip
PORT=10000
NODE_ENV=production
```

**Importante:**
- O Render usa a porta 10000 por padrão
- Substitua os valores do MySQL pelas credenciais do seu serviço

### Exemplo com Railway:
```
DB_HOST=containers-us-west-123.railway.app
DB_USER=root
DB_PASSWORD=ABC123xyz
DB_NAME=railway
PORT=10000
```

### Exemplo com PlanetScale:
```
DB_HOST=aws.connect.psdb.cloud
DB_USER=xyz123abc
DB_PASSWORD=pscale_pw_xyz123
DB_NAME=natrip
PORT=10000
```

## Passo 4: Criar Tabelas no Banco de Dados

### Opção A: Deixar o servidor criar automaticamente
O servidor criará as tabelas automaticamente na primeira execução.

### Opção B: Criar manualmente
Se preferir, execute o script SQL no seu serviço de banco:

```sql
CREATE DATABASE IF NOT EXISTS natrip CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE natrip;

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255),
  cpf VARCHAR(20),
  phone VARCHAR(20),
  email VARCHAR(255) UNIQUE,
  password VARCHAR(255),
  role VARCHAR(50),
  referralCode VARCHAR(20),
  source VARCHAR(255),
  referredBy VARCHAR(20),
  INDEX idx_email (email),
  INDEX idx_referralCode (referralCode)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS trips (
  id INT AUTO_INCREMENT PRIMARY KEY,
  city VARCHAR(255),
  date VARCHAR(50),
  category VARCHAR(100),
  seats INT,
  departureTime VARCHAR(50),
  returnTime VARCHAR(50),
  description TEXT,
  points TEXT,
  price DECIMAL(10,2),
  coverImage VARCHAR(500),
  createdBy VARCHAR(255),
  createdAt VARCHAR(50),
  INDEX idx_date (date),
  INDEX idx_category (category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS banners (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255),
  subtitle VARCHAR(255),
  category VARCHAR(100),
  image VARCHAR(500),
  link VARCHAR(500),
  orderIndex INT,
  createdBy VARCHAR(255),
  createdAt VARCHAR(50),
  INDEX idx_order (orderIndex)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

## Passo 5: Deploy

1. No Render, clique em "Manual Deploy" ou faça push no GitHub
2. Aguarde o build completar
3. Verifique os logs para confirmar:
   - "MySQL connected successfully"
   - "Database tables initialized"
   - "Backend running on port X"

## Passo 6: Testar

Acesse a URL do Render (exemplo: `https://natrip-aventura.onrender.com`)

### Login Padrão:
- **Email:** admin@natrip.local
- **Senha:** capela9797@

## Troubleshooting

### Erro: "MySQL connection error"
- ✓ Verifique se as credenciais do banco estão corretas no Environment
- ✓ Verifique se o banco de dados permite conexões externas
- ✓ Verifique se o nome do banco está correto

### Erro: "Access denied for user"
- ✓ Senha incorreta nas variáveis de ambiente
- ✓ Usuário não tem permissões no banco

### Login não funciona
- ✓ Verifique se as tabelas foram criadas
- ✓ Verifique se o usuário admin foi criado (veja nos logs)
- ✓ Teste a API diretamente: `https://seu-app.onrender.com/api/users`

### Erro: "Port already in use"
- Não use PORT=3000 no Render, use PORT=10000 ou deixe o Render definir

### Servidor muito lento
- Render free tier hiberna após inatividade
- Primeira requisição pode demorar 30-50 segundos
- Consider upgrading ao plano pago

## Configurações Recomendadas

### Para produção, configure no .env ou no Render:

```env
NODE_ENV=production
DB_HOST=seu_host_externo
DB_USER=usuario_producao
DB_PASSWORD=senha_forte
DB_NAME=natrip_prod
PORT=10000

# PayPal (se usar)
PAYPAL_MODE=live
PAYPAL_CLIENT_ID=seu_client_id_real
PAYPAL_SECRET=seu_secret_real
```

## Monitoramento

1. Logs do Render:
   - Acesse "Logs" no dashboard do Render
   - Monitore erros de conexão com banco

2. Logs do MySQL:
   - Acesse o dashboard do seu serviço MySQL
   - Verifique conexões ativas e queries lentas

## Custos Estimados

### Opção Gratuita:
- Render Web Service: Grátis (com limitações)
- Railway MySQL: Grátis (500h/mês)
- **Total: R$ 0/mês**

### Opção Paga (Recomendada para produção):
- Render Starter: $7/mês
- Railway Pro: $5-20/mês
- **Total: ~$12-27/mês (~R$ 60-135/mês)**

## Próximos Passos

1. Configure um domínio personalizado no Render
2. Configure SSL (automático no Render)
3. Configure backups do banco de dados
4. Configure monitoramento com UptimeRobot
5. Configure CI/CD automático com GitHub Actions

## Suporte

- Render Docs: https://render.com/docs
- Railway Docs: https://docs.railway.app
- PlanetScale Docs: https://planetscale.com/docs
