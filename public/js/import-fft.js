/* Récupérer son historique depuis le site de la fédération.

   Ce qu'il faut savoir avant de lire ce fichier : il n'existe aucun moyen
   d'aller chercher ces matchs tout seul. Ten'Up demande une connexion,
   n'offre aucune interface publique, et un site comme celui-ci n'a de
   toute façon pas le droit d'interroger un autre domaine depuis le
   navigateur. Toute promesse d'import « automatique » serait mensongère.

   Ce qui marche : ouvrir son palmarès, tout sélectionner, copier, coller.

   ─── La forme réelle du tableau Ten'Up ───────────────────────────────

   Une fois collé, chaque match occupe un paquet de lignes, dans cet ordre
   et sans exception :

       Alexandre MOREL                     ← le nom, « Prénom NOM »
       1970                                ← l'année de naissance
       15/2                                ← le classement de l'adversaire
       D                                   ← l'issue, parfois « V (WO) »
       6/3                                 ← le score, un jeu par ligne
       -
       Abandon
       Tournoi du CASINO…  1  11/08/2026  août 2027   ← la compétition

   Deux pièges s'y cachent, et ce sont eux qui rendent l'analyse naïve
   fausse plutôt qu'imparfaite :

   • **La date est en dernier, pas en premier.** Découper les blocs à
     chaque date fait donc commencer un match sur la fin du précédent :
     on hérite de la date du match d'avant et du nom de celui d'après.
     Les blocs se ferment donc sur la date, ils ne s'ouvrent pas dessus.

   • **Les noms sont « Prénom NOM », pas tout en capitales.** Chercher la
     plus longue suite de majuscules ramène « MASCULIN PRINTEMPS » ou
     « CTCA », c'est-à-dire des bouts de nom de compétition.

   D'où la méthode retenue : on ne devine pas, on se repère. La ligne
   d'issue — un « V » ou un « D » seul — est la seule impossible à
   confondre. Tout se lit par rapport à elle : le classement juste avant,
   l'année encore avant, le nom encore avant, le score juste après. Cette
   ancre rend aussi l'en-tête du tableau inoffensif, puisqu'il n'en
   contient pas.

   Un mode dégradé subsiste pour les collages d'une autre forme, où tout
   le match tient sur une ligne. Il devine, lui — d'où l'aperçu corrigeable
   avant tout import. */

import { ECHELONS } from './classement.js';

/* Les échelons, du plus long au plus court : sans ce tri, « 30 »
   avalerait le début de « 30/5 » et tous les classements seraient faux. */
const MOTIF_ECHELON = new RegExp(
  '(?<![\\w/])(' +
  [...ECHELONS].sort((a, b) => b.length - a.length)
    .map(e => e.replace(/[/\\^$*+?.()|[\]{}]/g, '\\$&'))
    .join('|') +
  ')(?![\\w/])'
);

const MOTIF_DATE = /(\d{2})[/.-](\d{2})[/.-](\d{4})|(\d{4})-(\d{2})-(\d{2})/;

/* Un jeu de set : « 6/4 », « 7/6(5) », « 6-4 ». Les deux nombres sont
   bornés à un seul chiffre, et c'est ce qui sauve le mode dégradé : sans
   cette borne, un classement « 30/1 » se ferait avaler par le score qui
   le suit. Un jeu ne dépasse jamais 7. */
const GROUPE = '(?<![\\d/])[0-7]\\s*[/-]\\s*[0-7](?:\\s*\\(\\d{1,2}\\))?(?![\\d/])';
const MOTIF_SCORE_LONG = new RegExp(`${GROUPE}(?:\\s+${GROUPE}){1,4}`);
const MOTIF_ABANDON = /\b(w\.?o\.?|abandon|forfait|ab\.)\b/i;

/** La ligne d'issue du tableau : « V », « D », « V (WO) », « D (W.O.) ». */
const MOTIF_ISSUE = /^([VD])\s*(?:\(\s*(?:W\.?\s*O\.?)\s*\))?$/i;

const MOTS_VICTOIRE = /\b(victoire|gagn[ée]|vainqueur|bat\b|v\b)/i;
const MOTS_DEFAITE  = /\b(d[ée]faite|perdu|battu|vaincu|d\b)/i;

/* Ce qui n'est jamais un nom d'adversaire, même écrit en majuscules.
   Ne sert plus qu'au mode dégradé. */
const BRUIT = new Set([
  'VICTOIRE', 'DEFAITE', 'DÉFAITE', 'TOURNOI', 'CHAMPIONNAT', 'MATCH', 'SIMPLE',
  'DOUBLE', 'MESSIEURS', 'DAMES', 'SENIORS', 'CLASSEMENT', 'WO', 'ABANDON',
  'FORFAIT', 'POULE', 'FINALE', 'DEMI', 'QUART', 'TABLEAU', 'NC', 'TC', 'AS',
  'OPEN', 'COUPE', 'TROPHEE', 'TROPHÉE', 'INTERNE', 'EQUIPES', 'ÉQUIPES',
  'GRAND', 'PRIX', 'CRITERIUM', 'CRITÉRIUM', 'RENCONTRE', 'CLUB', 'LIGUE',
  'MASCULIN', 'FEMININ', 'FÉMININ', 'PRINTEMPS', 'AUTOMNE', 'CTCA', 'TPCV',
]);

/** Normalise une date trouvée vers la forme ISO. */
function versISO(m) {
  if (m[4]) return `${m[4]}-${m[5]}-${m[6]}`;          // déjà en ISO
  return `${m[3]}-${m[2]}-${m[1]}`;                    // jj/mm/aaaa
}

/** Prépare le texte collé : une ligne par entrée, tabulations conservées
 *  (elles séparent les colonnes de la dernière ligne), lignes vides
 *  écartées pour que les positions relatives restent stables. */
function normaliser(texte) {
  return texte
    .replace(/\r/g, '')
    .replace(/ /g, ' ')
    .split('\n')
    .map(l => l.replace(/[ \t]+$/g, '').replace(/^[ \t]+/g, ''))
    .filter(l => l.length > 0);
}

/** Découpe en blocs, en **fermant** sur la ligne qui porte la date.
 *  L'en-tête du tableau, qui n'en contient pas, se retrouve collé devant
 *  le premier match : sans conséquence, puisque la lecture se repère sur
 *  la ligne d'issue et non sur le début du bloc. */
function decouper(lignes) {
  const blocs = [];
  let courant = [];
  for (const ligne of lignes) {
    courant.push(ligne);
    if (MOTIF_DATE.test(ligne)) { blocs.push(courant); courant = []; }
  }
  if (courant.length) blocs.push(courant);
  return blocs;
}

/** Le nom et l'année, qui partagent parfois la même ligne (« Anonyme 1977 »)
 *  et occupent parfois deux lignes distinctes. */
function lireNomEtAnnee(lignes, iClassement) {
  const avant1 = (lignes[iClassement - 1] || '').replace(/\t/g, ' ').trim();
  const avant2 = (lignes[iClassement - 2] || '').replace(/\t/g, ' ').trim();

  if (/^\d{4}$/.test(avant1)) return { nom: avant2, annee: avant1 };

  const colle = avant1.match(/^(.+?)\s+(\d{4})$/);
  if (colle) return { nom: colle[1].trim(), annee: colle[2] };

  return { nom: avant1, annee: '' };
}

/** Lecture structurée d'un bloc du tableau Ten'Up.
 *  Rend `null` si le bloc n'a pas la forme attendue — l'appelant bascule
 *  alors sur le mode dégradé plutôt que d'inventer. */
function lireTableau(bloc) {
  const iIssue = bloc.findIndex(l => MOTIF_ISSUE.test(l.replace(/\t/g, ' ').trim()));
  if (iIssue < 2) return null;

  const brutIssue = bloc[iIssue].replace(/\t/g, ' ').trim();
  const mIssue = brutIssue.match(MOTIF_ISSUE);
  const issue = mIssue[1].toUpperCase();
  const wo = /w\.?\s*o\.?/i.test(brutIssue);

  const echelonAdverse = bloc[iIssue - 1].replace(/\t/g, ' ').trim();
  if (!ECHELONS.includes(echelonAdverse)) return null;

  const { nom, annee } = lireNomEtAnnee(bloc, iIssue - 1);

  /* La dernière ligne porte la compétition, le coefficient, la date et le
     mois de péremption, séparés par des tabulations. */
  const derniere = bloc[bloc.length - 1];
  const md = derniere.match(MOTIF_DATE);
  if (!md) return null;
  const date = versISO(md);
  const tournoi = derniere.split('\t')[0].trim();

  /* Entre l'issue et la ligne de compétition : le score, un jeu par ligne,
     parfois suivi d'un tiret et d'« Abandon ». */
  const score = bloc.slice(iIssue + 1, bloc.length - 1)
    .map(l => l.replace(/\t/g, ' ').trim())
    .filter(l => l && l !== '-')
    .join(' ')
    .trim();

  return {
    date, issue, adversaire: nom, echelonAdverse,
    score: score || (wo ? 'WO' : ''),
    tournoi, annee, wo,
    confiance: nom ? 'sur' : 'verifier',
    brut: bloc.join(' · ').slice(0, 160),
  };
}

/** Le nom de l'adversaire en mode dégradé : un patronyme en capitales,
 *  éventuellement suivi d'un prénom. Les mots reliés par une seule espace,
 *  et le nom de tournoi élagué en tête comme en queue. */
function trouverNom(texte) {
  const candidats = texte.match(
    /\b[A-ZÀ-ÜŒ][A-ZÀ-ÜŒ'’-]{1,}(?: [A-ZÀ-ÜŒ][A-Za-zà-üœ'’-]+){0,3}/g) || [];

  const elaguer = (c) => {
    const mots = c.trim().split(' ');
    while (mots.length && BRUIT.has(mots[mots.length - 1].toUpperCase())) mots.pop();
    while (mots.length && BRUIT.has(mots[0].toUpperCase())) mots.shift();
    return mots.join(' ');
  };

  const propres = candidats.map(elaguer).filter(c => c.length > 2);
  if (!propres.length) return '';
  return propres.sort((a, b) => b.length - a.length)[0];
}

/** Mode dégradé : tout le match sur une ligne, ou une forme inconnue.
 *  Ici on devine, et l'aperçu sert de garde-fou. */
function lireLibre(bloc) {
  let reste = bloc.join(' ').replace(/\t/g, ' ');

  const md = reste.match(MOTIF_DATE);
  if (!md) return null;
  const date = versISO(md);
  reste = reste.replace(md[0], ' ');

  let score = '';
  const ms = reste.match(MOTIF_SCORE_LONG);
  if (ms) { score = ms[0].replace(/\s*([/-])\s*/g, '$1'); reste = reste.replace(ms[0], ' '); }
  else if (MOTIF_ABANDON.test(reste)) { score = 'WO'; }

  let echelonAdverse = '';
  const parenthese = reste.match(/\(([^)]{1,6})\)/);
  if (parenthese && ECHELONS.includes(parenthese[1].trim())) {
    echelonAdverse = parenthese[1].trim();
    reste = reste.replace(parenthese[0], ' ');
  } else {
    const me = reste.match(MOTIF_ECHELON);
    if (me) { echelonAdverse = me[1]; reste = reste.replace(me[0], ' '); }
  }

  // « battu par » contient « bat » : la défaite se teste en premier.
  let issue = '';
  const texte = bloc.join(' ');
  if (MOTS_DEFAITE.test(texte)) issue = 'D';
  else if (MOTS_VICTOIRE.test(texte)) issue = 'V';

  const adversaire = trouverNom(reste);

  let tournoi = reste
    .replace(new RegExp(adversaire.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), ' ')
    .replace(/\b(victoires?|d[ée]faites?|gagn[ée]e?s?|perdus?|vainqueur|battus?|vaincus?)\b/gi, ' ')
    .replace(/\s{2,}/g, ' ').replace(/^[\s,;·|-]+|[\s,;·|-]+$/g, '')
    .slice(0, 80);
  if (/^(par|contre|de|du|des|la|le|les|à|a)$/i.test(tournoi)) tournoi = '';

  const sur = !!(date && issue && echelonAdverse && adversaire);
  return {
    date, issue: issue || 'V', adversaire, echelonAdverse, score, tournoi,
    annee: '', wo: score === 'WO',
    confiance: sur ? 'sur' : 'verifier',
    brut: texte.slice(0, 160),
  };
}

/**
 * Relit un bloc collé et rend une ligne par match compris.
 * Chaque ligne porte sa `confiance` : « sûr » quand tout a été identifié
 * sans deviner, « à vérifier » sinon. L'écran d'import s'en sert pour
 * attirer l'œil là où il faut.
 */
export function analyser(texte) {
  const resultats = [];
  const ignores = [];

  for (const bloc of decouper(normaliser(texte))) {
    const lu = lireTableau(bloc) || lireLibre(bloc);
    if (lu) resultats.push(lu);
    else ignores.push(bloc.join(' ').slice(0, 120));
  }

  return { resultats, ignores };
}

/** Le texte d'exemple montré dans l'écran d'import. */
export const EXEMPLE = `Alexandre MOREL
1970
15/2
D
6/3
Tournoi du CASINO de Mers les Bains	1	11/08/2026	août 2027`;
