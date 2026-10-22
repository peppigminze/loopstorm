// Deterministischer Zufall (mulberry32) + Helfer
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
export function pickWeighted(rng, list, key = 'w') {
  let sum = 0;
  for (let i = 0; i < list.length; i++) sum += list[i][key];
  let r = rng() * sum;
  for (let i = 0; i < list.length; i++) { r -= list[i][key]; if (r <= 0) return list[i]; }
  return list[list.length - 1];
}
export function range(rng, a, b) { return a + (b - a) * rng(); }
export function shuffle(rng, arr) {
  for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); const t = arr[i]; arr[i] = arr[j]; arr[j] = t; }
  return arr;
}
