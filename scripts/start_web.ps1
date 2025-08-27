$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$repo = Join-Path $root ".."
$port = 5173

Set-Location $repo

try {
  $python = (Get-Command python -ErrorAction Stop).Source
} catch {
  Write-Error "Python not found in PATH. Please install Python 3.10+."
  exit 1
}

# Start server in a separate window so it persists
Start-Process -FilePath $python -ArgumentList "-m http.server $port --directory webxr" -WorkingDirectory $repo -WindowStyle Minimized
Start-Sleep -Seconds 1
Start-Process "http://localhost:$port/"
Write-Host "Started web server at http://localhost:$port/"

