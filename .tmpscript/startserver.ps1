# Set env vars in PowerShell session first
$env:NODE_ENV = "development"
$env:SERVER_PORT = "2567"
$env:DATABASE_URL = "postgresql://doomscrolls:doomscrolls@localhost:5432/doomscrolls"
$env:REDIS_URL = "redis://localhost:6379"
$env:SESSION_SECRET = "replace-with-local-dev-secret-1234567890"
$env:CLIENT_ORIGIN = "http://localhost:5174"
$env:CLIENT_ORIGIN_EXTRA = "http://localhost:5173"
$env:VITE_API_URL = "http://localhost:2567"
$env:VITE_WS_URL = "ws://localhost:2567"

Write-Host ("PowerShell EXTRA: [" + $env:CLIENT_ORIGIN_EXTRA + "]")

# Move .env away so dotenv doesn't read it
$envPath = 'c:\Users\petrj\Moje hry\Doomscrolls\apps\server\.env'
if (Test-Path $envPath) { Move-Item $envPath "$envPath.disabled" -Force }

$logPath = 'c:\Users\petrj\Moje hry\Doomscrolls\.tmpscript\server.log'
if (Test-Path $logPath) { Remove-Item $logPath -Force -ErrorAction SilentlyContinue }

# Write a .cmd that prints the env var and runs tsx
$batPath = 'c:\Users\petrj\Moje hry\Doomscrolls\.tmpscript\startserver.cmd'
$batContent = @"
@echo off
echo EXTRA=[%CLIENT_ORIGIN_EXTRA%] > "$logPath"
cd /d "c:\Users\petrj\Moje hry\Doomscrolls\apps\server"
echo === tsx start === >> "$logPath"
call "node_modules\.bin\tsx" watch src\main.ts >> "$logPath" 2>&1
"@
Set-Content -Path $batPath -Value $batContent

Start-Process -FilePath $batPath -WorkingDirectory 'c:\Users\petrj\Moje hry\Doomscrolls\apps\server' -WindowStyle Hidden
Start-Sleep -Seconds 14
$exists = Test-Path $logPath
Write-Host ("log exists: " + $exists)
if ($exists) { Get-Content $logPath -ErrorAction SilentlyContinue }
$conn = Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object { $_.LocalPort -eq 2567 }
if ($conn) { Write-Host ("OK: 2567 PID " + $conn.OwningProcess) } else { Write-Host "WARN: 2567 not listening" }
