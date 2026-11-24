/* Read the automation outputs without changing local journals. */
(async function () {
  'use strict';
  const node = document.getElementById('githubPipelineStatus');
  if (!node) return;
  async function readJSON(path) {
    const response = await fetch('./' + path, {cache:'no-store'});
    if (!response.ok) throw new Error('HTTP ' + response.status);
    return response.json();
  }
  const summary = await readJSON('automatisation/tableau.json').catch(() => null);
  const games = [['loto', 'LOTO'], ['euromillions', 'EuroMillions']];
  const lines = await Promise.all(games.map(async ([game, label]) => {
    const status = summary?.games?.[game];
    const parts = [];
    try {
      const history = await readJSON('automatisation/donnees/' + game + '.json');
      if (!Array.isArray(history.draws) || !history.draws.length) throw new Error('Historique vide');
      parts.push(history.draws.length + ' tirages, dernier résultat le ' + history.draws.at(-1).date);
    } catch {
      parts.push('historique GitHub indisponible');
    }
    if (status?.target) parts.push('prévision pour le ' + status.target);
    if (status?.status === 'blocked') parts.push('collecte ou prévision bloquée : ' + status.reason);
    if (Array.isArray(status?.evaluated)) {
      const certified = status.evaluated.filter(x => x.status === 'certified_prospective_result').length;
      const pending = status.evaluated.filter(x => x.status === 'uncertified_no_result_published').length;
      parts.push('journal : ' + certified + ' résultat(s) certifié(s), ' + pending + ' sans preuve vérifiée');
    }
    return label + ' · ' + parts.join(' · ');
  }));
  node.className = 'status warn';
  node.textContent = lines.join(' | ');
})();
