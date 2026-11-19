/* GitHub Pages read-only status. This does NOT independently verify FDJ or TSA. */
(function () {
  'use strict';
  const node = document.getElementById('githubPipelineStatus');
  if (!node) return;
  const show = (message, level) => { node.className = 'status ' + (level || 'warn'); node.textContent = message; };
  const readJSON = async (name) => {
    const response = await fetch('./' + name, {cache:'no-store'});
    if (!response.ok) throw new Error('HTTP ' + response.status);
    return response.json();
  };
  readJSON('prospective/bilan_30.json').then(data => {
    if (!data || data.protocol !== 'Froids 300 — frozen' ||
        !Number.isInteger(data.evaluated_results) || data.evaluated_results < 0 || data.evaluated_results > 30 ||
        !Array.isArray(data.missing_draws) || !Array.isArray(data.pending_draws) ||
        typeof data.complete !== 'boolean') {
      throw new Error('format de bilan invalide');
    }
    const count = data.evaluated_results;
    show('Journal GitHub publié : ' + count + '/30 tirages évalués ; ' +
      data.missing_draws.length + ' manquant(s), ' + data.pending_draws.length +
      ' à venir. ' + (data.complete ? 'Série complète. ' : 'Série incomplète. ') +
      'Ces informations publiques ne prouvent PAS à elles seules la validité FDJ, la preuve RFC 3161 ni un avantage prédictif.', 'warn');
  }).catch(() => show('Aucun bilan prospectif GitHub exploitable pour le moment. Les calculs locaux ne constituent pas une certification.', 'warn'));
})();
