$f = 'c:\Users\petrj\Moje hry\Doomscrolls\apps\client\src\game\scenes\WorldSessionScene.ts'
$c = Get-Content $f -Raw
$c = $c.Replace('message.attackKind === \\\\\"heavy\\\\\"', 'message.attackKind === "heavy"')
$c = $c.Replace('showNotice(\\\\\"Heavy attack!\\\\\")', 'showNotice("Heavy attack!")')
Set-Content -Path $f -Value $c -NoNewline
Write-Host "done"
