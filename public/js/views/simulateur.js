/* Combien de matchs pour monter ?

   C'est la question que tout le monde se pose et à laquelle le site de la
   fédération répond mal, parce qu'il raisonne en points quand le joueur
   raisonne en matchs. On répond donc en scénarios : « une victoire à 15 »,
   « deux victoires à 15/1 » — la forme sous laquelle la question se pose
   vraiment. */

import { h, puce } from '../util.js';
import { store, victoiresComptees, matchsDouzeMois, bilanEstime } from '../store.js';
import { simuler, direScenario, echelonSuivant, ECHELONS, rang } from '../classement.js';
import { profilForm, baremeForm } from '../forms.js';

let cibleChoisie = null;

export function render() {
  const p = store.profil;
  const suivant = echelonSuivant(p.echelon);
  const cible = cibleChoisie || suivant;

  const acquises = victoiresComptees();
  const joues = p.victoiresJouees ?? matchsDouzeMois().length;
  const est = bilanEstime();

  const r = simuler({
    echelon: p.echelon,
    bilan: p.bilan,
    cible,
    sexe: p.sexe,
    acquises,
    victoires: joues,
    bareme: store.bareme,
  });

  /* Les cibles proposées : l'échelon suivant, et les deux d'après. Viser
     plus loin n'a pas de sens tant que le premier palier n'est pas passé. */
  const i = rang(p.echelon);
  const cibles = [1, 2, 3].map(d => ECHELONS[i + d]).filter(Boolean);

  return `
    <section class="carte-classement">
      <div class="classement-actuel">
        <span class="etiquette">Mon classement</span>
        <b class="echelon">${h(p.echelon)}</b>
        <span class="bilan">${p.bilan} points de bilan</span>
      </div>
      <button class="btn btn-ghost" data-profil>Modifier</button>
    </section>

    ${p.bilan === 0 ? `<div class="avis">
      <strong>Le bilan n'est pas renseigné.</strong>
      Sans lui, le simulateur ne peut rien calculer de juste. Il s'affiche sur Ten'Up,
      dans ta fiche de classement. <button class="lien" data-profil>Le saisir</button>
    </div>` : ''}

    <section class="choix-cible">
      <span class="etiquette">Objectif</span>
      <div class="segments">
        ${cibles.map(c => `<button data-cible="${h(c)}"
          class="${c === cible ? 'actif' : ''}">${h(c)}</button>`).join('')}
      </div>
    </section>

    ${r.erreur ? `<div class="avis">${h(r.erreur)}</div>` : rendreResultat(r, joues)}

    <section class="carte">
      <h3>Ce que j'ai déjà en banque</h3>
      <p class="tiny muted">La fédération ne retient que les meilleures victoires, et en
        nombre limité. Une fois le quota atteint, une victoire de plus ne s'ajoute pas :
        elle remplace la moins bonne, et ne rapporte que la différence.</p>
      ${acquises.length ? `
        <div class="banque">
          ${acquises.slice(0, est.quota).map(v => `<span class="jeton">+${v}</span>`).join('')}
          ${acquises.length > est.quota
            ? `<span class="jeton jeton-hors">${acquises.length - est.quota} hors quota</span>` : ''}
        </div>
        <p class="tiny muted">${Math.min(acquises.length, est.quota)} victoire(s) comptée(s)
           sur ${est.quota} possibles, soit ${est.pointsVictoires} points de victoires
           dans ton bilan.</p>`
        : `<p class="tiny muted">Aucune victoire enregistrée sur douze mois. Les scénarios
           ci-dessus additionnent donc les points sans tenir compte des remplacements —
           saisis tes matchs pour un calcul exact.</p>`}
    </section>

    <section class="carte">
      <h3>D'où viennent ces chiffres</h3>
      <p class="tiny muted">Le barème des victoires et les seuils de bilan sont recopiés de
        sources publiques recoupées, pas d'un document officiel de la fédération. Ils sont
        justes à ma connaissance, mais le capital de départ, lui, n'est publié nulle part :
        c'est pourquoi le calcul part de <em>ton</em> bilan Ten'Up plutôt que de le
        recalculer. Les bonus (tournois, absence de défaite marquante) ne sont pas
        modélisés — ils ne peuvent que t'avantager.</p>
      <button class="btn btn-ghost" data-bareme>Voir et corriger le barème</button>
    </section>`;
}

function rendreResultat(r, joues) {
  const manqueMatchs = r.matchsManquants > 0;

  if (r.manque === 0) {
    return `<section class="carte carte-verte">
      <h3>Les points y sont.</h3>
      <p>Ton bilan de ${store.profil.bilan} atteint les ${r.seuil.points} points
         demandés pour ${h(r.cible)}.</p>
      ${manqueMatchs
        ? `<p class="alerte">Il te manque encore ${r.matchsManquants} match(s) :
           ${h(r.cible)} exige ${r.seuil.victoires} victoires comptabilisées, tu en as ${joues}.</p>`
        : `<p>Le nombre de matchs exigé est également atteint.</p>`}
    </section>`;
  }

  return `
    <section class="carte carte-objectif">
      <div class="ecart">
        <b>${r.manque}</b>
        <span>points à trouver pour passer ${h(r.cible)}</span>
      </div>
      <div class="jauge"><div class="jauge-pleine"
        style="width:${Math.min(100, Math.round((store.profil.bilan / r.seuil.points) * 100))}%"></div></div>
      <p class="tiny muted">${store.profil.bilan} / ${r.seuil.points} points
        ${manqueMatchs ? ` — et ${r.matchsManquants} match(s) à jouer en plus des points`
                       : ' — le nombre de matchs exigé est déjà atteint'}.</p>
    </section>

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
      </ul>
      ${r.estime ? `<p class="tiny muted">Calcul approché : sans historique de victoires,
        on additionne les points sans le jeu des remplacements. Saisis tes matchs pour
        affiner.</p>` : ''}`
      : `<div class="avis">Aucun scénario réaliste ne comble cet écart en huit victoires.
         Vise d'abord l'échelon juste au-dessus.</div>`}`;
}

export function wire(vue, rerendre) {
  vue.addEventListener('click', e => {
    if (e.target.closest('[data-profil]')) { profilForm(); return; }
    if (e.target.closest('[data-bareme]')) { baremeForm(); return; }
    const c = e.target.closest('[data-cible]');
    if (c) { cibleChoisie = c.dataset.cible; rerendre(); }
  });
}
