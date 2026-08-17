/* Les données, et où elles vivent.

   Tout tient dans le navigateur, sans compte ni serveur. Ce choix a une
   raison précise : ce carnet se consulte entre deux jeux, sur un court où
   le réseau ne passe pas. Une application qui attend une réponse du
   serveur au changement de côté ne sert à rien.

   La contrepartie est réelle et il ne faut pas la cacher : ce qui est
   saisi sur l'ordinateur n'est pas sur le téléphone. D'où l'export et
   l'import, qui ne sont pas un gadget de sauvegarde mais le seul pont
   entre les deux appareils. */

import { uid, dansLesDouzeMois } from './util.js';
import { BAREME_DEFAUT } from './classement.js';

const CLE = 'tennis-donnees';
const VERSION = 1;

// =====================================================================
//  Vocabulaire du coaching
// =====================================================================
/* Ces listes sont le squelette du carnet de conseils. Elles viennent des
   situations réellement rencontrées, pas d'un manuel : c'est ce qui rend
   un conseil retrouvable en trente secondes au changement de côté. */

export const PROFILS = [
  { cle: 'jeune',      emoji: '🧒', nom: 'Très jeune joueur' },
  { cle: 'decalage',   emoji: '🎾', nom: 'Décalage coup droit' },
  { cle: 'chipeur',    emoji: '🪶', nom: 'Chipeur / slice permanent' },
  { cle: 'gaucher',    emoji: '🫲', nom: 'Gaucher' },
  { cle: 'defenseur',  emoji: '🧱', nom: 'Défenseur / relanceur' },
  { cle: 'attaquant',  emoji: '⚡', nom: 'Attaquant / serveur-volleyeur' },
  { cle: 'lifteur',    emoji: '🌀', nom: 'Gros lifteur' },
  { cle: 'irregulier', emoji: '🎲', nom: 'Irrégulier / fautes gratuites' },
  { cle: 'physique',   emoji: '💪', nom: 'Très physique' },
  { cle: 'ancien',     emoji: '🎩', nom: 'Joueur d\'expérience / vicieux' },
];

export const MOMENTS = [
  { cle: 'avant',      emoji: '🚪', nom: 'Avant le match' },
  { cle: 'entre',      emoji: '⏸️', nom: 'Entre les points' },
  { cle: 'service',    emoji: '🎯', nom: 'Juste avant de servir' },
  { cle: 'retour',     emoji: '🛡️', nom: 'Juste avant de retourner' },
  { cle: 'changement', emoji: '🪑', nom: 'Au changement de côté' },
  { cle: 'mene',       emoji: '📉', nom: 'Quand je suis mené' },
  { cle: 'devant',     emoji: '📈', nom: 'Quand je mène' },
  { cle: 'apres',      emoji: '🧊', nom: 'Après le match' },
];

export const CATEGORIES = [
  { cle: 'tactique',  emoji: '♟️', nom: 'Tactique' },
  { cle: 'mental',    emoji: '🧠', nom: 'Mental' },
  { cle: 'technique', emoji: '🔧', nom: 'Technique' },
  { cle: 'physique',  emoji: '🏃', nom: 'Physique' },
  { cle: 'schema',    emoji: '🗺️', nom: 'Schéma de jeu' },
];

export const PLATEFORMES = [
  { cle: 'facebook',  emoji: '📘', nom: 'Facebook' },
  { cle: 'instagram', emoji: '📸', nom: 'Instagram' },
  { cle: 'youtube',   emoji: '▶️', nom: 'YouTube' },
  { cle: 'tiktok',    emoji: '🎵', nom: 'TikTok' },
  { cle: 'site',      emoji: '🌐', nom: 'Site web' },
];

/* Le vocabulaire de la fédération, et non le vocabulaire courant : c'est
   celui qu'on lit sur les fiches de tournoi, donc celui qui permettra de
   recouper. « Dur » n'y existe pas, on y parle résine et béton poreux. */
export const SURFACES = [
  'Terre battue traditionnelle', 'Terre artificielle', 'Résine',
  'Béton poreux', 'Moquette', 'Green-set', 'Gazon synthétique', 'Autre',
];

export const nomProfil  = c => PROFILS.find(p => p.cle === c)?.nom || c;
export const nomMoment  = c => MOMENTS.find(m => m.cle === c)?.nom || c;
export const nomCategorie = c => CATEGORIES.find(x => x.cle === c)?.nom || c;

// =====================================================================
//  L'état
// =====================================================================
function vide() {
  return {
    version: VERSION,
    /* Le bilan ne se saisit plus : il se calcule depuis l'historique.
       `bilanOfficiel` ne sert qu'à comparer avec le chiffre de Ten'Up —
       un écart signale des matchs manquants, pas une erreur de calcul. */
    profil: {
      prenom: '', sexe: 'h', echelon: '15', gaucher: false,
      bilanOfficiel: null, bonusVictoires: 0, bonusPoints: 0,
    },
    bareme: { ...BAREME_DEFAUT },
    matchs: [],
    conseils: [],
    clubs: [],
    sources: [],
    raquettes: [],
    cordages: [],
    chaussures: [],
    courses: [],
    /* Les adversaires ne sont pas stockés : ils se déduisent des matchs.
       Seul ce qu'on ajoute à leur sujet — leur façon de jouer — vit ici. */
    joueurs: [],
  };
}

export let store = vide();

/** Relit le disque. Un stockage illisible ne doit jamais empêcher de
 *  démarrer : on repart d'un carnet vierge en le disant. */
export function charger() {
  try {
    const brut = localStorage.getItem(CLE);
    if (!brut) { store = vide(); return { ok: true, neuf: true }; }
    const lu = JSON.parse(brut);
    store = { ...vide(), ...lu, profil: { ...vide().profil, ...(lu.profil || {}) } };
    store.bareme = { ...BAREME_DEFAUT, ...(lu.bareme || {}) };
    return { ok: true, neuf: false };
  } catch (err) {
    store = vide();
    return { ok: false, erreur: err.message };
  }
}

/** Écrit et prévient l'application. Le quota du navigateur peut être
 *  atteint (photos d'un autre site, mode privé) : on le remonte plutôt
 *  que de perdre la saisie en silence. */
export function sauver() {
  try {
    localStorage.setItem(CLE, JSON.stringify(store));
    document.dispatchEvent(new CustomEvent('data-changed'));
    return { ok: true };
  } catch (err) {
    return { ok: false, erreur: err.message };
  }
}

/** Modifie puis enregistre en un geste. */
export function maj(fn) {
  fn(store);
  return sauver();
}

// =====================================================================
//  Écritures
// =====================================================================
export const ajouterMatch = m => maj(s => s.matchs.unshift({ id: uid(), ...m }));
export const modifierMatch = (id, m) => maj(s => {
  const i = s.matchs.findIndex(x => x.id === id);
  if (i >= 0) s.matchs[i] = { ...s.matchs[i], ...m };
});
export const supprimerMatch = id => maj(s => { s.matchs = s.matchs.filter(m => m.id !== id); });

export const ajouterConseil = c => maj(s => s.conseils.unshift({ id: uid(), ...c }));
export const modifierConseil = (id, c) => maj(s => {
  const i = s.conseils.findIndex(x => x.id === id);
  if (i >= 0) s.conseils[i] = { ...s.conseils[i], ...c };
});
export const supprimerConseil = id => maj(s => { s.conseils = s.conseils.filter(c => c.id !== id); });
export const basculerFavori = id => maj(s => {
  const c = s.conseils.find(x => x.id === id);
  if (c) c.favori = !c.favori;
});

export const ajouterSource = x => maj(s => s.sources.push({ id: uid(), ...x }));
export const supprimerSource = id => maj(s => { s.sources = s.sources.filter(x => x.id !== id); });

export const ajouterClub = c => maj(s => s.clubs.push({ id: uid(), sources: [], ...c }));
export const modifierClub = (id, c) => maj(s => {
  const i = s.clubs.findIndex(x => x.id === id);
  if (i >= 0) s.clubs[i] = { ...s.clubs[i], ...c };
});
export const supprimerClub = id => maj(s => {
  s.clubs = s.clubs.filter(c => c.id !== id);
  // Un match rattaché à la main à ce club redevient orphelin plutôt que
  // de pointer dans le vide.
  s.matchs.forEach(m => { if (m.clubId === id) delete m.clubId; });
});

// =====================================================================
//  Matériel et intendance
// =====================================================================
/* Quatre listes de même nature, donc un seul jeu de fonctions. Les écrire
   à la main quatre fois n'aurait rien apporté qu'une occasion de se
   tromper à la quatrième. */
const listeDe = (cle) => ({
  ajouter: x => maj(s => s[cle].unshift({ id: uid(), ...x })),
  modifier: (id, x) => maj(s => {
    const i = s[cle].findIndex(y => y.id === id);
    if (i >= 0) s[cle][i] = { ...s[cle][i], ...x };
  }),
  supprimer: id => maj(s => { s[cle] = s[cle].filter(y => y.id !== id); }),
});

export const raquettes  = listeDe('raquettes');
export const cordages   = listeDe('cordages');
export const chaussures = listeDe('chaussures');
export const courses    = listeDe('courses');

/** Coche ou décoche un article de la liste de courses. Un article coché
 *  garde sa date d'achat : c'est ce qui permettra de savoir dans six mois
 *  qu'on rachète des balles toutes les huit semaines. */
export const basculerAchat = id => maj(s => {
  const a = s.courses.find(x => x.id === id);
  if (!a) return;
  a.achete = !a.achete;
  a.dateAchat = a.achete ? new Date().toISOString().slice(0, 10) : '';
});

/** Vide les articles cochés qui ne sont pas récurrents. Les récurrents
 *  restent : on rachètera des balles, ce serait absurde de les ressaisir. */
export const rangerCourses = () => maj(s => {
  s.courses = s.courses.filter(a => !a.achete || a.recurrent);
  s.courses.forEach(a => { if (a.achete && a.recurrent) { a.achete = false; } });
});

export const raquetteDe = id => store.raquettes.find(r => r.id === id) || null;

/** Enregistre ce qu'on a retenu d'un adversaire. La fiche est créée à la
 *  première note : tant qu'on n'a rien à dire, il n'y a rien à stocker. */
export const noterJoueur = (nom, donnees) => maj(s => {
  const cle = (n) => (n || '').trim().toUpperCase();
  const i = s.joueurs.findIndex(j => cle(j.nom) === cle(nom));
  if (i >= 0) s.joueurs[i] = { ...s.joueurs[i], ...donnees, nom };
  else s.joueurs.push({ id: uid(), nom, ...donnees });
});

// =====================================================================
//  Rattacher un match à un club
// =====================================================================
/* Ten'Up ne nomme le club que dans le libellé de l'épreuve, et encore :
   « TOURNOI SENIORS » ne dit rien, et un championnat par équipes se joue
   tantôt chez soi tantôt ailleurs sans que ce soit écrit nulle part.
   D'où deux niveaux : le rattachement explicite, qui fait foi, et à
   défaut la reconnaissance par mots-clés, que l'on peut corriger. */

const sansAccent = s => (s || '').toUpperCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '');

/** Où commence ce mot dans le texte, en mot entier — ou -1.
 *  Le mot entier n'est pas un luxe : sans lui « VEULES » attraperait
 *  « VEULETTES », qui est un autre club à quinze kilomètres. */
function positionMot(texte, mot) {
  const m = sansAccent(mot).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const r = new RegExp(`(^|[^A-Z])(${m})([^A-Z]|$)`);
  const t = sansAccent(texte);
  const trouve = r.exec(t);
  return trouve ? trouve.index + trouve[1].length : -1;
}

/** Où s'est joué ce match.
 *
 *  Le rattachement explicite fait foi — c'est celui que l'import pose
 *  quand la fédération a gardé le lien vers le tournoi, et celui qu'on
 *  choisit à la main.
 *
 *  Sinon on lit le libellé de l'épreuve, et deux clubs peuvent s'y
 *  reconnaître : « TOURNOI TPCV ACE CREDIT DIEPPE » contient à la fois le
 *  sigle du club organisateur et le nom d'une ville où joue un autre club.
 *  On tranche par la position : dans un nom d'épreuve, l'organisateur est
 *  cité avant le lieu. */
export function clubDuMatch(m) {
  if (!m) return null;
  if (m.clubId) return store.clubs.find(c => c.id === m.clubId) || null;

  let gagnant = null, meilleure = Infinity;
  for (const c of store.clubs) {
    for (const mot of (c.motsCles || [])) {
      const i = positionMot(m.tournoi, mot);
      if (i >= 0 && i < meilleure) { meilleure = i; gagnant = c; }
    }
  }
  return gagnant;
}

export const matchsDuClub = club =>
  store.matchs.filter(m => clubDuMatch(m)?.id === club.id)
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));

/** La surface d'un match : saisie si on la connaît, déduite du club sinon.
 *  Quand le club a plusieurs surfaces, on ne tranche pas — on le dit. */
export function surfaceDuMatch(m) {
  if (m.surface) return { surface: m.surface, origine: 'saisie' };
  const club = clubDuMatch(m);
  const s = club?.surfaces || [];
  if (s.length === 1) return { surface: s[0], origine: 'club' };
  if (s.length > 1) return { surface: '', origine: 'ambigu', choix: s };
  return { surface: '', origine: 'inconnue' };
}

/** Les épreuves qu'aucun club ne réclame : de quoi compléter les
 *  mots-clés, ou rattacher à la main. */
export function epreuvesOrphelines() {
  const n = {};
  for (const m of store.matchs) {
    if (clubDuMatch(m)) continue;
    const t = (m.tournoi || '(sans nom)').trim();
    n[t] = (n[t] || 0) + 1;
  }
  return Object.entries(n).sort((a, b) => b[1] - a[1]);
}

// =====================================================================
//  Lectures calculées
// =====================================================================
/** Les matchs de la fenêtre de calcul du classement. */
export function matchsDouzeMois() {
  return store.matchs.filter(m => dansLesDouzeMois(m.date));
}

/** Les réglages du calcul, tels que `classement.js` les attend.
 *
 *  Le bonus de victoires est délibérément absent d'ici : il ne vaut que
 *  pour l'échelon auquel il a été relevé. La fédération en accorde un
 *  différent à chaque échelon visé — sur un cas mesuré, +2 à 15, +1 à 5/6
 *  et +0 à 4/6 — et sa formule n'est pas publiée. L'appliquer partout
 *  ferait annoncer des échelons déjà acquis qui ne le sont pas. C'est donc
 *  à l'appelant de décider, échelon par échelon. */
export function reglagesCalcul() {
  return {
    matchs: store.matchs,
    sexe: store.profil.sexe,
    bareme: store.bareme,
    bonusPoints: Number(store.profil.bonusPoints) || 0,
  };
}

/** Le bonus de victoires ne s'applique qu'à l'échelon où il a été lu.
 *  Ailleurs on retient zéro : mieux vaut annoncer un objectif un peu plus
 *  loin qu'il ne l'est que l'inverse. */
export function bonusVictoiresPour(cible) {
  return cible === store.profil.echelon ? (Number(store.profil.bonusVictoires) || 0) : 0;
}

/** Statistiques d'ensemble, telles qu'on aime les lire après coup. */
export function bilanMatchs(liste = store.matchs) {
  const v = liste.filter(m => m.issue === 'V').length;
  const d = liste.filter(m => m.issue === 'D').length;
  const total = v + d;
  return { v, d, total, ratio: total ? Math.round((v / total) * 100) : 0 };
}

// =====================================================================
//  Le pont entre deux appareils
// =====================================================================
export function exporterJSON() {
  return JSON.stringify({ ...store, exporteLe: new Date().toISOString() }, null, 2);
}

/** Fusionne ou remplace. La fusion est le défaut : on rapatrie le
 *  téléphone sur l'ordinateur sans écraser ce qu'on vient d'y saisir.
 *  L'identité fait foi ; à défaut, un match est reconnu par sa date et
 *  son adversaire, un conseil par son titre. */
export function importerJSON(texte, mode = 'fusion') {
  let lu;
  try { lu = JSON.parse(texte); }
  catch { return { ok: false, erreur: 'Ce fichier n\'est pas un export valide (JSON illisible).' }; }

  if (!lu || typeof lu !== 'object' || (!lu.matchs && !lu.conseils)) {
    return { ok: false, erreur: 'Ce fichier ne ressemble pas à un export de ce carnet.' };
  }

  if (mode === 'remplacement') {
    store = { ...vide(), ...lu };
    store.bareme = { ...BAREME_DEFAUT, ...(lu.bareme || {}) };
    const r = sauver();
    return r.ok
      ? { ok: true, matchs: store.matchs.length, conseils: store.conseils.length, mode }
      : { ok: false, erreur: r.erreur };
  }

  let nm = 0, nc = 0, ns = 0;
  const cleMatch = m => m.id || `${m.date}|${(m.adversaire || '').toLowerCase()}`;
  const cleConseil = c => c.id || (c.titre || '').toLowerCase();

  const vusM = new Set(store.matchs.map(cleMatch));
  for (const m of (lu.matchs || [])) {
    if (vusM.has(cleMatch(m))) continue;
    store.matchs.push({ ...m, id: m.id || uid() });
    vusM.add(cleMatch(m));
    nm++;
  }
  const vusC = new Set(store.conseils.map(cleConseil));
  for (const c of (lu.conseils || [])) {
    if (vusC.has(cleConseil(c))) continue;
    store.conseils.push({ ...c, id: c.id || uid() });
    vusC.add(cleConseil(c));
    nc++;
  }
  const vusS = new Set(store.sources.map(x => (x.url || '').toLowerCase()));
  for (const x of (lu.sources || [])) {
    if (vusS.has((x.url || '').toLowerCase())) continue;
    store.sources.push({ ...x, id: x.id || uid() });
    vusS.add((x.url || '').toLowerCase());
    ns++;
  }

  let nc2 = 0;
  const vusCl = new Set(store.clubs.map(c => (c.nom || '').toLowerCase()));
  for (const c of (lu.clubs || [])) {
    if (vusCl.has((c.nom || '').toLowerCase())) continue;
    store.clubs.push({ sources: [], ...c, id: c.id || uid() });
    vusCl.add((c.nom || '').toLowerCase());
    nc2++;
  }

  /* Le matériel se fusionne sur l'identité seule : deux raquettes du même
     modèle sont deux raquettes, et deux cordages du même jour peuvent être
     deux cordages. Rien ici ne se déduplique sur le contenu. */
  let nMat = 0;
  for (const cle of ['raquettes', 'cordages', 'chaussures', 'courses']) {
    const vus = new Set(store[cle].map(x => x.id));
    for (const x of (lu[cle] || [])) {
      if (x.id && vus.has(x.id)) continue;
      store[cle].push({ ...x, id: x.id || uid() });
      if (x.id) vus.add(x.id);
      nMat++;
    }
  }

  store.matchs.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const r = sauver();
  return r.ok ? { ok: true, matchs: nm, conseils: nc, sources: ns, clubs: nc2, materiel: nMat, mode }
              : { ok: false, erreur: r.erreur };
}

export function toutEffacer() {
  store = vide();
  return sauver();
}
