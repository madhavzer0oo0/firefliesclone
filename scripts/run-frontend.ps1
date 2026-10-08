. "$PSScriptRoot/common.ps1"
Push-Location $FrontendRoot
try { Invoke-Checked npm.cmd @('run', 'dev') }
finally { Pop-Location }
