# Move disabled .env back to .env
$envPath = 'c:\Users\petrj\Moje hry\Doomscrolls\apps\server\.env'
$disabledPath = "$envPath.disabled"
if (Test-Path $disabledPath) { Move-Item $disabledPath $envPath -Force }

# Remove old log
$logPath = 'c:\Users\petrj\Moje hry\Doomscrolls\.tmpscript\server.log'
if (Test-Path $logPath) { Remove-Item $logPath -Force }

# Run tsx watch in foreground with redirected output (this is a child process that blocks)
$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName = "cmd.exe"
$psi.Arguments = "/c cd /d `"c:\Users\petrj\Moje hry\Doomscrolls\apps\server`" && node_modules\.bin\tsx watch src\main.ts"
$psi.UseShellExecute = $false
$psi.RedirectStandardOutput = $true
$psi.RedirectStandardError = $true
$psi.CreateNoWindow = $true

$proc = [System.Diagnostics.Process]::Start($psi)
$sb = New-Object System.Text.StringBuilder
Register-ObjectEvent -InputObject $proc -EventName OutputDataReceived -Action {
  if ($EventArgs.Data) {
    Add-Content -Path 'c:\Users\petrj\Moje hry\Doomscrolls\.tmpscript\server.log' -Value $EventArgs.Data
  }
} | Out-Null
Register-ObjectEvent -InputObject $proc -EventName ErrorDataReceived -Action {
  if ($EventArgs.Data) {
    Add-Content -Path 'c:\Users\petrj\Moje hry\Doomscrolls\.tmpscript\server.log' -Value $EventArgs.Data
  }
} | Out-Null
$proc.BeginOutputReadLine()
$proc.BeginErrorReadLine()

Start-Sleep -Seconds 14
$conn = Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object { $_.LocalPort -eq 2567 }
if ($conn) { Write-Host ("OK: 2567 PID " + $conn.OwningProcess) } else { Write-Host "WARN: 2567 not listening" }
