$files = @(
  'c:\Users\petrj\Moje hry\Doomscrolls\apps\client\src\game\scenes\worldSession\worldSessionEnemyPlaceholderView.ts',
  'c:\Users\petrj\Moje hry\Doomscrolls\apps\client\src\game\scenes\worldSession\worldSessionAreaView.ts',
  'c:\Users\petrj\Moje hry\Doomscrolls\apps\client\src\game\scenes\WorldSessionScene.ts',
  'c:\Users\petrj\Moje hry\Doomscrolls\apps\client\src\net\attackIntentClient.ts',
  'c:\Users\petrj\Moje hry\Doomscrolls\apps\server\src\realtime\rooms\TownRoom.ts',
  'c:\Users\petrj\Moje hry\Doomscrolls\apps\server\src\realtime\rooms\initializeTownEnemies.ts',
  'c:\Users\petrj\Moje hry\Doomscrolls\packages\shared\src\room\EnemyPresence.ts',
  'c:\Users\petrj\Moje hry\Doomscrolls\packages\shared\src\protocol\ServerMessages.ts',
  'c:\Users\petrj\Moje hry\Doomscrolls\packages\content\src\data\enemies.ts',
  'c:\Users\petrj\Moje hry\Doomscrolls\packages\content\src\data\types.ts',
  'c:\Users\petrj\Moje hry\Doomscrolls\apps\client\src\net\townRoomEnemies.ts'
)
$bs = [string][char]92 + [string][char]34
$qt = [string][char]34
foreach ($f in $files) {
  $c = [System.IO.File]::ReadAllText($f)
  $c = $c.Replace($bs, $qt)
  [System.IO.File]::WriteAllText($f, $c)
}
Write-Host "done"
