'use strict';
// Headless browser-DOM simulation. Does not replace a real Safari test.
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const ids=['emTarget','emWindow','emOutput','emTestOutput','emExport','emExportTest','emFile','emAdd','emManualNums','emManualStars','emManualDate','emDownloadHistory','emGenerate','emBacktest'];
const elements=Object.fromEntries(ids.map(id=>[id,{value:'',textContent:'',disabled:false,files:[],addEventListener(){}}]));
elements.emWindow.value='20';
const sandbox={document:{getElementById:id=>elements[id]||null,createElement:()=>({click(){},remove(){}}),body:{append(){}}},window:{},console,Date,Intl,Blob,URL,Set,Map,Array,Object,Number,String,Error,Promise,setTimeout};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync('euromillions.js','utf8'),sandbox);
const lab=sandbox.window.EMLab;
assert(lab,'EuroMillions module not initialized');
const eq=(a,b)=>assert.strictEqual(JSON.stringify(a),JSON.stringify(b));
assert.throws(()=>lab.row('2026-11-17',[1,1,3,4,5],[1,2]),/distincts/);
assert.throws(()=>lab.row('2026-11-18',[1,2,3,4,5],[1,2]),/mardi ou vendredi/);
assert.throws(()=>lab.row('2026-11-17',[1,2,3,4,51],[1,2]),/entre 1 et 50/);
assert.throws(()=>lab.row('2026-11-17',[1,2,3,4,5],[1,13]),/entre 1 et 12/);
const rows=[];let day=new Date('2026-01-02T12:00:00Z');
for(let i=0;i<60;i++) {const d=day.toISOString().slice(0,10);rows.push(`${d};${[1,2,3,4,5].map(x=>x+i%10).join(';')};1;2`);day.setUTCDate(day.getUTCDate()+(day.getUTCDay()===5?4:3));}
const data=lab.parse('date;n1;n2;n3;n4;n5;e1;e2\n'+rows.join('\n'));
assert.strictEqual(data.length,60);
assert.strictEqual(lab.anomalies(data).length,0);
const p=lab.predict(data.slice(0,30),20,1);
assert.strictEqual(p.nums.length,5);assert.strictEqual(p.stars.length,2);
assert.throws(()=>lab.parse('date;n1;n2;n3;n4;n5;e1;e2\n'+rows[0]+'\n'+rows[0]),/double/);
const gap=lab.parse('date;n1;n2;n3;n4;n5;e1;e2\n'+[...rows.slice(0,5),...rows.slice(6)].join('\n'));
assert(lab.anomalies(gap).length>0);
elements.emGenerate.onclick();
assert(elements.emOutput.textContent.includes('Calcul impossible'),'Missing-history UI error not shown');
assert(elements.emExport.disabled,'Export not disabled after failed forecast');
console.log('EuroMillions JS: 10 checks passed (module init, invalid numbers, calendar, CSV, gaps, forecast, UI error).');

const app=fs.readFileSync('app.js','utf8');
const checker=vm.runInNewContext(
 app.slice(app.indexOf('function mainMatchOdds'),app.indexOf('function wire'))+
 '\n({compareEuroGrids,randomGrid})',
 {
  $:id=>quickFields[id],
  document:{createElement:()=>({
   children:[], append(child){this.children.push(child);},
   addEventListener(type,listener){this[type]=listener;}
  })},
  crypto:require('node:crypto').webcrypto,
  window:{confirm:()=>allowReplacement},
  Event
 }
);
const draw='12 17 26 34 38 + 5 9';
eq(checker.compareEuroGrids(draw,'2 7 8 11 49 + 1 12\r\n1 21 22 38 43 + 4 9'),[
 {numbers:[],stars:[]},{numbers:[38],stars:[9]}
]);
for(const invalid of ['1 2 3 4 4 + 1 2','1 2 3 4 51 + 1 2','1 2 3 4 5 + 1 13','1 2 3 4 5 + 1 1']){
 assert.throws(()=>checker.compareEuroGrids(draw,invalid),/Grille 1/);
}
let allowReplacement=false;
let inputEvents=0;
const quickFields={
 quickGridCount:{value:2},
 quickCoverMain:{checked:true},
 quickCoverExtras:{checked:true},
 quickAvoidDates:{checked:false},
 quickGridOutput:{replaceChildren(...children){this.children=children;},append(child){this.children.push(child);}},
 euroCheckGrids:{value:'2 7 8 11 49 + 1 12',dispatchEvent(event){
  assert.strictEqual(event.type,'input');
  assert(event.bubbles);
  inputEvents++;
 }},
 euroCheckPanel:{open:false,scrollIntoView(){}},
 euroCheckDraw:{focus(){this.focused=true;}}
};
checker.randomGrid('euromillions');
const transfer=quickFields.quickGridOutput.children.at(-1);
assert.strictEqual(transfer.textContent,'Ouvrir ces grilles dans le vérificateur');
transfer.click();
assert.strictEqual(quickFields.euroCheckGrids.value,'2 7 8 11 49 + 1 12');
assert(!quickFields.euroCheckPanel.open);
allowReplacement=true;
transfer.click();
const transferred=quickFields.euroCheckGrids.value.split('\n');
assert.strictEqual(transferred.length,2);
const generated=quickFields.quickGridOutput.children[1].children;
for(const [index,line] of transferred.entries()){
 assert.strictEqual(line.replaceAll(' – ',' ').replace(' + ',' '),
  generated[index].textContent.replaceAll(' – ',' ').replace(' · Étoiles : ',' '));
 const [match]=checker.compareEuroGrids(line,line);
 assert.strictEqual(match.numbers.length,5);
 assert.strictEqual(match.stars.length,2);
}
assert(quickFields.euroCheckPanel.open);
assert(quickFields.euroCheckDraw.focused);
assert.strictEqual(inputEvents,1);
console.log('EuroMillions JS: vérification des correspondances et transfert des grilles validés.');

const wheelCode=app.slice(app.indexOf('function reduceGrids'),app.indexOf('function wire'));
const wheelContext={
 $:id=>wheelFields[id],
 document:{createElement:()=>({
  children:[], append(child){this.children.push(child);}, setAttribute(){},
  addEventListener(type,listener){this[type]=listener;}
 })},
 crypto:require('node:crypto').webcrypto,
 intersections:(a,b)=>a.filter(value=>b.includes(value)).length,
 fetch:async path=>({ok:true,json:async()=>JSON.parse(fs.readFileSync(path,'utf8'))}),
 exportFile:(name,content)=>{downloaded={name,content};}
};
const wheel=vm.runInNewContext(wheelCode+'\n({reduceGrids,showReducedGrids})',wheelContext);
const wheelPool=[4,11,19,23,28,33,37,41,45,49];
const complete=wheel.reduceGrids(wheelPool,3,12,49);
assert.equal(complete.covered,252);
assert.equal(complete.ordinaryCovered,19362);
assert.equal(complete.grids.length,2);
let downloaded;
const wheelFields={
 reducedGame:{value:'loto'}, reducedMinimum:{value:'3'}, reducedBudget:{value:'12'},
 reducedNumbers:{value:wheelPool.join(' ')},reducedPrice:{value:'3'},
 reducedOutput:{replaceChildren(...children){this.children=children;}}
};
(async()=>{
 for(const game of ['loto','euromillions']){
  wheelFields.reducedGame.value=game;
  wheel.showReducedGrids({preventDefault(){}});
  const [summary,odds,list,save,audit,report]=wheelFields.reducedOutput.children;
  assert.match(summary.textContent,/252 tirages couverts sur 252/);
  assert.match(odds.textContent,/6,00/);
  assert.equal(list.children.length,2);
  save.click();
  assert.equal(downloaded.name,'grilles-'+game+'.csv');
  assert.equal(downloaded.content.split('\n').length,3);
  await audit.click();
  assert.match(report.textContent,/Référence théorique/);
  assert.equal(audit.disabled,false);
 }
 console.log('Système réducteur : coût, couverture, export et archives LOTO et EuroMillions vérifiés.');
})().catch(error=>{console.error(error);process.exitCode=1;});

const syncCode=app.slice(app.indexOf('async function sync('),app.indexOf('// Numerical recipes'));
(async()=>{
 const btn={disabled:false},status={};
 let expire, merged=0, saved=0;
 const row={date:'2026-11-25',nums:[9,15,20,35,42],extras:[8]};
 const response=cached=>({
  ok:true,
  headers:new Headers(cached?{'X-IA-Loto-Cache':'offline'}:{}),
  json:async()=>({draws:[row]})
 });
 const ctx={
  $:id=>id==='syncBtn'?btn:status, currentSync:0, LASTSYNC:'last',
  draws:[[row.date]], AbortController,
  setTimeout(callback,ms){assert.equal(ms,4000);expire=callback;return 1;},
  clearTimeout(){},
  mergeRemote(){merged++;return {same:1,added:0};},
  store(){saved++;},
  fetch:async()=>({...response(false),json:()=>new Promise(()=>{})})
 };
 const sync=vm.runInNewContext(syncCode+'\nsync',ctx);
 const pending=sync(true);
 await Promise.resolve();
 assert(btn.disabled);
 expire();
 await pending;
 assert.match(status.textContent,/délai.*Historique local disponible/);
 assert.equal(btn.disabled,false);
 assert.equal(merged,0);
 ctx.fetch=async()=>response(true);
 await sync(true);
 assert.match(status.textContent,/Copie hors ligne/);
 assert.equal(merged,1);
 assert.equal(saved,0);
 ctx.fetch=async()=>response(false);
 await sync(true);
 assert.equal(status.className,'status good');
 assert.equal(saved,1);
 console.log('Synchronisation : délai sur le corps JSON, cache hors ligne et reprise vérifiés.');
})().catch(error=>{console.error(error);process.exitCode=1;});

const boot=app.slice(app.indexOf('function startApplication()'));
for(const failedStep of ['history','navigation']){
 const calls=[],errors=[],bootStatus={};
 const step=name=>()=>{
  calls.push(name);
  if(name===failedStep)throw new Error('échec simulé');
 };
 vm.runInNewContext(boot,{
  load:step('history'),wireGenerators:step('generators'),wire:step('navigation'),
  updateStats:step('dashboard'),sync:step('sync'),$:()=>bootStatus,
  window:{reportLotoError:message=>errors.push(message)},navigator:{},console:{error(){}}
 });
 assert(calls.includes('generators'));
 assert.equal(calls.includes('sync'),failedStep!=='history');
 assert.match(bootStatus.textContent,/Démarrage partiel/);
 assert.equal(errors.length,1);
}
console.log('Démarrage partiel : générateurs disponibles après une panne simulée.');
