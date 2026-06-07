$logPath = 'c:\Users\petrj\Moje hry\Doomscrolls\.tmpscript\client.log'
if (Test-Path $logPath) { Remove-Item $logPath -Force }
$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName = "cmd.exe"
$psi.Arguments = "/c cd /d `"c:\Users\petrj\Moje hry\Doomscrolls\apps\client`" && node_modules\.bin\vite --port 5174 --host 127.0.0.1"
$psi.UseShellExecute = $false
$psi.RedirectStandardOutput = $true
$psi.RedirectStandardError = $true
$psi.CreateNoWindow = $true
$proc = [System.Diagnostics.Process]::Start($psi)
Register-ObjectEvent -InputObject $proc -EventName OutputDataReceived -Action { if ($EventArgs.Data) { Add-Content -Path $logPath -Value $EventArgs.Data } } | Out-Null
Register-ObjectEvent -InputObject $proc -EventName ErrorDataReceived -Action { if ($EventArgs.Data) { Add-Content -Path $logPath -Value $EventArgs.Data } } | Out-Null
$proc.BeginOutputReadLine()
$proc.BeginErrorReadLine()
Start-Sleep -Seconds 6
$conn = Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object { $_.LocalPort -eq 5174 }
if ($conn) { Write-Host ("OK: 5174 PID " + $conn.OwningProcess) } else { Write-Host "WARN: 5174 not listening" }
