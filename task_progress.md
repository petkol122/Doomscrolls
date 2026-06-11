# Task 315: Reconnect and Phantom Presence Cleanup Audit

- [x] Read and understand the task requirements
- [x] Audit server-side leave/cleanup (TownRoom, CombatRoom, presence, corpse, pending state)
- [x] Audit client scene teardown/reconnect (WorldSessionScene, area views, overlays, handlers)
- [x] Fix: TownRoom.onLeave missing enemy target cleanup (phantom player target reference)
- [x] Fix: WorldSessionScene room.onStateChange handler lifecycle (may fire after teardown)
- [x] Update docs/CORE_BUILD_0_2_CHECKLIST.md
- [x] Update docs/CORE_BUILD_0_2_RELEASE_NOTES.md
- [x] Verify existing behavior remains unchanged