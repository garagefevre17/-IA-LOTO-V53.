const fs=require('node:fs'), vm=require('node:vm'), assert=require('node:assert/strict');
const html=fs.readFileSync(process.argv[2],'utf8');
const code=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert(code, 'inline code absent');
const elements={};
function el(id){if(!elements[id])elements[id]={value:'',textContent:'',files:[],size:0,disabled:false,children:[],replaceChildren(){this.children=[];},append(...items){this.children.push(...items);},set className(v){this._className=v;},get className(){return this._className;}};return elements[id]}
const document={getElementById:el,createElement(tag){return {tag,children:[],textContent:'',append(...x){this.children.push(...x);}}}};
const csv=(()=>{let out=['date;n1;n2;n3;n4;n5;e1;e2'];let d=new Date('2025-11-01T12:00:00Z');while(d<=new Date('2026-11-26T12:00:00Z')){if([2,5].includes(d.getUTCDay()))out.push(`${d.toISOString().slice(0,10)};1;7;13;29;45;3;8`);d.setUTCDate(d.getUTCDate()+1);}return out.join('\n')})();
const memory={};let savedWrites=0;
const db={objectStoreNames:{contains:()=>true},createObjectStore(){},close(){},transaction(){let tx={oncomplete:null,onerror:null,onabort:null,objectStore(){return {put(data,key){memory[key]=data;savedWrites++;queueMicrotask(()=>tx.oncomplete?.())},get(key){const q={onsuccess:null,onerror:null,result:memory[key]};queueMicrotask(()=>q.onsuccess?.());return q}}}};return tx}};
const indexedDB={open(){const req={result:db,onsuccess:null,onerror:null};queueMicrotask(()=>req.onsuccess?.());return req}};
const crypto=require('node:crypto').webcrypto;
const sandbox={document,window:{indexedDB},indexedDB,crypto,Intl,Date,Map,Set,Error,Number,Array,Promise,TextEncoder,console,fetch:async()=>({ok:false}),setTimeout,URL,Blob};
vm.runInNewContext(code,sandbox);
const flush=()=>new Promise(res=>setTimeout(res,25));
(async()=>{
 await flush();
 el('csv').files=[{size:csv.length,name:'fdj-test.csv',text:async()=>csv}];
 await el('csv').onchange();
 assert.match(el('importState').textContent,/Sauvegardé/,'la sauvegarde ne s’est pas terminée');
 assert.equal(savedWrites,1,'une seule sauvegarde attendue');
 assert.equal(memory.latest.text,csv);
 el('target').value='2026-11-27';
 el('calculate').onclick();
 assert.match(el('status').textContent,/tirages pris en compte/);
 assert.equal(el('export').disabled,false);
 assert.equal(el('results').children.length,4,'trois grilles + fréquences');
 console.log('EuroMillions : import, sauvegarde IndexedDB, 365 jours, 3 grilles : OK');
})().catch(e=>{console.error(e);process.exitCode=1});
