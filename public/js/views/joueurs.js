/* Les adversaires.

   Le répertoire ne se saisit pas : il se déduit des matchs, comme celui des
   clubs. Un joueur croisé six fois n'a pas à être ressaisi, et un joueur
   jamais rencontré n'a rien à faire ici.

   Ce qu'on vient y chercher n'est pas une fiche d'identité mais une
   question précise, posée la veille d'un match : « je l'ai déjà joué, ça
   avait donné quoi ? ». D'où l'ordre de la fiche — le bilan de la
   confrontation d'abord, les matchs ensuite, les notes en bas.

   Les notes, justement, sont le seul champ saisi à la main, et le seul qui
   compte vraiment : ce qu'on a retenu de sa façon de jouer. Elles se
   raccrochent aux mêmes profils que le carnet de conseils, si bien que
   noter « chipeur » sur un adversaire ramène les conseils du prof sur les
   chipeurs. */

import { h, hMulti, dateCourte, puce, confirmer, toast } from '../util.js';
import { store, bilanMatchs, clubDuMatch, nomProfil, PROFILS } from '../store.js';
import { rang } from '../classement.js';
import { joueurForm, matchForm } from '../forms.js';

let recherche = '';

/** L'identité d'un joueur, c'est son nom débarrassé de sa casse et de ses
 *  accents : « Éliott TRAN » et « ELIOTT TRAN » sont le même adversaire. */
export const cleJoueur = nom => (nom || '')
  .trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/\s+/g, ' ');

/* « Anonyme » est le libellé que la fédération affiche pour les joueurs
   qui refusent d'être nommés. Ce n'est pas une identité : les regrouper
   ferait un adversaire fictif de vingt-quatre personnes différentes, avec
   un bilan de confrontation qui ne veut rien dire. On les écarte. */
const SANS_IDENTITE = /^(anonyme|inconnu|n\.?c\.?)$/i;

export const estAnonyme = nom => SANS_IDENTITE.test((nom || '').trim());

/** Le répertoire, reconstruit depuis les matchs à chaque affichage. */
export function repertoire() {
  const parCle = new Map();

  for (const m of store.matchs) {
    const cle = cleJoueur(m.adversaire);
    if (!cle || estAnonyme(m.adversaire)) continue;
    if (!parCle.has(cle)) {
      parCle.set(cle, { cle, nom: m.adversaire.trim(), matchs: [] });
    }
    parCle.get(cle).matchs.push(m);
  }

  return [...parCle.values()].map(j => {
    j.matchs.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    const b = bilanMatchs(j.matchs);
    /* Le classement retenu est le plus récent connu : c'est celui qui
       renseigne sur le niveau actuel, pas le meilleur jamais atteint. */
    const dernier = j.matchs.find(m => m.echelonAdverse);
    return {
      ...j,
      ...b,
      echelon: dernier?.echelonAdverse || '',
      derniere: j.matchs[0]?.date || '',
      fiche: store.joueurs?.find(x => cleJoueur(x.nom) === j.cle) || null,
    };
  }).sort((a, b) => b.total - a.total || a.nom.localeCompare(b.nom, 'fr'));
}

// =====================================================================
//  La liste
// =====================================================================
export function render() {
  const tous = repertoire();
  const q = recherche.trim().toUpperCase();
  const liste = q ? tous.filter(j => cleJoueur(j.nom).includes(cleJoueur(q))) : tous;

  if (!tous.length) {
    return `<div class="vide"><span class="emoji">👥</span>
      Aucun adversaire : le répertoire se remplit tout seul avec tes matchs.</div>`;
  }

  /* Les revanches en attente : ceux contre qui le bilan est négatif. La
     question qu'on se pose vraiment en parcourant un tableau de tournoi. */
  const aBattre = tous.filter(j => j.d > j.v).length;
  const anonymes = store.matchs.filter(m => estAnonyme(m.adversaire)).length;

  return `
    <section class="chiffres">
      <div class="chiffre"><b>${tous.length}</b><span>adversaires</span></div>
      <div class="chiffre"><b>${tous.filter(j => j.total > 1).length}</b><span>déjà rejoués</span></div>
      <div class="chiffre"><b>${aBattre}</b><span>bilan négatif</span></div>
    </section>

    <section class="barre-filtres">
      <input id="q-joueur" class="recherche" placeholder="Chercher un adversaire…"
             value="${h(recherche)}">
    </section>

    ${anonymes ? `<p class="tiny muted" style="margin:0 4px 10px">${anonymes} match(s) contre
      des joueurs « Anonyme » ne figurent pas ici : la fédération masque leur nom, et les
      regrouper ferait un adversaire fictif au bilan dénué de sens.</p>` : ''}

    ${liste.length ? `<ul class="joueurs">
      ${liste.map(j => `<li class="joueur-ligne" data-joueur="${h(j.cle)}">
        <div class="joueur-corps">
          <strong>${h(j.nom)}</strong>
          <div class="club-bas">
            ${j.echelon ? puce(j.echelon) : ''}
            <span>${j.total} match${j.total > 1 ? 's' : ''}</span>
            ${j.derniere ? `<span class="muted">dernier ${h(dateCourte(j.derniere))}</span>` : ''}
            ${(j.fiche?.profils || []).map(p => puce(nomProfil(p), 'puce-profil')).join('')}
          </div>
        </div>
        <div class="joueur-bilan ${j.v > j.d ? 'positif' : j.v < j.d ? 'negatif' : ''}">
          ${j.v}<span>–</span>${j.d}
        </div>
      </li>`).join('')}
    </ul>` : `<div class="vide"><span class="emoji">🔍</span>Aucun adversaire à ce nom.</div>`}`;
}

// =====================================================================
//  La fiche
// =====================================================================
export function renderFiche(params) {
  const cle = decodeURIComponent(params[1] || '');
  const j = repertoire().find(x => x.cle === cle);
  if (!j) return `<div class="vide"><span class="emoji">🤷</span>Adversaire introuvable.</div>`;

  const dominant = j.v > j.d ? 'positif' : j.v < j.d ? 'negatif' : '';
  const ecart = j.echelon ? rang(j.echelon) - rang(store.profil.echelon) : null;

  return `
    <section class="carte">
      <div class="fiche-tete">
        <div>
          <h2>${h(j.nom)}</h2>
          <p class="tiny muted">
            ${j.echelon ? `Classé ${h(j.echelon)}` : 'Classement inconnu'}
            ${ecart != null ? (ecart > 0 ? ' — au-dessus de toi'
                            : ecart < 0 ? ' — en dessous de toi' : ' — même échelon') : ''}
          </p>
        </div>
        <button class="btn btn-ghost" data-modifier>Noter</button>
      </div>

      <div class="confrontation ${dominant}">
        <b>${j.v}</b><span>–</span><b>${j.d}</b>
        <em>${j.total} confrontation${j.total > 1 ? 's' : ''}, ${j.ratio}% pour toi</em>
      </div>

      ${j.fiche?.profils?.length ? `<div class="pastilles" style="margin-top:10px">
        ${j.fiche.profils.map(p => puce(nomProfil(p), 'puce-profil')).join('')}
      </div>` : ''}
      ${j.fiche?.note ? `<p class="match-note" style="margin-top:10px">${hMulti(j.fiche.note)}</p>` : ''}
      ${!j.fiche ? `<p class="tiny muted" style="margin-top:10px">Rien de noté sur sa façon de
        jouer. Le jour où tu le retrouveras dans un tableau, tu regretteras de ne pas
        l'avoir fait.</p>` : ''}
    </section>

    <section class="carte">
      <h3>Vos matchs</h3>
      <ul class="matchs" style="margin-top:8px">
        ${j.matchs.map(m => {
          const club = clubDuMatch(m);
          return `<li class="match ${m.issue === 'V' ? 'gagne' : 'perdu'}" data-match="${h(m.id)}">
            <div class="match-issue">${m.issue}</div>
            <div class="match-corps">
              <div class="match-tete">
                <strong>${h(m.score || (m.wo ? 'W.O.' : 'sans score'))}</strong>
                ${puce(m.echelonAdverse)}
              </div>
              <div class="match-bas">
                <span>${h(dateCourte(m.date))}</span>
                ${m.tournoi ? `<span class="muted">${h(m.tournoi)}</span>` : ''}
                ${club ? `<span class="muted">${h(club.nom)}</span>` : ''}
                ${m.surface ? puce(m.surface) : ''}
              </div>
              ${m.notes ? `<p class="match-note">${hMulti(m.notes)}</p>` : ''}
            </div>
          </li>`;
        }).join('')}
      </ul>
    </section>`;
}

// =====================================================================
//  Branchements
// =====================================================================
export function wire(vue, rerendre) {
  vue.querySelector('#q-joueur')?.addEventListener('input', e => {
    recherche = e.target.value;
    const ul = vue.querySelector('.joueurs');
    if (!ul) { rerendre(); return; }
    /* On ne redessine que la liste : refaire tout l'écran ferait perdre le
       curseur au milieu d'un mot. */
    const q = cleJoueur(recherche);
    for (const li of ul.querySelectorAll('.joueur-ligne')) {
      li.hidden = q ? !li.dataset.joueur.includes(q) : false;
    }
  });

  vue.addEventListener('click', e => {
    const l = e.target.closest('[data-joueur]');
    if (l) location.hash = `#/joueurs/${encodeURIComponent(l.dataset.joueur)}`;
  });
}

export function wireFiche(vue) {
  vue.addEventListener('click', e => {
    const cle = decodeURIComponent(location.hash.split('/')[2] || '');
    const j = repertoire().find(x => x.cle === cle);
    if (!j) return;

    if (e.target.closest('[data-modifier]')) { joueurForm(j); return; }

    const m = e.target.closest('[data-match]');
    if (m) {
      const match = store.matchs.find(x => x.id === m.dataset.match);
      if (match) matchForm(match);
    }
  });
}
