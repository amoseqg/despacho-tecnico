import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const src=fs.readFileSync('release-info.js','utf8');const ctx={};vm.runInNewContext(src,ctx);
const {current,releases}=ctx.NexoFieldRelease;
assert.match(current,/^\d+\.\d+\.\d+$/);
assert.equal(releases[0].version,current);assert.equal(new Set(releases.map(r=>r.version)).size,releases.length);
for(const r of releases){assert.match(r.date,/^\d{4}-\d{2}-\d{2}$/);assert.equal(new Date(r.date).toISOString().slice(0,10),r.date);assert.ok(r.changes.length>0);}
const html=fs.readFileSync('app.part3','utf8');assert.ok(html.includes('/release-info.js?v='+current));
assert.ok(Object.isFrozen(ctx.NexoFieldRelease));
console.log('Versão '+current+': formato, data, histórico e inclusão no aplicativo validados.');
