$node = "C:\Program Files\nodejs\node.exe"

if (-not (Test-Path ".env")) {
  Write-Host "Missing .env file. Copy .env.example to .env and fill DEPLOYER_PRIVATE_KEY first." -ForegroundColor Yellow
  exit 1
}

& $node .\node_modules\hardhat\dist\src\cli.js run .\scripts\deploy-welcome-badge.js --network sepolia
