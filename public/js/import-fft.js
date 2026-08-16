/* Récupérer son historique depuis le site de la fédération.

   Ce qu'il faut savoir avant de lire ce fichier : il n'existe aucun moyen
   d'aller chercher ces matchs tout seul. Ten'Up demande une connexion,
   n'offre aucune interface publique, et un site comme celui-ci n'a de
   toute façon pas le droit d'interroger un autre domaine depuis le
   navigateur. Toute promesse d'import « automatique » serait mensongère.

   Ce qui marche, en revanche : ouvrir son palmarès sur Ten'Up, tout
   sélectionner, copier, et coller ici. Ce fichier se charge de relire ce
   bloc de texte. Il ne devine jamais en silence — chaque ligne comprise
   est présentée pour relecture et correction avant d'entrer dans le
   carnet, parce qu'un historique faux vaut moins que pas d'historique. */

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

/* Un jeu de set : « 6/4 », « 7/6(5) », « 6-4 ».

   Les deux nombres sont bornés à un seul chiffre, et c'est ce qui sauve
   l'analyse : sans cette borne, un classement laissé seul sur sa ligne
   — « 30/1 » juste avant « 6/0 6/2 » — se fait avaler par le score et
   l'adversaire se retrouve sans classement. Un jeu ne dépasse jamais 7. */
const GROUPE = '(?<![\\d/])[0-7]\\s*[/-]\\s*[0-7](?:\\s*\\(\\d{1,2}\\))?(?![\\d/])';
const MOTIF_SCORE_LONG = new RegExp(`${GROUPE}(?:\\s+${GROUPE}){1,4}`);
const MOTIF_ABANDON = /\b(w\.?o\.?|abandon|forfait|ab\.)\b/i;

const MOTS_VICTOIRE = /\b(victoire|gagn[ée]|vainqueur|bat\b|v\b)/i;
const MOTS_DEFAITE  = /\b(d[ée]faite|perdu|battu|vaincu|d\b)/i;

/* Ce qui n'est jamais un nom d'adversaire, même écrit en majuscules. */
const BRUIT = new Set([
  'VICTOIRE', 'DEFAITE', 'DÉFAITE', 'TOURNOI', 'CHAMPIONNAT', 'MATCH', 'SIMPLE',
  'DOUBLE', 'MESSIEURS', 'DAMES', 'SENIORS', 'CLASSEMENT', 'WO', 'ABANDON',
  'FORFAIT', 'POULE', 'FINALE', 'DEMI', 'QUART', 'TABLEAU', 'NC', 'TC', 'AS',
  'OPEN', 'COUPE', 'TROPHEE', 'TROPHÉE', 'INTERNE', 'EQUIPES', 'ÉQUIPES',
  'GRAND', 'PRIX', 'CRITERIUM', 'CRITÉRIUM', 'RENCONTRE', 'CLUB',
]);

/** Normalise une date trouvée vers la forme ISO. */
function versISO(m) {
  if (m[4]) return `${m[4]}-${m[5]}-${m[6]}`;          // déjà en ISO
  return `${m[3]}-${m[2]}-${m[1]}`;                    // jj/mm/aaaa
}

/** Découpe le bloc collé en enregistrements : un match commence à chaque
 *  date rencontrée, et emporte tout ce qui suit jusqu'à la date d'après.
 *  Ten'Up présente parfois un match sur une ligne, parfois sur cinq ; ce
 *  découpage-là supporte les deux. */
function decouper(texte) {
  const lignes = texte
    .replace(/\r/g, '')
    .replace(/\t/g, ' ')
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean);

  const blocs = [];
  let courant = null;
  for (const ligne of lignes) {
    if (MOTIF_DATE.test(ligne)) {
      if (courant) blocs.push(courant);
      courant = [ligne];
    } else if (courant) {
      courant.push(ligne);
    }
    // Avant la première date, on est dans les en-têtes du site : on jette.
  }
  if (courant) blocs.push(courant);
  return blocs.map(b => b.join(' '));
}

/** Le nom de l'adversaire : un patronyme en capitales, éventuellement
 *  suivi d'un prénom, ce qui est la façon dont la fédération les écrit.
 *
 *  Deux précautions. Les mots ne sont reliés que par une espace simple :
 *  une colonne suivante, séparée par plusieurs espaces, n'est pas la suite
 *  du nom. Et le nom du tournoi, souvent capitalisé lui aussi, est retiré
 *  en tête comme en queue. À défaut de certitude on rend une chaîne vide,
 *  qui sera visible dans l'aperçu — mieux qu'un nom inventé. */
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

/**
 * Relit un bloc collé et rend une ligne par match compris.
 * Chaque ligne porte sa `confiance` : « sûr » quand la date, l'issue et le
 * classement adverse ont été trouvés, « à vérifier » sinon. L'écran
 * d'import s'en sert pour attirer l'œil là où il faut.
 */
export function analyser(texte) {
  const resultats = [];
  const ignores = [];

  for (const bloc of decouper(texte)) {
    let reste = bloc;

    const md = reste.match(MOTIF_DATE);
    if (!md) { ignores.push(bloc); continue; }
    const date = versISO(md);
    reste = reste.replace(md[0], ' ');

    /* Le score en premier, pour qu'il cesse de brouiller la lecture : sans
       ça, le « 4/6 » d'un set perdu se ferait passer pour un classement. */
    let score = '';
    const ms = reste.match(MOTIF_SCORE_LONG);
    if (ms) { score = ms[0].replace(/\s*([/-])\s*/g, '$1'); reste = reste.replace(ms[0], ' '); }
    else if (MOTIF_ABANDON.test(reste)) { score = 'WO'; }

    /* Un classement entre parenthèses, écrit juste après le nom, est le
       signal le plus fiable. On le cherche donc avant le reste. */
    let echelonAdverse = '';
    const parenthese = reste.match(/\(([^)]{1,6})\)/);
    if (parenthese && ECHELONS.includes(parenthese[1].trim())) {
      echelonAdverse = parenthese[1].trim();
      reste = reste.replace(parenthese[0], ' ');
    } else {
      const me = reste.match(MOTIF_ECHELON);
      if (me) { echelonAdverse = me[1]; reste = reste.replace(me[0], ' '); }
    }

    /* L'issue. « battu par » est une défaite alors qu'il contient « bat » :
       on teste donc la défaite en premier. */
    let issue = '';
    if (MOTS_DEFAITE.test(bloc)) issue = 'D';
    else if (MOTS_VICTOIRE.test(bloc)) issue = 'V';

    const adversaire = trouverNom(reste);

    /* Ce qui traîne encore après tous les retraits est le contexte : le nom
       du tournoi, le club, le tour. Les mots d'issue reviennent souvent en
       double (« Défaite … battu par ») : on les retire tous, pas seulement
       le premier. Ce qui se réduit à une préposition orpheline ne veut plus
       rien dire et vaut mieux vide. */
    let tournoi = reste
      .replace(new RegExp(adversaire.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), ' ')
      .replace(/\b(victoires?|d[ée]faites?|gagn[ée]e?s?|perdus?|vainqueur|battus?|vaincus?)\b/gi, ' ')
      .replace(/\s{2,}/g, ' ').replace(/^[\s,;·|-]+|[\s,;·|-]+$/g, '')
      .slice(0, 80);
    if (/^(par|contre|de|du|des|la|le|les|à|a)$/i.test(tournoi)) tournoi = '';

    const sur = !!(date && issue && echelonAdverse);
    resultats.push({
      date, issue: issue || 'V', adversaire, echelonAdverse, score,
      tournoi, wo: score === 'WO',
      confiance: sur ? 'sur' : 'verifier',
      brut: bloc.slice(0, 160),
    });
  }

  return { resultats, ignores };
}

/** Le texte d'exemple montré dans l'écran d'import : il vaut mieux qu'un
 *  paragraphe d'explications pour faire comprendre ce qu'on attend. */
export const EXEMPLE = `12/05/2025 Victoire DUPONT Jean (15/2) 6/4 6/3 Tournoi de Saint-Cloud
28/04/2025 Défaite MARTIN Paul (15/1) 4/6 6/7(4) Open du Printemps
15/03/2025 Victoire BERNARD Luc (30) 6/2 6/1 Championnat par équipes`;
