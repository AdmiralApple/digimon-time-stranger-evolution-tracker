// Parse a Digimon Story: Time Stranger save file entirely in-browser and derive
// per-species Field Guide progress (discovered / registered) plus scan %.
//
// Format (see /SAVE_FORMAT.md): AES-128-ECB, fixed key, exactly 3,098,176 bytes.
// ECB blocks are independent, so we only decrypt the ~16 KB window that holds the
// Field Guide record table and the scan-material table — nothing leaves the page.
import aesjs from 'aes-js';
import dbidToSlug from '../generated/dbid_to_slug.json';
import idToSlug from '../generated/id_to_slug.json';

const KEY = aesjs.utils.hex.toBytes('33393632373736373534353535383833');
const SAVE_SIZE = 3_098_176;

// Decrypt window (block-aligned) covering both tables of interest.
const REGION_START = 0x05c000;
const REGION_END = 0x060000;
const RECORD_TABLE = 0x05d2a8; // stride-0x10 records {id:i32, flags:i32, -1, -1}
const SCAN_TABLE = 0x05c100; // stride-4 (u16 digi_id, u16 scan_pct)

// flags bits (low 5): bit0 owned, bit1 seen, bit2 registered, bit3/4 scan.
const FLAG_REGISTERED = 0x04;
const FLAG_DISCOVERED = 0x05; // bit0 | bit2 — matches in-game "Discovered"

const DBID_TO_SLUG = dbidToSlug as Record<string, string>;
const ID_TO_SLUG = idToSlug as Record<string, string>;

export interface SaveProgress {
  /** Player name from the plaintext CSV header, if legible. */
  player: string;
  /** Species seen at least once (drives fog-of-war reveal). */
  discovered: Set<string>;
  /** Species fully registered in the Field Guide. */
  registered: Set<string>;
  /** slug → scan-material completion (1–200%), where present. */
  scanPct: Record<string, number>;
}

function decryptRegion(bytes: Uint8Array, start: number, end: number): DataView {
  // aes-js reads a plain array-like and returns a fresh Uint8Array; slice gives it a copy.
  const enc = bytes.slice(start, end);
  const dec = new aesjs.ModeOfOperation.ecb(KEY).decrypt(enc);
  return new DataView(dec.buffer, dec.byteOffset, dec.byteLength);
}

/** Parse raw save bytes. Throws if the file isn't a well-formed DSTS save. */
export function parseSave(bytes: Uint8Array): SaveProgress {
  if (bytes.length !== SAVE_SIZE) {
    throw new Error(
      `That file is ${bytes.length.toLocaleString()} bytes; a Time Stranger save is exactly ` +
        `${SAVE_SIZE.toLocaleString()} (savedata0N.dat / 000N.bin).`,
    );
  }

  const view = decryptRegion(bytes, REGION_START, REGION_END);
  const rel = (abs: number) => abs - REGION_START;

  const discovered = new Set<string>();
  const registered = new Set<string>();

  // Field Guide record table — walk to the end of the decrypt window; entries
  // whose id isn't a dex Digimon (NPCs/enemies) simply have no slug and are skipped.
  for (let off = RECORD_TABLE; off + 16 <= REGION_END; off += 16) {
    const id = view.getInt32(rel(off), true);
    if (id === 0) continue;
    const slug = DBID_TO_SLUG[String(id)];
    if (!slug) continue;
    const flags = view.getInt32(rel(off) + 4, true);
    if (flags & FLAG_DISCOVERED) discovered.add(slug);
    if (flags & FLAG_REGISTERED) registered.add(slug);
  }

  // Scan-material table (secondary): scan % per species; any progress implies seen.
  const scanPct: Record<string, number> = {};
  for (let off = SCAN_TABLE; off + 4 <= RECORD_TABLE; off += 4) {
    const did = view.getUint16(rel(off), true);
    const pct = view.getUint16(rel(off) + 2, true);
    if (pct === 0 || pct > 200) continue;
    const slug = ID_TO_SLUG[String(did)];
    if (!slug) continue;
    scanPct[slug] = pct;
    discovered.add(slug);
  }

  return { player: readPlayerName(bytes), discovered, registered, scanPct };
}

/** Player name lives in the plaintext CSV header (field 5), its own decrypt block. */
function readPlayerName(bytes: Uint8Array): string {
  try {
    const header = decryptRegion(bytes, 0x000, 0x100);
    let s = '';
    for (let i = 0; i < header.byteLength; i++) {
      const c = header.getUint8(i);
      if (c === 0) break;
      s += String.fromCharCode(c);
    }
    const field = s.split(',')[4];
    return field ? field.trim() : '';
  } catch {
    return '';
  }
}
