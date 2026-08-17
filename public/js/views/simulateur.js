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
import { simuler, bilanA, direScenario, echelonSuivant, ECHELONS, rang,
         projeter, echeance, rendementParEchelon } from '../classement.js';
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

    ${rendreCalendrier(reglages, cible, r)}

    ${rendreRendement(reglages, cible, r)}

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

/* ─── Le calendrier ────────────────────────────────────────────────────

   La question « qu'est-ce qu'il me faut » a une jumelle qu'on oublie :
   « jusqu'à quand ». Le bilan glisse sur douze mois, donc une victoire
   finit par sortir de la fenêtre et le total baisse sans qu'on ait rien
   fait. Attendre coûte. */
function rendreCalendrier(reglages, cible, r) {
  if (!r.seuil || r.seuil.points == null) return '';

  const etapes = projeter({ ...reglages, cible,
                            bonusVictoires: bonusVictoiresPour(cible), mois: 12 });
  if (etapes.length < 2) return '';

  const ech = echeance(etapes);
  /* Une marge en haut : sans elle le trait de seuil, qui est la plus
     grande valeur, se colle au bord et se lit mal. */
  const max = Math.max(r.seuil.points, ...etapes.map(e => e.bilan)) * 1.08;
  const hauteur = v => Math.max(2, Math.round((v / max) * 100));

  /* Les victoires qui vont sortir, et ce qu'elles emportent. C'est le
     détail qui rend la baisse concrète plutôt que fatale. */
  const pertes = etapes.flatMap(e =>
    e.sortants.map(s => ({ mois: e.libelle, ...s }))).slice(0, 4);

  return `<section class="carte">
    <h3>Le temps joue contre toi</h3>
    ${ech
      ? `<p>Tant que tu ne rejoues pas, il te manque <strong>${etapes[0].manque} points</strong>.
         À partir de <strong>${h(ech.apres.libelle)}</strong> il t'en manquera
         <strong>${ech.apres.manque}</strong> : des victoires sortent de la fenêtre des douze
         mois et cessent de compter. Agir avant coûte ${ech.surcout} points de moins.</p>`
      : `<p class="tiny muted">Aucune de tes victoires comptées ne sort de la fenêtre dans
         l'année qui vient : l'écart ne se creusera pas tout seul.</p>`}

    <div class="frise" role="img"
         aria-label="Bilan projeté sur douze mois, à résultats constants">
      <div class="frise-zone">
        ${etapes.map(e => `<div class="frise-col ${e.bilan < r.seuil.points ? '' : 'atteint'}"
               title="${h(e.libelle)} — bilan ${e.bilan}${e.manque
                 ? `, il manquerait ${e.manque} points` : ', seuil atteint'}">
          <div class="frise-barre" style="height:${hauteur(e.bilan)}%"></div>
        </div>`).join('')}
        <div class="frise-seuil" style="bottom:${hauteur(r.seuil.points)}%"></div>
      </div>
      <div class="frise-legende">
        ${etapes.map((e, i) => `<span class="frise-mois">
          ${i % 2 === 0 ? h(e.libelle.split(' ')[0]) : ''}</span>`).join('')}
      </div>
    </div>
    <p class="tiny muted">Bilan projeté à ${h(cible)} si tu ne joues plus, mois par mois.
      Le trait marque les ${r.seuil.points} points demandés.</p>

    ${pertes.length ? `<ul class="fiche-infos" style="margin-top:10px">
      ${pertes.map(p => `<li><span class="fiche-emoji">📉</span><div>
        <strong>${h(p.mois)}</strong> — ${h(p.match.adversaire || 'une victoire')}
        (${h(p.match.echelonAdverse)}, ${h(dateCourte(p.match.date))}) cesse de compter,
        ${p.points} points.</div></li>`).join('')}
    </ul>` : ''}
  </section>`;
}

/* ─── Le rendement ─────────────────────────────────────────────────────

   Le contre-intuitif du système : une fois le quota atteint, battre un
   joueur moins bien classé que ses propres victoires déjà comptées ne
   rapporte rien du tout. Zéro. Autant le dire avant de s'inscrire. */
function rendreRendement(reglages, cible, r) {
  if (!r.seuil || r.seuil.points == null) return '';

  const lignes = rendementParEchelon({ ...reglages, cible,
                                       bonusVictoires: bonusVictoiresPour(cible) });
  const inutiles = lignes.filter(l => l.gain === 0);

  return `<section class="carte">
    <h3>Ce que rapporterait une victoire, aujourd'hui</h3>
    <table class="rendement">
      <thead><tr><th>Battre un…</th><th>Barème</th><th>Gain réel</th></tr></thead>
      <tbody>
        ${lignes.map(l => `<tr class="${l.gain === 0 ? 'nul' : ''}">
          <td><strong>${h(l.echelon)}</strong></td>
          <td class="muted">${l.bareme} pts</td>
          <td>${l.gain > 0 ? `<strong>+${l.gain}</strong>` : '<span class="muted">rien</span>'}</td>
        </tr>`).join('')}
      </tbody>
    </table>
    <p class="tiny muted">Le barème est ce que vaut la victoire ; le gain réel est ce qu'elle
      ajoute vraiment à ton bilan une fois les remplacements faits.
      ${inutiles.length
        ? `Battre ${inutiles.map(l => l.echelon).join(', ')} ne changerait
           strictement rien : ces victoires ne feraient que remplacer des victoires
           équivalentes déjà comptées.`
        : 'Toutes ces victoires te feraient progresser.'}</p>
  </section>`;
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
