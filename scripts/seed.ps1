. "$PSScriptRoot/common.ps1"
Assert-BackendReady
Push-Location $BackendRoot
try {
    Invoke-Checked $BackendPython @('-m', 'alembic', 'upgrade', 'head')
    Invoke-Checked $BackendPython @('-m', 'app.seed')
} finally { Pop-Location }
