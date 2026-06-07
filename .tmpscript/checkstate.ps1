Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object { $_.LocalPort -eq 2567 } | Format-Table LocalPort,OwningProcess
Get-Process node -ErrorAction SilentlyContinue | ForEach-Object {
  $p = $_
  $cmd = (Get-CimInstance Win32_Process -Filter ("ProcessId = " + $p.Id)).CommandLine
  if ($cmd -and ($cmd -match 'main.ts' -or $cmd -match 'vite')) {
    Write-Host ("PID " + $p.Id + " " + $cmd.Substring(0, [Math]::Min(200, $cmd.Length)))
  }
}
