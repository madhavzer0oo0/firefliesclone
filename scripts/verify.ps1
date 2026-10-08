. "$PSScriptRoot/common.ps1"
Assert-BackendReady
Push-Location $BackendRoot
try { Invoke-Checked $BackendPython @('-m', 'pytest', '-q') }
finally { Pop-Location }
Push-Location $FrontendRoot
try {
    Invoke-Checked npm.cmd @('run', 'test:unit')
    Invoke-Checked npm.cmd @('run', 'lint')
    Invoke-Checked npm.cmd @('run', 'typecheck')
    Invoke-Checked npm.cmd @('run', 'build')
} finally { Pop-Location }
