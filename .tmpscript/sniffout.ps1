$p = Get-CimInstance Win32_Process -Filter "ProcessId = 1120"
Write-Host "Name=$($p.Name)"
Write-Host "ParentProcessId=$($p.ParentProcessId)"
Write-Host "CommandLine=$($p.CommandLine)"
Write-Host "---stdout handle---"
$stdout = Get-CimInstance Win32_Process -Filter "ProcessId = 1120" | ForEach-Object { $_ }
