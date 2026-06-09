$ErrorActionPreference = 'Stop'

# 1. attackIntentClient.ts
$f = 'c:\Users\petrj\Moje hry\Doomscrolls\apps\client\src\net\attackIntentClient.ts'
$c = Get-Content $f -Raw
$needle1 = "    typeof candidate.windupMs === \`"number\`"`r`n  );"
$repl1 = "    typeof candidate.windupMs === \`"number\`" &&`r`n    (candidate.attackKind === undefined || candidate.attackKind === \`"normal\`" || candidate.attackKind === \`"heavy\`")`r`n  );"
$c = $c.Replace($needle1, $repl1)
$needle2 = "    && (candidate.outcome === \`"hit\`" || candidate.outcome === \`"miss\`")`r`n    && (candidate.damage === undefined"
$repl2 = "    && (candidate.outcome === \`"hit\`" || candidate.outcome === \`"miss\`")`r`n    && (candidate.attackKind === undefined || candidate.attackKind === \`"normal\`" || candidate.attackKind === \`"heavy\`")`r`n    && (candidate.damage === undefined"
$c = $c.Replace($needle2, $repl2)
Set-Content -Path $f -Value $c -NoNewline

# 2. worldSessionEnemyPlaceholderView.ts
$f = 'c:\Users\petrj\Moje hry\Doomscrolls\apps\client\src\game\scenes\worldSession\worldSessionEnemyPlaceholderView.ts'
$c = Get-Content $f -Raw
$needleA = "  readonly setTelegraphing: (active: boolean) => void;"
$replA = "  readonly setTelegraphing: (active: boolean, attackKind?: \`"normal\`" | \`"heavy\`") => void;"
$c = $c.Replace($needleA, $replA)
$needleB = "  container.add([shadow, ring, body, core, hpBarFrame, hpBarFill, hpText, labelText, stateText, telegraphMarker, telegraphExclaim, aggroExclaim]);"
$replB = "  const heavyTelegraphLabel = scene.add`r`n    .text(0, -29, \`"HEAVY!\`", {`r`n      color: \`"#fff1d6\`",`r`n      fontFamily: \`"Arial, sans-serif\`",`r`n      fontSize: \`"10px\`",`r`n      fontStyle: \`"bold\`",`r`n      stroke: \`"#2a0600\`",`r`n      strokeThickness: 3,`r`n      backgroundColor: \`"#7a1408\`",`r`n      padding: { left: 4, right: 4, top: 2, bottom: 2 },`r`n    })`r`n    .setOrigin(0.5);`r`n  heavyTelegraphLabel.setVisible(false);`r`n`r`n  container.add([shadow, ring, body, core, hpBarFrame, hpBarFill, hpText, labelText, stateText, telegraphMarker, telegraphExclaim, heavyTelegraphLabel, aggroExclaim]);"
$c = $c.Replace($needleB, $replB)
$needleC = "  const setTelegraphing = (active: boolean): void => {`r`n    telegraphMarker.setVisible(active);`r`n    telegraphExclaim.setVisible(active);`r`n    if (active) {"
$replC = "  const setTelegraphing = (active: boolean, attackKind: \`"normal\`" | \`"heavy\`" = \`"normal\`"): void => {`r`n    const isHeavy = attackKind === \`"heavy\`";`r`n    telegraphMarker.setFillStyle(isHeavy ? 0xff6a3d : 0xffe14a, 0.95);`r`n    telegraphMarker.setStrokeStyle(2, isHeavy ? 0x5c1200 : 0x6b4a00, 0.9);`r`n    telegraphExclaim.setText(isHeavy ? \`"!!\`" : \`"!\`");`r`n    telegraphExclaim.setColor(isHeavy ? \`"#fff3e0\`" : \`"#1a0e00\`");`r`n    telegraphMarker.setVisible(active);`r`n    telegraphExclaim.setVisible(active);`r`n    heavyTelegraphLabel.setVisible(active && isHeavy);`r`n    if (active) {"
$c = $c.Replace($needleC, $replC)
$needleD = "          targets: [telegraphMarker, telegraphExclaim],`r`n          scaleX: 1.15,`r`n          scaleY: 1.15,`r`n          yoyo: true,`r`n          duration: 110,`r`n          repeat: -1,"
$replD = "          targets: [telegraphMarker, telegraphExclaim, heavyTelegraphLabel],`r`n          scaleX: isHeavy ? 1.22 : 1.15,`r`n          scaleY: isHeavy ? 1.22 : 1.15,`r`n          yoyo: true,`r`n          duration: isHeavy ? 135 : 110,`r`n          repeat: -1,"
$c = $c.Replace($needleD, $replD)
$needleE = "      telegraphTween = null;`r`n      telegraphMarker.setScale(1);`r`n      telegraphExclaim.setScale(1);`r`n    }`r`n  };"
$replE = "      telegraphTween = null;`r`n      telegraphMarker.setScale(1);`r`n      telegraphExclaim.setScale(1);`r`n      heavyTelegraphLabel.setScale(1);`r`n      heavyTelegraphLabel.setVisible(false);`r`n    }`r`n  };"
$c = $c.Replace($needleE, $replE)
Set-Content -Path $f -Value $c -NoNewline

# 3. worldSessionAreaView.ts
$f = 'c:\Users\petrj\Moje hry\Doomscrolls\apps\client\src\game\scenes\worldSession\worldSessionAreaView.ts'
$c = Get-Content $f -Raw
$needle1 = "  readonly showEnemyTelegraph: (enemyId: string) => void;"
$repl1 = "  readonly showEnemyTelegraph: (enemyId: string, attackKind?: \`"normal\`" | \`"heavy\`") => void;"
$c = $c.Replace($needle1, $repl1)
$needle2 = "  const showEnemyTelegraph = (enemyId: string): void => {`r`n    const view = enemyPlaceholders.get(enemyId);`r`n    if (view === undefined) {`r`n      return;`r`n    }`r`n    view.setTelegraphing(true);`r`n  };"
$repl2 = "  const showEnemyTelegraph = (enemyId: string, attackKind: \`"normal\`" | \`"heavy\`" = \`"normal\`"): void => {`r`n    const view = enemyPlaceholders.get(enemyId);`r`n    if (view === undefined) {`r`n      return;`r`n    }`r`n    view.setTelegraphing(true, attackKind);`r`n  };"
$c = $c.Replace($needle2, $repl2)
Set-Content -Path $f -Value $c -NoNewline

# 4. WorldSessionScene.ts
$f = 'c:\Users\petrj\Moje hry\Doomscrolls\apps\client\src\game\scenes\WorldSessionScene.ts'
$c = Get-Content $f -Raw
$needle1 = "      onEnemyAttackTelegraph: (message) => {`r`n        this.worldAreaView?.showEnemyTelegraph(message.enemyId);`r`n      },"
$repl1 = "      onEnemyAttackTelegraph: (message) => {`r`n        this.worldAreaView?.showEnemyTelegraph(message.enemyId, message.attackKind);`r`n        if (message.attackKind === \`"heavy\`") {`r`n          this.feedbackView?.showNotice(\`"Heavy attack!\`");`r`n        }`r`n      },"
$c = $c.Replace($needle1, $repl1)
Set-Content -Path $f -Value $c -NoNewline

Write-Host "client patches done"
