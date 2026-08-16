/* Le carnet de conseils, et le mode qu'on ouvre sur le court.

   Deux écrans pour deux moments qui n'ont rien à voir.

   Le carnet sert après le cours, au calme : on note ce que le prof vient
   de dire, on range, on relit. Il peut être dense.

   Le mode court sert entre deux jeux, quatre-vingt-dix secondes, une main
   sur la serviette et l'autre sur le téléphone. Là, tout ce qui n'est pas
   immédiatement lisible est nuisible : on choisit le profil de l'adversaire
   d'un pouce, et on ne voit plus que les conseils qui s'y rapportent, en
   gros caractères. Rien à chercher, rien à taper.

   Le carnet est volontairement vide au premier lancement. Ces conseils
   sont ceux de tes profs, pas des miens : les pré-remplir de généralités
   les diluerait dans du bruit. En revanche les situations que tu as citées
   sont proposées d'emblée, pour n'avoir qu'à les remplir. */

import { h, hMulti, dateCourte, puce } from '../util.js';
import {
  store, basculerFavori, PROFILS, MOMENTS, CATEGORIES,
  nomProfil, nomMoment,
} from '../store.js';
import { conseilForm } from '../forms.js';

let filtre = { profil: '', moment: '', categorie: '', texte: '', favoris: false };
let profilCourt = '';
let momentCourt = '';

function trouver(f = filtre) {
  return store.conseils.filter(c => {
    if (f.favoris && !c.favori) return false;
    if (f.profil && !(c.profils || []).includes(f.profil)) return false;
    if (f.moment && !(c.moments || []).includes(f.moment)) return false;
    if (f.categorie && c.categorie !== f.categorie) return false;
    if (f.texte) {
      const t = f.texte.toLowerCase();
      if (![c.titre, c.texte, c.source].some(v => (v || '').toLowerCase().includes(t))) return false;
    }
    return true;
  });
}

const emojiCat = cle => CATEGORIES.find(x => x.cle === cle)?.emoji || '💡';

function carteConseil(c) {
  return `<li class="conseil" data-id="${h(c.id)}">
    <button class="etoile ${c.favori ? 'pleine' : ''}" data-favori="${h(c.id)}"
            aria-label="${c.favori ? 'Retirer des essentiels' : 'Marquer comme essentiel'}"
            title="Essentiel — visible en mode court">${c.favori ? '⭐' : '☆'}</button>
    <div class="conseil-corps" data-ouvrir="${h(c.id)}">
      <div class="conseil-tete">
        <span class="cat">${emojiCat(c.categorie)}</span>
        <strong>${h(c.titre)}</strong>
      </div>
      ${c.texte ? `<p class="conseil-texte">${hMulti(c.texte)}</p>` : ''}
      <div class="conseil-bas">
        ${(c.profils || []).map(p => puce(nomProfil(p), 'puce-profil')).join('')}
        ${(c.moments || []).map(m => puce(nomMoment(m), 'puce-moment')).join('')}
        ${c.source ? `<span class="muted">— ${h(c.source)}</span>` : ''}
        ${c.date ? `<span class="muted">${h(dateCourte(c.date))}</span>` : ''}
      </div>
    </div>
  </li>`;
}

// =====================================================================
//  Le carnet
// =====================================================================
export function render() {
  const liste = trouver();
  const total = store.conseils.length;

  return `
    ${total === 0 ? amorce() : ''}

    <section class="barre-filtres">
      <input id="q" class="recherche" placeholder="Chercher dans mes conseils…"
             value="${h(filtre.texte)}">
      <div class="segments">
        <button data-fav="0" class="${!filtre.favoris ? 'actif' : ''}">Tous</button>
        <button data-fav="1" class="${filtre.favoris ? 'actif' : ''}">⭐ Essentiels</button>
      </div>
    </section>

    <details class="replis" ${filtre.profil || filtre.moment || filtre.categorie ? 'open' : ''}>
      <summary>Filtrer par situation</summary>
      <div class="groupe-filtres">
        <span class="etiquette">Face à</span>
        <div class="pastilles">
          ${PROFILS.map(p => `<button data-f-profil="${p.cle}"
            class="pastille ${filtre.profil === p.cle ? 'actif' : ''}">${p.emoji} ${h(p.nom)}</button>`).join('')}
        </div>
        <span class="etiquette">Moment</span>
        <div class="pastilles">
          ${MOMENTS.map(m => `<button data-f-moment="${m.cle}"
            class="pastille ${filtre.moment === m.cle ? 'actif' : ''}">${m.emoji} ${h(m.nom)}</button>`).join('')}
        </div>
        <span class="etiquette">Catégorie</span>
        <div class="pastilles">
          ${CATEGORIES.map(x => `<button data-f-cat="${x.cle}"
            class="pastille ${filtre.categorie === x.cle ? 'actif' : ''}">${x.emoji} ${h(x.nom)}</button>`).join('')}
        </div>
        <button class="btn btn-ghost" data-raz>Tout afficher</button>
      </div>
    </details>

    ${liste.length
      ? `<ul class="conseils">${liste.map(carteConseil).join('')}</ul>`
      : total
        ? `<div class="vide"><span class="emoji">🔍</span>Aucun conseil pour ce filtre.</div>`
        : ''}`;
}

/** Au premier lancement : on ne meuble pas avec des conseils inventés, on
 *  montre les situations à remplir. Le carnet doit se remplir de la voix
 *  du prof, pas de la mienne. */
function amorce() {
  return `<section class="carte carte-amorce">
    <h3>Ton carnet est vide — c'est normal</h3>
    <p>Les conseils qui comptent sont ceux que tes profs te donnent, avec leurs mots.
       Je ne les invente pas à leur place. En revanche, les situations dont tu m'as
       parlé sont déjà prêtes : touche l'une d'elles pour noter ce qu'on t'a dit
       dessus.</p>
    <div class="pastilles">
      ${PROFILS.slice(0, 4).map(p => `<button class="pastille" data-amorce-profil="${p.cle}">
        ${p.emoji} ${h(p.nom)}</button>`).join('')}
      ${MOMENTS.slice(1, 4).map(m => `<button class="pastille" data-amorce-moment="${m.cle}">
        ${m.emoji} ${h(m.nom)}</button>`).join('')}
    </div>
    <p class="tiny muted">Le réflexe à prendre : juste après le cours, dans la voiture,
       noter les deux ou trois phrases qui restent. C'est là qu'elles sont encore
       fraîches — et c'est ce carnet-là qui te servira en match.</p>
  </section>`;
}

export function wire(vue, rerendre) {
  vue.querySelector('#q')?.addEventListener('input', e => {
    filtre.texte = e.target.value;
    const ul = vue.querySelector('.conseils');
    if (ul) ul.innerHTML = trouver().map(carteConseil).join('');
  });

  vue.addEventListener('click', e => {
    const fav = e.target.closest('[data-favori]');
    if (fav) { basculerFavori(fav.dataset.favori); return; }

    const ouvrir = e.target.closest('[data-ouvrir]');
    if (ouvrir) {
      const c = store.conseils.find(x => x.id === ouvrir.dataset.ouvrir);
      if (c) conseilForm(c);
      return;
    }

    const bf = e.target.closest('[data-fav]');
    if (bf) { filtre.favoris = bf.dataset.fav === '1'; rerendre(); return; }

    const p = e.target.closest('[data-f-profil]');
    if (p) { filtre.profil = filtre.profil === p.dataset.fProfil ? '' : p.dataset.fProfil; rerendre(); return; }

    const m = e.target.closest('[data-f-moment]');
    if (m) { filtre.moment = filtre.moment === m.dataset.fMoment ? '' : m.dataset.fMoment; rerendre(); return; }

    const c = e.target.closest('[data-f-cat]');
    if (c) { filtre.categorie = filtre.categorie === c.dataset.fCat ? '' : c.dataset.fCat; rerendre(); return; }

    if (e.target.closest('[data-raz]')) {
      filtre = { profil: '', moment: '', categorie: '', texte: '', favoris: false };
      rerendre();
      return;
    }

    // Depuis l'amorce : on ouvre le formulaire avec la situation déjà cochée.
    const ap = e.target.closest('[data-amorce-profil]');
    if (ap) { conseilForm({ ...neuf(), profils: [ap.dataset.amorceProfil] }); return; }
    const am = e.target.closest('[data-amorce-moment]');
    if (am) { conseilForm({ ...neuf(), moments: [am.dataset.amorceMoment], categorie: 'mental' }); return; }
  });
}

const neuf = () => ({
  date: new Date().toISOString().slice(0, 10),
  titre: '', texte: '', categorie: 'tactique',
  profils: [], moments: [], source: '', favori: false,
});

// =====================================================================
//  Le mode court
// =====================================================================
/* Ce que je consulte pendant le match. Deux gestes maximum : le profil de
   l'adversaire, puis éventuellement le moment. Pas de recherche, pas de
   clavier — on ne tape pas au clavier avec une raquette à la main. */
export function renderCourt() {
  const conseils = trouver({
    profil: profilCourt, moment: momentCourt,
    categorie: '', texte: '', favoris: false,
  });

  /* Sans filtre, on montre les essentiels : c'est ce qu'on veut relire
     par défaut quand on ouvre l'écran en pleine partie. */
  const rien = !profilCourt && !momentCourt;
  const affiches = rien ? store.conseils.filter(c => c.favori) : conseils;

  return `
    <section class="court-choix">
      <span class="etiquette">En face de moi</span>
      <div class="pastilles pastilles-grosses">
        ${PROFILS.map(p => `<button data-court-profil="${p.cle}"
          class="pastille ${profilCourt === p.cle ? 'actif' : ''}">
          <span class="gros-emoji">${p.emoji}</span>${h(p.nom)}</button>`).join('')}
      </div>
      <span class="etiquette">Moment</span>
      <div class="pastilles pastilles-grosses">
        ${MOMENTS.map(m => `<button data-court-moment="${m.cle}"
          class="pastille ${momentCourt === m.cle ? 'actif' : ''}">
          <span class="gros-emoji">${m.emoji}</span>${h(m.nom)}</button>`).join('')}
      </div>
      ${(profilCourt || momentCourt)
        ? `<button class="btn btn-ghost" data-court-raz>Revenir aux essentiels</button>` : ''}
    </section>

    <section class="court-liste">
      ${affiches.length ? affiches.map(c => `
        <article class="court-carte">
          <h2>${h(c.titre)}</h2>
          ${c.texte ? `<p>${hMulti(c.texte)}</p>` : ''}
          <div class="court-bas">
            ${(c.profils || []).map(p => puce(nomProfil(p), 'puce-profil')).join('')}
            ${c.source ? `<span class="muted">— ${h(c.source)}</span>` : ''}
          </div>
        </article>`).join('')
        : `<div class="vide"><span class="emoji">🎾</span>
            ${rien
              ? `Aucun conseil marqué « essentiel ». Dans le carnet, touche l'étoile
                 des conseils que tu veux retrouver ici en plein match.`
              : `Rien de noté pour cette situation. C'est peut-être la question à
                 poser au prochain cours.`}
           </div>`}
    </section>`;
}

export function wireCourt(vue, rerendre) {
  vue.addEventListener('click', e => {
    const p = e.target.closest('[data-court-profil]');
    if (p) { profilCourt = profilCourt === p.dataset.courtProfil ? '' : p.dataset.courtProfil; rerendre(); return; }
    const m = e.target.closest('[data-court-moment]');
    if (m) { momentCourt = momentCourt === m.dataset.courtMoment ? '' : m.dataset.courtMoment; rerendre(); return; }
    if (e.target.closest('[data-court-raz]')) { profilCourt = ''; momentCourt = ''; rerendre(); }
  });
}
