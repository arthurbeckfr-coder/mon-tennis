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

import { h, hMulti, dateCourte, puce, confirmer, toast,
         puceNote, blocNote, brancherNotes } from '../util.js';
import { store, bilanMatchs, clubDuMatch, nomProfil, direTour, PROFILS } from '../store.js';
import { rang } from '../classement.js';
import { joueurForm, matchForm } from '../forms.js';
import { carteClubs, brancherCarte } from '../carte.js';

let recherche = '';
let tri = 'matchs';

/* Les compteurs du haut ne sont pas des affirmations à croire : chacun
   ouvre exactement les adversaires qu'il a comptés. « 75 bilans négatifs »
   ne sert à rien tant qu'on ne peut pas demander lesquels — c'est même la
   première chose qu'on a envie de faire en le lisant. */
let vueListe = 'tous';

const VUES = {
  tous:    { garde: () => true },
  rejoues: { garde: j => j.total > 1,
             titre: 'Seulement ceux que tu as joués plusieurs fois' },
  negatif: { garde: j => j.d > j.v,
             titre: 'Seulement ceux contre qui ton bilan est négatif' },
};

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

  /* Les fiches sans match : un adversaire noté avant de l'avoir joué —
     celui du tableau de dimanche, celui dont un partenaire vient de
     parler. Le répertoire se remplit tout seul avec les matchs, mais il
     ne doit pas faire disparaître ce qu'on y a mis à la main : ajouté
     puis introuvable, c'est pire que pas d'ajout du tout. */
  for (const f of store.joueurs || []) {
    const cle = cleJoueur(f.nom);
    if (!cle || parCle.has(cle)) continue;
    parCle.set(cle, { cle, nom: (f.nom || '').trim(), matchs: [] });
  }

  return [...parCle.values()].map(j => {
    j.matchs.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    const b = bilanMatchs(j.matchs);
    /* Le classement retenu est le plus récent connu : c'est celui qui
       renseigne sur le niveau actuel, pas le meilleur jamais atteint. */
    const dernier = j.matchs.find(m => m.echelonAdverse);
    const fiche = store.joueurs?.find(x => cleJoueur(x.nom) === j.cle) || null;
    return {
      ...j,
      ...b,
      echelon: dernier?.echelonAdverse || '',
      derniere: j.matchs[0]?.date || '',
      fiche,
      club: (fiche?.club || '').trim(),
    };
  }).sort((a, b) => b.total - a.total || a.nom.localeCompare(b.nom, 'fr'));
}

// =====================================================================
//  Les tris
// =====================================================================
/* La question de la veille d'un match n'est pas toujours la même. « Qui
   je croise tout le temps » se lit par nombre de matchs ; « qui je n'ai
   jamais réussi à battre » par défaites ; « le plus fort que j'aie
   battu » par classement ; et quand on cherche simplement quelqu'un dont
   on a le nom en tête, c'est l'ordre alphabétique qu'on veut.

   Le tri ne change que l'ordre, jamais le contenu : la recherche reste
   maîtresse de ce qui s'affiche.

   Les victoires et les défaites se départagent par le nombre de matchs :
   à deux défaites chacun, celui qu'on a joué six fois est un adversaire
   installé, celui qu'on a joué deux fois est un accident.

   (La table des tris se trouve plus bas, après le tableau des clubs
   adverses.) */

/* ─── Les clubs adverses ───────────────────────────────────────────────

   Ten'Up ne donne pas le club d'un adversaire : un nom, un classement, et
   rien d'autre. Ce champ se saisit donc à la main, et le carnet ne fait
   pas semblant du contraire — il ne montre ce tableau que quand il a de
   quoi le remplir, et dit combien d'adversaires restent sans club.

   Ce qu'on vient y chercher n'est pas une statistique de plus mais une
   fierté précise : « combien de licenciés de ce club j'ai battus ». D'où
   le classement par joueurs battus, et non par joueurs croisés. */
function rendreClubsAdverses(tous) {
  const avec = tous.filter(j => j.club);
  if (!avec.length) return '';

  const parClub = {};
  for (const j of avec) {
    const c = j.club;
    parClub[c] = parClub[c] || { joueurs: 0, battus: 0, v: 0, d: 0 };
    parClub[c].joueurs++;
    if (j.v > 0) parClub[c].battus++;
    parClub[c].v += j.v;
    parClub[c].d += j.d;
  }

  const clubs = Object.keys(parClub)
    .sort((a, b) => parClub[b].battus - parClub[a].battus ||
                    parClub[b].v - parClub[a].v ||
                    a.localeCompare(b, 'fr'));
  const sansClub = tous.length - avec.length;

  return `<section class="carte">
    <h3>Les clubs de tes adversaires</h3>
    <ul class="clubs-adverses">
      ${clubs.map(c => `<li>
        <div>
          <strong>${h(c)}</strong>
          <div class="tiny muted">${parClub[c].joueurs} joueur${parClub[c].joueurs > 1 ? 's' : ''}
            croisé${parClub[c].joueurs > 1 ? 's' : ''}, ${parClub[c].v}V–${parClub[c].d}D</div>
        </div>
        <div class="club-score">
          <b>${parClub[c].battus}</b>
          <span class="tiny muted">battu${parClub[c].battus > 1 ? 's' : ''}</span>
        </div>
      </li>`).join('')}
    </ul>
    ${sansClub ? `<p class="tiny muted">${sansClub} adversaire(s) sans club renseigné : la
      fédération ne le publie pas, il se saisit depuis leur fiche. Ce tableau ne compte
      que ce que tu as noté.</p>` : ''}
  </section>`;
}

const TRIS = [
  { cle: 'matchs',    nom: 'matchs joués',
    comparer: (a, b) => b.total - a.total },
  { cle: 'victoires', nom: 'mes victoires',
    comparer: (a, b) => b.v - a.v || b.total - a.total },
  { cle: 'defaites',  nom: 'mes défaites',
    comparer: (a, b) => b.d - a.d || (b.d - b.v) - (a.d - a.v) },
  { cle: 'ratio',     nom: 'mon taux de victoires',
    comparer: (a, b) => b.ratio - a.ratio || b.total - a.total },
  { cle: 'recent',    nom: 'dernière rencontre',
    comparer: (a, b) => (b.derniere || '').localeCompare(a.derniere || '') },
  /* Un adversaire sans classement connu vaut −1 au rang, et tombe donc
     naturellement en fin de liste : on ne lui invente pas un niveau. */
  { cle: 'niveau',    nom: 'classement (le plus fort d\'abord)',
    comparer: (a, b) => rang(b.echelon) - rang(a.echelon) || b.total - a.total },
  { cle: 'club',      nom: 'club (A→Z)',
    /* Les adversaires sans club renseigné passent derrière : les mêler
       aux autres ferait un premier groupe sans nom, qui n'apprend rien. */
    comparer: (a, b) => (a.club ? 0 : 1) - (b.club ? 0 : 1) ||
                        a.club.localeCompare(b.club, 'fr') || b.total - a.total },
  { cle: 'nom',       nom: 'nom (A→Z)',
    comparer: (a, b) => a.nom.localeCompare(b.nom, 'fr') },
];

const triCourant = () => TRIS.find(t => t.cle === tri) || TRIS[0];

// =====================================================================
//  La liste
// =====================================================================
export function render() {
  const t = triCourant();
  // Le nom départage en dernier ressort, sinon deux adversaires à égalité
  // s'échangeraient de place d'un affichage à l'autre.
  const tous = repertoire()
    .sort((a, b) => t.comparer(a, b) || a.nom.localeCompare(b.nom, 'fr'));
  const q = recherche.trim().toUpperCase();
  const garde = (VUES[vueListe] || VUES.tous).garde;
  const liste = tous
    .filter(garde)
    .filter(j => !q || cleJoueur(j.nom).includes(cleJoueur(q)));

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
      <div class="chiffre ${vueListe === 'tous' ? 'actif' : ''}" data-vue-j="tous"
        title="Tous les adversaires"><b>${tous.length}</b><span>adversaires</span></div>
      <div class="chiffre ${vueListe === 'rejoues' ? 'actif' : ''}" data-vue-j="rejoues"
        title="Voir ceux-là"><b>${tous.filter(j => j.total > 1).length}</b>
        <span>déjà rejoués</span></div>
      <div class="chiffre ${vueListe === 'negatif' ? 'actif' : ''}" data-vue-j="negatif"
        title="Voir ceux-là"><b>${aBattre}</b><span>bilan négatif</span></div>
    </section>

    ${vueListe !== 'tous' ? `<p class="tiny muted" style="margin:0 4px 10px">
      ${h(VUES[vueListe].titre)}.
      <button class="lien" data-vue-j="tous">Tout revoir</button></p>` : ''}

    <section class="barre-filtres">
      <input id="q-joueur" class="recherche" placeholder="Chercher un adversaire…"
             value="${h(recherche)}">
      ${tous.length > 1 ? `<label class="tri">
        <span>Trier par</span>
        <select id="tri-joueur">
          ${TRIS.map(x => `<option value="${x.cle}"${x.cle === tri ? ' selected' : ''}
            >${h(x.nom)}</option>`).join('')}
        </select>
      </label>` : ''}
    </section>

    ${anonymes ? `<p class="tiny muted" style="margin:0 4px 10px">${anonymes} match(s) contre
      des joueurs « Anonyme » ne figurent pas ici : la fédération masque leur nom, et les
      regrouper ferait un adversaire fictif au bilan dénué de sens.</p>` : ''}

    ${rendreClubsAdverses(tous)}

    ${liste.length ? `<ul class="joueurs">
      ${liste.map(j => `<li class="joueur-ligne" data-joueur="${h(j.cle)}">
        <div class="joueur-corps">
          <strong>${h(j.nom)}</strong>
          <div class="club-bas">
            ${j.echelon ? puce(j.echelon) : ''}
            ${j.club ? `<span class="puce puce-club">${h(j.club)}</span>` : ''}
            <span>${j.total} match${j.total > 1 ? 's' : ''}</span>
            ${tri === 'ratio' ? `<span>${j.ratio}% pour toi</span>` : ''}
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
/* ─── Où l'on s'est croisés ────────────────────────────────────────────

   La liste des matchs dit déjà le club de chacun, mais en toutes lettres
   et un par un : pour savoir si l'on se croise toujours au même endroit ou
   un peu partout, il faut les lire tous et les tenir de tête. Une carte
   répond d'un coup d'œil.

   Elle réutilise celle des clubs sans rien y changer : mêmes disques,
   même taille selon le nombre de matchs — ici, le nombre de fois qu'on
   s'est rencontrés là. Un adversaire croisé une seule fois donne donc une
   carte à un point, ce qui reste une réponse : c'était là. */
function rendreOuVousAvezJoue(j) {
  const parClub = new Map();
  for (const m of j.matchs) {
    const club = clubDuMatch(m);
    if (!club) continue;
    if (!parClub.has(club.id)) parClub.set(club.id, { club, matchs: [] });
    parClub.get(club.id).matchs.push(m);
  }

  const clubs = [...parClub.values()].map(x => ({ ...x, bilan: bilanMatchs(x.matchs) }));
  const sansClub = j.matchs.length - clubs.reduce((t, c) => t + c.matchs.length, 0);

  if (!clubs.length) {
    return `<section class="carte">
      <h3>Où vous vous êtes croisés</h3>
      <p class="tiny muted">Aucun de vos matchs n'est rattaché à un club — c'est le cas des
        rencontres par équipes, qui n'en ont pas, et des épreuves dont le libellé ne nomme
        personne.</p>
    </section>`;
  }

  /* Le compte d'abord, la carte ensuite : « 7 matchs dans 6 clubs » se
     lit plus vite qu'une carte, et la carte dit ce que le compte ne dit
     pas — lesquels, et à quelle distance les uns des autres. */
  const situes = clubs.reduce((t, c) => t + c.matchs.length, 0);
  const plusJoue = [...clubs].sort((a, b) => b.matchs.length - a.matchs.length)[0];

  return `<section class="carte">
    <h3>Où vous vous êtes croisés</h3>
    <p class="tiny muted">${situes} de vos ${j.matchs.length} match${j.matchs.length > 1 ? 's' : ''}
      ${clubs.length === 1
        ? `au même endroit : <strong>${h(clubs[0].club.nom)}</strong>`
        : `dans <strong>${clubs.length} clubs</strong>, le plus souvent à
           <strong>${h(plusJoue.club.nom)}</strong> (${plusJoue.matchs.length})`}.${sansClub
      ? ` Les ${sansClub} autre${sansClub > 1 ? 's' : ''} n'ont pas de club — rencontres par
         équipes ou épreuves qui ne nomment personne — et ne figurent pas ici.` : ''}</p>
    ${carteClubs(clubs, { couleur: 'bilan' })}
    <ul class="clubs-adverses" style="margin-top:10px">
      ${[...clubs].sort((a, b) => b.matchs.length - a.matchs.length).map(c => {
        const b = c.bilan;
        return `<li>
          <div>
            <strong>${h(c.club.nom)}</strong>
            <div class="tiny muted">${c.matchs.map(m => h(dateCourte(m.date))).join(' · ')}</div>
          </div>
          <div class="joueur-bilan ${b.v > b.d ? 'positif' : b.v < b.d ? 'negatif' : ''}">
            ${b.v}<span>–</span>${b.d}
          </div>
        </li>`;
      }).join('')}
    </ul>
  </section>`;
}

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

    ${rendreOuVousAvezJoue(j)}

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
                ${direTour(m) ? puce(direTour(m), m.tour === 'finale' && m.issue === 'V' ? 'puce-titre' : '') : ''}
                ${puceNote(m)}
              </div>
              ${blocNote(m)}
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
  vue.querySelector('#tri-joueur')?.addEventListener('change', e => {
    tri = e.target.value;
    rerendre();
  });

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
    const v = e.target.closest('[data-vue-j]');
    if (v) {
      // Recliquer sur un compteur ouvert le referme.
      const choisie = v.dataset.vueJ;
      vueListe = choisie === vueListe ? 'tous' : choisie;
      rerendre();
      return;
    }

    const l = e.target.closest('[data-joueur]');
    if (l) location.hash = `#/joueurs/${encodeURIComponent(l.dataset.joueur)}`;
  });
}

export function wireFiche(vue) {
  brancherCarte(vue, id => { location.hash = `#/clubs/${id}`; });

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
