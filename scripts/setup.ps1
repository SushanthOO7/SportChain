$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
function Invoke-Checked([scriptblock]$Action) {
    & $Action
    if ($LASTEXITCODE -ne 0) { throw "Setup command failed with exit code $LASTEXITCODE" }
}
Invoke-Checked { npm.cmd ci }
Invoke-Checked { npm.cmd ci --prefix frontend }
Invoke-Checked { python -m venv backend/.venv }
Invoke-Checked { & backend/.venv/Scripts/python.exe -m pip install -r backend/requirements.lock }
Invoke-Checked { npm.cmd run compile }
Write-Host 'Setup complete. Follow README.md to start chain, seed, API and frontend.'
