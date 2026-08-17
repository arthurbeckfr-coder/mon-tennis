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
//  Les tris
// =====================================================================
/* Une liste de clubs ne se lit pas toujours dans le même ordre. « Où
   est-ce que je joue » se lit par nombre de matchs, « où est-ce que je
   gagne » par taux de victoires, « où ne suis-je pas retourné depuis
   deux ans » par dernière visite. Un ordre unique répondrait à une
   question sur trois.

   Chaque tri affiche le chiffre sur lequel il trie : trier sur un nombre
   qu'on ne voit pas, c'est demander de croire sur parole.

   Le taux de victoires se départage par le nombre de matchs, et c'est ce
   qui compte le plus dans ce tri : 100 % sur un match unique n'est pas
   un fort, et n'a rien à faire devant un club où l'on gagne trois fois
   sur quatre depuis quatorze matchs. */
let tri = 'matchs';

const pluriel = n => `${n} match${n > 1 ? 's' : ''}`;

const TRIS = [
  { cle: 'matchs', nom: 'fréquentation',
    gros: c => String(c.matchs.length),
    petit: c => `${c.bilan.v}V–${c.bilan.d}D`,
    comparer: (a, b) => b.matchs.length - a.matchs.length },

  { cle: 'victoires', nom: 'mes victoires',
    gros: c => String(c.bilan.v),
    petit: c => `sur ${pluriel(c.matchs.length)}`,
    comparer: (a, b) => b.bilan.v - a.bilan.v || b.matchs.length - a.matchs.length },

  { cle: 'reussite', nom: 'mon taux de victoires',
    gros: c => c.matchs.length ? `${c.bilan.ratio}%` : '—',
    petit: c => c.matchs.length ? `${c.bilan.v}V–${c.bilan.d}D` : 'jamais joué',
    comparer: (a, b) => b.bilan.ratio - a.bilan.ratio || b.matchs.length - a.matchs.length },

  { cle: 'recent', nom: 'ma dernière visite',
    gros: c => String(c.matchs.length),
    petit: c => c.derniere ? dateCourte(c.derniere) : 'jamais',
    comparer: (a, b) => (b.derniere || '').localeCompare(a.derniere || '') },

  { cle: 'surfaces', nom: 'nombre de surfaces',
    gros: c => String((c.club.surfaces || []).length || '—'),
    petit: c => `${pluriel(c.matchs.length)}`,
    comparer: (a, b) => (b.club.surfaces || []).length - (a.club.surfaces || []).length ||
                        b.matchs.length - a.matchs.length },

  { cle: 'nom', nom: 'nom (A→Z)',
    gros: c => String(c.matchs.length),
    petit: c => `${c.bilan.v}V–${c.bilan.d}D`,
    comparer: (a, b) => a.club.nom.localeCompare(b.club.nom, 'fr') },
];

const triCourant = () => TRIS.find(t => t.cle === tri) || TRIS[0];

const barreTri = () => `<section class="barre-filtres">
  <label class="tri">
    <span>Trier par</span>
    <select id="tri-club">
      ${TRIS.map(t => `<option value="${t.cle}"${t.cle === tri ? ' selected' : ''}
        >${h(t.nom)}</option>`).join('')}
    </select>
  </label>
</section>`;

// =====================================================================
//  La liste
// =====================================================================
export function render() {
  const t = triCourant();
  const clubs = [...store.clubs]
    .map(c => {
      const matchs = matchsDuClub(c);
      // `matchsDuClub` rend les matchs du plus récent au plus ancien.
      return { club: c, matchs, bilan: bilanMatchs(matchs), derniere: matchs[0]?.date || '' };
    })
    // Le nom départage en dernier ressort : sans lui, deux clubs à égalité
    // s'échangeraient de place d'un affichage à l'autre.
    .sort((a, b) => t.comparer(a, b) || a.club.nom.localeCompare(b.club.nom, 'fr'));

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

    ${store.clubs.length > 1 ? barreTri() : ''}

    <ul class="clubs">
      ${clubs.map(c => `<li class="club-ligne" data-club="${h(c.club.id)}">
          <div class="club-corps">
            <strong>${h(c.club.nom)}</strong>
            <div class="club-bas">
              ${c.club.ville ? `<span>${h(c.club.ville)}</span>` : ''}
              ${(c.club.surfaces || []).map(s => puce(s)).join('')}
              ${c.club.jugeArbitre ? `<span class="muted">JA ${h(c.club.jugeArbitre)}</span>` : ''}
            </div>
          </div>
          <div class="club-score">
            <b>${h(t.gros(c))}</b>
            <span class="tiny muted">${h(t.petit(c))}</span>
          </div>
        </li>`).join('')}
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
export function wire(vue, rerendre) {
  vue.querySelector('#tri-club')?.addEventListener('change', e => {
    tri = e.target.value;
    rerendre();
  });

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
