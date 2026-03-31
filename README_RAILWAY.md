# Deploy no Railway (Backend + Banco)

Este projeto ja esta preparado para rodar no Railway com o servidor hibrido.

## Como funciona no Railway

- Com `DATABASE_URL` definido: usa PostgreSQL.
- Sem `DATABASE_URL`: usa SQLite local (nao recomendado em producao no Railway).

## Passo a passo

1. Suba o projeto para GitHub.
2. No Railway, clique em **New Project**.
3. Escolha **Deploy from GitHub repo** e selecione este repositorio.
4. Railway vai detectar Node.js e usar:
   - Build: `npm install`
   - Start: `npm run start:godaddy`

## Banco de dados (recomendado)

1. No projeto Railway, clique em **New** -> **Database** -> **Add PostgreSQL**.
2. Railway cria automaticamente a variavel `DATABASE_URL`.
3. Redeploy do servico web (ou restart).

## Variaveis de ambiente

Defina no servico web:

- `NODE_ENV=production`
- `ALLOWED_ORIGINS=https://natripaventuras.com,https://www.natripaventuras.com`
- `PAYPAL_CLIENT_ID=...`
- `PAYPAL_SECRET=...`
- `PAYPAL_MODE=sandbox` (ou `live`)

Observacao:
- `PORT` e definido automaticamente pelo Railway.

## Verificacao

Depois do deploy, teste:

- `GET /health`
- `GET /api/trips`
- `POST /api/login`

Se `/health` falhar:

- verifique se `DATABASE_URL` existe no servico
- confirme se o PostgreSQL foi adicionado no mesmo projeto
- confira logs do deploy no Railway
