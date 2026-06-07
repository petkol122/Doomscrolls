$ports = @(2567, 5173, 5174)
foreach ($p in $ports) {
  $conn = Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object { $_.LocalPort -eq $p }
  if ($conn) {
    $proc = Get-CimInstance Win32_Process -Filter ('ProcessId=' + $conn.OwningProcess)
    Write-Host ("Port " + $p + " PID " + $conn.OwningProcess + " " + $proc.Name)
  } else {
    Write-Host ("Port " + $p + " FREE")
  }
}
