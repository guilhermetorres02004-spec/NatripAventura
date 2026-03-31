# Migração para MySQL

Este projeto foi migrado de SQLite para MySQL para melhor performance e escalabilidade.

## Requisitos

- MySQL Server 5.7+ ou MariaDB 10.2+
- Node.js 14+ (já instalado)

## Passos para Configuração

### 1. Instalar MySQL

**Windows:**
- Baixe e instale o MySQL Community Server: https://dev.mysql.com/downloads/mysql/
- Durante a instalação, configure uma senha para o usuário `root`
- Ou use XAMPP/WAMP que já incluem MySQL

**Alternativa - usando XAMPP:**
- Baixe XAMPP: https://www.apachefriends.org/pt_br/download.html
- Inicie o MySQL pelo painel de controle do XAMPP

### 2. Criar o Banco de Dados

Opção A - Via MySQL Command Line:
```bash
mysql -u root -p
```

Depois execute:
```sql
CREATE DATABASE natrip CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Opção B - Execute o script SQL fornecido:
```bash
mysql -u root -p < setup_database.sql
```

Opção C - Use phpMyAdmin (se estiver usando XAMPP):
1. Acesse http://localhost/phpmyadmin
2. Clique em "Novo" ou "New"
3. Nome do banco: `natrip`
4. Charset: `utf8mb4_unicode_ci`
5. Clique em "Criar"

### 3. Configurar as Credenciais

Edite o arquivo `.env` na raiz do projeto:

```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=sua_senha_mysql
DB_NAME=natrip
PORT=3000
```

**IMPORTANTE:** Substitua `sua_senha_mysql` pela senha que você configurou para o MySQL.

### 4. Iniciar o Servidor

```bash
node server.js
```

O servidor irá:
- Conectar ao MySQL
- Criar as tabelas automaticamente (users, trips, banners)
- Criar o usuário admin padrão
- Iniciar na porta 3000

### 5. Verificar a Conexão

Você deve ver no console:
```
MySQL connected successfully
Database tables initialized
Admin user created
Backend running on port 3000
```

Se houver erro de conexão, verifique:
- O MySQL está rodando? (verifique no XAMPP ou Gerenciador de Serviços do Windows)
- As credenciais no `.env` estão corretas?
- O banco de dados `natrip` foi criado?

## Estrutura das Tabelas

### Tabela `users`
- Armazena usuários do sistema
- Campos: id, name, cpf, phone, email, password, role, referralCode, source, referredBy

### Tabela `trips`
- Armazena as viagens/pacotes
- Campos: id, city, date, category, seats, departureTime, returnTime, description, points, price, coverImage, createdBy, createdAt

### Tabela `banners`
- Armazena banners promocionais
- Campos: id, title, subtitle, category, image, link, orderIndex, createdBy, createdAt

## Login Padrão

- **Email:** admin@natrip.local
- **Senha:** capela9797@

## Diferenças do SQLite

1. **Performance:** MySQL é mais rápido para múltiplas conexões simultâneas
2. **Tipos de dados:** DECIMAL ao invés de REAL para preços, VARCHAR ao invés de TEXT
3. **Auto increment:** INT AUTO_INCREMENT ao invés de INTEGER PRIMARY KEY AUTOINCREMENT
4. **Conexão:** Usa pool de conexões para melhor gerenciamento
5. **Sintaxe:** INSERT IGNORE ao invés de INSERT OR IGNORE

## Troubleshooting

### Erro: "Client does not support authentication protocol"
Se você receber este erro, execute no MySQL:
```sql
ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY 'sua_senha';
FLUSH PRIVILEGES;
```

### Erro: "Access denied for user"
Verifique se a senha no `.env` está correta.

### Erro: "Unknown database 'natrip'"
O banco de dados não foi criado. Execute o passo 2 novamente.

### MySQL não inicia no XAMPP
- Verifique se a porta 3306 não está em uso
- Tente mudar a porta no arquivo `my.ini` do MySQL

## Migração de Dados do SQLite (Opcional)

Se você tinha dados no SQLite antigo em `db/users.db`, você pode exportar e importar:

1. Exportar do SQLite para SQL:
```bash
sqlite3 db/users.db .dump > backup.sql
```

2. Adaptar o SQL para MySQL (substituir tipos de dados)

3. Importar no MySQL:
```bash
mysql -u root -p natrip < backup_adapted.sql
```

## Suporte

Para mais informações sobre MySQL:
- Documentação oficial: https://dev.mysql.com/doc/
- Tutorial MySQL: https://www.mysqltutorial.org/
