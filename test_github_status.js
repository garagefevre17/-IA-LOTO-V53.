const fs = require('fs');
const vm = require('vm');
const assert = require('assert');
const source = fs.readFileSync('github_status.js', 'utf8');
async function check(payload, expected) {
  const node = {className:'', textContent:''};
  const ctx = {
    document: {getElementById(id){return id==='githubPipelineStatus'?node:null;}},
    fetch: async ()=>payload === null ? {ok:false,status:404} : {ok:true,json:async()=>payload}
  };
  vm.runInNewContext(source,ctx);
  for(let i=0;i<10;i++) await new Promise(resolve=>setImmediate(resolve));
  assert.match(node.textContent,expected);
  assert.strictEqual(node.className,'status warn');
}
(async()=>{
  await check(null,/Aucun bilan/);
  await check({protocol:'wrong',evaluated_results:30,missing_draws:[],pending_draws:[],complete:true},/Aucun bilan/);
  await check({protocol:'Froids 300 — frozen',evaluated_results:5,missing_draws:['2026-11-18'],pending_draws:[],complete:false},/5\/30 tirages/);
  console.log('GitHub status JS: 3/3 tests passed');
})().catch(err=>{console.error(err);process.exitCode=1;});
