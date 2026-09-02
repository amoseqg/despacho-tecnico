import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const nodes=[];
class Element {
  constructor(tag){this.tag=tag;this.children=[];this.events={};nodes.push(this);}
  append(...items){this.children.push(...items);}
  setAttribute(k,v){this[k]=v;}
  addEventListener(k,fn){this.events[k]=fn;}
}
const bars=[new Element('bar'),new Element('bar'),new Element('bar')];
const root={dataset:{}};const meta={};const saved=new Map();let observe;
const selects=()=>nodes.filter(n=>n.tag==='select');
const ctx={S:{_id:'a'},document:{readyState:'complete',documentElement:root,
  querySelectorAll:q=>q==='.user-bar'?bars:selects(),querySelector:()=>meta,
  getElementById:()=>({}),createElement:t=>new Element(t)},
  localStorage:{getItem:k=>saved.get(k),setItem:(k,v)=>saved.set(k,v)},
  MutationObserver:class{constructor(fn){observe=fn;}observe(){}},window:{addEventListener(){}}};
vm.runInNewContext(fs.readFileSync('appearance.js','utf8'),ctx);
assert.equal(selects().length,3);assert.equal(root.dataset.appearance,'azul');
selects()[0].value='petroleo';selects()[0].events.change();
assert.equal(root.dataset.appearance,'petroleo');assert.equal(meta.content,'#063b40');
assert.ok(selects().every(s=>s.value==='petroleo'));
ctx.S={_id:'b'};observe();assert.equal(root.dataset.appearance,'azul');
selects()[1].value='branco';selects()[1].events.change();assert.equal(root.dataset.appearance,'branco');
ctx.S={_id:'a'};observe();assert.equal(root.dataset.appearance,'petroleo');
ctx.S=null;observe();assert.equal(root.dataset.appearance,'azul');
ctx.S={_id:'b'};observe();assert.equal(root.dataset.appearance,'branco');
ctx.localStorage.setItem=()=>{throw Error('denied')};
selects()[1].value='petroleo';assert.doesNotThrow(()=>selects()[1].events.change());
assert.equal(root.dataset.appearance,'petroleo');
assert.ok(nodes.some(n=>n.textContent==='Aplicado nesta sessão; navegador não permitiu salvar'));
saved.set('nexofield.appearance.v1:a','invalid');ctx.S={_id:'a'};observe();assert.equal(root.dataset.appearance,'azul');
console.log('Aparência validada: 3 áreas, 3 cores, isolamento por conta, restauração, saída e armazenamento indisponível.');
