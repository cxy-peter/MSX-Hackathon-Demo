$port = 4173
$url = "http://localhost:$port"
$npm = "C:\Program Files\nodejs\npm.cmd"

Write-Host ""
Write-Host "Starting MSX demo at $url" -ForegroundColor Green
Write-Host "Use Ctrl+C to stop the server." -ForegroundColor DarkGray
Write-Host ""

Start-Process $url
& $npm run dev -- --host 127.0.0.1 --port $port
