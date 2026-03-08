# Script para criar o banco de dados MySQL
# Execute este arquivo com: .\criar_banco.ps1

Write-Host "=== Criação do Banco de Dados NatripAventura ===" -ForegroundColor Cyan
Write-Host ""

# Solicitar senha do MySQL
$securePassword = Read-Host "Digite a senha do MySQL (usuário root)" -AsSecureString
$BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
$password = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)

Write-Host ""
Write-Host "Criando banco de dados 'natrip'..." -ForegroundColor Yellow

# Caminho do MySQL
$mysqlPath = "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe"

# Criar banco de dados
$createDbCommand = "CREATE DATABASE IF NOT EXISTS natrip CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
$showDbCommand = "SHOW DATABASES LIKE 'natrip';"
$fullCommand = "$createDbCommand $showDbCommand"

try {
    # Executar comando MySQL
    $output = & $mysqlPath -u root "-p$password" -e $fullCommand 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "✓ Banco de dados 'natrip' criado com sucesso!" -ForegroundColor Green
        Write-Host ""
        Write-Host "Próximos passos:" -ForegroundColor Cyan
        Write-Host "1. Configure a senha no arquivo .env" -ForegroundColor White
        Write-Host "2. Execute: node server.js" -ForegroundColor White
        Write-Host ""
    } else {
        Write-Host ""
        Write-Host "✗ Erro ao criar banco de dados:" -ForegroundColor Red
        Write-Host $output -ForegroundColor Red
        Write-Host ""
        Write-Host "Verifique se a senha está correta." -ForegroundColor Yellow
    }
} catch {
    Write-Host ""
    Write-Host "✗ Erro ao executar MySQL:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
}

# Limpar senha da memória
$password = $null
