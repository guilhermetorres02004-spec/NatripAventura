# Deploy no GoDaddy (Node.js cPanel)

Este guia configura o projeto NatripAventura para rodar no GoDaddy com Node.js.

## 1. Requisitos

- Plano GoDaddy com suporte a Node.js (cPanel + Setup Node.js App).
- Acesso SSH ou Gerenciador de Arquivos do cPanel.

## 2. Upload do projeto

Envie os arquivos para o diretório da aplicação no GoDaddy (ex.: `~/natrip-aventura`).

Mantenha esta estrutura:
- `server_hybrid.js`
- `package.json`
- `css/`, `js/`, `img/`
- páginas `.html` na raiz

## 3. Configurar app Node no cPanel

No cPanel, abra **Setup Node.js App** e configure:

- **Node.js version:** 18+ (recomendado 20)
- **Application mode:** `production`
- **Application root:** pasta do projeto
- **Application startup file:** `server_hybrid.js`

## 4. Instalar dependências

No terminal SSH (na pasta do projeto):

```bash
npm install
```

## 5. Variáveis de ambiente

No painel da aplicação Node (ou via shell), configure:

Obrigatórias para produção:
- `NODE_ENV=production`
- `PORT` (geralmente definido automaticamente pela hospedagem)

Opcional para PostgreSQL externo:
- `DATABASE_URL=postgres://usuario:senha@host:5432/banco`

Sem `DATABASE_URL`, o servidor usa SQLite automaticamente.

Opcional para PayPal:
- `PAYPAL_CLIENT_ID=...`
- `PAYPAL_SECRET=...`
- `PAYPAL_MODE=sandbox` (ou `live`)

Opcional para CORS:
- `ALLOWED_ORIGINS=https://seu-dominio.com,https://www.seu-dominio.com`

## 6. Banco de dados no GoDaddy

### Opção A: SQLite (mais simples)
- Não configure `DATABASE_URL`.
- O app cria banco local automaticamente em `db/natrip.db`.
- Verifique permissão de escrita da pasta `db/`.

### Opção B: PostgreSQL externo
- Configure `DATABASE_URL`.
- O app passa a usar PostgreSQL automaticamente.

### Opção C: MySQL
- Use o comando de start MySQL:

```bash
npm run start:mysql
```

- Configure também:
  - `DB_HOST`
  - `DB_USER`
  - `DB_PASSWORD`
  - `DB_NAME`

## 7. Subir/reiniciar aplicação

No cPanel Node App:
- Clique em **Restart** após alterações de código ou variáveis.

## 8. Testes rápidos

Depois de publicar:
- `GET /health`
- `GET /api/trips`
- `POST /api/login`

Se `GET /health` falhar:
- revise variáveis de ambiente
- confira permissões da pasta `db/`
- verifique logs da aplicação no cPanel
