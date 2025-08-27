$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$fp = Join-Path $root "..\services\flight-proxy"
$tts = Join-Path $root "..\services\tts-explain"

Start-Process -FilePath node -ArgumentList 'index.js' -WorkingDirectory $fp -WindowStyle Minimized

$py = Join-Path $tts ".venv\Scripts\python.exe"
if (!(Test-Path $py)) {
  Write-Host "Python venv not found. Creating..."
  py -3 -m venv (Join-Path $tts ".venv")
  $py = Join-Path $tts ".venv\Scripts\python.exe"
}
Start-Process -FilePath $py -ArgumentList '-m uvicorn main:app --port 8081' -WorkingDirectory $tts -WindowStyle Minimized

Write-Host "Started: flight-proxy on 8080, tts-explain on 8081"

