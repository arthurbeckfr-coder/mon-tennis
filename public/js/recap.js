/* Le récapitulatif d'un tournoi, et celui d'une saison.

   ─── Ce qu'on cherche en ouvrant ceci ────────────────────────────────

   La liste des matchs répond à « qu'ai-je joué ». Elle ne répond pas à
   « comment s'est passé cet open », qui est pourtant la question qu'on se
   pose en rentrant — et celle qu'on repose deux ans plus tard, quand le
   tournoi revient et qu'on ne se souvient plus que d'une chose : il
   faisait chaud.

   D'où deux fiches, bâties sur les mêmes chiffres. Elles ne calculent
   rien de neuf : tout est déjà dans les matchs. Elles le rassemblent, ce
   qui est un autre travail — un total de quatre heures trente sur trois
   jours n'existe nulle part avant qu'on l'écrive.

   ─── Ce qu'on n'y met pas ────────────────────────────────────────────

   Une moyenne sur deux matchs n'est pas une moyenne, un taux sur trois
   n'est pas un taux. Chaque indicateur dit donc sur combien il porte, ou
   ne s'affiche pas. Et rien ne s'invente : la durée n'est notée que
   lorsqu'on y pense, alors le temps passé sur le court se dit « sur les
   n matchs chronométrés » plutôt que de faire comme si l'on savait.
*/

import { store, bilanMatchs, surfaceDuMatch, estParEquipes, clubDuMatch,
         direTour, nomTour, TOURS } from './store.js';
import { pointsVictoire, rang } from './classement.js';
import { distanceKm, direDistance } from './geocodage.js';
import { photosDe } from './photos.js';

/* ─── Des mots pour des nombres ────────────────────────────────────── */

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet',
              'août', 'septembre', 'octobre', 'novembre', 'décembre'];

const jourDe = iso => Number((iso || '').slice(8, 10));
const moisDe = iso => Number((iso || '').slice(5, 7)) - 1;
const anDe = iso => (iso || '').slice(0, 4);

/** « du 12 au 19 juillet 2024 », « le 3 mai 2025 » — et l'on ne répète le
 *  mois que lorsqu'il change, comme on l'écrirait à la main. */
export function direPeriode(dates) {
  const tri = [...dates].filter(Boolean).sort();
  if (!tri.length) return '';
  const [a, b] = [tri[0], tri[tri.length - 1]];
  if (a === b) return `le ${jourDe(a)} ${MOIS[moisDe(a)]} ${anDe(a)}`;
  if (moisDe(a) === moisDe(b) && anDe(a) === anDe(b)) {
    return `du ${jourDe(a)} au ${jourDe(b)} ${MOIS[moisDe(b)]} ${anDe(b)}`;
  }
  if (anDe(a) === anDe(b)) {
    return `du ${jourDe(a)} ${MOIS[moisDe(a)]} au ${jourDe(b)} ${MOIS[moisDe(b)]} ${anDe(b)}`;
  }
  return `du ${jourDe(a)} ${MOIS[moisDe(a)]} ${anDe(a)} au ${jourDe(b)} ${MOIS[moisDe(b)]} ${anDe(b)}`;
}

/** « 4 h 30 », « 55 min ». Zéro minute n'est pas une durée : c'est une
 *  durée non notée, et l'appelant s'en occupe. */
export const direTemps = minutes => {
  const n = Math.round(minutes || 0);
  if (!n) return '';
  const hh = Math.floor(n / 60), mm = n % 60;
  return hh ? `${hh} h${mm ? ' ' + String(mm).padStart(2, '0') : ''}` : `${mm} min`;
};

/* ─── Les chiffres communs ─────────────────────────────────────────── */

/** Ce qu'un paquet de matchs a de commun à dire, tournoi comme saison. */
function socle(liste) {
  const bilan = bilanMatchs(liste);
  const dates = [...new Set(liste.map(m => m.date).filter(Boolean))].sort();

  const chronos = liste.filter(m => Number(m.duree) > 0);
  const minutes = chronos.reduce((t, m) => t + Number(m.duree), 0);

  /* Les points, comptés à l'échelon d'aujourd'hui : c'est la seule façon
     de les rendre comparables entre eux. Une victoire de 2019 valait
     autre chose à l'époque — mais l'époque, elle, ne reviendra pas. */
  const points = liste.reduce((t, m) => t + (m.issue === 'V' && !m.wo
    ? pointsVictoire(store.profil.echelon, m.echelonAdverse, store.bareme) : 0), 0);

  /* Le meilleur scalp : la victoire contre le mieux classé. À égalité, la
     plus récente — c'est celle dont on se souvient. */
  const scalp = liste
    .filter(m => m.issue === 'V' && !m.wo && m.echelonAdverse)
    .sort((a, b) => rang(b.echelonAdverse) - rang(a.echelonAdverse)
      || (b.date || '').localeCompare(a.date || ''))[0] || null;

  const gains = liste.reduce((t, m) => t + (Number(m.gainMontant) || 0), 0);
  const lots = liste.filter(m => m.gainLot).map(m => m.gainLot);

  const surfaces = {};
  for (const m of liste) {
    const s = surfaceDuMatch(m).surface;
    if (s) surfaces[s] = (surfaces[s] || 0) + 1;
  }

  return {
    liste, bilan, dates, jours: dates.length,
    chronos: chronos.length, minutes,
    points, scalp, gains, lots, surfaces,
    photos: liste.flatMap(m => photosDe(m)),
  };
}

/** Les kilomètres d'un déplacement, aller-retour, une fois par jour joué.
 *  Rien si l'on ne sait pas d'où l'on part ou où l'on va : une distance
 *  inventée passerait pour une mesure. */
function route(club, jours) {
  const chez = store.profil?.domicile?.point;
  const la = club?.point;
  const d = distanceKm(chez, la);
  if (d == null) return null;
  return { km: d * 2 * jours, unAller: d, jours };
}

/* ─── Le tournoi ───────────────────────────────────────────────────── */

/** La clé d'une édition : « OPEN DE PUYS §2024 ». Le même open revient
 *  chaque année, et le gagner en 2023 ne dit rien de 2024. */
export const cleEdition = m =>
  `${(m.tournoi || '').trim()} §${(m.date || '').slice(0, 4) || '?'}`;

/** Toutes les éditions jouées, de la plus récente à la plus ancienne. */
export function editions(matchs = store.matchs) {
  const par = new Map();
  for (const m of matchs) {
    const nom = (m.tournoi || '').trim();
    if (!nom) continue;
    const cle = cleEdition(m);
    if (!par.has(cle)) {
      par.set(cle, { cle, nom, an: (m.date || '').slice(0, 4) || '?', matchs: [] });
    }
    par.get(cle).matchs.push(m);
  }
  return [...par.values()]
    .map(e => ({ ...e, derniere: e.matchs.map(m => m.date || '').sort().pop() || '' }))
    .sort((a, b) => (b.derniere || '').localeCompare(a.derniere || ''));
}

/** Comment cela s'est fini.
 *
 *  Le tour n'est pas toujours saisi, et l'on ne suppose rien à sa place :
 *  sans lui, on dit le bilan et l'on s'arrête. Avec lui, la dernière
 *  défaite dit où l'on est sorti, et l'absence de défaite dit qu'on est
 *  allé au bout — c'est la même règle que pour les titres.
 */
function issueDuTournoi(liste) {
  const parEquipes = liste.some(estParEquipes);
  if (parEquipes) return { texte: 'Championnat par équipes', emoji: '🛡️' };

  const defaites = liste.filter(m => m.issue === 'D');
  const finaleGagnee = liste.some(m => m.issue === 'V' && m.tour === 'finale');

  if (finaleGagnee) return { texte: 'Vainqueur', emoji: '🏆' };
  if (!defaites.length && liste.length) return { texte: 'Aucune défaite', emoji: '🏆' };

  const derniere = defaites
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''))[0];
  if (derniere?.tour === 'finale') return { texte: 'Finaliste', emoji: '🥈' };
  if (derniere?.tour) return { texte: `Sorti en ${nomTour(derniere.tour).toLowerCase()}`, emoji: '' };
  return { texte: '', emoji: '' };
}

/** Le parcours, tour par tour, du premier au dernier match joué. */
const parcours = liste => [...liste]
  .sort((a, b) => (a.date || '').localeCompare(b.date || '')
    || (TOURS.findIndex(t => t.cle === b.tour) - TOURS.findIndex(t => t.cle === a.tour)));

export function recapEdition(cle, matchs = store.matchs) {
  const liste = matchs.filter(m => cleEdition(m) === cle);
  if (!liste.length) return null;

  const s = socle(liste);
  const club = liste.map(clubDuMatch).find(Boolean) || null;

  return {
    ...s,
    cle,
    nom: cle.split(' §')[0],
    an: cle.split(' §')[1] || '',
    club,
    route: route(club, s.jours),
    issue: issueDuTournoi(liste),
    parcours: parcours(liste),
    /* Dans l'ordre où on les a joués, et non celui du carnet : un parcours
       se raconte du premier tour à la finale. */
    adversaires: [...new Set(parcours(liste).map(m => (m.adversaire || '').trim()).filter(Boolean))],
  };
}

/* ─── La saison ────────────────────────────────────────────────────── */

/** La plus longue série de victoires d'affilée, dans l'ordre des dates.
 *  C'est le seul chiffre d'ici qui ne se déduit pas d'un total : il
 *  dépend de l'ordre, et l'ordre est ce qu'une moyenne efface. */
function plusLongueSerie(liste) {
  const ordre = [...liste].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  let meilleure = 0, courante = 0, fin = null, finMeilleure = null;
  for (const m of ordre) {
    if (m.issue === 'V') {
      courante++;
      fin = m;
      if (courante > meilleure) { meilleure = courante; finMeilleure = fin; }
    } else courante = 0;
  }
  return { n: meilleure, dernier: finMeilleure };
}

export function recapSaison(annee, matchs = store.matchs, saisonDe) {
  const liste = matchs.filter(m => saisonDe(m.date) === Number(annee));
  if (!liste.length) return null;

  const s = socle(liste);
  const tournois = editions(liste.filter(m => !estParEquipes(m)));
  const titres = tournois.filter(e => e.matchs.every(m => m.issue === 'V'));
  const finales = tournois.filter(e =>
    e.matchs.some(m => m.tour === 'finale' && m.issue === 'D'));

  const clubs = [...new Set(liste.map(m => clubDuMatch(m)?.id).filter(Boolean))];
  const parMois = {};
  for (const m of liste) {
    const c = (m.date || '').slice(0, 7);
    if (c) parMois[c] = (parMois[c] || 0) + 1;
  }
  const moisFort = Object.keys(parMois).sort((a, b) => parMois[b] - parMois[a])[0] || '';

  /* Les kilomètres de la saison : club par club, une fois par jour joué
     là-bas. Sans domicile ni club situé, on ne dit rien. */
  const parClub = {};
  for (const m of liste) {
    const c = clubDuMatch(m);
    if (!c) continue;
    (parClub[c.id] = parClub[c.id] || { club: c, dates: new Set() }).dates.add(m.date);
  }
  let km = 0, situes = 0;
  for (const x of Object.values(parClub)) {
    const r = route(x.club, x.dates.size);
    if (r) { km += r.km; situes++; }
  }

  return {
    ...s,
    annee: Number(annee),
    libelle: `${annee}-${String(Number(annee) + 1).slice(2)}`,
    tournois, titres, finales,
    equipes: liste.filter(estParEquipes).length,
    adversaires: [...new Set(liste.map(m => (m.adversaire || '').trim()).filter(Boolean))],
    clubs: clubs.length,
    km: situes ? km : null,
    moisFort: moisFort ? { libelle: `${MOIS[Number(moisFort.slice(5, 7)) - 1]} ${moisFort.slice(0, 4)}`,
                           n: parMois[moisFort] } : null,
    serie: plusLongueSerie(liste),
    exploits: liste.filter(m => m.issue === 'V'
      && rang(m.echelonAdverse) > rang(store.profil.echelon)).length,
  };
}

/* ─── De quoi les afficher ─────────────────────────────────────────── */

/** Une ligne de chiffre, ou rien du tout : un indicateur vide n'est pas
 *  un indicateur à zéro, et « 0 h sur le court » ferait croire à un
 *  défaut plutôt qu'à une durée jamais notée. */
export const chiffre = (valeur, libelle, titre = '') =>
  valeur === null || valeur === undefined || valeur === '' ? ''
    : `<div class="chiffre"${titre ? ` title="${titre}"` : ''}><b>${valeur}</b>
       <span>${libelle}</span></div>`;

export { direDistance };
