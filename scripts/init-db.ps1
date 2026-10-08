. "$PSScriptRoot/common.ps1"
Assert-BackendReady
Push-Location $BackendRoot
try { Invoke-Checked $BackendPython @('-m', 'alembic', 'upgrade', 'head') }
finally { Pop-Location }
