# Stop existing server (PID 1120) and the tsx watch parent (10360) and other tsx children
$targets = @(1120, 10360)
foreach ($pid in $targets) {
  Get-Process -Id $pid -ErrorAction SilentlyContinue | Stop-Process -Force
}
# Also stop any other node processes whose CommandLine contains src/main.ts
Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" | ForEach-Object {
  if ($_.CommandLine -and $_.CommandLine -match 'src/main\.ts') {
    Write-Host "Killing PID=$($_.ProcessId) CommandLine=$($_.CommandLine)"
    Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
  }
}
Start-Sleep -Seconds 1
# Confirm 2567 is free
$conns = Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object { $_.LocalPort -eq 2567 }
if ($conns) {
  Write-Host "WARN: port 2567 still listening"
} else {
  Write-Host "OK: port 2567 free"
}
