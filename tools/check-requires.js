// Static check: every relative require('./x') / require('../x') must resolve to a file.
// Also reports requires of a given banned path fragment list (pass as args).
const fs = require('fs');
const path = require('path');

const roots = ['app.js', 'routes', 'socketio', 'utils', 'fairness', 'database', 'tests'];
const banned = process.argv.slice(2).map(s => s.toLowerCase());
const skip = new Set(['node_modules', '.git', 'dist', 'public']);
const exts = ['', '.js', '.json', '.cjs', '/index.js'];

function walk(p, out) {
  if (!fs.existsSync(p)) return out;
  const st = fs.statSync(p);
  if (st.isFile()) { if (p.endsWith('.js')) out.push(p); return out; }
  for (const f of fs.readdirSync(p)) if (!skip.has(f)) walk(path.join(p, f), out);
  return out;
}

const files = roots.flatMap(r => walk(r, []));
const re = /require\(\s*['"](\.{1,2}\/[^'"]*)['"]\s*\)/g;
let broken = 0, bannedHits = 0;
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  let m;
  while ((m = re.exec(src))) {
    const lineStart = src.lastIndexOf('\n', m.index) + 1;
    const lineText = src.slice(lineStart, src.indexOf('\n', m.index) === -1 ? undefined : src.indexOf('\n', m.index)).trim();
    if (lineText.startsWith('//') || lineText.startsWith('*') || lineText.startsWith('/*')) continue; // commented out
    const line = src.slice(0, m.index).split('\n').length;
    const target = path.resolve(path.dirname(f), m[1]);
    if (!exts.some(e => fs.existsSync(target + e) && fs.statSync(target + e).isFile())) {
      console.log(`BROKEN  ${f}:${line}  require('${m[1]}')`); broken++;
    }
    if (banned.some(b => m[1].toLowerCase().includes(b))) {
      console.log(`BANNED  ${f}:${line}  require('${m[1]}')`); bannedHits++;
    }
  }
}
console.log(`checked ${files.length} files, ${broken} broken requires, ${bannedHits} banned requires`);
process.exit(broken || bannedHits ? 1 : 0);