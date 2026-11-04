// Lists npm packages the backend require()s that are missing from package.json (and optionally banned ones).
// Usage: node tools/check-deps.js [bannedPackage ...]
const fs = require('fs'), path = require('path');
const builtin = new Set(require('module').builtinModules);
const roots = ['app.js', 'routes', 'socketio', 'utils', 'fairness', 'database', 'tests'];
const banned = process.argv.slice(2);
function walk(p, o = []) {
  if (!fs.existsSync(p)) return o;
  const s = fs.statSync(p);
  if (s.isFile()) { if (p.endsWith('.js')) o.push(p); return o; }
  for (const f of fs.readdirSync(p)) if (f !== 'node_modules') walk(path.join(p, f), o);
  return o;
}
const used = {};
for (const f of roots.flatMap(r => walk(r))) {
  fs.readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
    if (/^\s*(\/\/|\*)/.test(line)) return;
    for (const m of line.matchAll(/require\(\s*['"]([^'".\/][^'"]*)['"]\s*\)/g)) {
      let n = m[1]; if (n.startsWith('node:')) continue;
      n = n.startsWith('@') ? n.split('/').slice(0, 2).join('/') : n.split('/')[0];
      if (!builtin.has(n)) (used[n] = used[n] || []).push(`${f}:${i + 1}`);
    }
  });
}
const pj = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const have = new Set(Object.keys({ ...pj.dependencies, ...pj.devDependencies }));
let bad = 0;
for (const n of Object.keys(used).sort()) {
  if (!have.has(n)) { console.log(`MISSING  ${n}  (${used[n][0]})`); bad++; }
  if (banned.includes(n)) { console.log(`BANNED   ${n}  (${used[n][0]})`); bad++; }
}
console.log(`${Object.keys(used).length} packages required, ${bad} problem(s)`);
process.exit(bad ? 1 : 0);