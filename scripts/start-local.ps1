$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
Set-Location $projectRoot
function Test-LocalPort([int]$Port) {
    $portClient = New-Object System.Net.Sockets.TcpClient
    try { return $portClient.ConnectAsync('127.0.0.1', $Port).Wait(300) -and $portClient.Connected }
    catch { return $false }
    finally { $portClient.Dispose() }
}
foreach ($servicePort in @(8545, 8000, 5173)) {
    if (Test-LocalPort $servicePort) { throw "Port $servicePort is already occupied. Stop the existing service before starting this launcher." }
}
New-Item -ItemType Directory -Force -Path '.runtime' | Out-Null
$processes = @()
try {
    $processes += Start-Process -FilePath 'node' -ArgumentList @('node_modules/hardhat/dist/src/cli.js', 'node') -WorkingDirectory $projectRoot -PassThru -WindowStyle Hidden -RedirectStandardOutput '.runtime/chain.log' -RedirectStandardError '.runtime/chain-error.log'
    $ready = $false
    for ($attempt = 0; $attempt -lt 40; $attempt++) {
        try {
            Invoke-RestMethod -Uri 'http://127.0.0.1:8545' -Method Post -ContentType 'application/json' -Body '{"jsonrpc":"2.0","id":1,"method":"eth_chainId","params":[]}' | Out-Null
            $ready = $true
            break
        } catch { Start-Sleep -Milliseconds 500 }
    }
    if (-not $ready -or $processes[0].HasExited) { throw 'Local chain did not start. Check .runtime/chain-error.log.' }
    & npm.cmd run seed
    if ($LASTEXITCODE -ne 0) { throw 'Seeding failed.' }
    $pythonPath = Join-Path $projectRoot 'backend/.venv/Scripts/python.exe'
    $processes += Start-Process -FilePath $pythonPath -ArgumentList @('-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', '8000') -WorkingDirectory (Join-Path $projectRoot 'backend') -PassThru -WindowStyle Hidden -RedirectStandardOutput (Join-Path $projectRoot '.runtime/api.log') -RedirectStandardError (Join-Path $projectRoot '.runtime/api-error.log')
    $processes += Start-Process -FilePath 'node' -ArgumentList @('node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--strictPort') -WorkingDirectory (Join-Path $projectRoot 'frontend') -PassThru -WindowStyle Hidden -RedirectStandardOutput (Join-Path $projectRoot '.runtime/frontend.log') -RedirectStandardError (Join-Path $projectRoot '.runtime/frontend-error.log')
    $servicesReady = $false
    for ($attempt = 0; $attempt -lt 40; $attempt++) {
        if (@($processes | Where-Object HasExited).Count -gt 0) { throw 'A service exited during startup. Check .runtime/*-error.log.' }
        try {
            Invoke-RestMethod -Uri 'http://127.0.0.1:8000/api/health' | Out-Null
            Invoke-WebRequest -Uri 'http://127.0.0.1:5173' -UseBasicParsing | Out-Null
            $servicesReady = $true
            break
        } catch { Start-Sleep -Milliseconds 500 }
    }
    if (-not $servicesReady) { throw 'API or frontend did not become ready. Check the logs in .runtime.' }
    Write-Host 'SportChain: http://127.0.0.1:5173 -- Press Enter to stop services started by this script.'
    Read-Host | Out-Null
} finally {
    foreach ($process in $processes) {
        if (-not $process.HasExited) { Stop-Process -Id $process.Id -ErrorAction SilentlyContinue }
    }
}
