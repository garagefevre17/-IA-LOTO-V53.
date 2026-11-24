const fs = require('fs');
const vm = require('vm');
const assert = require('assert');
const source = fs.readFileSync('github_status.js', 'utf8');

async function status(files) {
  const node = {className: '', replaceChildren(...children) {
    this.textContent = children.map(child => child.textContent).join(' | ');
  }};
  await vm.runInNewContext(source, {
    AbortSignal,
    document: {getElementById: () => node, createElement: () => ({})},
    fetch: async (url, {signal}) => {
      assert(signal instanceof AbortSignal);
      if (files[url] instanceof Error) throw files[url];
      return Object.hasOwn(files, url)
        ? {ok:true,json:async()=>files[url]}
        : {ok:false,status:404};
    }
  });
  assert.strictEqual(node.className, 'status warn');
  return node.textContent;
}

(async () => {
  assert.match(await status({}), /LOTO.*indisponible.*EuroMillions.*indisponible/);
  const files = {
    './automatisation/donnees/loto.json': {draws:[{date:'2026-11-23',nums:[2,10,24,30,45],extras:[1]}]},
    './automatisation/donnees/euromillions.json': {draws:[{date:'2026-11-24',nums:[3,5,37,44,49],extras:[5,6]}]},
    './automatisation/tableau.json': {games:{
      loto:{target:'2026-11-25',evaluated:[
        {status:'certified_prospective_result'},
        {status:'uncertified_no_result_published'}
      ]},
      euromillions:{status:'blocked',reason:'Tirage manquant'}
    }}
  };
  const result = await status(files);
  assert.match(result, /LOTO.*23\/11\/2026.*2 – 10 – 24 – 30 – 45.*Chance : 1.*2026-11-25.*1 résultat\(s\) certifié\(s\), 1 sans preuve/);
  assert.match(result, /EuroMillions.*24\/11\/2026.*3 – 5 – 37 – 44 – 49.*Étoiles : 5 – 6.*Tirage manquant/);
  const partial = await status({...files, './automatisation/tableau.json': new Error('Timeout')});
  assert.match(partial, /LOTO.*23\/11\/2026.*automatisation indisponible.*EuroMillions.*24\/11\/2026.*automatisation indisponible/);
  const invalid = await status({...files, './automatisation/donnees/euromillions.json': {draws:[{date:'2026-11-24',nums:[3,5,5,44,49],extras:[5,6]}]}});
  assert.match(invalid, /EuroMillions · historique GitHub indisponible/);
  console.log('GitHub status JS: 5/5 tests passed');
})().catch(error => {console.error(error);process.exitCode=1;});
