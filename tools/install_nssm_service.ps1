<#
Instala e registra um serviço Windows usando NSSM para executar o backend Node.
Como usar (executar como Administrador):
  powershell -ExecutionPolicy Bypass -File .\tools\install_nssm_service.ps1
Opções:
  -ServiceName: nome do serviço (padrão: NatripAventura)
  -Action: install (padrão), uninstall
#>
param(
  [string]$ServiceName = 'NatripAventura',
  [ValidateSet('install','uninstall')]
  [string]$Action = 'install'
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

$NssmDir = Join-Path $ProjectRoot 'tools\nssm'
$NssmExe = Join-Path $NssmDir 'nssm.exe'

if ($Action -eq 'install') {
  if (-not (Test-Path $NssmExe)) {
    Write-Host "NSSM não encontrado localmente. Tentando instalar..."
    $choco = (Get-Command choco -ErrorAction SilentlyContinue)
    if ($choco) {
      Write-Host "Instalando nssm via Chocolatey..."
      choco install nssm -y | Out-Null
      $nssmFromPath = (Get-Command nssm.exe -ErrorAction SilentlyContinue).Source
      if ($nssmFromPath) {
        Copy-Item $nssmFromPath -Destination $NssmDir -Force -ErrorAction SilentlyContinue
        $NssmExe = Join-Path $NssmDir 'nssm.exe'
      }
    }
    if (-not (Test-Path $NssmExe)) {
      Write-Host "Baixando nssm oficial..."
      $tmp = Join-Path $env:TEMP "nssm.zip"
      $url = 'https://nssm.cc/release/nssm-2.24.zip'
      Invoke-WebRequest -Uri $url -OutFile $tmp -UseBasicParsing -ErrorAction Stop
      if (Test-Path $tmp) {
        Expand-Archive -Path $tmp -DestinationPath $NssmDir -Force
        # a estrutura do zip tem win64\nssm.exe ou win32\nssm.exe
        if (Test-Path (Join-Path $NssmDir 'win64\nssm.exe')) {
          Copy-Item (Join-Path $NssmDir 'win64\nssm.exe') -Destination $NssmExe -Force
        } elseif (Test-Path (Join-Path $NssmDir 'win32\nssm.exe')) {
          Copy-Item (Join-Path $NssmDir 'win32\nssm.exe') -Destination $NssmExe -Force
        }
        Remove-Item $tmp -Force -ErrorAction SilentlyContinue
      }
    }
  }

  if (-not (Test-Path $NssmExe)) {
    Write-Error "Não foi possível instalar ou localizar o nssm.exe. Instale manualmente e rode novamente."
    exit 1
  }

  $Entry = 'server.js'
  $AppDir = $ProjectRoot
  $NodePath = $NodeCmd

  Write-Host "Registrando serviço '$ServiceName' com NSSM..."
  & $NssmExe install $ServiceName $NodePath "$AppDir\$Entry"
  if ($LASTEXITCODE -ne 0) {
    Write-Error "Falha ao chamar nssm install. Código: $LASTEXITCODE"
    exit 1
  }

  & $NssmExe set $ServiceName AppDirectory "$AppDir"
  & $NssmExe set $ServiceName AppStdout (Join-Path $AppDir 'logs\stdout.log')
  & $NssmExe set $ServiceName AppStderr (Join-Path $AppDir 'logs\stderr.log')
  & $NssmExe set $ServiceName Start SERVICE_AUTO_START
  New-Item -Path (Join-Path $AppDir 'logs') -ItemType Directory -Force | Out-Null

  Write-Host "Iniciando serviço '$ServiceName'..."
  Start-Service -Name $ServiceName -ErrorAction SilentlyContinue
  Start-Sleep -Seconds 1
  $svc = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
  if ($svc -and $svc.Status -eq 'Running') {
    Write-Host "Serviço instalado e em execução."
  } else {
    Write-Warning "Serviço instalado, mas não está rodando. Verifique logs e permissões."
  }

} elseif ($Action -eq 'uninstall') {
  Write-Host "Desinstalando serviço '$ServiceName'..."
  if (Get-Service -Name $ServiceName -ErrorAction SilentlyContinue) {
    Stop-Service -Name $ServiceName -Force -ErrorAction SilentlyContinue
    & $NssmExe remove $ServiceName confirm
    Write-Host "Serviço removido.";
  } else {
    Write-Warning "Serviço '$ServiceName' não encontrado.";
  }
}
