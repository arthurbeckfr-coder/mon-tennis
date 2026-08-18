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

import { positionMot, store, modifierClub } from './store.js';

/* ─── Les surfaces ─────────────────────────────────────────────────────
 *
 * Relevées une par une sur Ten'Up, à la page « installations » de chaque
 * club : c'est la fédération qui les déclare, et c'est le même
 * vocabulaire que celui du carnet. Les sites des clubs disent parfois
 * autre chose — Mont-Saint-Aignan annonce du Green Set là où Ten'Up
 * classe de la résine, l'ASRUC parle de terre battue quand Ten'Up ne
 * connaît que de la terre artificielle. En cas de désaccord on suit
 * Ten'Up : c'est lui qui sert de référence au reste du carnet.
 *
 * Un club a presque toujours plusieurs surfaces — terre battue dehors,
 * moquette ou résine sous bulle — et c'est la liste entière qu'on garde :
 * le filtre de la page des clubs le fait apparaître sous chacune.
 *
 * L'identifiant Ten'Up vient de la même visite. Il donne le lien direct
 * vers la fiche officielle depuis la page du club.
 */
export const CLUBS_CONNUS = [
  {
    nom: 'MONT SAINT AIGNAN TC',
    tenupId: '58760140',
    /* Deux sites. Les Coquets : sept courts de résine dont cinq couverts,
       un de gazon synthétique couvert. Les Cottes : quatre de terre
       battue et un d'enrobé poreux. */
    surfaces: ['Résine', 'Gazon synthétique', 'Terre battue traditionnelle',
               'Enrobé poreux'],
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
    tenupId: '58760304',
    /* Dix courts de tennis : six de terre artificielle dont quatre
       couverts, deux de gazon synthétique couverts, deux de revêtement
       plastique couverts. Les six courts de résine sont ceux du
       pickleball, et n'ont rien à faire ici. */
    surfaces: ['Terre artificielle', 'Gazon synthétique', 'Revêtement P.V.C. ou P.U.'],
    ville: 'MONT SAINT AIGNAN',
    adresse: '37 rue de la Croix-Vaubois, 76130 MONT SAINT AIGNAN',
    note: 'Association Sportive Rouen Université Club — section tennis.',
    motsCles: ['ASRUC'],
    sources: [{ plateforme: 'site', url: 'http://tennis.asrouenuc.com/' }],
  },
  {
    nom: 'AA PETIT COURONNE',
    tenupId: '58760121',
    /* Trois courts de moquette couverts et un de résine. */
    surfaces: ['Moquette', 'Résine'],
    ville: 'PETIT COURONNE',
    adresse: 'rue Camille Saint-Saëns, 76650 PETIT COURONNE',
    motsCles: ['PETIT COURONNE'],
    sources: [],
  },
  {
    nom: 'YVETOT TC',
    tenupId: '58760134',
    /* Huit courts : quatre de résine couverts, deux de terre artificielle
       couverts, deux de terre battue en extérieur. */
    surfaces: ['Résine', 'Terre artificielle', 'Terre battue traditionnelle'],
    ville: 'YVETOT',
    adresse: '11 rue Pierre de Coubertin, 76190 YVETOT',
    motsCles: ['YVETOT'],
    sources: [],
  },
  {
    nom: 'YERVILLE TC',
    tenupId: '58760399',
    /* Deux courts de béton poreux et un de résine, couvert. */
    surfaces: ['Béton poreux', 'Résine'],
    ville: 'YERVILLE',
    adresse: '1 rue des Acacias, 76760 YERVILLE',
    motsCles: ['YERVILLE'],
    sources: [],
  },
  {
    nom: 'USCB TENNIS',
    tenupId: '58760097',
    /* Cinq courts de moquette couverts, quatre de terre battue, deux de
       résine — plus la salle Ariane, deux courts de moquette de plus. */
    surfaces: ['Moquette', 'Terre battue traditionnelle', 'Résine'],
    ville: 'BOIS GUILLAUME',
    adresse: '1422 rue de la Haie, 76230 BOIS GUILLAUME',
    note: 'Union Sportive et Culturelle de Bois-Guillaume.',
    motsCles: ['BOIS GUILLAUME', 'BOIS-GUILLAUME', 'USCB'],
    sources: [{ plateforme: 'site', url: 'https://www.uscbtennis.fr/' }],
  },
  {
    nom: 'TENNIS CLUB DE ROUEN',
    /* Aucun club de ce nom exact sur Ten'Up dans le rayon de Rouen : on
       y trouve le Rouen Port AS, le comité de Seine-Maritime et une
       dizaine d'autres, mais rien qui corresponde à coup sûr. Ni
       identifiant, ni surfaces : deviner reviendrait à attribuer à ce
       club les courts d'un autre. */
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

/** Complète les clubs déjà créés avec ce qu'on vient d'apprendre.
 *
 *  Les surfaces et l'identifiant Ten'Up n'arrivaient jusqu'ici qu'à la
 *  création du club. Les sept clubs du carnet ont été créés avant, et
 *  seraient donc restés sans surface — c'est-à-dire absents du filtre —
 *  alors que la réponse est juste au-dessus, dans cette table.
 *
 *  On ne remplit que le vide : un club qui porte déjà une surface garde
 *  la sienne, même si Ten'Up en déclare une autre. Ce qui est saisi à la
 *  main l'emporte sur ce qui est relevé — c'est lui qui a joué dessus.
 */
export function completerClubsConnus() {
  const connuPour = club => CLUBS_CONNUS.find(k =>
    k.nom.toUpperCase() === (club.nom || '').toUpperCase()
    || (club.motsCles || []).some(m =>
         k.motsCles.some(x => x.toUpperCase() === String(m).toUpperCase())));

  const aCompleter = store.clubs.filter(c => {
    const k = connuPour(c);
    if (!k) return false;
    return (!c.tenupId && k.tenupId)
        || (!(c.surfaces || []).length && (k.surfaces || []).length);
  });
  if (!aCompleter.length) return 0;

  /* On passe par `modifierClub` plutôt que d'écrire dans la liste : il
     date chaque fiche touchée, et c'est cette date que la
     synchronisation lit pour savoir qui, de deux appareils, a raison. */
  for (const c of aCompleter) {
    const k = connuPour(c);
    const ajouts = {};
    if (!c.tenupId && k.tenupId) ajouts.tenupId = k.tenupId;
    if (!(c.surfaces || []).length && (k.surfaces || []).length) {
      ajouts.surfaces = [...k.surfaces];
    }
    modifierClub(c.id, ajouts);
  }
  return aCompleter.length;
}
