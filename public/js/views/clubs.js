/* Les clubs où j'ai joué.

   La liste n'est pas saisie à la main : elle se déduit des matchs. Un club
   qu'on a fréquenté quatorze fois n'a pas à être ressaisi, et un club où
   l'on n'est jamais allé n'a rien à faire ici.

   Le rattachement d'un match à un club se fait sur le libellé de l'épreuve,
   qui est la seule chose que la fédération conserve. C'est imparfait et il
   faut le dire : « TOURNOI SENIORS » ne nomme personne, et un championnat
   par équipes se joue une fois chez soi et une fois ailleurs sans que ce
   soit écrit nulle part. D'où le bloc des épreuves orphelines en bas de
   page — non pour s'excuser, mais parce que c'est là qu'on répare.

   Cette fiche absorbe aussi les comptes de réseaux sociaux, qui vivaient
   sur un écran séparé : un club, c'est son adresse et son juge-arbitre et
   sa page Facebook. Trois écrans pour une même chose n'aidaient personne. */

import { h, dateCourte, puce, confirmer, toast } from '../util.js';
import {
  store, matchsDuClub, epreuvesOrphelines, bilanMatchs,
  supprimerClub, PLATEFORMES,
} from '../store.js';
import { clubForm, matchForm } from '../forms.js';

const infoPlateforme = cle => PLATEFORMES.find(p => p.cle === cle) || { emoji: '🔗', nom: cle };

const carteMaps = adresse =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(adresse)}`;

// =====================================================================
//  La liste
// =====================================================================
export function render() {
  const clubs = [...store.clubs]
    .map(c => ({ club: c, matchs: matchsDuClub(c) }))
    .sort((a, b) => b.matchs.length - a.matchs.length ||
                    a.club.nom.localeCompare(b.club.nom, 'fr'));

  const orphelines = epreuvesOrphelines();
  const sansClub = orphelines.reduce((t, [, n]) => t + n, 0);

  if (!store.clubs.length) {
    return `<div class="vide">
      <span class="emoji">🏟️</span>
      Aucun club enregistré.
      <div class="rangee-boutons" style="justify-content:center;margin-top:14px">
        <button class="btn btn-primary" data-nouveau>Ajouter un club</button>
      </div>
    </div>`;
  }

  return `
    <section class="chiffres">
      <div class="chiffre"><b>${store.clubs.length}</b><span>clubs</span></div>
      <div class="chiffre"><b>${store.matchs.length - sansClub}</b><span>matchs situés</span></div>
      <div class="chiffre"><b>${new Set(store.clubs.flatMap(c => c.surfaces || [])).size}</b><span>surfaces</span></div>
      <div class="chiffre"><b>${sansClub}</b><span>à rattacher</span></div>
    </section>

    <ul class="clubs">
      ${clubs.map(({ club, matchs }) => {
        const b = bilanMatchs(matchs);
        return `<li class="club-ligne" data-club="${h(club.id)}">
          <div class="club-corps">
            <strong>${h(club.nom)}</strong>
            <div class="club-bas">
              ${club.ville ? `<span>${h(club.ville)}</span>` : ''}
              ${(club.surfaces || []).map(s => puce(s)).join('')}
              ${club.jugeArbitre ? `<span class="muted">JA ${h(club.jugeArbitre)}</span>` : ''}
            </div>
          </div>
          <div class="club-score">
            <b>${matchs.length}</b>
            <span class="tiny muted">${b.v}V–${b.d}D</span>
          </div>
        </li>`;
      }).join('')}
    </ul>

    <div class="rangee-boutons" style="justify-content:center">
      <button class="btn" data-nouveau>Ajouter un club</button>
    </div>

    ${orphelines.length ? `<section class="carte">
      <h3>${sansClub} match(s) sans club</h3>
      <p class="tiny muted">La fédération ne dit pas toujours où l'on a joué : un
        championnat par équipes se déroule tantôt chez soi tantôt ailleurs, et
        « TOURNOI SENIORS » ne nomme personne. Ajoute le mot manquant aux mots-clés
        d'un club, ou rattache le match depuis sa fiche.</p>
      <ul class="orphelines">
        ${orphelines.slice(0, 12).map(([nom, n]) =>
          `<li><span>${h(nom)}</span><b>${n}</b></li>`).join('')}
      </ul>
      ${orphelines.length > 12
        ? `<p class="tiny muted">…et ${orphelines.length - 12} autre(s) épreuve(s).</p>` : ''}
    </section>` : ''}`;
}

// =====================================================================
//  La fiche
// =====================================================================
export function renderFiche(params) {
  const club = store.clubs.find(c => c.id === params[1]);
  if (!club) return `<div class="vide"><span class="emoji">🤷</span>Ce club n'existe plus.</div>`;

  const matchs = matchsDuClub(club);
  const b = bilanMatchs(matchs);

  const lignes = [
    club.adresse ? ['📍', `<a href="${h(carteMaps(club.adresse))}" target="_blank"
                            rel="noopener noreferrer">${h(club.adresse)}</a>`] : null,
    club.telephone ? ['📞', `<a href="tel:${h(club.telephone.replace(/\s/g, ''))}">${h(club.telephone)}</a>`] : null,
    club.mail ? ['✉️', `<a href="mailto:${h(club.mail)}">${h(club.mail)}</a>`] : null,
    club.jugeArbitre ? ['⚖️', (() => {
      // Le juge principal n'a rien à faire dans la liste des autres.
      const autres = (club.autresJuges || []).filter(j => j && j !== club.jugeArbitre);
      return `Juge-arbitre : <strong>${h(club.jugeArbitre)}</strong>${autres.length
        ? ` <span class="muted">(aussi croisé : ${h(autres.join(', '))})</span>` : ''}`;
    })()] : null,
    (club.surfaces || []).length ? ['🎾', `${club.surfaces.length > 1 ? 'Surfaces' : 'Surface'} :
      ${club.surfaces.map(s => puce(s)).join(' ')}`] : null,
    club.installations ? ['🏟️', h(club.installations)] : null,
    club.note ? ['📝', h(club.note)] : null,
  ].filter(Boolean);

  return `
    <section class="carte">
      <div class="fiche-tete">
        <div>
          <h2>${h(club.nom)}</h2>
          ${club.ville ? `<p class="muted tiny">${h(club.ville)}</p>` : ''}
        </div>
        <button class="btn btn-ghost" data-modifier>Modifier</button>
      </div>
      <ul class="fiche-infos">
        ${lignes.map(([e, t]) => `<li><span class="fiche-emoji">${e}</span><div>${t}</div></li>`).join('')}
      </ul>
      ${!club.telephone ? `<p class="tiny muted">Le téléphone n'est pas publié sur Ten'Up :
        c'est à toi de l'ajouter une fois pour toutes.</p>` : ''}
    </section>

    ${(club.sources || []).length ? `<section class="carte">
      <h3>Suivre ce club</h3>
      <ul class="comptes">
        ${club.sources.map(s => {
          const p = infoPlateforme(s.plateforme);
          return `<li><a href="${h(s.url)}" target="_blank" rel="noopener noreferrer">
            <span class="gros-emoji">${p.emoji}</span>
            <span class="compte-nom">${h(p.nom)}</span></a></li>`;
        }).join('')}
      </ul>
    </section>` : ''}

    <section class="carte">
      <h3>Mes matchs ici</h3>
      ${matchs.length ? `
        <p class="tiny muted">${matchs.length} match(s) — ${b.v} victoire(s),
           ${b.d} défaite(s), ${b.ratio}% de réussite.</p>
        <ul class="matchs" style="margin-top:10px">
          ${matchs.map(m => `<li class="match ${m.issue === 'V' ? 'gagne' : 'perdu'}"
                                data-match="${h(m.id)}">
            <div class="match-issue">${m.issue}</div>
            <div class="match-corps">
              <div class="match-tete">
                <strong>${h(m.adversaire || '—')}</strong>${puce(m.echelonAdverse)}
              </div>
              <div class="match-bas">
                <span>${h(dateCourte(m.date))}</span>
                ${m.score ? `<span>${h(m.score)}</span>` : ''}
                ${m.tournoi ? `<span class="muted">${h(m.tournoi)}</span>` : ''}
              </div>
            </div>
          </li>`).join('')}
        </ul>`
        : `<p class="tiny muted">Aucun match rattaché. Vérifie les mots-clés du club :
           ils sont comparés au libellé de l'épreuve.</p>`}
    </section>

    <div class="rangee-boutons">
      <button class="btn btn-danger" data-supprimer>Supprimer ce club</button>
    </div>`;
}

// =====================================================================
//  Branchements
// =====================================================================
export function wire(vue) {
  vue.addEventListener('click', e => {
    if (e.target.closest('[data-nouveau]')) { clubForm(); return; }
    const l = e.target.closest('[data-club]');
    if (l) location.hash = `#/clubs/${l.dataset.club}`;
  });
}

export function wireFiche(vue, rerendre) {
  vue.addEventListener('click', async e => {
    const club = store.clubs.find(c => c.id === location.hash.split('/')[2]);
    if (!club) return;

    if (e.target.closest('[data-modifier]')) { clubForm(club); return; }

    const m = e.target.closest('[data-match]');
    if (m) {
      const match = store.matchs.find(x => x.id === m.dataset.match);
      if (match) matchForm(match);
      return;
    }

    if (e.target.closest('[data-supprimer]')) {
      if (await confirmer('Supprimer ce club ?',
          `${club.nom} — les matchs restent, ils redeviennent simplement sans club.`)) {
        supprimerClub(club.id);
        toast('Club supprimé.');
        location.hash = '#/clubs';
      }
    }
  });
}
