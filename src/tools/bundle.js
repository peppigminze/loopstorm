// Bündelt ES-Module, JSON-Daten und CSS zu EINER self-contained dist/index.html
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { DATA_FILES } from '../logic/content.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const order = [], seen = new Set();
const IMPORT_RE = /^import\s*\{([^}]*)\}\s*from\s*['"](.+?)['"];?\s*$/gm;

function visit(rel) {
  if (seen.has(rel)) return;
  seen.add(rel);
  const src = fs.readFileSync(path.join(root, rel), 'utf8');
  for (const m of src.matchAll(IMPORT_RE)) visit(path.posix.join(path.posix.dirname(rel), m[2]));
  order.push(rel);
}
visit('main.js');

const id = (rel) => '__m_' + rel.replace(/[^a-zA-Z0-9]/g, '_');
let js = '';
for (const rel of order) {
  let src = fs.readFileSync(path.join(root, rel), 'utf8');
  const exports = [];
  src = src.replace(IMPORT_RE, (_, names, from) => {
    const dep = path.posix.join(path.posix.dirname(rel), from);
    const parts = names.split(',').map((s) => s.trim()).filter(Boolean).map((s) => s.replace(/\s+as\s+/, ': '));
    return `const { ${parts.join(', ')} } = ${id(dep)};`;
  });
  src = src.replace(/^export\s+(async\s+function|function|const|let|class)\s+([A-Za-z0-9_$]+)/gm, (_, kw, name) => { exports.push(name); return kw + ' ' + name; });
  src = src.replace(/^export\s*\{([^}]*)\};?\s*$/gm, (_, names) => { names.split(',').map((s) => s.trim()).filter(Boolean).forEach((n) => exports.push(n)); return ''; });
  if (/^\s*(import|export)\s/m.test(src)) throw new Error('Unbehandeltes import/export in ' + rel);
  js += `\n// ---- ${rel} ----\nconst ${id(rel)} = (function () {\n${src}\nreturn { ${exports.join(', ')} };\n})();\n`;
}

const data = {};
for (const f of DATA_FILES) data[f] = JSON.parse(fs.readFileSync(path.join(root, 'data', f + '.json'), 'utf8'));
const css = fs.readFileSync(path.join(root, 'style.css'), 'utf8');
let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const script = `'use strict';\nwindow.__DATA__ = ${JSON.stringify(data)};\n${js}`.replace(/<\/script/gi, '<\\/script');
html = html.replace('<link rel="stylesheet" href="style.css">', () => `<style>\n${css}</style>`);
html = html.replace('<script type="module" src="main.js"></script>', () => `<script>\n(function () {\n${script}\n})();\n</script>`);
if (html.includes('src="main.js"') || html.includes('href="style.css"')) throw new Error('Ersetzung fehlgeschlagen');
fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
fs.writeFileSync(path.join(root, 'dist', 'index.html'), html);
// Syntax-Check des gebündelten Skripts
fs.writeFileSync('/tmp/bundle_check.js', script);
console.log(`dist/index.html: ${(html.length / 1024).toFixed(1)} KB, ${order.length} Module: ${order.join(', ')}`);
