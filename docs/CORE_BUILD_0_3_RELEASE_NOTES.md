# docs/CORE_BUILD_0_3_RELEASE_NOTES.md — Core Build 0.3 Release Notes

## Task 318 — Vendor Foundation: Open Basic Town Vendor Panel

**Summary:**

Implemented the first real town vendor interaction path. Clicking the Suspicious Vendor in the Nightmarket now opens a basic vendor panel backed by existing content data.

**Changes:**

- **`packages/content/src/data/townServices.ts`**: Added `nightmarket_suspicious_vendor` as a real town-service content definition with `serviceKind: "vendor"`, a localized `labelKey` and `unavailableMessageKey`.

- **`packages/content/src/data/types.ts`**: Extended `TownServiceId` union to include `"nightmarket_suspicious_vendor"`.

- **`packages/localization/src/LocaleTypes.ts`**: Added `town_service.suspicious_vendor.name` and `town_service.suspicious_vendor.unavailable` to `REQUIRED_LOCALIZATION_KEYS`.

- **`packages/localization/src/locales/en.ts`**: Added `"town_service.suspicious_vendor.name": "Suspicious Vendor"` and `"town_service.suspicious_vendor.unavailable": "Vendor trading is not available yet."` locale entries.

- **`apps/server/src/realtime/rooms/interactValidation.ts`**: Updated `getInteractableResponseMessage` for `nightmarket_vendor_01` to return the localized vendor name followed by a vendor greeting (`"Suspicious Vendor: 'What're you buyin'?'"`) instead of the previous `"Vendor trading is not available yet."` hardcoded string.

- **`apps/client/src/game/scenes/WorldSessionScene.ts`**: Updated the interact response handler for `nightmarket_vendor_01` to read the vendor label from `contentRegistry.townServices.get("nightmarket_suspicious_vendor").labelKey` via the localization `t()` function, eliminating the hardcoded `"Suspicious Vendor"` string.

**Verification:**

- `pnpm typecheck` — 0 errors
- `pnpm test` — all pass
- Pre-existing lint errors only (3 errors in unrelated files: `worldSessionAreaView.ts`, `worldSessionCursorFeedback.ts`)

**Known limitations:**

- Buy/sell actions remain disabled ("Trading locked for Core 0.1.")
- No vendor stock refresh or persistence
- No currency economy redesign