/* L'historique des matchs.

   Un historique ne sert pas à collectionner : il sert à répondre à des
   questions qu'on se pose vraiment. Est-ce que je gagne contre plus fort
   que moi ? Est-ce que je perds toujours contre les gauchers ? Les
   compteurs du haut sont là pour ça, et non pour décorer. */

import { h, hMulti, dateCourte, puce, dansLesDouzeMois } from '../util.js';
import { store, bilanMatchs } from '../store.js';
import { pointsVictoire, rang } from '../classement.js';
import { matchForm, importFFTForm } from '../forms.js';

let filtre = { periode: '12', issue: 'tout', texte: '' };

function filtrer() {
  return store.matchs
    .filter(m => filtre.periode === 'tout' || dansLesDouzeMois(m.date))
    .filter(m => filtre.issue === 'tout' || m.issue === filtre.issue)
    .filter(m => {
      if (!filtre.texte) return true;
      const t = filtre.texte.toLowerCase();
      return [m.adversaire, m.tournoi, m.notes, m.echelonAdverse]
        .some(v => (v || '').toLowerCase().includes(t));
    })
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
}

/** Le détail qui manque partout ailleurs : ce que la victoire a rapporté. */
function ligneMatch(m) {
  const pts = m.issue === 'V' && !m.wo
    ? pointsVictoire(store.profil.echelon, m.echelonAdverse, store.bareme) : 0;
  const ecart = rang(m.echelonAdverse) - rang(store.profil.echelon);
  const exploit = m.issue === 'V' && ecart >= 1;

  return `<li class="match ${m.issue === 'V' ? 'gagne' : 'perdu'}" data-id="${h(m.id)}">
    <div class="match-issue">${m.issue === 'V' ? 'V' : 'D'}</div>
    <div class="match-corps">
      <div class="match-tete">
        <strong>${h(m.adversaire || 'Adversaire inconnu')}</strong>
        ${puce(m.echelonAdverse, ecart > 0 ? 'puce-fort' : ecart < 0 ? 'puce-faible' : '')}
        ${exploit ? '<span class="exploit" title="Victoire contre plus fort que toi">🔥</span>' : ''}
      </div>
      <div class="match-bas">
        <span>${h(dateCourte(m.date))}</span>
        ${m.score ? `<span>${h(m.score)}</span>` : ''}
        ${m.tournoi ? `<span class="muted">${h(m.tournoi)}</span>` : ''}
        ${m.wo ? puce('non joué') : ''}
      </div>
      ${m.notes ? `<p class="match-note">${hMulti(m.notes)}</p>` : ''}
    </div>
    ${pts ? `<div class="match-points">+${pts}</div>` : ''}
  </li>`;
}

export function render() {
  const liste = filtrer();
  const sur12 = store.matchs.filter(m => dansLesDouzeMois(m.date));
  const b = bilanMatchs(sur12);

  /* Les victoires contre plus fort que soi sont le vrai marqueur de
     progression : elles rapportent le plus, et ce sont celles dont on se
     souvient. Elles méritent leur compteur. */
  const exploits = sur12.filter(m =>
    m.issue === 'V' && rang(m.echelonAdverse) > rang(store.profil.echelon)).length;

  return `
    <section class="chiffres">
      <div class="chiffre"><b>${b.total}</b><span>matchs sur 12 mois</span></div>
      <div class="chiffre"><b>${b.v}<small>–${b.d}</small></b><span>victoires–défaites</span></div>
      <div class="chiffre"><b>${b.ratio}%</b><span>de victoires</span></div>
      <div class="chiffre"><b>${exploits}</b><span>contre plus fort</span></div>
    </section>

    <section class="barre-filtres">
      <input id="q" class="recherche" placeholder="Chercher un nom, un tournoi…"
             value="${h(filtre.texte)}">
      <div class="segments" role="group">
        <button data-p="12" class="${filtre.periode === '12' ? 'actif' : ''}">12 mois</button>
        <button data-p="tout" class="${filtre.periode === 'tout' ? 'actif' : ''}">Tout</button>
      </div>
      <div class="segments" role="group">
        <button data-i="tout" class="${filtre.issue === 'tout' ? 'actif' : ''}">Tous</button>
        <button data-i="V" class="${filtre.issue === 'V' ? 'actif' : ''}">Victoires</button>
        <button data-i="D" class="${filtre.issue === 'D' ? 'actif' : ''}">Défaites</button>
      </div>
    </section>

    ${liste.length ? `<ul class="matchs">${liste.map(ligneMatch).join('')}</ul>` : `
      <div class="vide">
        <span class="emoji">🎾</span>
        ${store.matchs.length
          ? 'Aucun match ne correspond à ce filtre.'
          : `Aucun match pour l'instant.
             <div class="rangee-boutons" style="justify-content:center;margin-top:14px">
               <button class="btn btn-primary" data-import>Importer depuis Ten'Up</button>
               <button class="btn" data-nouveau>Saisir un match</button>
             </div>`}
      </div>`}

    ${store.matchs.length ? `<div class="pied-liste">
      <button class="btn" data-import>Importer depuis Ten'Up</button>
    </div>` : ''}`;
}

export function wire(vue, rerendre) {
  vue.querySelector('#q')?.addEventListener('input', e => {
    filtre.texte = e.target.value;
    // On ne redessine que la liste : redessiner tout ferait perdre le curseur.
    const liste = vue.querySelector('.matchs');
    const trouves = filtrer();
    if (liste) liste.innerHTML = trouves.map(ligneMatch).join('');
  });

  vue.addEventListener('click', e => {
    const p = e.target.closest('[data-p]');
    if (p) { filtre.periode = p.dataset.p; rerendre(); return; }

    const i = e.target.closest('[data-i]');
    if (i) { filtre.issue = i.dataset.i; rerendre(); return; }

    if (e.target.closest('[data-import]')) { importFFTForm(); return; }
    if (e.target.closest('[data-nouveau]')) { matchForm(); return; }

    const li = e.target.closest('.match');
    if (li) {
      const m = store.matchs.find(x => x.id === li.dataset.id);
      if (m) matchForm(m);
    }
  });
}
