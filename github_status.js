/* Read the automation outputs without changing local journals. */
(async function () {
  'use strict';
  const node = document.getElementById('githubPipelineStatus');
  if (!node) return;
  async function readJSON(path) {
    const response = await fetch('./' + path, {cache:'no-store', signal:AbortSignal.timeout(8000)});
    if (!response.ok) throw new Error('HTTP ' + response.status);
    return response.json();
  }
  function officialResult(history, extraCount, numberMax, extraMax) {
    const draws = history?.draws;
    if (!Array.isArray(draws) || !draws.length) throw new Error('Historique vide');
    const result = draws.at(-1);
    const validNumbers = (values, count, max) => Array.isArray(values) &&
      values.length === count && new Set(values).size === count &&
      values.every(value => Number.isInteger(value) && value >= 1 && value <= max);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(result?.date) ||
        !validNumbers(result.nums, 5, numberMax) ||
        !validNumbers(result.extras, extraCount, extraMax)) throw new Error('Résultat invalide');
    const date = result.date.split('-').reverse().join('/');
    const extraLabel = extraCount === 1 ? 'Chance' : 'Étoiles';
    return 'Dernier tirage dans les archives FDJ du ' + date + ' : ' +
      result.nums.join(' – ') + ' · ' + extraLabel + ' : ' + result.extras.join(' – ');
  }
  const summaryRequest = readJSON('automatisation/tableau.json').catch(() => null);
  const games = [['loto', 'LOTO', 1, 49, 10], ['euromillions', 'EuroMillions', 2, 50, 12]];
  const lines = await Promise.all(games.map(async ([game, label, extraCount, numberMax, extraMax]) => {
    const parts = [];
    try {
      const history = await readJSON('automatisation/donnees/' + game + '.json');
      parts.push(officialResult(history, extraCount, numberMax, extraMax));
    } catch {
      parts.push('historique GitHub indisponible');
    }
    const summary = await summaryRequest;
    const status = summary?.games?.[game];
    if (!status) parts.push('état de l’automatisation indisponible');
    if (status?.target) parts.push('grille expérimentale pour le ' + status.target);
    if (status?.status === 'blocked') parts.push('collecte ou prévision bloquée : ' + status.reason);
    if (Array.isArray(status?.evaluated)) {
      const certified = status.evaluated.filter(x => x?.status === 'certified_prospective_result').length;
      const pending = status.evaluated.filter(x => x?.status === 'uncertified_no_result_published').length;
      parts.push('journal : ' + certified + ' résultat(s) certifié(s), ' + pending + ' sans preuve vérifiée');
    }
    return label + ' · ' + parts.join(' · ');
  }));
  node.className = 'status warn';
  node.replaceChildren(...lines.map(line => {
    const row = document.createElement('p');
    row.textContent = line;
    return row;
  }));
})();
