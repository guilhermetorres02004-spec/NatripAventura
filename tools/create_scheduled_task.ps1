<#
Cria uma Tarefa Agendada do Windows que executa o servidor Node na inicialização.
Uso (executar como Administrador):
  powershell -ExecutionPolicy Bypass -File .\tools\create_scheduled_task.ps1
Opções:
  -TaskName: nome da tarefa (padrão: NatripAventura)
#>
param(
  [string]$TaskName = 'NatripAventura'
)

function Assert-Admin {
  $isAdmin = ([Security.Principal.WindowsIdentity]::GetCurrent()).groups -match 'S-1-5-32-544'
  if (-not $isAdmin) {
    Write-Error "Este script precisa ser executado como Administrador. Abra o PowerShell como Administrador e execute novamente."
    exit 1
  }
}

Assert-Admin

$ProjectRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$ProjectRoot = $ProjectRoot.ProviderPath

$NodeCmd = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $NodeCmd) {
  Write-Error "Node.js não encontrado no PATH. Instale o Node.js e tente novamente."
  exit 1
}

New-Item -Path (Join-Path $ProjectRoot 'logs') -ItemType Directory -Force | Out-Null

$BatPath = Join-Path $ProjectRoot 'tools\start_server.bat'
$ServerJs = Join-Path $ProjectRoot 'server.js'

$batContent = @"
@echo off
cd /d "$ProjectRoot"
"$NodeCmd" "$ServerJs" >> "$ProjectRoot\logs\stdout.log" 2>> "$ProjectRoot\logs\stderr.log"
"@

Set-Content -Path $BatPath -Value $batContent -Encoding ASCII -Force

# Criar/atualizar a tarefa agendada para rodar ao iniciar o sistema como NT AUTHORITY\SYSTEM
$schtasks = 'schtasks /Create /SC ONSTART /TN "' + $TaskName + '" /TR "' + $BatPath + '" /RL HIGHEST /F /RU SYSTEM'

Write-Host "Registrando tarefa agendada..."
$out = cmd /c $schtasks 2>&1
Write-Host $out

if ($LASTEXITCODE -eq 0) {
  Write-Host "Tarefa '$TaskName' criada. Para iniciar agora: schtasks /Run /TN '$TaskName'"
} else {
  Write-Warning "Falha criando tarefa. Veja saída acima. Tente executar o comando manualmente em uma janela Administrador."
}

Write-Host "Comandos úteis:"
Write-Host "  schtasks /Query /TN '$TaskName' /V"
Write-Host "  schtasks /Run /TN '$TaskName'"
Write-Host "Verifique o servidor em http://localhost:3000 ou veja logs em $ProjectRoot\logs"
