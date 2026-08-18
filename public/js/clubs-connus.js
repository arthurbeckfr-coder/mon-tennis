/* Les clubs qu'on sait reconnaître dans un nom d'épreuve.

   Ten'Up ne nomme le club que dans le libellé du tournoi, et pas toujours
   de la même façon : « TOURNOI OPEN MSA TC » une année, « TOURNOI OPEN
   MSATC » la suivante. Le carnet reconnaît un club par ses mots-clés,
   qu'il faut donc saisir un par un — et personne ne le fait.

   D'où cette table : elle ne décide de rien, elle propose. Quand une
   épreuve sans club contient un sigle reconnu, la page des clubs offre de
   créer le club manquant ou d'ajouter le mot-clé au club existant. Un
   geste au lieu d'un formulaire, et rien n'est écrit sans qu'on ait
   cliqué.

   ─── D'où viennent ces adresses ──────────────────────────────────────

   Des pages publiques de chaque club, consultées une à une : elles ne
   viennent ni de Ten'Up, qui exige une connexion et n'ouvre aucun accès
   aux applications extérieures, ni d'une déduction. Ce sont des clubs de
   Seine-Maritime, parce que c'est là que ce carnet joue ; la table n'a
   pas vocation à couvrir la France, seulement à cesser de laisser
   trente-sept matchs sans lieu.

   Une adresse peut vieillir. C'est pourquoi tout est modifiable après
   création : la fiche du club s'ouvre comme n'importe quelle autre. */

import { positionMot } from './store.js';

/* ─── Les surfaces ─────────────────────────────────────────────────────
 *
 * Chaque liste ci-dessous vient d'une page du club ou d'un répertoire
 * d'équipements sportifs, vérifiée au nom du club. Trois clubs n'en ont
 * pas : Yerville, Petit-Couronne et le TC de Rouen ne publient pas
 * l'information, et aucune source secondaire ne la donne sans se
 * contredire. Un champ vide se remplit d'un coup d'œil sur place ; une
 * surface inventée fausse une statistique pour toujours.
 *
 * Un club a presque toujours plusieurs surfaces — terre battue dehors,
 * moquette ou résine sous bulle — et c'est bien la liste entière qu'on
 * garde : le filtre de la page des clubs le fait apparaître sous chacune.
 */
export const CLUBS_CONNUS = [
  {
    nom: 'MONT SAINT AIGNAN TC',
    /* Deux sites : les Coquets — six courts couverts en Green Set, deux
       extérieurs de même, un couvert en gazon synthétique — et les
       Cottes, quatre courts de terre battue ouverts l'été. Source : la
       page « Nos infrastructures » du club. */
    surfaces: ['Green-set', 'Terre battue traditionnelle', 'Gazon synthétique'],
    ville: 'MONT SAINT AIGNAN',
    adresse: 'Centre sportif des Coquets, 8 rue du Dr Fleury, 76130 MONT SAINT AIGNAN',
    // Les deux graphies rencontrées dans le palmarès, espacée et collée.
    motsCles: ['MSA TC', 'MSATC', 'MSA'],
    sources: [
      { plateforme: 'site', url: 'https://msatc.fr/' },
      { plateforme: 'facebook', url: 'https://www.facebook.com/MSATC/' },
      { plateforme: 'instagram', url: 'https://www.instagram.com/msatennisclub/' },
    ],
  },
  {
    nom: 'ASRUC TENNIS',
    /* Dix courts : huit couverts — quatre en terre artificielle, deux en
       terre battue, deux en résine — et deux extérieurs en terre
       artificielle. Source : la page tennis de l'ASRUC. */
    surfaces: ['Terre artificielle', 'Terre battue traditionnelle', 'Résine'],
    ville: 'MONT SAINT AIGNAN',
    adresse: '37 rue de la Croix-Vaubois, 76130 MONT SAINT AIGNAN',
    note: 'Association Sportive Rouen Université Club — section tennis.',
    motsCles: ['ASRUC'],
    sources: [{ plateforme: 'site', url: 'http://tennis.asrouenuc.com/' }],
  },
  {
    nom: 'AA PETIT COURONNE',
    ville: 'PETIT COURONNE',
    adresse: 'rue Camille Saint-Saëns, 76650 PETIT COURONNE',
    motsCles: ['PETIT COURONNE'],
    sources: [],
  },
  {
    nom: 'YVETOT TC',
    /* Six courts : deux de terre battue extérieure, deux de terre
       artificielle couverte, deux de résine en intérieur. */
    surfaces: ['Terre battue traditionnelle', 'Terre artificielle', 'Résine'],
    ville: 'YVETOT',
    adresse: '11 rue Pierre de Coubertin, 76190 YVETOT',
    motsCles: ['YVETOT'],
    sources: [],
  },
  {
    nom: 'YERVILLE TC',
    ville: 'YERVILLE',
    adresse: '1 rue des Acacias, 76760 YERVILLE',
    motsCles: ['YERVILLE'],
    sources: [],
  },
  {
    nom: 'USCB TENNIS',
    /* Douze courts sur deux sites : six couverts en moquette, quatre de
       terre battue et deux de résine à l'extérieur. Source : la page
       « Nos infrastructures » du club. */
    surfaces: ['Moquette', 'Terre battue traditionnelle', 'Résine'],
    ville: 'BOIS GUILLAUME',
    adresse: '1422 rue de la Haie, 76230 BOIS GUILLAUME',
    note: 'Union Sportive et Culturelle de Bois-Guillaume.',
    motsCles: ['BOIS GUILLAUME', 'BOIS-GUILLAUME', 'USCB'],
    sources: [{ plateforme: 'site', url: 'https://www.uscbtennis.fr/' }],
  },
  {
    nom: 'TENNIS CLUB DE ROUEN',
    ville: 'ROUEN',
    // L'adresse n'a pas été trouvée sur une source publique fiable : mieux
    // vaut un champ vide qu'une adresse inventée. À compléter d'un tour
    // sur place, ou d'un appel.
    adresse: '',
    motsCles: ['TC ROUEN'],
    sources: [],
  },
];

/* Les pages publiques des clubs qu'on fréquente déjà.
 *
 * Elles se cherchent une par une et ne s'inventent pas : chaque adresse
 * ci-dessous vient d'une page trouvée au nom du club. Les clubs absents
 * de cette liste ne sont pas des oublis mais des recherches qui n'ont
 * rien donné de sûr — mieux vaut un champ vide qu'un lien qui tombe sur
 * le club voisin.
 *
 * Le lien Ten'Up ne figure pas ici, et c'est voulu : il se déduit de
 * l'identifiant que l'import a déjà posé sur chaque club (voir la fiche
 * de club), ce qui vaut mieux qu'une liste à tenir à jour. */
export const LIENS_CONNUS = [
  { club: 'TENNIS PETIT CAUX VARENGEVILLE', sources: [
    { plateforme: 'facebook', url: 'https://www.facebook.com/tennispetitcauxvarengeville/' },
  ] },
  { club: 'DIEPPE TENNIS SQUASH', sources: [
    { plateforme: 'facebook', url: 'https://www.facebook.com/DieppeTennisSquash/' },
  ] },
  { club: 'ROUXMESNIL BOUTEILLES ATRB', sources: [
    { plateforme: 'site', url: 'https://tennis-rouxmesnil.fr/' },
    { plateforme: 'facebook', url: 'https://www.facebook.com/rouxmesniltennis.atrb/' },
  ] },
  { club: 'TENNIS CLUB CANTON D\'AULT', sources: [
    { plateforme: 'site', url: 'https://www.tennisclubaultois.fr/' },
    { plateforme: 'facebook', url: 'https://www.facebook.com/tccault/' },
  ] },
  { club: 'Tennis Club de VEULES', sources: [
    { plateforme: 'facebook', url: 'https://www.facebook.com/tennisclubdeveules/' },
  ] },
  { club: 'VEULETTES SUR MER TC', sources: [
    { plateforme: 'facebook', url: 'https://www.facebook.com/tennisclubdeveulettes/' },
  ] },
];

/* L'adresse d'un club sur Ten'Up, déduite de l'identifiant que porte
   chaque club importé. Le format a été vérifié sur trois clubs dont on
   connaissait l'identifiant — 58760634 pour le TPCV, 58760458 pour
   Rouxmesnil — et non deviné. Sans identifiant, pas de lien : on ne
   fabrique pas une adresse au hasard. */
export const urlTenupClub = club =>
  club?.tenupId ? `https://tenup.fft.fr/club/${encodeURIComponent(club.tenupId)}` : '';

/* Les mots-clés à ajouter à un club que le carnet possède déjà, sous un
   nom que le libellé de l'épreuve ne dit pas. « TOUT VA BIEN » est le nom
   du tournoi de Dieppe : rien dans ces trois mots ne permet de le
   deviner, il fallait le savoir. */
export const MOTS_EN_PLUS = [
  { club: 'DIEPPE', mots: ['TOUT VA BIEN'] },
];

/** Le club connu que ce libellé désigne, ou null.
 *
 *  La reconnaissance réutilise `positionMot`, celle-là même dont le carnet
 *  se sert pour ses propres clubs : deux règles concurrentes finiraient
 *  par diverger, et l'on proposerait un rattachement qui ne prendrait pas
 *  une fois enregistré. Le premier mot cité l'emporte — dans un nom
 *  d'épreuve, l'organisateur est nommé avant le lieu. */
export function clubConnuPour(libelle) {
  let gagnant = null, meilleure = Infinity;
  for (const c of CLUBS_CONNUS) {
    for (const mot of c.motsCles) {
      const i = positionMot(libelle, mot);
      if (i >= 0 && i < meilleure) { meilleure = i; gagnant = { club: c, mot }; }
    }
  }
  return gagnant;
}
