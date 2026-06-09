$f = 'c:\Users\petrj\Moje hry\Doomscrolls\apps\client\src\game\scenes\WorldSessionScene.ts'
$c = [System.IO.File]::ReadAllText($f)
$needle = "      onEnemyAttackTelegraph: (message) => {`r`n        this.worldAreaView?.showEnemyTelegraph(message.enemyId);`r`n      },"
$repl = "      onEnemyAttackTelegraph: (message) => {`r`n        this.worldAreaView?.showEnemyTelegraph(message.enemyId, message.attackKind);`r`n        if (message.attackKind === " + [string][char]34 + "heavy" + [string][char]34 + ") {`r`n          this.feedbackView?.showNotice(" + [string][char]34 + "Heavy attack!" + [string][char]34 + ");`r`n        }`r`n      },"
$c = $c.Replace($needle, $repl)
[System.IO.File]::WriteAllText($f, $c)
Write-Host "done"
