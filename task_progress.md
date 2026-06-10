# Task 290: Remove Nightmarket-Specific Town Interactable Hardcoding

- [x] Analyze current hardcoded pattern in `initializeTownInteractables.ts`
- [x] Examine world props content definitions and types
- [x] Examine content registry for data-driven lookup capabilities
- [ ] Rewrite `initializeTownInteractables.ts` with data-driven zone-based filtering
- [ ] Update `docs/TECH_DEBT.md` to mark the hardcoded Nightmarket interactable item as resolved
- [ ] Update `docs/CORE_BUILD_0_2_RELEASE_NOTES.md` with the change
- [ ] Verify with `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`