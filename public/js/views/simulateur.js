/* Combien de matchs pour monter ?

   C'est la question que tout le monde se pose et à laquelle le site de la
   fédération répond mal, parce qu'il raisonne en points quand le joueur
   raisonne en matchs. On répond donc en scénarios : « une victoire à 15 »,
   « deux victoires à 15/1 ».

   Le calcul n'est plus une approximation : il reproduit au point près les
   bilans officiels de Ten'Up (voir l'en-tête de classement.js). Le bilan
   n'est donc plus saisi à la main, il est calculé depuis l'historique. */

import { h, puce, dateCourte } from '../util.js';
import { store, reglagesCalcul, bonusVictoiresPour } from '../store.js';
import { simuler, bilanA, direScenario, echelonSuivant, ECHELONS, rang } from '../classement.js';
import { profilForm, baremeForm } from '../forms.js';

let cibleChoisie = null;

export function render() {
  const p = store.profil;
  const reglages = reglagesCalcul();
  const cible = cibleChoisie || echelonSuivant(p.echelon);

  const actuel = bilanA({ ...reglages, cible: p.echelon,
                          bonusVictoires: bonusVictoiresPour(p.echelon) });
  const r = simuler({ ...reglages, echelon: p.echelon, cible,
                      bonusVictoires: bonusVictoiresPour(cible) });

  const i = rang(p.echelon);
  const cibles = [1, 2, 3].map(d => ECHELONS[i + d]).filter(Boolean);

  /* L'écart avec le chiffre officiel, quand il est connu, est le meilleur
     contrôle qui soit : s'il n'est pas nul, ce sont des matchs qui
     manquent à l'historique, pas le calcul qui se trompe. */
  const officiel = p.bilanOfficiel;
  const ecart = officiel != null ? actuel.bilan - officiel : null;

  return `
    <section class="carte-classement">
      <div class="classement-actuel">
        <span class="etiquette">Mon classement</span>
        <b class="echelon">${h(p.echelon)}</b>
        <span class="bilan">${actuel.bilan} points de bilan, calculés
          sur ${actuel.nbMatchs} match${actuel.nbMatchs > 1 ? 's' : ''}</span>
      </div>
      <button class="btn btn-ghost" data-profil>Régler</button>
    </section>

    ${!store.matchs.length ? `<div class="avis">
      <strong>Aucun match enregistré.</strong>
      Le bilan se calcule depuis l'historique : importe ton palmarès Ten'Up
      et tout le reste se remplit tout seul.</div>` : ''}

    ${ecart !== null ? (ecart === 0
      ? `<div class="avis"><strong>Calcul confirmé.</strong> Mon total tombe exactement
           sur les ${officiel} points affichés par Ten'Up.</div>`
      : `<div class="avis"><strong>${ecart > 0 ? '+' : ''}${ecart} points</strong>
           par rapport aux ${officiel} de Ten'Up — et c'est normal.
           ${ecart > 0
             ? `Ce chiffre-ci compte les matchs jusqu'à aujourd'hui, alors que le bilan
                officiel s'arrête au dernier calcul de la fédération : tes derniers matchs
                n'y sont pas encore. C'est donc le bilan que tu auras au prochain
                traitement, à résultats constants.`
             : `Le bilan officiel inclut des matchs plus anciens que ma fenêtre de douze
                mois, ou un bonus non renseigné.`}
           <button class="lien" data-profil>Voir les réglages</button></div>`) : ''}

    <section class="choix-cible">
      <span class="etiquette">Objectif</span>
      <div class="segments">
        ${cibles.map(c => `<button data-cible="${h(c)}"
          class="${c === cible ? 'actif' : ''}">${h(c)}</button>`).join('')}
      </div>
    </section>

    ${(p.bonusVictoires > 0 && bonusVictoiresPour(cible) === 0) ? `
      <p class="tiny muted" style="margin:0 4px 10px">Ton bonus de ${p.bonusVictoires}
        victoire(s) n'est pas appliqué ici : la fédération en accorde un différent à chaque
        échelon visé, et il diminue à mesure qu'on monte. L'objectif affiché est donc
        légèrement plus loin que la réalité, jamais plus près.</p>` : ''}

    ${r.erreur ? `<div class="avis">${h(r.erreur)}</div>` : rendreResultat(r)}

    ${rendreBanque(r)}

    <section class="carte">
      <h3>D'où viennent ces chiffres</h3>
      <p class="tiny muted">Le barème et les seuils ne viennent pas d'une source de seconde
        main : ils ont été confrontés aux bilans officiels de Ten'Up et les reproduisent
        au point près, à trois échelons différents. Une seule chose reste saisie à la
        main — le bonus de victoires accordé au ratio (le « +2 » de « 9+2 » sur Ten'Up),
        dont la formule n'est pas publiée. À zéro, le calcul est simplement pessimiste.</p>
      <button class="btn btn-ghost" data-bareme>Voir et corriger le barème</button>
    </section>`;
}

function rendreResultat(r) {
  const manqueMatchs = r.matchsManquants > 0;

  if (r.manque === 0) {
    return `<section class="carte carte-verte">
      <h3>Les points y sont.</h3>
      <p>Ton bilan à ${h(r.cible)} atteint ${r.bilan} points, pour ${r.seuil.points} demandés.</p>
      ${manqueMatchs
        ? `<p class="alerte">Il manque encore ${r.matchsManquants} victoire(s) :
           ${h(r.cible)} en exige ${r.seuil.victoires}, tu en as ${r.nbVictoires}.</p>`
        : `<p>Le nombre de victoires exigé est également atteint.</p>`}
      ${rendreMontee(r)}
    </section>`;
  }

  return `
    <section class="carte carte-objectif">
      <div class="ecart">
        <b>${r.manque}</b>
        <span>points à trouver pour passer ${h(r.cible)}</span>
      </div>
      <div class="jauge"><div class="jauge-pleine"
        style="width:${Math.min(100, Math.round((r.bilan / r.seuil.points) * 100))}%"></div></div>
      <p class="tiny muted">${r.bilan} / ${r.seuil.points} points
        ${manqueMatchs ? ` — et ${r.matchsManquants} victoire(s) à ajouter en plus des points`
                       : ' — le nombre de victoires exigé est déjà atteint'}.</p>
      <p class="tiny muted">Attention au piège : à ${h(r.cible)}, tes victoires sont
        recomptées <em>depuis ${h(r.cible)}</em>. Une victoire qui te rapporte 120 points
        aujourd'hui n'en vaut plus que 90 une fois là-haut. C'est ce qui rend chaque
        échelon plus dur que le précédent.</p>
    </section>

    ${rendreMontee(r)}

    ${r.scenarios.length ? `
      <h3 class="titre-section">Les chemins possibles</h3>
      <ul class="scenarios">
        ${r.scenarios.map((sc, n) => `<li class="scenario ${n === 0 ? 'meilleur' : ''}">
          <div class="scenario-tete">
            <strong>${h(direScenario(sc))}</strong>
            ${n === 0 ? puce('le plus court', 'puce-vert') : ''}
          </div>
          <div class="scenario-bas">
            <span>${sc.matchs} match${sc.matchs > 1 ? 's' : ''}</span>
            <span>+${sc.gain} points</span>
            ${sc.parts.map(x => `<span class="muted">${x.n}×${h(x.echelon)} = ${x.points} pts</span>`).join('')}
          </div>
        </li>`).join('')}
      </ul>`
      : `<div class="avis">Aucun scénario réaliste ne comble cet écart en huit victoires.
         Vise d'abord l'échelon juste au-dessus.</div>`}`;
}

/** La limitation de montée, règle officielle et souvent la vraie raison
 *  d'un blocage : on a les points, mais pas le scalp. */
function rendreMontee(r) {
  const m = r.montee;
  if (!m || !m.requise) return '';

  if (!m.satisfaite) {
    return `<div class="avis">
      <strong>Il te manque une victoire contre un joueur classé ${h(r.cible)}.</strong>
      La fédération l'exige pour monter, quels que soient les points : il faut avoir battu
      quelqu'un déjà classé à l'échelon visé, et pas par forfait. Les chemins ci-dessous
      en tiennent compte.</div>`;
  }
  return `<p class="tiny muted" style="margin:0 4px 10px">Victoire contre un joueur classé
    ${h(r.cible)} déjà acquise (${h(m.preuve.adversaire || 'adversaire')},
    ${h(dateCourte(m.preuve.date))}) : la limitation de montée est levée.</p>`;
}

/** Les victoires qui comptent, nommément. C'est ce qui rend le calcul
 *  vérifiable : on voit lesquelles portent le bilan, et laquelle sautera
 *  à la prochaine victoire. */
function rendreBanque(r) {
  if (!r.retenues?.length) return '';

  const faible = r.retenues[r.retenues.length - 1];

  return `<section class="carte">
      <h3>Les ${r.retenues.length} victoires qui comptent pour ${h(r.cible)}</h3>
      <p class="tiny muted">Seules les meilleures comptent, dans la limite de ${r.quota}.
        Une victoire de plus ne s'ajoute pas : elle remplace la moins bonne et ne rapporte
        que la différence.</p>
      <ul class="banque-liste">
        ${r.retenues.map(x => `<li>
          <span class="jeton">+${x.points}</span>
          <span class="banque-nom">${h(x.match.adversaire || '—')}
            ${puce(x.match.echelonAdverse)}</span>
          <span class="muted tiny">${h(dateCourte(x.match.date))}</span>
        </li>`).join('')}
      </ul>
      ${faible.points > 0 ? `<p class="tiny muted">La plus basse vaut ${faible.points} points :
        en dessous de ça, une nouvelle victoire ne changera rien à ton bilan.</p>` : ''}
      ${r.ecartees.length ? `<p class="tiny muted">${r.ecartees.length} autre(s) victoire(s)
        hors quota, sans effet sur ce bilan.</p>` : ''}
      ${r.bonusPoints ? `<p class="tiny muted">Plus ${r.bonusPoints} points de bonus.</p>` : ''}
    </section>`;
}

export function wire(vue, rerendre) {
  vue.addEventListener('click', e => {
    if (e.target.closest('[data-profil]')) { profilForm(); return; }
    if (e.target.closest('[data-bareme]')) { baremeForm(); return; }
    const c = e.target.closest('[data-cible]');
    if (c) { cibleChoisie = c.dataset.cible; rerendre(); }
  });
}
