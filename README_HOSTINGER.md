# Deploy para Hostinger (resumo rápido)

1) Requisitos
- Conta Hostinger com suporte Node.js (Cloud/Business). A hospedagem compartilhada tradicional pode não suportar apps Node.

2) Preparar o repositório
- Faça upload dos arquivos do projeto para o diretório do app via Git/SFTP/Upload (mantenha a estrutura, incl. `server.js`, `package.json`, `db/`, `css/`, `js/`, `img/`).

3) Ajustes importantes
- Variáveis de ambiente: configure `PAYPAL_CLIENT_ID`, `PAYPAL_SECRET`, `PAYPAL_MODE` (sandbox|live) e `PORT` no painel Node.js do Hostinger ou via SSH export.
- Banco: o app usa SQLite (`db/users.db`). Hostinger fornece armazenamento persistente, mas para ambientes escaláveis prefira um banco gerenciado (Postgres/MySQL).
- `fetch` no servidor: adicionamos um polyfill (`node-fetch`) para compatibilidade com versões antigas do Node.
- Pasta com espaço (`cidades historicas`): a referência em `index.html` já usa `cidades%20historicas/...`, mas é recomendável renomear a pasta para `cidades-historicas` e atualizar links para evitar problemas.

4) Instalar dependências e iniciar
Via SSH no diretório do app, execute:

```bash
npm install
npm start
```

Recomendado usar `pm2` (instale globalmente) para manter o processo:

```bash
npm install -g pm2
pm2 start npm --name natrip -- start
pm2 save
```

5) Configurar porta
Hostinger geralmente injeta `PORT` automaticamente; o app usa `process.env.PORT || 3000`.

6) Logs e permissões
- Verifique permissões de escrita em `db/` (o servidor precisa criar/abrir `db/users.db`).

7) Testes finais
- Acesse `https://your-domain/` e teste endpoints: `/api/trips`, `/api/users`, `/api/login`.
- Para PayPal, configure credenciais e testar em modo sandbox.

Se quiser, eu posso:
- Gerar um `ecosystem.config.js` do PM2.
- Renomear a pasta `cidades historicas` e corrigir links automaticamente.
