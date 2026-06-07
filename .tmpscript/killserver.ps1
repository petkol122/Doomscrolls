$conns = Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object { $_.LocalPort -eq 2567 }
foreach ($c in $conns) {
  Write-Host ("Killing PID " + $c.OwningProcess)
  Stop-Process -Id $c.OwningProcess -Force -ErrorAction SilentlyContinue
}
# Also stop any tsx watch parent
Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" | ForEach-Object {
  if ($_.CommandLine -and $_.CommandLine -match 'src/main.ts') {
    Write-Host ("Killing tsx PID " + $_.ProcessId)
    Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
  }
}
Start-Sleep -Seconds 2
$check = Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object { $_.LocalPort -eq 2567 }
if ($check) { Write-Host "WARN: 2567 still listening" } else { Write-Host "OK: 2567 free" }
