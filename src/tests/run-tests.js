import { execFileSync } from 'child_process';
let fail = 0;
for (const f of ['m1.test.js', 'm2.test.js', 'm4.test.js']) {
  try { const o = execFileSync('node', ['tests/' + f], { encoding: 'utf8' }); console.log(o.trim().split('\n').pop()); }
  catch (e) { fail++; console.log(e.stdout); }
}
for (const f of ['logic', 'ui']) for (const m of (await import('fs')).readdirSync(f)) execFileSync('node', ['--check', f + '/' + m]);
execFileSync('node', ['--check', 'main.js']);
console.log(fail ? 'TESTS ROT' : 'Alle Tests grün, Syntax ok');
process.exitCode = fail;
