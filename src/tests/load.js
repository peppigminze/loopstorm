import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { DATA_FILES, prepareData } from '../logic/content.js';
const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data');
export function loadRaw() { const raw = {}; for (const f of DATA_FILES) raw[f] = JSON.parse(fs.readFileSync(path.join(dir, f + '.json'), 'utf8')); return raw; }
export function loadData() { return prepareData(loadRaw()); }
let fails = 0, passes = 0;
export function ok(cond, msg) { if (cond) passes++; else { fails++; console.log('  FAIL:', msg); } }
export function summary(name) { console.log(`${name}: ${passes} ok, ${fails} fail`); return fails; }
