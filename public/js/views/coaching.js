/* L'écran du court : ce qu'on relit entre deux jeux, et ce qu'on y note.

   Il y avait deux onglets : un carnet pour ranger, un court pour relire.
   Le carnet ne servait qu'à écrire — et écrire tient dans une fenêtre
   flottante, qu'on ouvre d'un « + » depuis le court. Deux écrans pour un
   formulaire, c'était un écran de trop, et l'onglet du haut coûtait sa
   ligne à chaque visite.

   Reste donc le court, et lui seul. Il sert entre deux jeux, quatre-vingt-
   dix secondes, une main sur la serviette et l'autre sur le téléphone.
   Là, tout ce qui n'est pas immédiatement lisible est nuisible. D'où le
   terrain : viser une zone du pouce va plus vite que lire douze libellés,
   et un conseil de tennis parle presque toujours d'un endroit.

   Les trois façons de chercher — le coup, l'adversaire, le moment — ne
   s'empilent pas à l'écran : on en choisit une, et les autres attendent.
   Un écran qu'il faut faire défiler pour trouver son conseil a déjà perdu
   la partie.

   Chaque conseil affiché se rouvre d'une touche pour être corrigé ou
   supprimé, et son étoile se retire là où elle se lit : sans le carnet,
   c'est ici que tout doit pouvoir se faire.

   Le carnet reste volontairement vide au premier lancement : ces conseils
   sont ceux de tes profs, pas des miens. */

import { h, hMulti, dateCourte, puce } from '../util.js';
import {
  store, basculerFavori, PROFILS, MOMENTS,
  nomProfil, nomMoment,
} from '../store.js';
import { blocTerrain, nomCoup, COUPS } from '../terrain.js';
import { conseilForm } from '../forms.js';

let court = { profil: '', moment: '', coup: '', onglet: 'terrain', tous: false };

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

// =====================================================================
//  Le mode court
// =====================================================================

export function renderCourt() {
  const f = { profil: court.profil, moment: court.moment, coup: court.coup,
              categorie: '', texte: '', favoris: false };
  const aucunFiltre = !court.profil && !court.moment && !court.coup;
  const total = store.conseils.length;

  /* Sans filtre, on montre les essentiels : c'est ce qu'on veut relire par
     défaut quand on ouvre l'écran en pleine partie.

     Mais tout doit rester atteignable. Le carnet listait l'ensemble ; sans
     lui, un conseil sans étoile et sans coup renseigné n'aurait plus
     d'adresse — on le perdrait en lui retirant son étoile. D'où « Tout
     voir », qui lève le tri des essentiels sans rien ajouter à l'écran
     tant qu'on ne le demande pas. */
  const affiches = aucunFiltre
    ? (court.tous ? store.conseils : store.conseils.filter(c => c.favori))
    : trouver(f);

  const actifs = [
    court.coup ? ['coup', nomCoup(court.coup)] : null,
    court.profil ? ['profil', nomProfil(court.profil)] : null,
    court.moment ? ['moment', nomMoment(court.moment)] : null,
  ].filter(Boolean);

  return `
    ${total === 0 ? amorce() : ''}

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
          trajectoire — celle qui correspond à ce que tu cherches.</p>` : ''}

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
      ${/* Écrire tient dans une fenêtre flottante : le « + » est ici, à
            côté de ce qu'on lit, et il emporte avec lui la situation en
            cours — un conseil noté pendant qu'on regarde « Amortie »
            arrive déjà rangé sous « Amortie ». */''}
      <div class="court-liste-tete">
        <span class="etiquette">${!aucunFiltre ? "Ce que j'ai noté"
          : court.tous ? 'Tous mes conseils' : 'Mes essentiels'}</span>
        <div class="court-liste-actions">
          ${aucunFiltre && total ? `<button class="btn btn-ghost" data-tous>${
            court.tous ? '⭐ Essentiels' : 'Tout voir'}</button>` : ''}
          <button class="btn btn-ghost" data-noter>＋ Noter</button>
        </div>
      </div>

      ${affiches.length ? affiches.map(c => `
        <article class="court-carte">
          <button class="etoile ${c.favori ? 'pleine' : ''}" data-favori="${h(c.id)}"
                  aria-label="${c.favori ? 'Retirer des essentiels' : 'Marquer comme essentiel'}"
                  title="Essentiel — montré ici par défaut">${c.favori ? '⭐' : '☆'}</button>
          <div data-ouvrir="${h(c.id)}">
            <h2>${h(c.titre)}</h2>
            ${c.texte ? `<p>${hMulti(c.texte)}</p>` : ''}
            <div class="court-bas">
              ${(c.coups || []).map(x => puce(nomCoup(x), 'puce-coup')).join('')}
              ${(c.profils || []).map(p => puce(nomProfil(p), 'puce-profil')).join('')}
              ${(c.moments || []).map(m => puce(nomMoment(m), 'puce-moment')).join('')}
              ${c.source ? `<span class="muted">— ${h(c.source)}</span>` : ''}
              ${c.date ? `<span class="muted">${h(dateCourte(c.date))}</span>` : ''}
            </div>
          </div>
        </article>`).join('')
        : `<div class="vide"><span class="emoji">🎾</span>
            ${aucunFiltre
              ? `Aucun conseil marqué « essentiel ». Touche l'étoile d'un conseil pour
                 le retrouver ici en plein match, sans rien chercher.`
              : `Rien de noté pour cette situation. C'est peut-être la question à
                 poser au prochain cours — ou le conseil à noter maintenant.`}
           </div>`}
    </section>`;
}

export function wireCourt(vue, rerendre) {
  vue.addEventListener('click', e => {
    const o = e.target.closest('[data-onglet]');
    if (o) { court.onglet = o.dataset.onglet; rerendre(); return; }

    /* Le conseil neuf hérite de la situation qu'on regarde : c'est
       presque toujours celle dont il parle. */
    if (e.target.closest('[data-tous]')) { court.tous = !court.tous; rerendre(); return; }

    if (e.target.closest('[data-noter]')) {
      conseilForm({ ...neuf(),
        coups: court.coup ? [court.coup] : [],
        profils: court.profil ? [court.profil] : [],
        moments: court.moment ? [court.moment] : [] });
      return;
    }

    const fav = e.target.closest('[data-favori]');
    if (fav) { basculerFavori(fav.dataset.favori); return; }

    /* Sans carnet, c'est ici qu'un conseil se corrige et se supprime. */
    const ouvrir = e.target.closest('[data-ouvrir]');
    if (ouvrir) {
      const c = store.conseils.find(x => x.id === ouvrir.dataset.ouvrir);
      if (c) conseilForm(c);
      return;
    }

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
      return;
    }

    const ap = e.target.closest('[data-amorce-profil]');
    if (ap) { conseilForm({ ...neuf(), profils: [ap.dataset.amorceProfil] }); return; }

    const am = e.target.closest('[data-amorce-moment]');
    if (am) { conseilForm({ ...neuf(), moments: [am.dataset.amorceMoment], categorie: 'mental' }); return; }
  });
}

export { COUPS };
