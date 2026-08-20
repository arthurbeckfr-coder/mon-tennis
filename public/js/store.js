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
/* Les surfaces, dans les termes de la fédération. Ce sont ceux que Ten'Up
   affiche sur la fiche d'installation de chaque club : les reprendre mot
   pour mot évite d'avoir à traduire — et une traduction, ici, serait une
   invention. « Enrobé poreux » et « Revêtement P.V.C. ou P.U. » sont
   arrivés par là, relevés sur des courts où l'on a joué. */
export const SURFACES = [
  'Terre battue traditionnelle', 'Terre artificielle', 'Résine',
  'Béton poreux', 'Enrobé poreux', 'Moquette', 'Green-set',
  'Gazon synthétique', 'Revêtement P.V.C. ou P.U.', 'Autre',
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
    /* Les suppressions, datées : voir le bandeau sur la synchronisation. */
    supprimes: [],
    /* À quel compte ce carnet appartient. Vide tant qu'on ne s'est
       jamais connecté — un carnet peut vivre toute sa vie sans compte.

       Il ne sert qu'à une chose, et elle est grave : reconnaître qu'on
       se connecte à un autre compte que celui dont ces données sont
       issues. Sans ce témoin, la synchronisation faisait ce pour quoi
       elle est faite — verser le carnet local dans le compte connecté —
       et versait donc les matchs de l'un dans le compte de l'autre. */
    proprietaire: null,
    profilModifieLe: null,
    baremeModifieLe: null,
    /* Rien de calculable ne se saisit : le bilan, les victoires
       comptabilisées et les points de bonus se déduisent de l'historique.
       Ils bougent à chaque match — les recopier à la main, c'était
       entretenir un chiffre faux entre deux mises à jour. */
    profil: {
      prenom: '', nom: '', sexe: 'h', echelon: '15', gaucher: false,
      /* L'identité et les coordonnées ne servent à aucun calcul : elles
         servent à retrouver son numéro de licence au moment de s'inscrire
         à un tournoi, debout au club, sans fouiller ses mails. C'est la
         seule raison de leur présence, et elle suffit. */
      licence: '', telephone: '', mail: '', clubPrincipal: '', naissance: '',
      /* Deux prix qu'on ne peut pas deviner, et qui ne servent qu'à
         estimer : le kilomètre, et la tournée d'après-match. Celle-ci a
         un prix connu — deux canettes, quatre euros — et part donc
         remplie.

         `tourneeReglee` retient qu'on a touché au champ, et il part à
         faux : les valeurs par défaut se posent sous le profil chargé,
         si bien qu'un témoin vrai par défaut prétendrait, dans les
         carnets d'avant, qu'un choix a été fait alors que le champ n'y a
         jamais existé. Le vidage, lui, le passe à vrai — et il tient. */
      coutKm: null, coutVictoire: 4, tourneeReglee: false,
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
    /* Ce que le tennis coûte. Rien ne s'en déduit : une inscription de
       tournoi n'est écrite nulle part dans un palmarès, et le carnet ne
       l'inventera pas. */
    depenses: [],
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

/* ─── Ce qu'il faut pour que deux appareils disent la même chose ───────
 *
 * Additionner deux listes suffit tant qu'on n'ajoute que. Dès qu'on
 * corrige ou qu'on supprime, il faut savoir *quand* : sans date, un
 * appareil qui n'a pas vu la correction renvoie l'ancienne version, et
 * l'ancienne gagne parce qu'elle est arrivée en second. C'est ainsi qu'un
 * score corrigé sur l'ordinateur redevenait faux le lendemain sur le
 * téléphone.
 *
 * Deux ajouts, et tout se règle :
 *
 *   — chaque élément porte la date de sa dernière écriture. À la fusion,
 *     entre deux versions d'un même identifiant, la plus récente gagne ;
 *   — une suppression laisse une trace datée. Sans elle, l'appareil qui
 *     détient encore l'élément le réintroduit à la fusion suivante, et
 *     l'on ne peut plus rien effacer à deux.
 *
 * Les traces sont oubliées au bout de six mois : passé ce délai, tous les
 * appareils ont vu la suppression, et les garder ne ferait qu'alourdir
 * chaque envoi. Six mois, c'est le temps d'une saison plus une trêve —
 * un téléphone qu'on n'a pas ouvert de tout ce temps a d'autres soucis.
 */
/* Les listes que la fusion sait rapprocher. Exportée pour que l'essai
   puisse vérifier qu'aucune liste du carnet n'en manque : une liste
   oubliée ici partirait bien en ligne, mais n'en reviendrait jamais —
   elle s'ajouterait sur l'appareil qui l'a écrite et nulle part
   ailleurs. C'est le genre d'oubli qu'on ne voit qu'au moment où il
   manque quelque chose. */
export const LISTES = ['matchs', 'conseils', 'sources', 'clubs', 'raquettes',
                'cordages', 'chaussures', 'courses', 'joueurs', 'depenses'];

const MEMOIRE_TOMBES = 180 * 24 * 3600 * 1000;

const maintenant = () => new Date().toISOString();

/** Note la disparition d'un élément, pour que l'autre appareil ne le
 *  ressuscite pas. */
function oublier(s, id) {
  if (!id) return;
  s.supprimes = s.supprimes || [];
  s.supprimes.push({ id, quand: maintenant() });
}

/** Les traces trop vieilles pour servir encore. */
function purgerTombes(s) {
  if (!s.supprimes?.length) return;
  const limite = Date.now() - MEMOIRE_TOMBES;
  s.supprimes = s.supprimes.filter(t => new Date(t.quand).getTime() > limite);
}
/** Modifie puis enregistre en un geste. */
export function maj(fn) {
  /* Le profil et le barème ne sont pas des listes : on ne peut pas les
     dater élément par élément. On regarde donc s'ils ont bougé, et on
     date le tout — c'est peu de chose à comparer, et cela couvre tous
     les chemins d'écriture sans qu'aucun ait à y penser. */
  const avantProfil = JSON.stringify(store.profil);
  const avantBareme = JSON.stringify(store.bareme);

  fn(store);

  if (JSON.stringify(store.profil) !== avantProfil) store.profilModifieLe = maintenant();
  if (JSON.stringify(store.bareme) !== avantBareme) store.baremeModifieLe = maintenant();
  return sauver();
}

// =====================================================================
//  Écritures
// =====================================================================
export const ajouterMatch = m => maj(s => s.matchs.unshift({ id: uid(), ...m, modifieLe: maintenant() }));
export const modifierMatch = (id, m) => maj(s => {
  const i = s.matchs.findIndex(x => x.id === id);
  if (i >= 0) s.matchs[i] = { ...s.matchs[i], ...m, modifieLe: maintenant() };
});
export const supprimerMatch = id => maj(s => {
  s.matchs = s.matchs.filter(m => m.id !== id);
  oublier(s, id);
});

export const ajouterConseil = c => maj(s => s.conseils.unshift({ id: uid(), ...c, modifieLe: maintenant() }));
export const modifierConseil = (id, c) => maj(s => {
  const i = s.conseils.findIndex(x => x.id === id);
  if (i >= 0) s.conseils[i] = { ...s.conseils[i], ...c, modifieLe: maintenant() };
});
export const supprimerConseil = id => maj(s => {
  s.conseils = s.conseils.filter(c => c.id !== id);
  oublier(s, id);
});
export const basculerFavori = id => maj(s => {
  const c = s.conseils.find(x => x.id === id);
  if (c) { c.favori = !c.favori; c.modifieLe = maintenant(); }
});

export const ajouterSource = x => maj(s => s.sources.push({ id: uid(), ...x, modifieLe: maintenant() }));
export const supprimerSource = id => maj(s => {
  s.sources = s.sources.filter(x => x.id !== id);
  oublier(s, id);
});

export const ajouterClub = c => maj(s => s.clubs.push({ id: uid(), sources: [], ...c, modifieLe: maintenant() }));
export const modifierClub = (id, c) => maj(s => {
  const i = s.clubs.findIndex(x => x.id === id);
  if (i >= 0) s.clubs[i] = { ...s.clubs[i], ...c, modifieLe: maintenant() };
});
export const supprimerClub = id => maj(s => {
  s.clubs = s.clubs.filter(c => c.id !== id);
  oublier(s, id);
  // Un match rattaché à la main à ce club redevient orphelin plutôt que
  // de pointer dans le vide.
  s.matchs.forEach(m => { if (m.clubId === id) { delete m.clubId; m.modifieLe = maintenant(); } });
});

// =====================================================================
//  Matériel et intendance
// =====================================================================
/* Quatre listes de même nature, donc un seul jeu de fonctions. Les écrire
   à la main quatre fois n'aurait rien apporté qu'une occasion de se
   tromper à la quatrième. */
const listeDe = (cle) => ({
  ajouter: x => maj(s => s[cle].unshift({ id: uid(), ...x, modifieLe: maintenant() })),
  modifier: (id, x) => maj(s => {
    const i = s[cle].findIndex(y => y.id === id);
    if (i >= 0) s[cle][i] = { ...s[cle][i], ...x, modifieLe: maintenant() };
  }),
  supprimer: id => maj(s => {
    s[cle] = s[cle].filter(y => y.id !== id);
    oublier(s, id);
  }),
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
  a.modifieLe = maintenant();
});

/** Vide les articles cochés qui ne sont pas récurrents. Les récurrents
 *  restent : on rachètera des balles, ce serait absurde de les ressaisir. */
export const rangerCourses = () => maj(s => {
  const partis = s.courses.filter(a => a.achete && !a.recurrent);
  s.courses = s.courses.filter(a => !a.achete || a.recurrent);
  partis.forEach(a => oublier(s, a.id));
  s.courses.forEach(a => {
    if (a.achete && a.recurrent) { a.achete = false; a.modifieLe = maintenant(); }
  });
});

export const raquetteDe = id => store.raquettes.find(r => r.id === id) || null;

/** Enregistre ce qu'on a retenu d'un adversaire. La fiche est créée à la
 *  première note : tant qu'on n'a rien à dire, il n'y a rien à stocker. */
/* ─── Ce que ça coûte ──────────────────────────────────────────────────

   Rien de tout cela ne se déduit d'un palmarès : la fédération enregistre
   des résultats, pas des factures. Ces lignes se saisissent donc à la
   main, et le carnet ne remplit que ce qu'on lui donne.

   Le déplacement fait exception, et c'est le seul calcul du lot : on
   connaît le domicile et le club, donc la distance. Mais c'est un ordre
   de grandeur et rien d'autre — à vol d'oiseau, aller-retour, au tarif
   qu'on aura réglé soi-même. Il est compté à part du reste pour cette
   raison : mélanger un chiffre saisi et un chiffre estimé dans un même
   total ferait passer l'estimation pour une dépense constatée. */
export const CATEGORIES_DEPENSE = [
  { cle: 'inscription', emoji: '🎟️', nom: 'Inscription à un tournoi' },
  { cle: 'licence',     emoji: '🪪', nom: 'Licence et cotisation' },
  { cle: 'cordage',     emoji: '🧵', nom: 'Cordage et pose' },
  { cle: 'materiel',    emoji: '🎒', nom: 'Matériel' },
  { cle: 'cours',       emoji: '💡', nom: 'Cours et stages' },
  { cle: 'autre',       emoji: '💶', nom: 'Autre' },
];

export const nomCategorieDepense = cle =>
  CATEGORIES_DEPENSE.find(c => c.cle === cle)?.nom || cle;

export const ajouterDepense = d => maj(s => s.depenses.push({ id: uid(), ...d, modifieLe: maintenant() }));
export const modifierDepense = (id, d) => maj(s => {
  const i = s.depenses.findIndex(x => x.id === id);
  if (i >= 0) s.depenses[i] = { ...s.depenses[i], ...d, modifieLe: maintenant() };
});
export const supprimerDepense = id => maj(s => {
  s.depenses = s.depenses.filter(d => d.id !== id);
  oublier(s, id);
});

export const noterJoueur = (nom, donnees) => maj(s => {
  const cle = (n) => (n || '').trim().toUpperCase();
  const i = s.joueurs.findIndex(j => cle(j.nom) === cle(nom));
  if (i >= 0) s.joueurs[i] = { ...s.joueurs[i], ...donnees, nom, modifieLe: maintenant() };
  else s.joueurs.push({ id: uid(), nom, ...donnees, modifieLe: maintenant() });
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
export function positionMot(texte, mot) {
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

/* ─── Les tours d'un tableau ───────────────────────────────────────────

   Un tableau de tournoi se remonte : premier tour, seizièmes, huitièmes,
   quarts, demie, finale. Le tour n'est pas un détail de palmarès — c'est
   lui qui donne les victoires bonus du classement, et c'est lui qu'on
   raconte (« j'ai sorti un 15/1 en quart »).

   « Vainqueur » n'est pas un tour et ne figure donc pas ici : c'est une
   finale gagnée, et le carnet sait déjà laquelle des deux issues on a
   enregistrée. Le déduire évite la contradiction — une finale perdue
   cochée « vainqueur ».

   La poule n'est pas un tour non plus au sens strict, mais elle se joue
   et se note : sans elle, la moitié des championnats jeunes et des
   tournois internes n'aurait rien à cocher. */
/** Le prix de la tournée arrive dans les carnets ouverts avant lui.
 *
 *  Un carnet neuf le porte déjà ; celui qui existait déjà a le champ à
 *  vide, et un champ vide ne compte rien — la règle serait entrée dans
 *  le carnet sans jamais rien y changer. On le pose donc une fois, et
 *  le témoin fait qu'on ne le repose pas : vider le champ, c'est dire
 *  qu'on ne veut plus de ce calcul, et cela doit tenir.
 */
export function remplirTourneeUneFois() {
  const p = store.profil || {};
  if (p.tourneeReglee || p.coutVictoire != null) return false;
  maj(x => { x.profil = { ...x.profil, coutVictoire: 4, tourneeReglee: true }; });
  return true;
}

export const TOURS = [
  { cle: 'finale',   nom: 'Finale',           rang: 1 },
  { cle: 'demie',    nom: '1/2 finale',       rang: 2 },
  { cle: 'quart',    nom: '1/4 de finale',    rang: 3 },
  { cle: 'huitieme', nom: '1/8 de finale',    rang: 4 },
  { cle: 'seizieme', nom: '1/16 de finale',   rang: 5 },
  { cle: 'trentedeuxieme', nom: '1/32 de finale', rang: 6 },
  { cle: 'tour1',    nom: 'Premier tour',     rang: 7 },
  { cle: 'poule',    nom: 'Poule',            rang: 8 },
  { cle: 'qualif',   nom: 'Qualifications',   rang: 9 },
];

export const nomTour = cle => TOURS.find(t => t.cle === cle)?.nom || '';

/** Ce qu'on dit d'un match : « Vainqueur » quand la finale est gagnée,
 *  le tour lui-même sinon.
 *
 *  La coupe et la médaille ne sont pas un ornement : dans une liste de
 *  quarante lignes, elles se repèrent avant tout texte, et ce sont les
 *  deux seules lignes qu'on y cherche vraiment. Le mot reste à côté —
 *  une image seule ne se lit pas à voix haute, et se confond d'un
 *  téléphone à l'autre. */
export function direTour(m) {
  if (!m?.tour) return '';
  if (m.tour === 'finale') return m.issue === 'V' ? '🏆 Vainqueur' : '🥈 Finaliste';
  return nomTour(m.tour);
}
/* ─── Le championnat par équipes ───────────────────────────────────────

   Ce n'est pas un tournoi et il ne faut pas le compter comme tel. Une
   rencontre par équipes se joue une journée chez soi, la suivante chez
   l'adversaire : elle n'appartient à aucun club en particulier, et son
   absence dans la liste des clubs n'est pas un oubli à réparer. La ranger
   parmi les « épreuves à rattacher » revenait à signaler comme défaut ce
   qui est la règle du jeu.

   La reconnaissance se fait sur le libellé, seule chose que la fédération
   conserve, et sur les deux formes observées dans un palmarès réel :
   « LIGUE-2023 SENIORS MASCULIN PRINTEMPS » pour le championnat de ligue,
   « 76-2024 35 MESSIEURS » pour celui du département. C'est une
   heuristique, et il faut le dire : une troisième forme passerait à côté.
   Elle a l'avantage de ne jamais se tromper dans l'autre sens — aucun
   tournoi ne s'appelle ainsi. */
export const estParEquipes = m => /^(LIGUE|\d{2})-\d{4}\b/i.test((m?.tournoi || '').trim());

/** L'année et la saison d'une rencontre par équipes, telles qu'on les
 *  nomme : « 2023 printemps ». L'année vient du libellé et non de la date,
 *  parce qu'un championnat d'hiver déborde sur l'année suivante. */
export function saisonEquipe(m) {
  const t = (m.tournoi || '').toUpperCase();
  const an = (t.match(/-(\d{4})/) || [])[1] || (m.date || '').slice(0, 4) || '?';
  const saison = /HIVER/.test(t) ? 'hiver' : /PRINTEMPS/.test(t) ? 'printemps' : '';
  return { an, saison, libelle: saison ? `${an} ${saison}` : an };
}

/* ─── Les tournois gagnés ──────────────────────────────────────────────

   La fédération ne dit nulle part qu'on a gagné un tournoi. Elle donne
   des matchs, et c'est tout. Mais un tournoi se perd en une fois : dès
   qu'on y a une défaite, on est sorti. Une édition sans aucune défaite
   est donc une édition qu'on est allé au bout — c'est-à-dire gagnée.

   Le championnat par équipes est exclu, et il le faut : on y joue toutes
   les journées quoi qu'il arrive, si bien qu'une saison sans défaite ne
   veut pas dire la même chose.

   Les éditions à une seule victoire ont d'abord été mises à part : une
   victoire unique pouvait aussi bien être un petit tableau gagné en une
   rencontre qu'un tournoi dont la défaite manque à l'historique. Le
   joueur les a vérifiées une à une et confirmé que c'étaient bien des
   titres. Elles comptent donc comme les autres — c'est à lui de savoir,
   pas au carnet de trancher, et il a tranché.

   L'édition, et non le tournoi : le même open revient chaque année, et
   gagner celui de 2023 ne dit rien de celui de 2024. D'où l'année dans la
   clé de regroupement. */
export function tournoisRemportes() {
  const editions = {};
  for (const m of store.matchs) {
    const nom = (m.tournoi || '').trim();
    if (!nom || estParEquipes(m)) continue;
    const an = (m.date || '').slice(0, 4) || '?';
    const cle = `${nom} §${an}`;
    editions[cle] = editions[cle] || { cle, nom, an, v: 0, d: 0, derniere: '' };
    if (m.issue === 'V') editions[cle].v++; else editions[cle].d++;
    if ((m.date || '') > editions[cle].derniere) editions[cle].derniere = m.date || '';
  }

  const titres = Object.values(editions)
    .filter(e => e.d === 0 && e.v > 0)
    .sort((a, b) => (b.derniere || '').localeCompare(a.derniere || ''));

  return { titres, editions: Object.keys(editions).length };
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
  };
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

  /* ─── La fusion ────────────────────────────────────────────────────

     Trois règles, et elles suffisent à ce que trois appareils finissent
     par dire la même chose sans jamais se demander lequel a raison :

       1. un élément inconnu s'ajoute ;
       2. un élément connu des deux côtés est gardé dans sa version la
          plus récemment écrite ;
       3. un élément supprimé après sa dernière écriture disparaît, où
          qu'il se trouve.

     C'est la convergence par horodatage, et son défaut est connu : deux
     corrections du même match, faites en même temps sur deux appareils,
     ne se mélangent pas — la seconde écrite l'emporte entière. Pour un
     carnet tenu par une personne, c'est le bon compromis ; le contraire
     demanderait un journal d'opérations, et beaucoup de complication pour
     un cas qui ne se produit pas.

     Les carnets d'avant cette règle n'ont pas de dates. Un élément sans
     date perd contre un élément daté, et c'est le bon sens : le daté a
     forcément été écrit après, puisqu'il l'a été par une version du
     carnet qui date. */
  const avant = JSON.stringify(store);

  /* Les traces de suppression des deux côtés, la plus récente pour un
     même identifiant. */
  const tombes = new Map();
  for (const t of [...(store.supprimes || []), ...(lu.supprimes || [])]) {
    if (!t?.id) continue;
    const q = tombes.get(t.id);
    if (!q || t.quand > q) tombes.set(t.id, t.quand);
  }

  /* Un élément venu d'un carnet ancien peut n'avoir pas d'identifiant.
     On le reconnaît alors à son contenu — la date et l'adversaire pour un
     match, le titre pour un conseil — plutôt que de le dupliquer à chaque
     fusion. */
  const cleDeSecours = (liste, x) =>
    liste === 'matchs' ? `${x.date}|${(x.adversaire || '').toLowerCase()}`
    : liste === 'conseils' ? (x.titre || '').toLowerCase()
    : liste === 'clubs' ? (x.nom || '').toLowerCase()
    : liste === 'sources' ? (x.url || '').toLowerCase()
    : null;

  const compte = { ajoutes: 0, majs: 0, retires: 0 };

  for (const liste of LISTES) {
    const par = new Map();
    const secours = new Map();
    for (const x of store[liste] || []) {
      par.set(x.id, x);
      const c = cleDeSecours(liste, x);
      if (c) secours.set(c, x.id);
    }

    for (const brut of (lu[liste] || [])) {
      const x = { ...brut };
      if (!x.id) {
        const c = cleDeSecours(liste, x);
        x.id = (c && secours.get(c)) || uid();
      }
      const local = par.get(x.id);
      if (!local) {
        par.set(x.id, x);
        const c = cleDeSecours(liste, x);
        if (c) secours.set(c, x.id);
        compte.ajoutes++;
      } else if ((x.modifieLe || '') > (local.modifieLe || '')) {
        par.set(x.id, x);
        compte.majs++;
      }
    }

    const sortie = [];
    for (const x of par.values()) {
      const mort = tombes.get(x.id);
      /* Supprimé après sa dernière écriture : il reste supprimé. Écrit
         après avoir été supprimé — on l'a recréé ailleurs — il revit. */
      if (mort && mort >= (x.modifieLe || '')) { compte.retires++; continue; }
      sortie.push(x);
    }
    store[liste] = sortie;
  }

  store.supprimes = [...tombes].map(([id, quand]) => ({ id, quand }));
  purgerTombes(store);

  /* Le profil et le barème : le plus récemment écrit gagne. Auparavant on
     ne prenait celui d'en face que si le sien n'avait jamais été touché,
     ce qui rendait tout réglage local définitif — changer d'échelon sur
     l'ordinateur ne descendait jamais sur le téléphone. */
  if (lu.profil && (lu.profilModifieLe || '') > (store.profilModifieLe || '')) {
    store.profil = { ...vide().profil, ...lu.profil };
    store.profilModifieLe = lu.profilModifieLe;
  }
  if (lu.bareme && (lu.baremeModifieLe || '') > (store.baremeModifieLe || '')) {
    store.bareme = { ...BAREME_DEFAUT, ...lu.bareme };
    store.baremeModifieLe = lu.baremeModifieLe;
  }

  /* Une fusion qui ne change rien n'écrit rien, et surtout ne prévient
     personne. Ce n'est pas une économie d'écriture : `sauver()` annonce un
     changement, l'application se redessine et programme un envoi, l'envoi
     refusionne le carnet distant — et l'on repart pour un tour, indéfiniment.
     Le silence est ici la correction, pas la politesse. */
  if (JSON.stringify(store) === avant) {
    return { ok: true, matchs: 0, conseils: 0, sources: 0, clubs: 0, materiel: 0, mode };
  }

  store.matchs.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const r = sauver();
  return r.ok
    ? { ok: true, matchs: compte.ajoutes, conseils: 0, sources: 0, clubs: 0,
        materiel: 0, majs: compte.majs, retires: compte.retires, mode }
    : { ok: false, erreur: r.erreur };
}

/** Fusionne ce qui vient d'un autre appareil.
 *
 *  Tout le travail est dans `importerJSON` : la règle de fusion est la
 *  même qu'on reprenne un fichier à la main ou qu'on synchronise. Ici on
 *  ne fait que compter ce qui a changé, pour pouvoir le dire.
 */
export function fusionnerDistant(distant) {
  const avant = {
    matchs: store.matchs.length, conseils: store.conseils.length,
    clubs: store.clubs.length, joueurs: store.joueurs.length,
  };

  const r = importerJSON(JSON.stringify(distant), 'fusion');
  if (!r.ok) return { ok: false, erreur: r.erreur };

  return {
    ok: true,
    matchs: store.matchs.length - avant.matchs,
    conseils: store.conseils.length - avant.conseils,
    clubs: store.clubs.length - avant.clubs,
    joueurs: store.joueurs.length - avant.joueurs,
    majs: r.majs || 0,
    retires: r.retires || 0,
  };
}
/** À qui appartient le carnet posé sur cet appareil. */
export const proprietaireDuCarnet = () => store.proprietaire || null;

/** Le carnet change de main. À n'appeler qu'après avoir vérifié que
 *  c'est bien voulu : ce que contient l'appareil ne remontera plus. */
export function poserProprietaire(utilisateur) {
  return maj(s => { s.proprietaire = utilisateur || null; });
}

/** Ce que contient le carnet, en une phrase — pour demander avant
 *  d'effacer, plutôt qu'après. */
export function volumeDuCarnet() {
  const n = LISTES.reduce((t, c) => t + (store[c]?.length || 0), 0);
  return { total: n, matchs: store.matchs.length, conseils: store.conseils.length };
}

export function toutEffacer() {
  store = vide();
  return sauver();
}
