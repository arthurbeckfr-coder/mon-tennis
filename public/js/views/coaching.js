/* Le carnet de conseils, et le mode qu'on ouvre sur le court.

   Deux onglets d'une même chose, pour deux moments qui n'ont rien à voir.
   On note d'un côté, on relit de l'autre — et passer de l'un à l'autre est
   le geste le plus naturel qui soit (« je viens de noter ça, à quoi ça
   ressemble en match ? »). Ils partagent donc une barre d'onglets, au lieu
   de s'ignorer depuis deux coins opposés de l'écran.

   Le court vient en premier, et c'est lui que la barre du bas ouvre. Le
   rapport de force entre les deux est celui de l'usage : on note un
   conseil une fois, on le relit vingt. Le carnet est du côté du réglage —
   on y va quand on veut ranger, pas quand on veut jouer.

   Le carnet sert après le cours, au calme : on note ce que le prof vient
   de dire, on range, on relit. Il peut être dense.

   Le mode court sert entre deux jeux, quatre-vingt-dix secondes, une main
   sur la serviette et l'autre sur le téléphone. Là, tout ce qui n'est pas
   immédiatement lisible est nuisible. D'où le terrain : viser une zone du
   pouce va plus vite que lire douze libellés, et un conseil de tennis
   parle presque toujours d'un endroit.

   Les trois façons de chercher — le coup, l'adversaire, le moment — ne
   s'empilent pas à l'écran : on en choisit une, et les autres attendent.
   Un écran qu'il faut faire défiler pour trouver son conseil a déjà perdu
   la partie.

   Le carnet reste volontairement vide au premier lancement : ces conseils
   sont ceux de tes profs, pas des miens. */

import { h, hMulti, dateCourte, puce } from '../util.js';
import {
  store, basculerFavori, PROFILS, MOMENTS, CATEGORIES,
  nomProfil, nomMoment,
} from '../store.js';
import { blocTerrain, nomCoup, COUPS } from '../terrain.js';
import { conseilForm } from '../forms.js';

let filtre = { profil: '', moment: '', categorie: '', coup: '', texte: '', favoris: false };
let court = { profil: '', moment: '', coup: '', onglet: 'terrain' };

function trouver(f) {
  return store.conseils.filter(c => {
    if (f.favoris && !c.favori) return false;
    if (f.profil && !(c.profils || []).includes(f.profil)) return false;
    if (f.moment && !(c.moments || []).includes(f.moment)) return false;
    if (f.coup && !(c.coups || []).includes(f.coup)) return false;
    if (f.categorie && c.categorie !== f.categorie) return false;
    if (f.texte) {
      const t = f.texte.toLowerCase();
      if (![c.titre, c.texte, c.source].some(v => (v || '').toLowerCase().includes(t))) return false;
    }
    return true;
  });
}

/** Combien de conseils par coup, une fois les autres filtres appliqués.
 *  Les pastilles du terrain montrent ainsi ce qu'il y a *vraiment* à
 *  lire, et non un total qui ne correspond à rien. */
function compterParCoup(f) {
  const base = trouver({ ...f, coup: '' });
  const n = {};
  for (const c of base) for (const cle of (c.coups || [])) n[cle] = (n[cle] || 0) + 1;
  return n;
}

const emojiCat = cle => CATEGORIES.find(x => x.cle === cle)?.emoji || '💡';

/* ─── Les deux onglets ─────────────────────────────────────────────────

   Le carnet et le court sont deux moments d'une même chose : on note
   d'un côté, on relit de l'autre. Les séparer en deux entrées de la barre
   du bas obligeait à redescendre tout en bas de l'écran pour passer de
   l'un à l'autre — alors que c'est le geste le plus naturel qui soit
   (« je viens de noter ça, à quoi ça ressemble en match ? »).

   Les onglets restent deux adresses et non un état interne, et c'est
   voulu : le mode court dépouille l'écran de son décorum, ce que seule la
   route sait faire. Changer d'onglet change donc de route, et le
   dépouillement suit tout seul.

   Les deux entrées de la barre du bas restent, elles aussi : sur un
   court, entre deux jeux, on a quatre-vingt-dix secondes et une main
   libre. Ce n'est pas le moment de traverser un écran pour trouver un
   onglet. */
const barreOnglets = actif => `<div class="segments" style="width:100%;margin-bottom:12px">
  <button data-onglet-page="#/court" class="${actif === 'court' ? 'actif' : ''}"
          style="flex:1">🎯 Sur le court</button>
  <button data-onglet-page="#/conseils" class="${actif === 'carnet' ? 'actif' : ''}"
          style="flex:1">📓 Le carnet</button>
</div>`;

/** Le passage d'un onglet à l'autre, posé par les deux écrans. */
function brancherOnglets(vue) {
  vue.addEventListener('click', e => {
    const o = e.target.closest('[data-onglet-page]');
    if (o) location.hash = o.dataset.ongletPage;
  });
}

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
        ${(c.coups || []).map(x => puce(nomCoup(x), 'puce-coup')).join('')}
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
  const liste = trouver(filtre);
  const total = store.conseils.length;
  const ouvert = filtre.profil || filtre.moment || filtre.categorie || filtre.coup;

  return `
    ${barreOnglets('carnet')}

    ${total === 0 ? amorce() : ''}

    <section class="barre-filtres">
      <input id="q" class="recherche" placeholder="Chercher dans mes conseils…"
             value="${h(filtre.texte)}">
      <div class="segments">
        <button data-fav="0" class="${!filtre.favoris ? 'actif' : ''}">Tous</button>
        <button data-fav="1" class="${filtre.favoris ? 'actif' : ''}">⭐ Essentiels</button>
      </div>
    </section>

    <details class="replis" ${ouvert ? 'open' : ''}>
      <summary>Filtrer par situation</summary>
      <div class="groupe-filtres">
        <span class="etiquette">Sur le terrain</span>
        ${blocTerrain({
          selection: filtre.coup ? [filtre.coup] : [],
          gaucher: !!store.profil.gaucher,
          compte: compterParCoup(filtre),
        })}
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
 *  montre les situations à remplir. */
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

const neuf = () => ({
  date: new Date().toISOString().slice(0, 10),
  titre: '', texte: '', categorie: 'tactique',
  profils: [], moments: [], coups: [], source: '', favori: false,
});

export function wire(vue, rerendre) {
  brancherOnglets(vue);
  vue.querySelector('#q')?.addEventListener('input', e => {
    filtre.texte = e.target.value;
    const ul = vue.querySelector('.conseils');
    if (ul) ul.innerHTML = trouver(filtre).map(carteConseil).join('');
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

    const coup = e.target.closest('[data-coup]');
    if (coup) { filtre.coup = filtre.coup === coup.dataset.coup ? '' : coup.dataset.coup; rerendre(); return; }

    const bf = e.target.closest('[data-fav]');
    if (bf) { filtre.favoris = bf.dataset.fav === '1'; rerendre(); return; }

    const p = e.target.closest('[data-f-profil]');
    if (p) { filtre.profil = filtre.profil === p.dataset.fProfil ? '' : p.dataset.fProfil; rerendre(); return; }

    const m = e.target.closest('[data-f-moment]');
    if (m) { filtre.moment = filtre.moment === m.dataset.fMoment ? '' : m.dataset.fMoment; rerendre(); return; }

    const c = e.target.closest('[data-f-cat]');
    if (c) { filtre.categorie = filtre.categorie === c.dataset.fCat ? '' : c.dataset.fCat; rerendre(); return; }

    if (e.target.closest('[data-raz]')) {
      filtre = { profil: '', moment: '', categorie: '', coup: '', texte: '', favoris: false };
      rerendre();
      return;
    }

    const ap = e.target.closest('[data-amorce-profil]');
    if (ap) { conseilForm({ ...neuf(), profils: [ap.dataset.amorceProfil] }); return; }
    const am = e.target.closest('[data-amorce-moment]');
    if (am) { conseilForm({ ...neuf(), moments: [am.dataset.amorceMoment], categorie: 'mental' }); return; }
  });
}

// =====================================================================
//  Le mode court
// =====================================================================

/** Les coups en toutes lettres, sous le dessin.
 *
 *  Le plan dit tout, à condition de savoir le lire : entre deux zones
 *  voisines et trois flèches qui partent du même coin, on cherche parfois
 *  ce qu'on nomme très bien. La liste dit les mêmes coups par leur nom, et
 *  se sélectionne pareil — le dessin s'allume quand on touche un nom, le
 *  nom s'allume quand on touche le dessin.
 *
 *  Elle vient après le dessin et non avant : l'écran s'ouvre en plein
 *  match, et ce qu'on veut voir en arrivant, c'est le court. */
function listeCoups(f) {
  const compte = compterParCoup(f);
  const groupes = [
    ['Sur le court', COUPS.filter(c => c.type === 'zone')],
    ['Directions',   COUPS.filter(c => c.type === 'fleche')],
    ['Trajectoires', COUPS.filter(c => c.type === 'profil')],
  ];

  return `<div class="court-coups">
    ${groupes.map(([titre, liste]) => `
      <span class="etiquette">${titre}</span>
      <div class="pastilles">
        ${liste.map(c => `<button data-coup="${c.cle}"
          class="pastille ${court.coup === c.cle ? 'actif' : ''}">${
            c.emoji ? c.emoji + ' ' : ''}${h(c.nom)}${
            /* Le nombre de conseils rangés sous ce coup, comme sur le
               dessin : sans lui, on touche au hasard des coups qui n'ont
               rien à dire. */
            compte[c.cle] ? `<span class="pastille-nb">${compte[c.cle]}</span>` : ''
          }</button>`).join('')}
      </div>`).join('')}
  </div>`;
}

export function renderCourt() {
  const f = { profil: court.profil, moment: court.moment, coup: court.coup,
              categorie: '', texte: '', favoris: false };
  const aucunFiltre = !court.profil && !court.moment && !court.coup;

  /* Sans filtre, on montre les essentiels : c'est ce qu'on veut relire par
     défaut quand on ouvre l'écran en pleine partie. */
  const affiches = aucunFiltre ? store.conseils.filter(c => c.favori) : trouver(f);

  const actifs = [
    court.coup ? ['coup', nomCoup(court.coup)] : null,
    court.profil ? ['profil', nomProfil(court.profil)] : null,
    court.moment ? ['moment', nomMoment(court.moment)] : null,
  ].filter(Boolean);

  return `
    ${barreOnglets('court')}

    <section class="court-choix">
      <div class="segments" style="width:100%">
        <button data-onglet="terrain" class="${court.onglet === 'terrain' ? 'actif' : ''}"
                style="flex:1">🎾 Coup</button>
        <button data-onglet="adversaire" class="${court.onglet === 'adversaire' ? 'actif' : ''}"
                style="flex:1">👤 En face</button>
        <button data-onglet="moment" class="${court.onglet === 'moment' ? 'actif' : ''}"
                style="flex:1">⏱️ Moment</button>
      </div>

      ${actifs.length ? `<div class="pastilles" style="margin-top:10px">
        ${actifs.map(([axe, nom]) => `<button class="pastille actif" data-retirer="${axe}">
          ${h(nom)} ✕</button>`).join('')}
        <button class="pastille" data-court-raz>Tout enlever</button>
      </div>` : ''}

      ${court.onglet === 'terrain' ? `
        ${blocTerrain({
          selection: court.coup ? [court.coup] : [],
          gaucher: !!store.profil.gaucher,
          compte: compterParCoup(f),
        })}
        <p class="tiny muted terrain-aide">Touche une zone, une direction ou une
          trajectoire — celle qui correspond à ce que tu cherches.</p>
        ${listeCoups(f)}` : ''}

      ${court.onglet === 'adversaire' ? `
        <div class="pastilles pastilles-grosses">
          ${PROFILS.map(p => `<button data-court-profil="${p.cle}"
            class="pastille ${court.profil === p.cle ? 'actif' : ''}">
            <span class="gros-emoji">${p.emoji}</span>${h(p.nom)}</button>`).join('')}
        </div>` : ''}

      ${court.onglet === 'moment' ? `
        <div class="pastilles pastilles-grosses">
          ${MOMENTS.map(m => `<button data-court-moment="${m.cle}"
            class="pastille ${court.moment === m.cle ? 'actif' : ''}">
            <span class="gros-emoji">${m.emoji}</span>${h(m.nom)}</button>`).join('')}
        </div>` : ''}
    </section>

    <section class="court-liste">
      ${affiches.length ? affiches.map(c => `
        <article class="court-carte">
          <h2>${h(c.titre)}</h2>
          ${c.texte ? `<p>${hMulti(c.texte)}</p>` : ''}
          <div class="court-bas">
            ${(c.coups || []).map(x => puce(nomCoup(x), 'puce-coup')).join('')}
            ${(c.profils || []).map(p => puce(nomProfil(p), 'puce-profil')).join('')}
            ${c.source ? `<span class="muted">— ${h(c.source)}</span>` : ''}
          </div>
        </article>`).join('')
        : `<div class="vide"><span class="emoji">🎾</span>
            ${aucunFiltre
              ? `Aucun conseil marqué « essentiel ». Dans le carnet, touche l'étoile
                 des conseils que tu veux retrouver ici en plein match.`
              : `Rien de noté pour cette situation. C'est peut-être la question à
                 poser au prochain cours.`}
           </div>`}
    </section>`;
}

export function wireCourt(vue, rerendre) {
  brancherOnglets(vue);

  vue.addEventListener('click', e => {
    const o = e.target.closest('[data-onglet]');
    if (o) { court.onglet = o.dataset.onglet; rerendre(); return; }

    const r = e.target.closest('[data-retirer]');
    if (r) { court[r.dataset.retirer] = ''; rerendre(); return; }

    const coup = e.target.closest('[data-coup]');
    if (coup) { court.coup = court.coup === coup.dataset.coup ? '' : coup.dataset.coup; rerendre(); return; }

    const p = e.target.closest('[data-court-profil]');
    if (p) { court.profil = court.profil === p.dataset.courtProfil ? '' : p.dataset.courtProfil; rerendre(); return; }

    const m = e.target.closest('[data-court-moment]');
    if (m) { court.moment = court.moment === m.dataset.courtMoment ? '' : m.dataset.courtMoment; rerendre(); return; }

    if (e.target.closest('[data-court-raz]')) {
      court = { ...court, profil: '', moment: '', coup: '' };
      rerendre();
    }
  });
}

export { COUPS };
