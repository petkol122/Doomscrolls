$ErrorActionPreference = 'Stop'

# 1. attackIntentClient.ts -- allow attackKind in validators
$f = 'c:\Users\petrj\Moje hry\Doomscrolls\apps\client\src\net\attackIntentClient.ts'
$c = Get-Content $f -Raw
$needle1 = "    typeof candidate.windupMs === \`"number\`"`r`n  );"
$repl1 = "    typeof candidate.windupMs === \`"number\`" &&`r`n    (candidate.attackKind === undefined || candidate.attackKind === \`"normal\`" || candidate.attackKind === \`"heavy\`")`r`n  );"
$c = $c.Replace($needle1, $repl1)
$needle2 = "    && (candidate.outcome === \`"hit\`" || candidate.outcome === \`"miss\`")`r`n    && (candidate.damage === undefined"
$repl2 = "    && (candidate.outcome === \`"hit\`" || candidate.outcome === \`"miss\`")`r`n    && (candidate.attackKind === undefined || candidate.attackKind === \`"normal\`" || candidate.attackKind === \`"heavy\`")`r`n    && (candidate.damage === undefined"
$c = $c.Replace($needle2, $repl2)
Set-Content -Path $f -Value $c -NoNewline

# 2. worldSessionEnemyPlaceholderView.ts -- add HEAVY marker + accept kind
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

# 3. worldSessionAreaView.ts -- showEnemyTelegraph accepts kind and forwards
$f = 'c:\Users\petrj\Moje hry\Doomscrolls\apps\client\src\game\scenes\worldSession\worldSessionAreaView.ts'
$c = Get-Content $f -Raw
$needle1 = "  readonly showEnemyTelegraph: (enemyId: string) => void;"
$repl1 = "  readonly showEnemyTelegraph: (enemyId: string, attackKind?: \`"normal\`" | \`"heavy\`") => void;"
$c = $c.Replace($needle1, $repl1)
$needle2 = "  const showEnemyTelegraph = (enemyId: string): void => {`r`n    const view = enemyPlaceholders.get(enemyId);`r`n    if (view === undefined) {`r`n      return;`r`n    }`r`n    view.setTelegraphing(true);`r`n  };"
$repl2 = "  const showEnemyTelegraph = (enemyId: string, attackKind: \`"normal\`" | \`"heavy\`" = \`"normal\`"): void => {`r`n    const view = enemyPlaceholders.get(enemyId);`r`n    if (view === undefined) {`r`n      return;`r`n    }`r`n    view.setTelegraphing(true, attackKind);`r`n  };"
$c = $c.Replace($needle2, $repl2)
Set-Content -Path $f -Value $c -NoNewline

# 4. WorldSessionScene.ts -- pass kind + notice on heavy
$f = 'c:\Users\petrj\Moje hry\Doomscrolls\apps\client\src\game\scenes\WorldSessionScene.ts'
$c = Get-Content $f -Raw
$needle1 = "      onEnemyAttackTelegraph: (message) => {`r`n        this.worldAreaView?.showEnemyTelegraph(message.enemyId);`r`n      },"
$repl1 = "      onEnemyAttackTelegraph: (message) => {`r`n        this.worldAreaView?.showEnemyTelegraph(message.enemyId, message.attackKind);`r`n        if (message.attackKind === \`"heavy\`") {`r`n          this.feedbackView?.showNotice(\`"Heavy attack!\`");`r`n        }`r`n      },"
$c = $c.Replace($needle1, $repl1)
Set-Content -Path $f -Value $c -NoNewline

# 5. TownRoom.ts -- add Brute heavy attack branch
$f = 'c:\Users\petrj\Moje hry\Doomscrolls\apps\server\src\realtime\rooms\TownRoom.ts'
$c = Get-Content $f -Raw
$needle1 = "const ENEMY_ATTACK_WINDUP_MS = 350;`r`nconst ENEMY_RETURN_ARRIVAL_DISTANCE = 1;"
$repl1 = "const ENEMY_ATTACK_WINDUP_MS = 350;`r`n// Task 226 -- Brute-only charged heavy attack foundation.`r`nconst BRUTE_HEAVY_ATTACK_MIN_WINDUP_MS = 1200;`r`nconst BRUTE_HEAVY_ATTACK_MAX_WINDUP_MS = 1800;`r`nconst BRUTE_HEAVY_ATTACK_DEFAULT_CHANCE = 0.34;`r`nconst ENEMY_RETURN_ARRIVAL_DISTANCE = 1;"
$c = $c.Replace($needle1, $repl1)
$needle2 = "function sendEnemyAttackTelegraph(`r`n  targetClient: Client,`r`n  enemyId: string,`r`n  targetCharacterId: string,`r`n  windupMs: number,`r`n): void {`r`n  const telegraph: EnemyAttackTelegraphServerMessage = {`r`n    type: \`"enemy_attack_telegraph\`",`r`n    enemyId,`r`n    targetEntityId: targetCharacterId as unknown as EntityId,`r`n    windupMs,`r`n  };"
$repl2 = "function sendEnemyAttackTelegraph(`r`n  targetClient: Client,`r`n  enemyId: string,`r`n  targetCharacterId: string,`r`n  windupMs: number,`r`n  attackKind: \`"normal\`" | \`"heavy\`" = \`"normal\`",`r`n): void {`r`n  const telegraph: EnemyAttackTelegraphServerMessage = {`r`n    type: \`"enemy_attack_telegraph\`",`r`n    enemyId,`r`n    targetEntityId: targetCharacterId as unknown as EntityId,`r`n    windupMs,`r`n    attackKind,`r`n  };"
$c = $c.Replace($needle2, $repl2)
$needle3 = "      const enemyAttackCooldownMs = enemyDefinition?.attackCooldownMs ?? 1200;`r`n      const enemyAttackDamage = enemyDefinition?.damage ?? 2;"
$repl3 = "      const enemyAttackCooldownMs = enemyDefinition?.attackCooldownMs ?? 1200;`r`n      const enemyAttackDamage = enemyDefinition?.damage ?? 2;`r`n      const heavyAttackChance = enemyDefinition?.heavyAttackChance ?? BRUTE_HEAVY_ATTACK_DEFAULT_CHANCE;`r`n      const heavyAttackWindupMs = Math.min(`r`n        BRUTE_HEAVY_ATTACK_MAX_WINDUP_MS,`r`n        Math.max(BRUTE_HEAVY_ATTACK_MIN_WINDUP_MS, Math.floor(enemyDefinition?.heavyAttackWindupMs ?? 1500)),`r`n      );`r`n      const heavyAttackCooldownMs = enemyDefinition?.heavyAttackCooldownMs ?? Math.max(enemyAttackCooldownMs, heavyAttackWindupMs + 400);`r`n      const heavyAttackDamage = enemyDefinition?.heavyAttackDamage ?? Math.max(enemyAttackDamage + 1, enemyAttackDamage * 2);"
$c = $c.Replace($needle3, $repl3)
$needle4 = "          enemy.attackLandingAtMs = 0;`r`n          enemy.nextAttackAtMs = now + enemyAttackCooldownMs;`r`n          if (landingClient !== undefined) {`r`n            sendEnemyAttackResolved(landingClient, {`r`n              type: \`"enemy_attack_resolved\`",`r`n              enemyId: enemy.id,`r`n              targetEntityId: (landingTarget?.characterId ?? \`"\`) as unknown as EntityId,`r`n              outcome: \`"miss\`",`r`n            });"
$repl4 = "          const missAttackKind = enemy.attackKind;`r`n          enemy.attackLandingAtMs = 0;`r`n          enemy.attackKind = \`"normal\`";`r`n          enemy.nextAttackAtMs = now + (missAttackKind === \`"heavy\`" ? heavyAttackCooldownMs : enemyAttackCooldownMs);`r`n          if (landingClient !== undefined) {`r`n            sendEnemyAttackResolved(landingClient, {`r`n              type: \`"enemy_attack_resolved\`",`r`n              enemyId: enemy.id,`r`n              targetEntityId: (landingTarget?.characterId ?? \`"\`) as unknown as EntityId,`r`n              outcome: \`"miss\`",`r`n              attackKind: missAttackKind,`r`n            });"
$c = $c.Replace($needle4, $repl4)
$needle5 = "        enemy.attackLandingAtMs = 0;`r`n        const nextHp = Math.max(0, landingTarget.hp - enemyAttackDamage);"
$repl5 = "        const resolvedAttackKind = enemy.attackKind;`r`n        const resolvedDamage = resolvedAttackKind === \`"heavy\`" ? heavyAttackDamage : enemyAttackDamage;`r`n        enemy.attackLandingAtMs = 0;`r`n        enemy.attackKind = \`"normal\`";`r`n        const nextHp = Math.max(0, landingTarget.hp - resolvedDamage);"
$c = $c.Replace($needle5, $repl5)
$needle6 = "        } else {`r`n          enemy.nextAttackAtMs = now + enemyAttackCooldownMs;`r`n        }`r`n`r`n        if (landingClient !== undefined) {`r`n          const damageMessage: DamageAppliedServerMessage = {`r`n            type: \`"damage_applied\`",`r`n            targetEntityId: landingTarget.characterId as unknown as EntityId,`r`n            sourceEntityId: enemy.id as unknown as EntityId,`r`n            damage: enemyAttackDamage,"
$repl6 = "        } else {`r`n          enemy.nextAttackAtMs = now + (resolvedAttackKind === \`"heavy\`" ? heavyAttackCooldownMs : enemyAttackCooldownMs);`r`n        }`r`n`r`n        if (landingClient !== undefined) {`r`n          const damageMessage: DamageAppliedServerMessage = {`r`n            type: \`"damage_applied\`",`r`n            targetEntityId: landingTarget.characterId as unknown as EntityId,`r`n            sourceEntityId: enemy.id as unknown as EntityId,`r`n            damage: resolvedDamage,"
$c = $c.Replace($needle6, $repl6)
$needle7 = "            type: \`"enemy_attack_resolved\`",`r`n            enemyId: enemy.id,`r`n            targetEntityId: landingTarget.characterId as unknown as EntityId,`r`n            outcome: \`"hit\`",`r`n            damage: enemyAttackDamage,"
$repl7 = "            type: \`"enemy_attack_resolved\`",`r`n            enemyId: enemy.id,`r`n            targetEntityId: landingTarget.characterId as unknown as EntityId,`r`n            outcome: \`"hit\`",`r`n            attackKind: resolvedAttackKind,`r`n            damage: resolvedDamage,"
$c = $c.Replace($needle7, $repl7)
$needle8 = "      // Start a new telegraph + windup. Damage will only be applied`r`n      // after ENEMY_ATTACK_WINDUP_MS on a future tick.`r`n      enemy.attackLandingAtMs = now + ENEMY_ATTACK_WINDUP_MS;`r`n      enemy.nextAttackAtMs = enemy.attackLandingAtMs + enemyAttackCooldownMs;`r`n`r`n      const telegraphClient = this.clients.find(`r`n        (client) => client.sessionId === targetPlayer.sessionId,`r`n      );`r`n      if (telegraphClient !== undefined) {`r`n        sendEnemyAttackTelegraph(`r`n          telegraphClient,`r`n          enemy.id,`r`n          targetPlayer.characterId,`r`