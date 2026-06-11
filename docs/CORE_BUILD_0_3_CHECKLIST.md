# docs/CORE_BUILD_0_3_CHECKLIST.md — Core Build 0.3 Checklist

## Task 318 — Vendor Foundation: Open Basic Town Vendor Panel

- [x] Audit existing town service / vendor interactables and vendorStocks content data
- [x] Added `nightmarket_suspicious_vendor` to `townServices.ts` content definition
- [x] Added `town_service.suspicious_vendor.name` and `.unavailable` localization keys
- [x] Added `"nightmarket_suspicious_vendor"` to `TownServiceId` union type
- [x] Added `town_service.suspicious_vendor.name` and `.unavailable` to `REQUIRED_LOCALIZATION_KEYS`
- [x] Updated server `getInteractableResponseMessage` for `nightmarket_vendor_01`: shows localized vendor name + greeting instead of "not available yet"
- [x] Updated client `WorldSessionScene` to read vendor name from `contentRegistry.townServices` instead of hardcoded `"Suspicious Vendor"`
- [x] Vendor panel still shows stock from existing `vendorStocks` data (no changes needed — already works)
- [x] No buying or selling introduced
- [x] No schema/database changes
- [x] `pnpm typecheck` — 0 errors
- [x] `pnpm test` — all pass
- [x] Pre-existing lint errors only (unrelated to this task)