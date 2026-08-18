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

import { h, dateCourte, puce, confirmer, toast, openModal, closeModal,
         puceNote, blocNote, brancherNotes } from '../util.js';
import {
  store, matchsDuClub, epreuvesOrphelines, bilanMatchs, positionMot,
  supprimerClub, ajouterClub, modifierClub, modifierMatch, clubDuMatch,
  estParEquipes, direTour, PLATEFORMES,
} from '../store.js';
import { clubConnuPour, MOTS_EN_PLUS, LIENS_CONNUS, urlTenupClub } from '../clubs-connus.js';
import { carteClubs, brancherCarte, pointDuClub } from '../carte.js';
import { distanceKm, direDistance, lienItineraire, adresseDuClub } from '../geocodage.js';
import { clubForm, matchForm } from '../forms.js';

/* ─── Les rattachements proposés ───────────────────────────────────────

   Une épreuve sans club n'est pas toujours une énigme : « TOURNOI OPEN
   MSA TC » nomme son organisateur, encore faut-il savoir que MSA TC est
   le club de Mont-Saint-Aignan. Le carnet le sait maintenant (voir
   clubs-connus.js) et le propose, sans jamais l'appliquer tout seul.

   Deux réparations possibles, et une seule s'affiche à la fois :
   ajouter le mot-clé manquant à un club qu'on a déjà, ou créer le club
   absent avec son adresse. Dans les deux cas les matchs se rattachent
   ensuite d'eux-mêmes, par le mécanisme habituel des mots-clés — rien
   n'est écrit dans les matchs, ce qui rend le geste réversible d'un
   changement de mot-clé. */
function propositions(orphelines) {
  const dejaConnu = mot => store.clubs.some(c =>
    (c.motsCles || []).some(x => x.toUpperCase() === mot.toUpperCase()));

  const liste = [];

  /* Une proposition par club, et non par mot-clé : Mont-Saint-Aignan
     s'écrit « MSA TC » une année et « MSATC » la suivante, ce qui ferait
     deux lignes proposant de créer deux fois le même club — dont la
     seconde n'aurait plus de sens une fois la première appliquée. On
     rassemble donc les graphies, et un seul geste les pose toutes. */
  for (const [nom, n] of orphelines) {
    const trouve = clubConnuPour(nom);
    if (!trouve || dejaConnu(trouve.mot)) continue;

    const cle = trouve.club.nom;
    const deja = liste.find(x => x.cle === cle);
    if (deja) {
      deja.matchs += n;
      if (!deja.mots.includes(trouve.mot)) deja.mots.push(trouve.mot);
      if (!deja.epreuves.includes(nom)) deja.epreuves.push(nom);
      continue;
    }

    const existant = store.clubs.find(c =>
      c.nom.toUpperCase() === trouve.club.nom.toUpperCase());

    liste.push({ cle, epreuves: [nom], matchs: n, mots: [trouve.mot],
                 connu: trouve.club, existant: existant || null });
  }

  /* Les mots-clés à greffer sur un club déjà présent — « TOUT VA BIEN »
     pour Dieppe : rien dans ces trois mots ne le laisse deviner. */
  for (const { club, mots } of MOTS_EN_PLUS) {
    const cible = store.clubs.find(c => (c.motsCles || [])
      .some(x => x.toUpperCase() === club.toUpperCase()));
    if (!cible) continue;
    for (const mot of mots) {
      if (dejaConnu(mot)) continue;
      const touchees = orphelines.filter(([nom]) => positionMot(nom, mot) >= 0);
      if (!touchees.length) continue;
      liste.push({
        cle: cible.nom + '|' + mot,
        epreuves: touchees.map(([nom]) => nom),
        matchs: touchees.reduce((t, [, n]) => t + n, 0),
        mots: [mot], connu: null, existant: cible,
      });
    }
  }

  /* Les pages publiques qui manquent à un club qu'on a déjà. Un club sans
     lien n'est pas un club incomplet par choix : c'est simplement que
     l'import de la fédération ne donne aucune page, et que personne ne va
     les chercher à la main. */
  for (const { club, sources } of LIENS_CONNUS) {
    const cible = store.clubs.find(c => c.nom.toUpperCase() === club.toUpperCase());
    if (!cible) continue;
    const dejaLa = new Set((cible.sources || []).map(s => (s.url || '').toLowerCase()));
    const manquants = sources.filter(s => !dejaLa.has(s.url.toLowerCase()));
    if (!manquants.length) continue;
    liste.push({
      cle: 'liens|' + cible.nom,
      liens: manquants,
      existant: cible,
      epreuves: [], matchs: 0, mots: [], connu: null,
    });
  }

  return liste;
}

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

/* La surface retenue. Un club peut en avoir deux — terre battue dehors,
   résine sous bulle — et il compte alors dans les deux : filtrer sur la
   terre battue ne doit pas le faire disparaître sous prétexte qu'il a
   aussi de la résine. C'est pour cela que le filtre lit une liste et non
   une valeur. */
let surface = 'tout';

/* L'épreuve orpheline dont on regarde les matchs. Une seule à la fois :
   deux listes ouvertes se compareraient mal et rallongeraient l'écran
   pour rien. */
let epreuveOuverte = null;

/* Liste ou carte. La liste répond à « lequel je fréquente le plus », la
   carte à « lesquels sont groupés, lequel est loin » — deux questions que
   le même écran ne peut pas servir en même temps sans devenir long. */
let ongletClubs = 'liste';

const barreClubs = () => `<div class="segments" style="width:100%;margin-bottom:12px">
  <button data-onglet-club="liste" class="${ongletClubs === 'liste' ? 'actif' : ''}"
          style="flex:1">Liste</button>
  <button data-onglet-club="carte" class="${ongletClubs === 'carte' ? 'actif' : ''}"
          style="flex:1">Carte</button>
</div>`;

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

/** Les surfaces réellement présentes dans les clubs, avec le nombre de
 *  clubs qui les portent. On ne propose pas les huit surfaces du
 *  vocabulaire : filtrer sur une moquette qu'on n'a jamais foulée ne
 *  donnerait qu'une liste vide. */
const surfacesConnues = () => {
  const n = {};
  for (const c of store.clubs) {
    for (const s of c.surfaces || []) n[s] = (n[s] || 0) + 1;
  }
  return Object.keys(n).sort((a, b) => n[b] - n[a] || a.localeCompare(b, 'fr'))
    .map(s => ({ nom: s, clubs: n[s] }));
};

const barreTri = () => {
  const surfaces = surfacesConnues();
  return `<section class="barre-filtres">
    <label class="tri">
      <span>Trier par</span>
      <select id="tri-club">
        ${TRIS.map(t => `<option value="${t.cle}"${t.cle === tri ? ' selected' : ''}
          >${h(t.nom)}</option>`).join('')}
      </select>
    </label>
    ${surfaces.length > 1 ? `<label class="tri">
      <span>Surface</span>
      <select id="surface-club">
        <option value="tout"${surface === 'tout' ? ' selected' : ''}>Toutes</option>
        ${surfaces.map(s => `<option value="${h(s.nom)}"${s.nom === surface ? ' selected' : ''}
          >${h(s.nom)} (${s.clubs})</option>`).join('')}
      </select>
    </label>` : ''}
  </section>`;
};

// =====================================================================
//  La liste
// =====================================================================
/* ─── Deviner le club d'une épreuve orpheline ──────────────────────────
 *
 * Un tournoi revient chaque année, au même endroit et à peu près à la
 * même date. C'est presque toujours vrai, et c'est une information que le
 * carnet possède déjà sans s'en servir : si « TOURNOI OPEN » 2019 n'a pas
 * de club mais que le « TOURNOI OPEN » 2022 est rattaché à Auffay, le
 * premier s'est très probablement joué à Auffay aussi.
 *
 * Trois indices, du plus sûr au plus faible, et l'on s'arrête au premier
 * qui parle :
 *
 *   1. le même libellé, une autre année, déjà rattaché ;
 *   2. la même période de l'année, à dix jours près, pour une épreuve au
 *      nom voisin — un tournoi d'été ne devient pas un tournoi d'hiver ;
 *   3. les mêmes adversaires — un club fait jouer les mêmes gens, et deux
 *      noms en commun ne sont pas un hasard dans un rayon de trente
 *      kilomètres.
 *
 * Rien de tout cela n'est certain, et c'est pourquoi le carnet propose au
 * lieu de décider : la raison est écrite à côté du nom du club, et un
 * geste suffit à refuser en choisissant autre chose.
 */
const MOTS_VIDES = new Set(['TOURNOI', 'OPEN', 'DU', 'DE', 'DES', 'LE', 'LA', 'LES',
  'ET', 'A', 'AU', 'AUX', 'EN', 'SENIOR', 'SENIORS', 'MESSIEURS', 'DAMES', 'HOMMES',
  'FEMMES', 'CIRCUIT', 'CLASSEMENT', 'SIMPLE', 'MASCULIN', 'FEMININ', 'NC', 'PLUS']);

const sansAccent = t => (t || '').toUpperCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[^A-Z0-9]+/g, ' ').trim();

/** Le libellé d'une épreuve, débarrassé de son millésime : c'est ce qui
 *  reste identique d'une édition à l'autre. */
const cleEpreuve = nom => sansAccent(nom)
  .replace(/\b(19|20)\d\d\b/g, '').replace(/\s+/g, ' ').trim();

/** Les mots qui distinguent une épreuve d'une autre. */
const motsForts = nom => sansAccent(nom).split(' ')
  .filter(m => m.length >= 3 && !MOTS_VIDES.has(m) && !/^(19|20)\d\d$/.test(m));

/** Le jour de l'année, pour comparer deux éditions sans regarder l'année. */
const jourDeLAnnee = date => {
  const d = new Date((date || '') + 'T12:00:00');
  if (isNaN(d)) return null;
  return Math.round((d - new Date(d.getFullYear(), 0, 0)) / 86400000);
};

/** Le club le plus probable pour une épreuve sans club, et pourquoi.
 *  @returns {{club, raison, sur}|null}
 */
function deviner(nom, matchs) {
  const situes = store.matchs
    .map(m => ({ m, club: clubDuMatch(m) }))
    .filter(x => x.club);
  if (!situes.length) return null;

  const meilleur = compte => {
    const cles = Object.keys(compte);
    if (!cles.length) return null;
    cles.sort((a, b) => compte[b].n - compte[a].n);
    return compte[cles[0]];
  };

  /* 1. La même épreuve, une autre année. */
  const cle = cleEpreuve(nom);
  const parCle = {};
  for (const { m, club } of situes) {
    if (cleEpreuve(m.tournoi) !== cle) continue;
    const k = club.id;
    parCle[k] = parCle[k] || { club, n: 0, annees: new Set() };
    parCle[k].n++;
    parCle[k].annees.add((m.date || '').slice(0, 4));
  }
  const memeEpreuve = meilleur(parCle);
  if (memeEpreuve) {
    const ans = [...memeEpreuve.annees].filter(Boolean).sort();
    return { club: memeEpreuve.club, sur: memeEpreuve.n,
             raison: `même épreuve en ${ans.join(', ')}` };
  }

  /* 2. La même période de l'année, pour un nom voisin. */
  const jours = matchs.map(m => jourDeLAnnee(m.date)).filter(j => j != null);
  const mots = new Set(motsForts(nom));
  if (jours.length && mots.size) {
    const parPeriode = {};
    for (const { m, club } of situes) {
      const j = jourDeLAnnee(m.date);
      if (j == null) continue;
      /* Dix jours de part et d'autre, en passant par-dessus le nouvel an :
         un tournoi de fin décembre revient début janvier. */
      const proche = jours.some(x => {
        const d = Math.abs(x - j);
        return Math.min(d, 365 - d) <= 10;
      });
      if (!proche) continue;
      const communs = motsForts(m.tournoi).filter(w => mots.has(w));
      if (communs.length < 1) continue;
      const k = club.id;
      parPeriode[k] = parPeriode[k] || { club, n: 0, mot: communs[0] };
      parPeriode[k].n++;
    }
    const memePeriode = meilleur(parPeriode);
    if (memePeriode && memePeriode.n >= 2) {
      return { club: memePeriode.club, sur: memePeriode.n,
               raison: `même période, épreuve « ${memePeriode.mot} »` };
    }
  }

  /* 3. Les mêmes adversaires. */
  const advers = new Set(matchs.map(m => sansAccent(m.adversaire)).filter(Boolean));
  if (advers.size) {
    const parJoueur = {};
    for (const { m, club } of situes) {
      const a = sansAccent(m.adversaire);
      if (!a || !advers.has(a)) continue;
      const k = club.id;
      parJoueur[k] = parJoueur[k] || { club, n: 0, noms: new Set() };
      parJoueur[k].n++;
      parJoueur[k].noms.add(m.adversaire);
    }
    const memesJoueurs = meilleur(parJoueur);
    if (memesJoueurs && memesJoueurs.noms.size >= 2) {
      return { club: memesJoueurs.club, sur: memesJoueurs.noms.size,
               raison: `${memesJoueurs.noms.size} adversaires déjà croisés là-bas` };
    }
  }

  return null;
}
/** Le bouton qui applique la devinette, avec sa raison écrite à côté.
 *  `data-club-suggere` et non `data-club` : ce dernier ouvre la fiche
 *  d'un club dans la liste, et le clic partirait ailleurs. */
function boutonDevine(nom, matchs) {
  const d = deviner(nom, matchs);
  if (!d) return '';
  return `<div class="suggestion">
    <button class="btn btn-primary" data-suggere="${h(nom)}"
      data-club-suggere="${h(d.club.id)}">Rattacher à ${h(d.club.nom)}</button>
    <span class="tiny muted">${h(d.raison)}</span>
  </div>`;
}
/** Le détail derrière une des quatre tuiles.
 *
 *  Trois d'entre elles racontent ce qu'on a — les clubs, les matchs
 *  situés, les surfaces — et la quatrième donne de quoi agir : chaque
 *  épreuve sans club y reçoit sa liste déroulante, et la choisir
 *  rattache tous ses matchs d'un coup. Descendre au bas de la page pour
 *  le faire restait possible, mais la tuile promettait de s'ouvrir : elle
 *  ouvre donc là où le geste se fait.
 */
function fenetreChiffre(quoi) {
  const ligne = (titre, detail, valeur) => `<li>
    <div><strong>${h(titre)}</strong>
      ${detail ? `<div class="tiny muted">${detail}</div>` : ''}</div>
    <div class="club-score"><b>${h(valeur)}</b></div></li>`;

  if (quoi === 'clubs') {
    const liste = [...store.clubs]
      .map(c => ({ c, n: matchsDuClub(c).length }))
      .sort((a, b) => b.n - a.n || a.c.nom.localeCompare(b.c.nom, 'fr'));
    openModal({
      title: `Mes ${liste.length} clubs`,
      body: `<ul class="clubs-adverses">${liste.map(x => ligne(x.c.nom,
        [x.c.ville, (x.c.surfaces || []).join(', ')].filter(Boolean).join(' — '),
        `${x.n} match(s)`)).join('')}</ul>`,
    });
    return;
  }

  if (quoi === 'situes') {
    const liste = [...store.clubs]
      .map(c => ({ c, m: matchsDuClub(c) }))
      .filter(x => x.m.length)
      .sort((a, b) => b.m.length - a.m.length);
    const total = liste.reduce((t, x) => t + x.m.length, 0);
    openModal({
      title: `${total} matchs situés`,
      body: `<p class="tiny muted">Un match est situé quand son épreuve nomme un club
          reconnu, ou qu'on lui en a donné un à la main.</p>
        <ul class="clubs-adverses">${liste.map(x => {
          const b = bilanMatchs(x.m);
          return ligne(x.c.nom, `${b.v}V–${b.d}D`, `${x.m.length} match(s)`);
        }).join('')}</ul>`,
    });
    return;
  }

  if (quoi === 'surfaces') {
    const par = {};
    for (const c of store.clubs) {
      for (const s of c.surfaces || []) {
        par[s] = par[s] || { clubs: 0, matchs: 0 };
        par[s].clubs++;
        par[s].matchs += matchsDuClub(c).length;
      }
    }
    const cles = Object.keys(par).sort((a, b) => par[b].clubs - par[a].clubs);
    openModal({
      title: `${cles.length} surfaces`,
      body: cles.length
        ? `<ul class="clubs-adverses">${cles.map(s => ligne(s,
            `${par[s].matchs} match(s) joués dans ces clubs`,
            `${par[s].clubs} club(s)`)).join('')}</ul>
           <p class="tiny muted">Un club à plusieurs surfaces compte dans chacune :
             les totaux ne s'additionnent donc pas.</p>`
        : `<p class="tiny muted">Aucune surface renseignée. Elle se note sur la fiche
           d'un club, et le carnet la propose ensuite à chaque match qui s'y joue.</p>`,
    });
    return;
  }

  /* Rattacher : la seule fenêtre qui agit. */
  const orphelines = epreuvesOrphelines()
    .filter(([nom]) => !estParEquipes({ tournoi: nom }));
  const total = orphelines.reduce((t, [, n]) => t + n, 0);
  const choix = [...store.clubs].sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
  /* `data-rattacher-a` et non `data-rattacher` : ce dernier nomme déjà
     les boutons de proposition, plus bas dans la page, et deux gestes
     différents sous le même nom finissent par se croiser. */
  const menu = (nom, annee) => `<select data-rattacher-a="${h(nom)}"${
      annee ? ` data-annee="${h(annee)}"` : ''}>
      <option value="">— choisir un club —</option>
      ${choix.map(c => `<option value="${h(c.id)}">${h(c.nom)}</option>`).join('')}
    </select>`;

  openModal({
    title: `${total} match(s) à rattacher`,
    large: true,
    body: !orphelines.length
      ? `<p class="tiny muted">Tout est rattaché. Les rencontres par équipes n'y
         figurent pas : elles n'ont pas de club à trouver.</p>`
      : `<p class="tiny muted">Choisis un club pour une épreuve, et tous ses matchs le
          reçoivent. Touche son nom pour voir les matchs, année par année : un tournoi
          qui change de salle d'une édition à l'autre se rattache alors une année à la
          fois, sans toucher aux autres.</p>
        <ul class="rattachements">
          ${orphelines.map(([nom, n]) => {
            const m = store.matchs
              .filter(x => !clubDuMatch(x) && (x.tournoi || '(sans nom)').trim() === nom)
              .sort((a, b) => (b.date || '').localeCompare(a.date || ''));

            /* Une année, un bloc : c'est la maille à laquelle un tournoi
               change de lieu, et celle à laquelle on s'en souvient. */
            const annees = {};
            for (const x of m) {
              const a = (x.date || '').slice(0, 4) || '?';
              (annees[a] = annees[a] || []).push(x);
            }
            const cles = Object.keys(annees).sort((a, b) => b.localeCompare(a));

            return `<li>
              <details class="rattachement">
                <summary class="rattachement-tete">
                  <strong>${h(nom)}</strong>
                  <span class="tiny muted">${n} match(s) — ${cles.length > 1
                    ? `de ${h(cles[cles.length - 1])} à ${h(cles[0])}`
                    : h(cles[0] || '')}</span>
                </summary>

                ${cles.map(a => `<div class="rattachement-annee">
                  <div class="rattachement-annee-tete">
                    <strong>${h(a)}</strong>
                    <span class="tiny muted">${annees[a].length} match(s)</span>
                  </div>
                  <ul class="matchs-nus">
                    ${annees[a].map(x => `<li data-match="${h(x.id)}">
                      <span class="issue-${x.issue === 'V' ? 'v' : 'd'}">${x.issue}</span>
                      <span>${h(dateCourte(x.date))}</span>
                      <strong>${h(x.adversaire || '—')}</strong>
                      ${puce(x.echelonAdverse)}
                      ${x.score ? `<span class="muted">${h(x.score)}</span>` : ''}
                    </li>`).join('')}
                  </ul>
                  ${cles.length > 1 ? `<label class="tiny muted">Rattacher
                    ${h(a)} seulement ${menu(nom, a)}</label>` : ''}
                </div>`).join('')}
              </details>

              ${boutonDevine(nom, m)}
              <label class="tiny muted">${cles.length > 1
                ? 'Tout rattacher, toutes années confondues' : 'Ou choisir'}
                ${menu(nom)}</label>
            </li>`;
          }).join('')}
        </ul>`,
    onMount: corps => {
      corps.addEventListener('change', e => {
        const sel = e.target.closest('[data-rattacher-a]');
        if (!sel || !sel.value) return;
        const { rattacherA: nom, annee } = sel.dataset;
        rattacherEpreuve(nom, sel.value, annee);
        closeModal();
      });

      /* Un match se corrige d'ici comme d'ailleurs : c'est parfois le seul
         moyen de retrouver où il s'est joué. */
      corps.addEventListener('click', e => {
        const s = e.target.closest('[data-suggere]');
        if (s) {
          rattacherEpreuve(s.dataset.suggere, s.dataset.clubSuggere);
          closeModal();
          return;
        }

        const li = e.target.closest('[data-match]');
        if (!li) return;
        const match = store.matchs.find(x => x.id === li.dataset.match);
        if (match) { closeModal(); matchForm(match); }
      });
    },
  });
}
/** Donne un club aux matchs d'une épreuve — tous, ou ceux d'une année. */
function rattacherEpreuve(nom, clubId, annee = null) {
  const club = store.clubs.find(c => c.id === clubId);
  if (!club) return;
  const vises = store.matchs
    .filter(m => !clubDuMatch(m) && (m.tournoi || '(sans nom)').trim() === nom
              && (!annee || (m.date || '').slice(0, 4) === annee));
  for (const m of vises) modifierMatch(m.id, { clubId: club.id });
  epreuveOuverte = null;
  toast(`${vises.length} match(s) rattaché(s) à ${club.nom}.`);
}
export function render() {
  const t = triCourant();
  /* Le filtre de surface gouverne tout ce qui parle des clubs : la liste,
     la carte et les deux premiers chiffres. Un club à deux surfaces
     apparaît sous chacune — il n'y a pas à choisir laquelle est la
     sienne, elles le sont toutes les deux. */
  const clubs = [...store.clubs]
    .filter(c => surface === 'tout' || (c.surfaces || []).includes(surface))
    .map(c => {
      const matchs = matchsDuClub(c);
      // `matchsDuClub` rend les matchs du plus récent au plus ancien.
      return { club: c, matchs, bilan: bilanMatchs(matchs), derniere: matchs[0]?.date || '' };
    })
    // Le nom départage en dernier ressort : sans lui, deux clubs à égalité
    // s'échangeraient de place d'un affichage à l'autre.
    .sort((a, b) => t.comparer(a, b) || a.club.nom.localeCompare(b.club.nom, 'fr'));

  /* Toutes les épreuves sans club ne sont pas des oublis. Une rencontre
     par équipes se joue une journée chez soi et la suivante chez
     l'adversaire : elle n'appartient à aucun club, et la ranger parmi les
     choses à réparer faisait afficher un chantier permanent qu'aucun
     mot-clé ne pouvait clore. On les sépare donc, et on ne compte comme
     « à rattacher » que ce qui peut l'être. */
  const orphelinesToutes = epreuvesOrphelines();
  const orphelines = orphelinesToutes.filter(([nom]) => !estParEquipes({ tournoi: nom }));
  const equipes = orphelinesToutes.filter(([nom]) => estParEquipes({ tournoi: nom }));

  const sansClub = orphelinesToutes.reduce((t, [, n]) => t + n, 0);
  const aRattacher = orphelines.reduce((t, [, n]) => t + n, 0);
  const nEquipes = equipes.reduce((t, [, n]) => t + n, 0);

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
    ${/* Les quatre tuiles s'ouvrent : un total n'apprend rien tant qu'on
          ne sait pas de quoi il est fait. La dernière ouvre en plus ce
          qu'il faut pour agir — rattacher une épreuve à son club sans
          descendre la chercher au bas de la page. */''}
    <section class="chiffres">
      <div class="chiffre" data-detail="clubs" title="Voir le détail"
        ><b>${clubs.length}</b><span>club${clubs.length > 1 ? 's' : ''}${
          surface === 'tout' ? '' : ' retenus'}</span></div>
      <div class="chiffre" data-detail="situes" title="Voir le détail"
        ><b>${surface === 'tout' ? store.matchs.length - sansClub
          : clubs.reduce((t, c) => t + c.matchs.length, 0)}</b>
        <span>matchs situés</span></div>
      <div class="chiffre" data-detail="surfaces" title="Voir le détail"
        ><b>${new Set(store.clubs.flatMap(c => c.surfaces || [])).size}</b>
        <span>surfaces</span></div>
      <div class="chiffre" data-detail="rattacher" title="Rattacher ces épreuves"
        ><b>${aRattacher}</b><span>à rattacher</span></div>
    </section>

    ${nEquipes ? `<p class="tiny muted" style="margin:0 4px 10px">Plus ${nEquipes} match(s)
      de championnat par équipes, qui n'ont volontairement pas de club : une journée se
      joue chez soi, la suivante chez l'adversaire. Leur bilan se lit dans les
      <a href="#/">statistiques</a>.</p>` : ''}

    ${store.clubs.length > 1 ? barreClubs() : ''}

    ${/* La barre vaut pour les deux onglets : filtrer sur la terre battue
          doit vider la carte des clubs qui n'en ont pas, sinon le filtre
          ment d'un onglet à l'autre. */''}
    ${store.clubs.length > 1 ? barreTri() : ''}

    ${ongletClubs === 'carte' ? `<section class="carte">
      <h3>Où j'ai joué</h3>
      ${carteClubs(clubs)}
    </section>` : `
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
    </ul>`}

    <div class="rangee-boutons" style="justify-content:center">
      <button class="btn" data-nouveau>Ajouter un club</button>
    </div>

    ${(() => {
      const props = propositions(orphelines);
      if (!props.length) return '';
      const total = props.reduce((t, p) => t + p.matchs, 0);
      const nLiens = props.filter(p => p.liens).length;
      return `<section class="carte carte-verte">
        <h3>${total ? `${total} match(s) rattachables` : 'Des fiches à compléter'}${
          total && nLiens ? ', et des fiches à compléter' : ''}</h3>
        <p class="tiny muted">Ces épreuves nomment leur club, mais sous un sigle que ton
          carnet ne connaît pas encore. Rien n'est appliqué avant que tu cliques, et tout
          reste modifiable ensuite depuis la fiche du club.</p>
        <ul class="propositions">
          ${props.map(p => `<li>
            <div>
              <strong>${h(p.existant ? p.existant.nom : p.connu.nom)}</strong>
              ${p.existant ? '' : '<span class="puce">à créer</span>'}
              ${p.liens ? `<div class="tiny muted">Ajouter
                ${p.liens.map(s => h(s.plateforme === 'facebook' ? 'sa page Facebook'
                  : s.plateforme === 'instagram' ? 'son Instagram' : 'son site')).join(' et ')}
                — trouvé${p.liens.length > 1 ? 's' : ''} sur une page publique au nom du
                club.</div>` : `
              <div class="tiny muted">${h(p.epreuves[0])}${p.epreuves.length > 1
                ? ` et ${p.epreuves.length - 1} autre(s) épreuve(s)` : ''} —
                ${p.matchs} match${p.matchs > 1 ? 's' : ''}, reconnu${p.mots.length > 1
                  ? 's aux mots' : ' au mot'} ${p.mots.map(x => `« ${h(x)} »`).join(', ')}</div>
              ${p.connu?.adresse ? `<div class="tiny muted">${h(p.connu.adresse)}</div>` : ''}
              ${p.connu && !p.connu.adresse ? `<div class="tiny muted">Adresse inconnue :
                aucune source publique fiable, à compléter toi-même plutôt que de
                l'inventer.</div>` : ''}`}
            </div>
            <button class="btn btn-primary" data-rattacher="${h(p.cle)}">
              ${p.liens ? 'Ajouter les liens' : p.existant ? 'Ajouter le mot' : 'Créer le club'}</button>
          </li>`).join('')}
        </ul>
        <p class="tiny muted">Ces adresses viennent des pages publiques de chaque club, et
          non de Ten'Up — le site de la fédération exige une connexion et n'ouvre aucun
          accès aux applications extérieures.</p>
      </section>`;
    })()}

    ${orphelines.length ? `<section class="carte" id="orphelines">
      <h3>${aRattacher} match(s) sans club</h3>
      <p class="tiny muted">La fédération ne dit pas toujours où l'on a joué :
        « TOURNOI SENIORS » ne nomme personne, et aucune recherche n'y changera rien.
        Mais la date et l'adversaire, eux, font souvent revenir le lieu — touche une
        épreuve pour voir ses matchs. Les rencontres par équipes ne figurent pas ici :
        elles n'ont pas de club à trouver.</p>
      <ul class="orphelines">
        ${orphelines.map(([nom, n]) => `<li class="orpheline ${nom === epreuveOuverte
            ? 'actif' : ''}" data-epreuve="${h(nom)}" role="button" tabindex="0"
            title="Voir ces matchs">
          <span>${h(nom)}</span><b>${n}</b>
        </li>${nom === epreuveOuverte ? rendreMatchsOrphelins(nom) : ''}`).join('')}
      </ul>
    </section>` : ''}`;
}

/* ─── Les matchs d'une épreuve sans club ───────────────────────────────

   Un libellé anonyme ne dit rien, mais « 14 juillet 2019, Théo MARTIN,
   6/4 6/2 » fait revenir le lieu — on se souvient d'un adversaire et d'un
   été bien mieux que d'un intitulé de tournoi. C'est donc au souvenir
   qu'on s'adresse ici, faute de données.

   Le rattachement en bloc n'est offert que si tous les matchs tombent la
   même année. Un « TOURNOI SENIORS » qui traîne sur six saisons s'est
   presque sûrement joué dans plusieurs clubs, et l'attribuer d'un coup
   installerait sept erreurs en un clic — plus difficiles à défaire qu'à
   commettre. Dans ce cas chaque match s'ouvre séparément. */
function rendreMatchsOrphelins(nom) {
  const liste = store.matchs
    .filter(m => !clubDuMatch(m) && (m.tournoi || '(sans nom)').trim() === nom)
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  if (!liste.length) return '';

  const b = bilanMatchs(liste);

  /* Une année, un bloc : c'est la maille à laquelle un tournoi change de
     salle, et celle à laquelle on s'en souvient. */
  const annees = {};
  for (const m of liste) {
    const a = (m.date || '').slice(0, 4) || '?';
    (annees[a] = annees[a] || []).push(m);
  }
  const cles = Object.keys(annees).sort((x, y) => y.localeCompare(x));

  const menu = (nom, annee) => !store.clubs.length ? '' : `<select data-rattacher-a="${h(nom)}"${
      annee ? ` data-annee="${h(annee)}"` : ''}>
      <option value="">— choisir un club —</option>
      ${[...store.clubs].sort((x, y) => x.nom.localeCompare(y.nom, 'fr'))
        .map(c => `<option value="${h(c.id)}">${h(c.nom)}</option>`).join('')}
    </select>`;

  return `<li class="orphelines-detail">
    <p class="tiny muted">${b.v} victoire(s), ${b.d} défaite(s) —
      ${cles.length === 1 ? `tout en ${h(cles[0])}`
        : `réparti sur ${cles.length} années (${h(cles.join(', '))})`}.</p>

    ${cles.map(a => `<div class="rattachement-annee">
      ${cles.length > 1 ? `<div class="rattachement-annee-tete">
        <strong>${h(a)}</strong>
        <span class="tiny muted">${annees[a].length} match(s)</span>
      </div>` : ''}
      <ul class="matchs" style="margin-top:8px">
        ${annees[a].map(m => `<li class="match ${m.issue === 'V' ? 'gagne' : 'perdu'}"
            data-match="${h(m.id)}">
          <div class="match-issue">${m.issue}</div>
          <div class="match-corps">
            <div class="match-tete">
              <strong>${h(m.adversaire || '—')}</strong>${puce(m.echelonAdverse)}
            </div>
            <div class="match-bas">
              <span>${h(dateCourte(m.date))}</span>
              ${m.score ? `<span>${h(m.score)}</span>` : ''}
              ${m.surface ? puce(m.surface) : ''}
              ${direTour(m) ? puce(direTour(m)) : ''}
              ${puceNote(m)}
            </div>
            ${blocNote(m)}
          </div>
        </li>`).join('')}
      </ul>
      ${cles.length > 1 ? `<label class="tri">
        <span>Rattacher ${h(a)} seulement à</span>${menu(nom, a)}</label>` : ''}
    </div>`).join('')}

    ${/* Le rattachement en bloc ne se refuse plus aux épreuves étalées sur
          plusieurs années. Il l'était par prudence — un tournoi peut
          changer de club d'une édition à l'autre — mais celui qui le sait,
          c'est le joueur, et le refus l'obligeait à corriger sept matchs un
          par un pour un tournoi qui n'avait jamais bougé. L'année par année
          est là juste au-dessus pour les cas où il a bougé. */''}
    ${boutonDevine(nom, liste)}
    ${store.clubs.length ? `<label class="tri" style="margin-top:10px">
      <span>${cles.length > 1 ? 'Tout rattacher, toutes années confondues, à'
                              : 'Tout rattacher à'}</span>${menu(nom)}</label>
      <p class="tiny muted">Ce rattachement se pose sur les matchs eux-mêmes, et non sur
        un mot-clé : il ne vaut que pour ceux-là, et se défait match par match.</p>`
      : ''}
  </li>`;
}
export function renderFiche(params) {
  const club = store.clubs.find(c => c.id === params[1]);
  if (!club) return `<div class="vide"><span class="emoji">🤷</span>Ce club n'existe plus.</div>`;

  const matchs = matchsDuClub(club);
  const b = bilanMatchs(matchs);

  const lignes = [
    club.adresse ? ['📍', `<a href="${h(carteMaps(club.adresse))}" target="_blank"
                            rel="noopener noreferrer">${h(club.adresse)}</a>`] : null,
    /* La distance depuis chez soi, quand les deux points sont connus. On
       la dit à vol d'oiseau et l'on renvoie l'itinéraire à qui connaît les
       routes : inventer un temps de trajet à partir d'une distance
       donnerait un chiffre faux avec l'air d'être juste. */
    (() => {
      const chez = store.profil?.domicile?.point;
      const ici = pointDuClub(club);
      const d = distanceKm(chez, ici);
      if (d == null) return null;
      return ['🚗', `${h(direDistance(d))} de chez toi —
        <a href="${h(lienItineraire(chez, ici, adresseDuClub(club)))}" target="_blank"
           rel="noopener noreferrer">voir l'itinéraire ↗</a>`];
    })(),
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

    ${pointDuClub(club) ? `<section class="carte">
      <h3>Où c'est</h3>
      ${/* Un seul club sur la carte, et c'est bien le but : ce qu'on
            cherche ici n'est pas de comparer des clubs entre eux mais de
            savoir où celui-ci se trouve — quelle commune, quelle route,
            et à quelle distance de la maison, que le cadrage garde
            désormais dans le champ. */''}
      ${carteClubs([{ club, matchs, bilan: b }])}
    </section>` : ''}

    ${((club.sources || []).length || urlTenupClub(club)) ? `<section class="carte">
      <h3>Suivre ce club</h3>
      <ul class="comptes">
        ${(club.sources || []).map(s => {
          const p = infoPlateforme(s.plateforme);
          return `<li><a href="${h(s.url)}" target="_blank" rel="noopener noreferrer">
            <span class="gros-emoji">${p.emoji}</span>
            <span class="compte-nom">${h(p.nom)}</span></a></li>`;
        }).join('')}
        ${/* La fiche officielle, déduite de l'identifiant posé par l'import.
              Sans identifiant, aucun lien : on n'invente pas une adresse. */
          urlTenupClub(club) ? `<li>
          <a href="${h(urlTenupClub(club))}" target="_blank" rel="noopener noreferrer">
            <span class="gros-emoji">🎾</span>
            <span class="compte-nom">Ten'Up</span></a></li>` : ''}
      </ul>
    </section>` : ''}

    <section class="carte">
      <h3>Mes matchs ici</h3>
      ${matchs.length ? `
        <p class="tiny muted">${matchs.length} match(s) — ${b.v} victoire(s),
           ${b.d} défaite(s), ${b.ratio}% de réussite.</p>
        ${/* Une tête de chapitre par année. Quatorze matchs à la file, on
              ne sait plus où l'on en est ; l'année est le repère qu'on
              cherche en premier — « la fois où j'ai gagné ici, c'était en
              2019 ou en 2022 ? ». Elle porte son bilan, parce qu'un club
              se juge aussi année par année : trois défaites une saison,
              trois victoires la suivante, ce n'est pas la même chose que
              cinquante pour cent tout du long. */''}
        ${(() => {
          const annees = {};
          for (const m of matchs) {
            const a = (m.date || '').slice(0, 4) || '?';
            (annees[a] = annees[a] || []).push(m);
          }
          return Object.keys(annees).sort((x, y) => y.localeCompare(x)).map(a => {
            const ba = bilanMatchs(annees[a]);
            return `<div class="annee-bloc">
              <div class="annee-tete">
                <h4>${h(a)}</h4>
                <span class="tiny muted">${annees[a].length} match(s) —
                  ${ba.v}V–${ba.d}D</span>
              </div>
              ${/* Sous l'année, l'épreuve. Un club reçoit plusieurs tournois
                    dans la même saison — un open en janvier, un interne au
                    printemps — et leur nom répété sous chaque match faisait
                    une colonne de bruit. Écrit une fois en tête de groupe,
                    il devient le titre du chapitre qu'il ouvre. */''}
              ${(() => {
                const eps = {};
                for (const m of annees[a]) {
                  const e = (m.tournoi || 'Sans épreuve').trim();
                  (eps[e] = eps[e] || []).push(m);
                }
                return Object.keys(eps).map(e => {
                  const be = bilanMatchs(eps[e]);
                  return `<div class="epreuve-bloc">
                    <div class="epreuve-tete">
                      <strong>${h(e)}</strong>
                      <span class="tiny muted">${eps[e].length} match(s) —
                        ${be.v}V–${be.d}D</span>
                    </div>
                    <ul class="matchs">
                      ${eps[e].map(m => `<li class="match ${m.issue === 'V' ? 'gagne' : 'perdu'}"
                                            data-match="${h(m.id)}">
                        <div class="match-issue">${m.issue}</div>
                        <div class="match-corps">
                          <div class="match-tete">
                            <strong>${h(m.adversaire || '—')}</strong>${puce(m.echelonAdverse)}
                          </div>
                          <div class="match-bas">
                            <span>${h(dateCourte(m.date))}</span>
                            ${m.score ? `<span>${h(m.score)}</span>` : ''}
                            ${m.tour ? puce(direTour(m)) : ''}
                            ${puceNote(m)}
                          </div>
                          ${blocNote(m)}
                        </div>
                      </li>`).join('')}
                    </ul>
                  </div>`;
                }).join('');
              })()}
            </div>`;
          }).join('');
        })()}`
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
  brancherNotes(vue);
  brancherCarte(vue, id => { location.hash = `#/clubs/${id}`; });

  vue.querySelector('#tri-club')?.addEventListener('change', e => {
    tri = e.target.value;
    rerendre();
  });

  vue.querySelector('#surface-club')?.addEventListener('change', e => {
    surface = e.target.value;
    rerendre();
  });

  /* Le rattachement en bloc pose `clubId` sur chaque match : c'est le
     rattachement explicite, qui fait foi devant les mots-clés. On ne
     touche donc à aucun autre match, et celui qui se trompe corrige
     depuis la fiche du match. */
  vue.addEventListener('change', e => {
    const sel = e.target.closest('[data-rattacher-a]');
    if (!sel || !sel.value) return;
    const { rattacherA: epreuve, annee } = sel.dataset;
    rattacherEpreuve(epreuve, sel.value, annee);
  });

  // Une épreuve annoncée cliquable doit s'ouvrir au clavier aussi.
  vue.addEventListener('keydown', e => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const o = e.target.closest('[data-epreuve]');
    if (!o) return;
    e.preventDefault();
    o.click();
  });

  vue.addEventListener('click', e => {
    if (e.target.closest('[data-nouveau]')) { clubForm(); return; }

    const oc = e.target.closest('[data-onglet-club]');
    if (oc) { ongletClubs = oc.dataset.ongletClub; rerendre(); return; }

    const dt = e.target.closest('[data-detail]');
    if (dt) { fenetreChiffre(dt.dataset.detail); return; }

    const sg = e.target.closest('[data-suggere]');
    if (sg) { rattacherEpreuve(sg.dataset.suggere, sg.dataset.clubSuggere); return; }

    const tv = e.target.closest('[data-tri-vers]');
    if (tv) { tri = tri === tv.dataset.triVers ? 'matchs' : tv.dataset.triVers; rerendre(); return; }

    const r = e.target.closest('[data-rattacher]');
    if (r) {
      const orphelines = epreuvesOrphelines()
        .filter(([nom]) => !estParEquipes({ tournoi: nom }));
      const p = propositions(orphelines).find(x => x.cle === r.dataset.rattacher);
      if (!p) { rerendre(); return; }

      if (p.liens) {
        modifierClub(p.existant.id, {
          sources: [...(p.existant.sources || []), ...p.liens],
        });
        toast(`${p.liens.length} lien(s) ajouté(s) à ${p.existant.nom}.`);
      } else if (p.existant) {
        modifierClub(p.existant.id, {
          motsCles: [...(p.existant.motsCles || []), ...p.mots],
        });
        toast(`${p.mots.map(m => `« ${m} »`).join(', ')} ajouté à ${p.existant.nom}.`);
      } else {
        /* Les surfaces viennent avec le club quand on les connaît. Elles
           étaient vidées d'office, par prudence — mais un club créé sans
           surface n'apparaît dans aucun filtre, et personne ne va les
           ressaisir à la main. */
        ajouterClub({ ...p.connu, surfaces: [...(p.connu.surfaces || [])],
                      motsCles: [...p.connu.motsCles],
                      sources: [...(p.connu.sources || [])] });
        toast(`${p.connu.nom} créé — ${p.matchs} match(s) rattaché(s).`);
      }
      /* Pas de `rerendre()` : l'écriture émet « data-changed », qui
         redessine déjà l'écran. Le faire deux fois ferait clignoter la
         page pour rien. */
      return;
    }

    const mt = e.target.closest('[data-match]');
    if (mt) {
      const match = store.matchs.find(x => x.id === mt.dataset.match);
      if (match) matchForm(match);
      return;
    }

    const o = e.target.closest('[data-epreuve]');
    if (o) {
      // Retoucher l'épreuve ouverte la referme.
      epreuveOuverte = epreuveOuverte === o.dataset.epreuve ? null : o.dataset.epreuve;
      rerendre();
      return;
    }

    const l = e.target.closest('[data-club]');
    if (l) location.hash = `#/clubs/${l.dataset.club}`;
  });
}

export function wireFiche(vue, rerendre) {
  brancherNotes(vue);
  /* La carte se déplace et se pince ici comme ailleurs. Toucher le disque
     ouvre sa bulle ; « Voir la fiche » y renvoie à la page où l'on est
     déjà, ce qui ne coûte rien et évite un cas particulier de plus. */
  brancherCarte(vue, id => { location.hash = `#/clubs/${id}`; });

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
