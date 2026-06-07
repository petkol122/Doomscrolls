Stop-Process -Id 21596 -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2
Get-Process node -ErrorAction SilentlyContinue | ForEach-Object {
  $p = $_
  $cmd = (Get-CimInstance Win32_Process -Filter ("ProcessId = " + $p.Id)).CommandLine
  if ($cmd -and $cmd -match 'src/main.ts') {
    Write-Host ("Killing tsx " + $p.Id)
    Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue
  }
}
Start-Sleep -Seconds 2
$conn = Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object { $_.LocalPort -eq 2567 }
if ($conn) { Write-Host "WARN: 2567 still listening" } else { Write-Host "OK: 2567 free" }
