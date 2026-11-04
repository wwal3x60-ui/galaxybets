// Runs `node --check` on every backend .js file. Exit code 1 if any file has a syntax error.
// Usage: node tools/check-syntax.js
const fs = require('fs'), path = require('path'), { spawnSync } = require('child_process');
const roots = ['app.js', 'routes', 'socketio', 'utils', 'fairness', 'database', 'tests', 'tools'];
function walk(p, o = []) {
  if (!fs.existsSync(p)) return o;
  const s = fs.statSync(p);
  if (s.isFile()) { if (p.endsWith('.js')) o.push(p); return o; }
  for (const f of fs.readdirSync(p)) if (f !== 'node_modules') walk(path.join(p, f), o);
  return o;
}
const files = roots.flatMap(r => walk(r));
let bad = 0;
for (const f of files) {
  const r = spawnSync(process.execPath, ['--check', f], { encoding: 'utf8' });
  if (r.status !== 0) {
    bad++;
    const firstLine = (r.stderr || '').split('\n').find(l => /SyntaxError/.test(l)) || 'syntax error';
    const loc = (r.stderr || '').split('\n').find(l => l.includes(f.replace(/\\/g, path.sep))) || f;
    console.log(`SYNTAX ERROR  ${loc.trim()}\n              ${firstLine.trim()}`);
  }
}
console.log(`${files.length} files checked, ${bad} syntax error(s)`);
process.exit(bad ? 1 : 0);