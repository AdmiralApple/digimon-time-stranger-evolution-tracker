# Digimon Story: Time Stranger — Save Format (Field Guide extraction)

Validated against a real ~55-hr save (2026-08 patch) and 7 save slots spanning
months. Screenshot-validated (423 discovered / 406 registered).

## Container
- File: `savedata0N.dat` (Steam `userdata/<id>/1984270/remote/`) or
  `gamedata/savedata/<steamid>/000N.bin`. **Exactly 3,098,176 bytes.**
- **Encryption: AES-128-ECB, fixed key** `33393632373736373534353535383833`.
  ECB ⇒ every 16-byte block independent; decrypt only the blocks you need.
- After decrypt, offset 0x000–0x100 is a plaintext CSV header
  (`slot, size, ?, ?, playerName, playTimeSec, ...`).

## Field Guide record table  @ 0x05D2A8
Array of 16-byte records, packed (present entries only), terminated by a run of
zero records. Each record:

| offset | type  | field  | meaning |
|--------|-------|--------|---------|
| +0x00  | i32   | id     | **field-guide id** (see mapping below) |
| +0x04  | i32   | flags  | state bitfield (see below) |
| +0x08  | i32   | pad1   | -1 when registered, else 0 |
| +0x0C  | i32   | pad2   | -1 / 0 |

~631 records: 475 map to dex Digimon, the rest are NPCs/enemies/forms
(ids ~800–999 and scattered) that the dex tool ignores.

### flags bits (low 5)
- bit0 (0x01): owned/obtained
- bit1 (0x02): seen (in field guide)
- bit2 (0x04): **registered** (added to guide — the game's "Registered")
- bit3/bit4 (0x18): scan-related (set together)
- high bits 16–18: misc, ignored

### Derived per-species state (dex 475)
- **registered** ⟺ `flags & 0x04`         → 405 dex (game 406 incl. 1 non-dex)
- **discovered** ⟺ `flags & 0x05` (bit0|bit2) → 422 dex (game 423 incl. 1 non-dex)
- Both are supersets in the expected order (registered ⊆ discovered).

## field-guide id → dex slug
`localized_names` (in ANAMNESIS `anamnesis.db`, itself extracted from the game's
MBE files) maps **exactly 475 db_ids → names** (5 locales each). db_id is the
field-guide id. Match its ASCII/EN name to `digimon.json` names → slug.
Baked to `dbid_to_slug.json` (475 entries, 0 unmatched). NB: for base Digimon
db_id == internal digi_id (Agumon=50), but variants/specials differ
(Loaderleomon=479, BanchoStingmon=485…), so the localized_names join is required.

## Scan-material table  @ 0x05C100  (secondary/optional)
Stride 4: `(u16 digi_id, u16 scan_pct)` per internal digi_id, 0–200%. This is
active scan-material progress (≠ field guide). Can drive a "scan %" overlay.
