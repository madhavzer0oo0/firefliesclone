$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$BackendRoot = Join-Path $ProjectRoot 'backend'
$FrontendRoot = Join-Path $ProjectRoot 'frontend'
$BackendPython = Join-Path $BackendRoot '.venv/Scripts/python.exe'

function Invoke-Checked {
    param([string]$Executable, [string[]]$Arguments)
    & $Executable @Arguments
    if ($LASTEXITCODE -ne 0) { throw "Command failed: $Executable $Arguments" }
}

function Assert-BackendReady {
    if (-not (Test-Path -LiteralPath $BackendPython)) {
        throw 'Run scripts/setup.ps1 first to create the backend virtual environment.'
    }
}
