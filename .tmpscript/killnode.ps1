# Kill all node processes, ensure ports free
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 3
foreach ($p in @(2567, 5173, 5174)) {
  $conn = Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object { $_.LocalPort -eq $p }
  if ($conn) { Write-Host ("Port " + $p + " STILL LISTENING") } else { Write-Host ("Port " + $p + " FREE") }
}
