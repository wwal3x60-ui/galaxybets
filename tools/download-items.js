// One-time script: self-host all drop item images in public/items/<id>.png
// Usage:  node tools/download-items.js --dry-run     (no network, just counts)
//         node tools/download-items.js               (download everything missing)
// Safe to re-run: existing valid PNGs are skipped. Failures are listed in tools/items-failed.json
const fs = require('fs');
const path = require('path');

const THUMB_API = process.env.THUMB_API || 'https://thumbnails.roblox.com/v1/batch';
const ALLOWED = (process.env.IMG_HOSTS || 'rbxcdn.com').split(',');   // host suffixes we will download from
const OUT = path.join('public', 'items');
const DRY = process.argv.includes('--dry-run');
const CONCURRENCY = 6;
const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const sleep = ms => new Promise(r => setTimeout(r, ms));

function loadItems() {
  const raw = JSON.parse(fs.readFileSync(path.join('utils', 'cases.json'), 'utf8'));
  const cases = Array.isArray(raw) ? raw : Object.values(raw);
  const items = new Map();
  for (const c of cases) for (const it of c.items || []) {
    const id = String(it.id);
    if (!/^\d+$/.test(id)) continue;
    if (!items.has(id) || (!items.get(id).img && it.img)) items.set(id, { id, name: it.name, img: it.img || null });
  }
  return [...items.values()];
}

const hostOk = u => { try { const h = new URL(u).hostname; return ALLOWED.some(a => h === a || h.endsWith('.' + a)); } catch { return false; } };
const validPng = f => { try { const b = fs.readFileSync(f); return b.length > 100 && b.subarray(0, 8).equals(PNG_SIG); } catch { return false; } };

async function withRetry(fn, tries = 4) {
  let err;
  for (let i = 0; i < tries; i++) {
    try { return await fn(); }
    catch (e) { err = e; if (e.noRetry) break; await sleep(500 * 2 ** i); }
  }
  throw err;
}

async function download(url, file) {
  if (!hostOk(url)) throw new Error('host not allowed: ' + url);
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) {
    const e = new Error('HTTP ' + res.status);
    e.noRetry = res.status >= 400 && res.status < 500 && res.status !== 429;   // don't hammer dead links
    throw e;
  }
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > 5 * 1024 * 1024) throw new Error('file too large');
  if (!buf.subarray(0, 8).equals(PNG_SIG)) throw new Error('not a PNG');
  fs.writeFileSync(file, buf);
}

async function lookupThumbs(ids) {            // item ids -> { id: freshImageUrl }
  const found = {};
  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50);
    for (const type of ['Asset', 'BundleThumbnail']) {
      const pending = chunk.filter(id => !found[id]);
      if (!pending.length) break;
      const body = pending.map(id => ({ requestId: `${id}::${type}:420x420:png:regular`, type, targetId: Number(id), token: '', format: 'png', size: '420x420' }));
      const data = await withRetry(async () => {
        const r = await fetch(THUMB_API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        if (!r.ok) throw new Error('thumb API HTTP ' + r.status);
        return r.json();
      });
      for (const row of data.data || []) if (row.state === 'Completed' && row.imageUrl) found[String(row.targetId)] = row.imageUrl;
    }
    await sleep(400);
  }
  return found;
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const items = loadItems();
  const todo = items.filter(it => !validPng(path.join(OUT, it.id + '.png')));
  console.log(`items: ${items.length} | already saved: ${items.length - todo.length} | to fetch: ${todo.length} (fresh thumbnail lookup by ID; stored URLs only as fallback)`);
  if (DRY) return console.log('dry run, nothing downloaded');

  const failed = [];
  let found = {};
  if (todo.length) {
    console.log(`looking up ${todo.length} thumbnail URLs...`);
    found = await lookupThumbs(todo.map(i => i.id));
    console.log(`  thumbnail API returned ${Object.keys(found).length}/${todo.length}`);
  }
  const queue = [...todo];
  let done = 0;
  await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
    while (queue.length) {
      const it = queue.shift();
      const candidates = [found[it.id], it.img].filter((u, i, a) => u && a.indexOf(u) === i);
      let ok = false, why = candidates.length ? '' : 'no thumbnail found';
      for (const url of candidates) {
        try { await withRetry(() => download(url, path.join(OUT, it.id + '.png'))); ok = true; break; }
        catch (e) { why = e.message; }
      }
      if (!ok) failed.push({ id: it.id, name: it.name, why });
      if (++done % 20 === 0) console.log(`  ${done}/${todo.length}`);
    }
  }));
  fs.writeFileSync(path.join('tools', 'items-failed.json'), JSON.stringify(failed, null, 2));
  const have = items.filter(it => validPng(path.join(OUT, it.id + '.png'))).length;
  console.log(`saved ${have}/${items.length} images in ${OUT}; failed ${failed.length} (see tools/items-failed.json)`);
}

main().catch(e => { console.error('FATAL', e.message); process.exit(1); });