Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object { $_.LocalPort -eq 2567 } | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force; Write-Host ("Killed PID " + $_.OwningProcess) }
Get-Process node -ErrorAction SilentlyContinue | ForEach-Object {
  $cmd = (Get-CimInstance Win32_Process -Filter ("ProcessId = " + $_.Id)).CommandLine
  if ($cmd -and $cmd -match 'src/main.ts') {
    Write-Host ("Killing tsx " + $_.Id)
    Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
  }
}
Start-Sleep -Seconds 2
$conn = Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object { $_.LocalPort -eq 2567 }
if ($conn) { Write-Host "WARN: 2567 still listening" } else { Write-Host "OK: 2567 free" }
