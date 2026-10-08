. "$PSScriptRoot/common.ps1"
Push-Location $ProjectRoot
try {
    if (-not (Test-Path -LiteralPath $BackendPython)) {
        Invoke-Checked python @('-m', 'venv', 'backend/.venv')
    }
    Invoke-Checked $BackendPython @('-m', 'pip', 'install', '-r', 'backend/requirements.lock.txt')
    Push-Location $FrontendRoot
    try { Invoke-Checked npm.cmd @('ci') } finally { Pop-Location }
} finally { Pop-Location }
