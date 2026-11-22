const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const code = fs.readFileSync(__dirname+'/loto_v534_shared.js','utf8');
function ord(s){let d = new Date(s+'T12:00:00Z');do{d.setUTCDate(d.getUTCDate()+1)}while(![1,3,6].includes(d.getUTCDay()));return d.toISOString().slice(0,10)}
function make(extra,overrides={}){
 const base=[['2026-11-11',1,2,3,4,5,1]];
 const db={'ia_loto_expert_v1_draws':JSON.stringify([...base,...extra]),...overrides};
 const ls={getItem(k){return Object.hasOwn(db,k)?db[k]:null}};
 const valid=r=>Array.isArray(r)&&r.length===7&&/^\d{4}-\d\d-\d\d$/.test(r[0])&&new Date(r[0]+'T12:00:00Z').toISOString().slice(0,10)===r[0]&&[1,3,6].includes(new Date(r[0]+'T12:00:00Z').getUTCDay())&&r.slice(1,6).every(n=>Number.isInteger(n)&&n>0&&n<=49)&&new Set(r.slice(1,6)).size===5&&Number.isInteger(r[6])&&r[6]>=1&&r[6]<=10;
 const window={Loto18:{allRows:()=>base,valid}};
 vm.runInNewContext(code,{window,localStorage:ls,document:{readyState:'loading',addEventListener(){}},Intl,Date,Map,Set,Error});
 return window.Loto534Shared;
}
const rows=['2026-11-14','2026-11-16','2026-11-18','2026-11-21'].map(d=>[d,1,2,3,4,5,1]);
let s=make(rows);
assert.equal(s.allRows().length,5);
assert.equal(s.info(new Date('2026-11-22T20:00:00Z')).nextDraw,'2026-11-23');
assert.equal(s.info(new Date('2026-11-22T20:00:00Z')).outdated,false);
assert.equal(s.info(new Date('2026-11-24T20:00:00Z')).outdated,true);
assert.equal(s.info(new Date('2026-11-22T20:00:00Z')).extraLocalRows,4);
assert.throws(()=>make([rows[0],rows[2],rows[3]]).allRows(),/discontinu/);
assert.throws(()=>make([['2026-11-11',11,12,13,14,15,1]]).allRows(),/Contradiction/);
assert.throws(()=>make([['2026-11-15',1,2,3,4,5,1]]).allRows(),/non conforme/);
assert.throws(()=>make(rows,{'ia_loto_v24_prospectif_fixe_v1':'bad'}).journalIndex(),/corrompu/);
let j=make(rows,{'ia_loto_v24_prospectif_fixe_v1':JSON.stringify([{target:'2026-11-23'}])}).journalIndex();
assert.equal(j.find(x=>x.name==='V24').entries,1);
assert(j.every(x=>x.verifiedByThirdParty===false));
assert.equal(ord('2026-11-21'),'2026-11-23');
console.log('10 vérifications de cohérence et de protection : OK');
