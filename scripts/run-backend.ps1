. "$PSScriptRoot/common.ps1"
Assert-BackendReady
Push-Location $BackendRoot
try { Invoke-Checked $BackendPython @('-m', 'uvicorn', 'app.main:app', '--reload', '--host', '127.0.0.1', '--port', '8000') }
finally { Pop-Location }
