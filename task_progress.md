# Task 227 - Fix Enemy AI + Loot Pickup

## Bugs identified

### Bug 1: enemy.moveSpeed is in raw content units, but `moveEnemyTowardTarget` treats it as world-units-per-second
- Content has `moveSpeed: 0.84` (for trashboar_runt)
- Player movement speed: `derived.moveSpeed * 220` (player runs at ~220 world units/sec)
- Enemy `moveEnemyTowardTarget(enemy, target, enemyMoveSpeed=0.84, deltaMs)` — uses 0.84 as if it were world units/sec → enemy moves 0.042 world units per tick (50ms) → essentially stationary
- **Fix**: scale enemy moveSpeed by the same multiplier as player (or read content correctly)

### Bug 2: enemy aggroRange/leashRange are stored in content units, but the `moveEnemyTowardTarget` already converts to world units via `toWorldUnits` (× 24)
- `toWorldUnits(aggroRange ?? 0, 120) = 5.1 * 24 = 122.4` world units (good)
- BUT enemy `moveSpeed` is NOT scaled → enemy only moves 0.042 units per tick (≈ 0.84 units/sec) vs 220 units/sec for player
- **Result**: enemy can't catch up to player

### Bug 3: `moveEnemyTowardPoint` (return-to-spawn) also uses raw `enemyMoveSpeed` → enemy returns at crawl speed
- **Fix**: scale enemy moveSpeed in both movement functions, or pass scaled value

### Bug 4: Loot hit priority is below live enemy hit
- `worldSessionAreaView.ts` line 564-598: inputZone LMB checks `findClickedEnemy` first, then `findClickedWorldLoot`
- A live enemy sitting on top of loot will always block loot pickup
- The task says "loot hit priority must be above defeated enemy/corpse visuals" — currently defeated enemies are filtered (line 899-901), but live enemies still block
- **Fix**: when an enemy is alive AND overlapping loot, both can be valid. Best to make loot priority WIN when player clicks directly on loot position (use a smaller hit radius for enemy, bigger for loot, and check loot first when within loot radius)

### Bug 5: `findClickedEnemy` returns the closest hit enemy even if a loot is at the exact click position
- The dead-zones fix for this is to check loot first when within loot radius, OR raise the enemy hit radius (24px) above the loot hit radius (30px) to give loot priority

### Bug 6: spawnLoot scatter position is initialized from `enemy.x + 10, enemy.y + 8` and then randomized ±8
- Spawns at ±18 from enemy center → often behind/in enemy body
- **Fix**: spawn loot further from enemy center so pickup is easier

## Plan

1. Fix enemy moveSpeed units - multiply by world units multiplier (e.g., 220)
2. Fix loot hit priority - check loot first in inputZone, and/or make sure defeated enemy filter works
3. Verify all checks pass
