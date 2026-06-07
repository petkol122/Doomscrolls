$f = 'c:\Users\petrj\Moje hry\Doomscrolls\apps\client\src\game\scenes\WorldSessionScene.ts'
$lines = Get-Content $f
for ($i = 0; $i -lt $lines.Count; $i++) {
  if ($lines[$i] -like '*attackKind === \\"heavy\\"*') {
    $lines[$i] = $lines[$i] -replace 'attackKind === \\"heavy\\"', 'attackKind === "heavy"'
  }
  if ($lines[$i] -like '*showNotice(\\"Heavy attack!\\")*') {
    $lines[$i] = $lines[$i] -replace 'showNotice\(\\"Heavy attack!\\"\)', 'showNotice("Heavy attack!")'
  }
}
Set-Content -Path $f -Value $lines -NoNewline
Write-Host "done"
