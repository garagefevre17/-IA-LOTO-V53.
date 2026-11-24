const fs = require('fs');
const vm = require('vm');
const assert = require('assert');
const source = fs.readFileSync('github_status.js', 'utf8');

async function status(files) {
  const node = {className: '', textContent: ''};
  await vm.runInNewContext(source, {
    document: {getElementById: () => node},
    fetch: async url => Object.hasOwn(files, url)
      ? {ok:true,json:async()=>files[url]}
      : {ok:false,status:404}
  });
  assert.strictEqual(node.className, 'status warn');
  return node.textContent;
}

(async () => {
  assert.match(await status({}), /LOTO.*indisponible.*EuroMillions.*indisponible/);
  const files = {
    './automatisation/donnees/loto.json': {draws:[{date:'2026-11-23'}]},
    './automatisation/donnees/euromillions.json': {draws:[{date:'2026-11-24'}]},
    './automatisation/tableau.json': {games:{
      loto:{target:'2026-11-25',evaluated:[
        {status:'certified_prospective_result'},
        {status:'uncertified_no_result_published'}
      ]},
      euromillions:{status:'blocked',reason:'Tirage manquant'}
    }}
  };
  const result = await status(files);
  assert.match(result, /LOTO.*2026-11-23.*2026-11-25.*1 résultat\(s\) certifié\(s\), 1 sans preuve/);
  assert.match(result, /EuroMillions.*2026-11-24.*Tirage manquant/);
  console.log('GitHub status JS: 3/3 tests passed');
})().catch(error => {console.error(error);process.exitCode=1;});
