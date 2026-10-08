param([string[]]$TestFiles = @())
. "$PSScriptRoot/common.ps1"
Assert-BackendReady
# Always isolate browser writes from backend/fireflies.db. Each run gets a new SQLite file.
$TaskTestRoot = Join-Path $ProjectRoot ('tmp/e2e-' + [guid]::NewGuid().ToString('N'))
$TaskDatabase = Join-Path $TaskTestRoot 'test.db'
$TaskOriginalDatabase = $env:DATABASE_URL
$TaskOriginalApi = $env:NEXT_PUBLIC_API_URL
$TaskOriginalTestApi = $env:E2E_API_URL
$TaskOriginalIsolation = $env:PLAYWRIGHT_ISOLATED_DB
$TaskServer = $null
$TaskFrontendBuilt = $false
if (Get-NetTCPConnection -State Listen -LocalPort 8001 -ErrorAction SilentlyContinue) { throw 'Port 8001 is in use. Stop that service before isolated browser tests.' }
if (Get-NetTCPConnection -State Listen -LocalPort 3000 -ErrorAction SilentlyContinue) { throw 'Stop the frontend on port 3000 before running isolated browser tests.' }
New-Item -ItemType Directory -Path $TaskTestRoot -Force | Out-Null
try {
    $env:DATABASE_URL = 'sqlite:///' + $TaskDatabase.Replace('\', '/')
    $env:NEXT_PUBLIC_API_URL = 'http://localhost:8001/api/v1'
    $env:E2E_API_URL = $env:NEXT_PUBLIC_API_URL
    $env:PLAYWRIGHT_ISOLATED_DB = '1'
    Push-Location $BackendRoot
    try {
        Invoke-Checked $BackendPython @('-m', 'alembic', 'upgrade', 'head')
        Invoke-Checked $BackendPython @('-m', 'app.seed')
    } finally { Pop-Location }
    $TaskServer = Start-Process -FilePath $BackendPython -ArgumentList @('-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', '8001') -WorkingDirectory $BackendRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $TaskTestRoot 'backend.log') -RedirectStandardError (Join-Path $TaskTestRoot 'backend-error.log')
    $TaskReady = $false
    for ($TaskAttempt = 0; $TaskAttempt -lt 40; $TaskAttempt++) {
        if ($TaskServer.HasExited) { throw 'Isolated backend exited; inspect tmp/e2e-*/backend-error.log.' }
        try { Invoke-RestMethod 'http://localhost:8001/health' | Out-Null; $TaskReady = $true; break } catch { Start-Sleep -Milliseconds 250 }
    }
    if (-not $TaskReady) { throw 'Isolated backend did not become ready.' }
    Push-Location $FrontendRoot
    try {
        $TaskFrontendBuilt = $true
        Invoke-Checked npm.cmd @('run', 'build')
        $TaskTestArguments = @('run', 'test:e2e')
        if ($TestFiles.Count) { $TaskTestArguments += @('--') + $TestFiles }
        Invoke-Checked npm.cmd $TaskTestArguments
    } finally { Pop-Location }
} finally {
    if ($TaskServer -and -not $TaskServer.HasExited) { Stop-Process -Id $TaskServer.Id }
    $env:DATABASE_URL = $TaskOriginalDatabase
    $env:NEXT_PUBLIC_API_URL = $TaskOriginalApi
    $env:E2E_API_URL = $TaskOriginalTestApi
    $env:PLAYWRIGHT_ISOLATED_DB = $TaskOriginalIsolation
    # Restore a regular production build pointing to the original API configuration.
    if ($TaskFrontendBuilt) {
        Push-Location $FrontendRoot
        try { Invoke-Checked npm.cmd @('run', 'build') } finally { Pop-Location }
    }
}
