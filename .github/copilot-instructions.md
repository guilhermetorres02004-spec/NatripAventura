# Copilot Workspace Instructions for NatripAventura

## Overview
This project is a Node.js web application for travel and tourism, supporting multiple database backends (SQLite, MySQL, PostgreSQL) and deployable on platforms like Render and Hostinger. The codebase is designed for easy local development and cloud deployment.

## Build & Run Commands
- **Install dependencies:** `npm install`
- **Start (default):** `node server.js`
- **Start with MySQL:** `node server_mysql.js`
- **Start with PostgreSQL:** `node server_hybrid.js` (auto-detects DATABASE_URL)
- **Test server:** `node test_server.js`

## Database Setup
- **Local development:** Uses SQLite by default (no setup needed)
- **MySQL:** See `README_MYSQL.md` for setup and migration
- **PostgreSQL:** See `README_POSTGRES_RENDER.md` for Render setup, or `setup_database_postgres.sql` for manual setup
- **Hybrid:** See `README_HYBRID_DATABASE.md` for auto-detection logic

## Deployment
- **Render:** See `README_RENDER.md` and `README_POSTGRES_RENDER.md`
- **Hostinger:** See `README_HOSTINGER.md`
- **GoDaddy:** See `README_GODADDY.md`
- **Railway:** See `README_RAILWAY.md`

## Project Conventions
- All environment variables are set via platform dashboard or `.env` (not committed)
- Static assets in `img/`, `css/`, `js/`
- HTML pages at root or in feature folders
- Scripts and tools in `scripts/` and `tools/`
- Use `cidades-historicas/` (not `cidades historicas/`) for static content

## Common Pitfalls
- Ensure correct database config for the environment (see hybrid logic)
- On Hostinger, check write permissions for `db/`
- For PayPal integration, set all required environment variables

## Documentation
- See all `README_*.md` files for platform-specific instructions
- For troubleshooting, see `TROUBLESHOOTING.md`

## Example Prompts
- "Como faço deploy no Render com PostgreSQL?"
- "Como rodar localmente usando SQLite?"
- "Como migrar para MySQL?"
- "Como configurar o PayPal sandbox?"

---

_This file is auto-generated to help Copilot and developers follow project conventions and avoid common issues. Update as needed when project structure or workflows change._
