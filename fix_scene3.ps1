$f = 'c:\Users\petrj\Moje hry\Doomscrolls\apps\client\src\game\scenes\WorldSessionScene.ts'
$c = [System.IO.File]::ReadAllText($f)
$c = $c.Replace([string][char]92 + [string][char]34, [string][char]34)
[System.IO.File]::WriteAllText($f, $c)
Write-Host "done"
