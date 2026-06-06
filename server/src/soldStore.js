// Persistent store of SOLD (permanently removed) lottery numbers.
//
// A number that has been purchased must never be offered again — even after a
// server restart. We persist the sold set to a JSON file on disk. For a single
// kiosk fleet on a LAN this is enough; for a multi-server deployment swap this
// file for the same authoritative DB/Redis set behind the same exported surface
// (has / add / list / size).

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_FILE = path.join(__dirname, "..", "data", "sold.json");

export function createSoldStore({ file = DEFAULT_FILE } = {}) {
  const sold = new Set();

  // Load any previously sold numbers from disk.
  try {
    const raw = fs.readFileSync(file, "utf8");
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) for (const n of arr) sold.add(n);
  } catch (err) {
    if (err.code !== "ENOENT") {
      console.warn(`[soldStore] could not read ${file}:`, err.message);
    }
  }

  function persist() {
    try {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      // Write to a temp file then rename so a crash mid-write can't corrupt it.
      const tmp = `${file}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify([...sold]));
      fs.renameSync(tmp, file);
    } catch (err) {
      console.error(`[soldStore] FAILED to persist sold numbers to ${file}:`, err.message);
    }
  }

  function has(number) {
    return sold.has(number);
  }

  // Mark numbers as permanently sold. Returns the numbers that were newly added.
  function add(numbers) {
    const added = [];
    for (const n of numbers) {
      if (!sold.has(n)) {
        sold.add(n);
        added.push(n);
      }
    }
    if (added.length) persist();
    return added;
  }

  function list() {
    return [...sold];
  }

  function size() {
    return sold.size;
  }

  return { has, add, list, size };
}
