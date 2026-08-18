/* Le classement FFT : échelons, barème, seuils, bilan et simulateur.

   Tout ce qui touche aux règles de la fédération est rassemblé ici, et
   nulle part ailleurs : ces règles bougent — la 5ᵉ série est née le
   1ᵉʳ juillet 2025 — et il faut pouvoir corriger un seul fichier.

   ─── Ce modèle a été vérifié contre les chiffres officiels ───────────

   Il ne repose pas sur des sources de seconde main. Il a été confronté à
   la page « Bilan de classement » de Ten'Up d'un joueur réel classé 15,
   sur ses 28 matchs de la période, et il reproduit **les trois bilans
   officiels au point près** :

       bilan à 15  → 120+120+60+60+60+30+30+30+30+30+20 = 590 (+20) = 610 ✓
       bilan à 5/6 → 90+90+30+30+30+20+20+20+20+20      = 370 (+20) = 390 ✓
       bilan à 4/6 → 60+60+20+20+20+15+15+15+15         = 240 (+20) = 260 ✓

   Trois enseignements en découlent, dont deux contredisent ce qu'on lit
   partout ailleurs :

   • **Il n'y a pas de « capital de départ ».** Le bilan est la somme des
     meilleures victoires, plus les bonus. Rien d'autre. On peut donc le
     calculer entièrement depuis l'historique, sans rien demander.

   • **Le bilan se calcule échelon par échelon.** Les points d'une victoire
     dépendent de l'échelon *visé*, pas de celui qu'on a. Battre un 4/6
     vaut 120 quand on se juge à 15, mais seulement 60 quand on se juge à
     4/6. C'est là toute la difficulté de monter, et c'est ce que les
     simulateurs naïfs ratent.

   • **La victoire à trois échelons d'écart vaut 15 points**, pas 10 :
     observé directement (une victoire sur 15/1 comptée 15 points au bilan
     à 4/6). Les deux sources publiques se contredisaient sur ce point. */

/* Du plus faible au plus fort. L'ordre est la seule chose qui compte :
   tout le barème se calcule sur des écarts de position dans cette liste. */
export const ECHELONS = [
  'NC', '40/2', '40/1', '40',
  '30/5', '30/4', '30/3', '30/2', '30/1', '30',
  '15/5', '15/4', '15/3', '15/2', '15/1', '15',
  '5/6', '4/6', '3/6', '2/6', '1/6', '0',
  '-2/6', '-4/6', '-15',
];

export const rang = e => ECHELONS.indexOf(e);
export const estValide = e => rang(e) >= 0;

/** L'échelon juste au-dessus, ou null tout en haut de l'échelle. */
export function echelonSuivant(e) {
  const i = rang(e);
  return i >= 0 && i < ECHELONS.length - 1 ? ECHELONS[i + 1] : null;
}

/* Barème, indexé par l'écart « adversaire − échelon visé ». Les six
   valeurs ont été vérifiées une à une sur des bilans officiels. */
export const BAREME_DEFAUT = {
  '2': 120,   // adversaire 2 échelons au-dessus ou plus
  '1': 90,
  '0': 60,    // même échelon
  '-1': 30,
  '-2': 20,
  '-3': 15,
  '-4': 0,    // 4 échelons en dessous ou plus : rien
};

/**
 * Points d'une victoire, **relativement à l'échelon que l'on cherche à
 * valider** — et non à celui que l'on porte aujourd'hui. C'est le point
 * de bascule du calcul : le même match ne vaut pas la même chose selon
 * l'échelon auquel on se juge.
 */
export function pointsVictoire(echelonVise, echelonAdverse, bareme = BAREME_DEFAUT) {
  if (!estValide(echelonVise) || !estValide(echelonAdverse)) return 0;
  const diff = rang(echelonAdverse) - rang(echelonVise);
  return bareme[String(Math.max(-4, Math.min(2, diff)))] ?? 0;
}

/* Bilan minimum et nombre de victoires exigés pour valider chaque
   échelon. Les trois valeurs recoupées avec Ten'Up (15 → 420, 5/6 → 435,
   4/6 → 435) sont exactes : le doublon 435/435, qui ressemblait à une
   coquille de la source, n'en est pas une. */
export const SEUILS = {
  '40':   { h: null, hv: 6,  f: null, fv: 6 },
  '30/5': { h: 6,    hv: 6,  f: 6,    fv: 6 },
  '30/4': { h: 70,   hv: 6,  f: 70,   fv: 6 },
  '30/3': { h: 120,  hv: 6,  f: 120,  fv: 6 },
  '30/2': { h: 170,  hv: 6,  f: 170,  fv: 6 },
  '30/1': { h: 210,  hv: 6,  f: 210,  fv: 6 },
  '30':   { h: 285,  hv: 8,  f: 265,  fv: 8 },
  '15/5': { h: 305,  hv: 8,  f: 295,  fv: 8 },
  '15/4': { h: 315,  hv: 8,  f: 305,  fv: 8 },
  '15/3': { h: 325,  hv: 8,  f: 305,  fv: 8 },
  '15/2': { h: 335,  hv: 8,  f: 325,  fv: 8 },
  '15/1': { h: 360,  hv: 8,  f: 345,  fv: 8 },
  '15':   { h: 420,  hv: 9,  f: 385,  fv: 9 },   // vérifié
  '5/6':  { h: 435,  hv: 9,  f: 395,  fv: 9 },   // vérifié
  '4/6':  { h: 435,  hv: 9,  f: 430,  fv: 9 },   // vérifié
  '3/6':  { h: 475,  hv: 10, f: 500,  fv: 10 },
  '2/6':  { h: 505,  hv: 10, f: 560,  fv: 11 },
  '1/6':  { h: 550,  hv: 11, f: 610,  fv: 12 },
  '0':    { h: 610,  hv: 12, f: 630,  fv: 14 },
  '-2/6': { h: 765,  hv: 15, f: 760,  fv: 15 },
  '-4/6': { h: 865,  hv: 17, f: 740,  fv: 16 },
  '-15':  { h: 930,  hv: 19, f: 780,  fv: 17 },
};

/** Ce qu'il faut atteindre pour valider cet échelon.
 *  `points: null` signifie qu'aucun seuil n'est publié. */
export function seuil(echelon, sexe = 'h') {
  const s = SEUILS[echelon];
  if (!s) return null;
  return sexe === 'f'
    ? { points: s.f, victoires: s.fv }
    : { points: s.h, victoires: s.hv };
}

/* ─── Le bonus de victoires, et pourquoi il reste saisi à la main ─────

   Le nombre de victoires retenues n'est pas fixe : la fédération en
   ajoute ou en retire selon un paramètre nommé V-E-2I-5G, qui mesure la
   qualité d'ensemble du palmarès. Le document officiel en publie les
   seuils, reproduits ici pour mémoire (2ᵉ série positive, celle qui va
   de 15 à 0) :

       de -20 à -0,1 →  0        de 15 à 22,9 → +3
       de   0 à  7,9 → +1        de 23 à 29,9 → +4
       de   8 à 14,9 → +2        de 30 à 39,9 → +5
                                 40 et plus   → +6

   Ce qui n'est pas publié, c'est la définition exacte des termes : la
   pondération des défaites par le coefficient du match, et le traitement
   des W.O. Les décimales des seuils trahissent d'ailleurs des poids
   fractionnaires. Sur le cas mesuré, une lecture naïve retombe bien sur
   le +2 observé à l'échelon 15, mais pas sur le +1 observé à 5/6.

   Reconstituer la formule à partir de deux points d'observation
   produirait un chiffre faux avec l'assurance d'un chiffre juste. Le
   bonus reste donc saisi — il se lit sur Ten'Up — et vaut zéro par
   défaut, ce qui rend le calcul pessimiste plutôt que trompeur. */

/**
 * La limitation de montée : « pour pouvoir prétendre monter à un échelon
 * (sauf pour l'échelon 40), il est impératif d'avoir battu un joueur déjà
 * classé à cet échelon (hors WO). »
 *
 * Règle officielle, et souvent la vraie raison d'un blocage : on a les
 * points, mais pas le scalp. Un simulateur qui l'ignore annonce des
 * montées qui n'arriveront pas.
 */
export function monteeAutorisee(matchs, cible, finISO = null) {
  if (cible === '40') return { requise: false, satisfaite: true };
  const preuve = matchs.find(m =>
    m.issue === 'V' && !m.wo && m.echelonAdverse === cible && dansLaFenetre(m.date, finISO));
  return { requise: true, satisfaite: !!preuve, preuve: preuve || null };
}

// =====================================================================
//  La fenêtre de calcul
// =====================================================================
/* La fédération calcule sur les douze mois qui précèdent le traitement.
   Sur le cas vérifié, la fenêtre annoncée allait du 04/08/2025 au
   02/08/2026 : douze mois glissants, à quelques jours près. On retient
   douze mois pleins, ce qui donne le même compte de matchs. */
export function dansLaFenetre(dateISO, finISO = null) {
  if (!dateISO) return false;
  const fin = finISO ? new Date(finISO + 'T12:00:00') : new Date();
  const debut = new Date(fin);
  debut.setFullYear(debut.getFullYear() - 1);
  const d = new Date(dateISO + 'T12:00:00');
  return !isNaN(d) && d >= debut && d <= fin;
}

// =====================================================================
//  Le bilan
// =====================================================================
/**
 * Le bilan à un échelon donné, calculé exactement comme la fédération :
 * on note chaque victoire selon l'échelon visé, on garde les meilleures
 * dans la limite du quota, on ajoute les bonus.
 *
 * @param {object} p
 * @param {Array}  p.matchs         l'historique complet
 * @param {string} p.cible          l'échelon que l'on cherche à valider
 * @param {string} [p.sexe]
 * @param {object} [p.bareme]
 * @param {number} [p.bonusVictoires] le « +2 » de « 9+2 » sur Ten'Up :
 *        victoires supplémentaires accordées au ratio victoires/défaites.
 *        Il varie selon l'échelon visé et sa formule n'est pas publiée —
 *        d'où la saisie manuelle, à 0 par défaut (donc pessimiste).
 * @param {number} [p.bonusPoints]  bonus en points (double, etc.).
 */
export function bilanA({ matchs = [], cible, sexe = 'h', bareme = BAREME_DEFAUT,
                         bonusVictoires = 0, bonusPoints = 0, finISO = null }) {
  const s = seuil(cible, sexe);
  const quota = (s?.victoires ?? 8) + bonusVictoires;

  const fenetre = matchs.filter(m => dansLaFenetre(m.date, finISO));
  const victoires = fenetre.filter(m => m.issue === 'V');
  const defaites = fenetre.filter(m => m.issue === 'D');

  const notees = victoires
    .map(m => ({ match: m, points: pointsVictoire(cible, m.echelonAdverse, bareme) }))
    .sort((a, b) => b.points - a.points);

  const retenues = notees.slice(0, quota);
  const points = retenues.reduce((t, x) => t + x.points, 0);

  return {
    cible,
    bilan: points + bonusPoints,
    points,
    bonusPoints,
    quota,
    retenues,
    ecartees: notees.slice(quota),
    nbMatchs: fenetre.length,
    nbVictoires: victoires.length,
    nbDefaites: defaites.length,
    seuil: s,
  };
}

// =====================================================================
//  Le simulateur
// =====================================================================
/* La question n'est pas « quel est mon bilan » mais « qu'est-ce qu'il me
   reste à faire ». On répond en scénarios — une victoire à 15, ou deux à
   15/1 — et non en points. */

/** Les adversaires qu'il est réaliste de rencontrer, exprimés autour de
 *  l'échelon visé : au-delà de trois crans en dessous, une victoire ne
 *  rapporte plus rien, et au-dessus le barème plafonne. */
function adversairesPlausibles(cible) {
  const i = rang(cible);
  const out = [];
  for (let d = 2; d >= -3; d--) {
    const e = ECHELONS[i + d];
    if (e) out.push(e);
  }
  return out;
}

/** Ce que rapporte vraiment l'ajout de victoires, une fois le jeu des
 *  remplacements appliqué : au-delà du quota, une victoire de plus ne
 *  s'ajoute pas, elle remplace la moins bonne. */
function gainDe(nouvellesPoints, base) {
  const avant = base.retenues.reduce((t, x) => t + x.points, 0);
  const toutes = [...base.retenues.map(x => x.points),
                  ...base.ecartees.map(x => x.points),
                  ...nouvellesPoints].sort((a, b) => b - a);
  const apres = toutes.slice(0, base.quota).reduce((t, p) => t + p, 0);
  return apres - avant;
}

/* Une victoire contre plus fort que soi se va chercher plus difficilement.
   Deux scénarios de même longueur ne se valent donc pas. */
function difficulte(cible, adversaire) {
  const d = rang(adversaire) - rang(cible);
  return d >= 2 ? 5 : d === 1 ? 3 : d === 0 ? 2 : 1;
}

/**
 * Les chemins possibles vers l'échelon visé.
 * @returns {{cible, bilan, manque, matchsManquants, atteint, scenarios}}
 */
export function simuler({ matchs = [], echelon, cible, sexe = 'h',
                          bareme = BAREME_DEFAUT, bonusVictoires = 0, bonusPoints = 0,
                          finISO = null }) {
  const visee = cible || echelonSuivant(echelon);
  if (!visee) return { erreur: 'Pas d\'échelon au-dessus.' };

  const base = bilanA({ matchs, cible: visee, sexe, bareme, bonusVictoires, bonusPoints, finISO });
  if (!base.seuil || base.seuil.points == null) {
    return { erreur: `Aucun seuil publié pour ${visee}.`, cible: visee };
  }

  const manque = Math.max(0, base.seuil.points - base.bilan);
  const matchsManquants = Math.max(0, base.seuil.victoires - base.nbVictoires);
  /* La victoire qui lève la limitation de montée expire comme les autres :
     se projeter en novembre sans la faire expirer aussi annoncerait une
     montée déjà autorisée qui ne le sera plus. */
  const montee = monteeAutorisee(matchs, visee, finISO);

  if (manque === 0) {
    return {
      ...base, manque: 0, matchsManquants, montee,
      atteint: matchsManquants === 0 && montee.satisfaite,
      scenarios: [],
    };
  }

  const scenarios = [];
  const advs = adversairesPlausibles(visee);

  // Les chemins purs : n victoires contre le même niveau.
  for (const adv of advs) {
    const p = pointsVictoire(visee, adv, bareme);
    if (p <= 0) continue;
    for (let n = 1; n <= 8; n++) {
      const gain = gainDe(Array(n).fill(p), base);
      if (gain >= manque) {
        scenarios.push({
          parts: [{ echelon: adv, n, points: p }],
          matchs: n, gain, cout: n * difficulte(visee, adv),
        });
        break;
      }
    }
  }

  /* Les chemins mixtes : une victoire de prestige complétée par des
     victoires plus accessibles. Souvent le scénario le plus réaliste, et
     celui auquel on ne pense pas seul. */
  for (const fort of advs) {
    const pf = pointsVictoire(visee, fort, bareme);
    if (pf <= 0 || gainDe([pf], base) >= manque) continue;
    for (const appoint of advs) {
      const pa = pointsVictoire(visee, appoint, bareme);
      if (appoint === fort || pa <= 0 || pa >= pf) continue;
      for (let n = 1; n <= 4; n++) {
        const gain = gainDe([pf, ...Array(n).fill(pa)], base);
        if (gain >= manque) {
          scenarios.push({
            parts: [{ echelon: fort, n: 1, points: pf },
                    { echelon: appoint, n, points: pa }],
            matchs: 1 + n, gain,
            cout: difficulte(visee, fort) + n * difficulte(visee, appoint),
          });
          break;
        }
      }
    }
  }

  /* Tant que la limitation de montée n'est pas levée, un scénario qui ne
     passe pas par une victoire contre un joueur de l'échelon visé ne mène
     nulle part, quels que soient les points. On les écarte plutôt que de
     faire miroiter une montée impossible. */
  const valables = montee.satisfaite
    ? scenarios
    : scenarios.filter(s => s.parts.some(p => p.echelon === visee));

  valables.sort((a, b) => a.matchs - b.matchs || a.cout - b.cout);
  const vus = new Set();
  const retenus = valables.filter(s => {
    const cle = s.parts.map(p => `${p.n}×${p.echelon}`).join('+');
    if (vus.has(cle)) return false;
    vus.add(cle);
    return true;
  }).slice(0, 8);

  return { ...base, manque, matchsManquants, montee, atteint: false, scenarios: retenus };
}

// =====================================================================
//  Le temps qui passe
// =====================================================================
/* Le bilan glisse sur douze mois : une victoire finit toujours par sortir
   de la fenêtre, et le bilan baisse tout seul si l'on ne rejoue pas. C'est
   l'information qui manque partout — on sait ce qu'il faut faire, jamais
   avant quand. Une victoire à 120 points qui expire dans six semaines
   transforme un écart de 35 points en écart de 155.

   On projette donc le bilan mois par mois, à résultats constants, en
   déplaçant la fin de la fenêtre. */

/** Le dernier jour du mois, `n` mois après aujourd'hui. */
function finDeMois(n) {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + n + 1);
  d.setDate(0);
  return d.toISOString().slice(0, 10);
}

const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin',
              'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

/**
 * Le mois calendaire situé n mois devant, nommé et daté.
 *
 * On se projette toujours à la **fin** du mois, parce que c'est la
 * question qu'on se pose : « où j'en serai en novembre », et non « où j'en
 * serai le 3 novembre ». La fin du mois est aussi le pire cas — toutes les
 * expirations du mois ont eu lieu — et il vaut mieux se tromper dans ce
 * sens-là.
 *
 * @returns {{fin: string, mois: string, libelle: string}}
 */
export function moisAVenir(n) {
  const fin = finDeMois(n);
  const d = new Date(fin + 'T12:00:00');
  return {
    fin,
    mois: MOIS[d.getMonth()],
    libelle: `${MOIS[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`,
  };
}

/**
 * Ce que devient le bilan si l'on ne joue plus, mois par mois.
 * @returns {Array<{fin, libelle, bilan, manque, sortants}>}
 */
/**
 * L'échelon qu'on tiendrait à une date donnée, et non celui qu'on porte.
 *
 * Il ne se lit pas sur un seul bilan : les points d'une victoire dépendent
 * de l'échelon visé, si bien qu'il faut recalculer le bilan à chaque
 * échelon candidat et prendre le plus haut qui passe. C'est exactement ce
 * que fait la fédération, et c'est ce qui rend une descente lisible —
 * perdre soixante points peut ne rien coûter, ou coûter deux échelons.
 *
 * On ne balaie pas toute l'échelle : cinq crans sous l'échelon de départ
 * et trois au-dessus suffisent, et évitent vingt-quatre calculs de bilan
 * par mois projeté.
 *
 * @returns {{echelon: string, bilan: number}|null}
 */
export function echelonTenu({ matchs = [], depuis, sexe = 'h', bareme = BAREME_DEFAUT,
                              bonusPoints = 0, finISO = null }) {
  const i = rang(depuis);
  if (i < 0) return null;
  const haut = Math.min(ECHELONS.length - 1, i + 3);
  const bas = Math.max(0, i - 8);

  for (let n = haut; n >= bas; n--) {
    const e = ECHELONS[n];
    const s = seuil(e, sexe);
    if (!s || s.points == null) continue;
    const b = bilanA({ matchs, cible: e, sexe, bareme, bonusPoints, finISO });
    if (b.bilan >= s.points && b.nbVictoires >= s.victoires) {
      return { echelon: e, bilan: b.bilan };
    }
  }
  /* Sous le plus bas seuil examiné. Rendre l'échelon plancher laisserait
     croire qu'on le tient encore : on rend null, et l'appelant dit
     « au-dessous » plutôt que d'inventer un chiffre. */
  return null;
}

export function projeter({ matchs = [], cible, sexe = 'h', bareme = BAREME_DEFAUT,
                           bonusVictoires = 0, bonusPoints = 0, debut = 0, mois = 12,
                           depuis = null }) {
  const s = seuil(cible, sexe);
  const etapes = [];
  let precedentes = null;

  /* L'échelon réellement porté, et depuis combien de mois on n'a pas
     descendu. La projection marche dans le temps : chaque mois dépend de
     ce que les précédents ont autorisé, et non du seul bilan du jour. */
  let porte = depuis || cible;
  let depuisDescente = 12;   // au départ, rien n'interdit de descendre

  for (let n = debut; n <= mois; n++) {
    const fin = finDeMois(n);
    const b = bilanA({ matchs, cible, sexe, bareme, bonusVictoires, bonusPoints, finISO: fin });

    /* Ce qui sort n'est pas « ce qui quitte la fenêtre » mais « ce qui
       cessera de compter » : une victoire hors quota qui expire ne change
       rien au bilan et n'a pas à être annoncée. */
    const idsMaintenant = new Set(b.retenues.map(x => x.match.id));
    const sortants = precedentes
      ? precedentes.filter(x => !idsMaintenant.has(x.match.id))
      : [];
    precedentes = b.retenues;

    const d = new Date(fin + 'T12:00:00');
    /* L'échelon tenu ne se calcule que si l'appelant dit d'où l'on part :
       c'est neuf calculs de bilan par mois, qu'on ne fait pas pour rien. */
    const brut = depuis
      ? echelonTenu({ matchs, depuis, sexe, bareme, bonusPoints, finISO: fin })
      : null;

    /* ─── La descente est bridée par le règlement ───────────────────────
       « Tout licencié classé, qu'il ait ou non participé à des
       compétitions homologuées, ne peut pas descendre de 2 échelons
       consécutifs en moins de 12 mois. »

       Sans cette règle, la projection faisait plonger de trois ou quatre
       échelons en un an — ce qui n'arrive jamais, et faisait dire au
       graphique une chose fausse avec l'aplomb d'un calcul.

       La limitation saute dès qu'on remonte : celui qui regagne son
       échelon peut le reperdre sans attendre douze mois. */
    let tenu = null;
    if (depuis) {
      /* Un bilan sous le plus bas seuil examiné rend null. Ce n'est pas
         « plus de classement » : c'est « très en dessous », et la règle
         des douze mois s'y applique comme ailleurs — on descend d'un cran,
         pas dans le vide. */
      const rCourant = rang(porte);
      const rNaturel = brut?.echelon ? rang(brut.echelon) : -1;

      if (rNaturel > rCourant) {
        porte = brut.echelon;          // une montée lève la limitation
        depuisDescente = 0;
      } else if (rNaturel < rCourant && depuisDescente >= 12) {
        porte = ECHELONS[Math.max(0, rCourant - 1)];   // un seul cran
        depuisDescente = 0;
      }
      tenu = { echelon: porte, bilan: brut?.bilan ?? null,
               naturel: brut?.echelon || 'sous le plancher examiné' };
    }
    depuisDescente++;

    etapes.push({
      fin,
      libelle: `${MOIS[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`,
      bilan: b.bilan,
      manque: s?.points != null ? Math.max(0, s.points - b.bilan) : null,
      futur: n > 0,
      sortants,
      echelon: tenu?.echelon || null,
      /* L'échelon que le seul bilan donnerait, sans la limitation : c'est
         lui qui dit à quel point on est descendu « en dessous de sa
         protection », et donc ce qui tombera dès qu'elle sautera. */
      echelonNaturel: tenu?.naturel || null,
      nbVictoires: b.nbVictoires,
    });
  }
  return etapes;
}

/** Le premier mois où l'écart se creuse : la date avant laquelle il faut
 *  avoir agi, si l'on ne veut pas voir la marche monter. */
export function echeance(etapes) {
  const depart = etapes[0]?.manque;
  if (depart == null) return null;
  for (let i = 1; i < etapes.length; i++) {
    if (etapes[i].manque > depart) {
      return { avant: etapes[i - 1], apres: etapes[i], surcout: etapes[i].manque - depart };
    }
  }
  return null;
}

/** Ce que rapporterait une victoire à chaque échelon, une fois les
 *  remplacements appliqués. Sert à montrer aussi ce qui ne rapporte
 *  **rien** : c'est contre-intuitif, et c'est la première chose à savoir
 *  avant de s'inscrire à un tournoi. */
export function rendementParEchelon({ matchs = [], cible, sexe = 'h',
                                      bareme = BAREME_DEFAUT, bonusVictoires = 0,
                                      bonusPoints = 0, finISO = null }) {
  const base = bilanA({ matchs, cible, sexe, bareme, bonusVictoires, bonusPoints, finISO });
  return adversairesPlausibles(cible).map(adv => {
    const p = pointsVictoire(cible, adv, bareme);
    const avant = base.retenues.reduce((t, x) => t + x.points, 0);
    const toutes = [...base.retenues.map(x => x.points),
                    ...base.ecartees.map(x => x.points), p].sort((a, b) => b - a);
    const apres = toutes.slice(0, base.quota).reduce((t, x) => t + x, 0);
    return { echelon: adv, bareme: p, gain: apres - avant };
  });
}

/** Formule un scénario en français : « 2 victoires à 15/1 ». */
export function direScenario(sc) {
  return sc.parts
    .map(p => `${p.n} victoire${p.n > 1 ? 's' : ''} à ${p.echelon}`)
    .join(' + ');
}
