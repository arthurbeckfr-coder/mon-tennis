/* Le classement FFT : échelons, barème des victoires, seuils, simulateur.

   Tout ce qui touche aux règles de la fédération est rassemblé ici, et
   nulle part ailleurs. La raison est simple : ces règles changent (la 5e
   série est née le 1er juillet 2025), et le jour où elles bougeront il
   faudra pouvoir corriger un seul fichier sans relire l'application.

   Ce qui est vérifié et ce qui ne l'est pas — à lire avant de faire
   confiance à un chiffre :

   • Le barème des victoires (120/90/60/30/20/15) est recoupé par deux
     sources indépendantes. Une seule divergence : la victoire contre un
     adversaire 3 échelons plus bas vaut 15 points selon Wikipédia et 10
     selon tennis-classement.fr. On retient 15, et le barème est réglable
     dans l'application — si le prof ou Ten'Up dit autre chose, on corrige
     sans toucher au code.

   • Les seuils de bilan minimum viennent de tennis-classement.fr. Deux
     valeurs identiques se suivent chez les hommes (5/6 et 4/6 à 435) : ça
     ressemble à une coquille de la source, mais on recopie plutôt que
     d'inventer une correction.

   • Le capital de départ, lui, n'est publié par aucune source fiable.
     C'est pourquoi le simulateur ne recalcule jamais un bilan à partir de
     zéro : il part du bilan que Ten'Up affiche déjà, et raisonne sur
     l'écart qui reste à combler. Moins ambitieux, mais juste. */

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

/* Barème par défaut, indexé par l'écart « adversaire − moi » exprimé en
   échelons. Battre plus fort que soi rapporte gros, battre trois crans en
   dessous rapporte des miettes, et au-delà plus rien : la fédération ne
   veut pas qu'on monte en accumulant des victoires faciles. */
export const BAREME_DEFAUT = {
  '2': 120,   // adversaire 2 échelons au-dessus ou plus
  '1': 90,
  '0': 60,    // même échelon
  '-1': 30,
  '-2': 20,
  '-3': 15,
  '-4': 0,    // 4 échelons en dessous ou plus
};

/** Points rapportés par une victoire, selon le barème en vigueur.
 *  Les écarts extrêmes sont ramenés aux bornes du barème : battre un
 *  joueur 5 échelons au-dessus rapporte autant qu'à 2 échelons. */
export function pointsVictoire(monEchelon, echelonAdverse, bareme = BAREME_DEFAUT) {
  const diff = rang(echelonAdverse) - rang(monEchelon);
  if (!estValide(monEchelon) || !estValide(echelonAdverse)) return 0;
  const borne = Math.max(-4, Math.min(2, diff));
  return bareme[String(borne)] ?? 0;
}

/* Bilan minimum et nombre de victoires exigés pour être classé à chaque
   échelon. Monter demande les deux à la fois : les points ne suffisent
   pas si l'on n'a pas joué assez de matchs. */
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
  '15':   { h: 420,  hv: 9,  f: 385,  fv: 9 },
  '5/6':  { h: 435,  hv: 9,  f: 395,  fv: 9 },
  '4/6':  { h: 435,  hv: 9,  f: 430,  fv: 9 },
  '3/6':  { h: 475,  hv: 10, f: 500,  fv: 10 },
  '2/6':  { h: 505,  hv: 10, f: 560,  fv: 11 },
  '1/6':  { h: 550,  hv: 11, f: 610,  fv: 12 },
  '0':    { h: 610,  hv: 12, f: 630,  fv: 14 },
  '-2/6': { h: 765,  hv: 15, f: 760,  fv: 15 },
  '-4/6': { h: 865,  hv: 17, f: 740,  fv: 16 },
  '-15':  { h: 930,  hv: 19, f: 780,  fv: 17 },
};

/** Ce qu'il faut atteindre pour être classé à cet échelon.
 *  `null` en points signifie que la source ne publie pas de seuil. */
export function seuil(echelon, sexe = 'h') {
  const s = SEUILS[echelon];
  if (!s) return null;
  return sexe === 'f'
    ? { points: s.f, victoires: s.fv }
    : { points: s.h, victoires: s.hv };
}

// =====================================================================
//  Le bilan et son évolution
// =====================================================================
/* Seules les meilleures victoires comptent, et en nombre limité. Une fois
   le quota atteint, une victoire de plus ne s'ajoute pas : elle remplace
   la moins bonne, et ne rapporte que la différence. C'est le point que
   tout le monde oublie, et qui explique pourquoi une victoire facile ne
   fait parfois rien bouger du tout. */

/** Somme des `quota` meilleures valeurs d'une liste de points. */
function meilleures(points, quota) {
  return [...points].sort((a, b) => b - a).slice(0, quota).reduce((s, p) => s + p, 0);
}

/** Ce que rapportent vraiment `nouvelles` victoires, une fois le jeu des
 *  remplacements appliqué. Sans historique connu, on ne peut pas jouer ce
 *  jeu : on additionne alors bêtement, en le disant à l'appelant. */
export function gainReel(nouvelles, acquises, quota) {
  if (!acquises || !acquises.length) {
    return { gain: nouvelles.reduce((s, p) => s + p, 0), estime: true };
  }
  const avant = meilleures(acquises, quota);
  const apres = meilleures([...acquises, ...nouvelles], quota);
  return { gain: apres - avant, estime: false };
}

// =====================================================================
//  Le simulateur
// =====================================================================
/* La question qu'on se pose vraiment n'est pas « quel est mon bilan »
   mais « qu'est-ce qu'il me reste à faire ». On répond donc en scénarios
   concrets — une victoire à 15, ou deux à 15/1 — et non en points. */

/** Les adversaires qu'il est réaliste de rencontrer : trois échelons en
 *  dessous, deux au-dessus. Au-delà vers le bas ça ne rapporte rien, au-delà
 *  vers le haut le barème plafonne de toute façon. */
function adversairesPlausibles(monEchelon) {
  const i = rang(monEchelon);
  const out = [];
  for (let d = 2; d >= -3; d--) {
    const e = ECHELONS[i + d];
    if (e) out.push(e);
  }
  return out;
}

/** Combien de victoires à cet échelon-là pour combler l'écart ?
 *  Rend null si le compte n'y arrive jamais — typiquement une victoire à
 *  zéro point, ou un plafond atteint par les remplacements. */
function combienPour(manque, echelonAdverse, ctx, max = 8) {
  const p = pointsVictoire(ctx.echelon, echelonAdverse, ctx.bareme);
  if (p <= 0) return null;
  for (let n = 1; n <= max; n++) {
    const { gain } = gainReel(Array(n).fill(p), ctx.acquises, ctx.quota);
    if (gain >= manque) return { n, points: p, gain };
  }
  return null;
}

/* Une victoire contre plus fort que soi est plus dure à aller chercher
   qu'une victoire contre plus faible. Deux scénarios qui demandent le même
   nombre de matchs ne se valent donc pas, et c'est ce coût qui les
   départage à l'affichage. */
function difficulte(monEchelon, echelonAdverse) {
  const d = rang(echelonAdverse) - rang(monEchelon);
  return d >= 2 ? 5 : d === 1 ? 3 : d === 0 ? 2 : 1;
}

/**
 * Les chemins possibles vers l'échelon visé.
 *
 * @param {object} p
 * @param {string} p.echelon    classement actuel
 * @param {number} p.bilan      bilan actuel, celui que Ten'Up affiche
 * @param {string} [p.cible]    échelon visé (par défaut le suivant)
 * @param {string} [p.sexe]     'h' ou 'f', les seuils diffèrent
 * @param {number[]} [p.acquises] points des victoires déjà comptées
 * @param {number} [p.victoires]  nombre de victoires déjà jouées
 * @param {object} [p.bareme]
 */
export function simuler({ echelon, bilan, cible, sexe = 'h', acquises = [], victoires = 0, bareme = BAREME_DEFAUT }) {
  const visee = cible || echelonSuivant(echelon);
  if (!visee) return { erreur: 'Pas d\'échelon au-dessus.' };

  const s = seuil(visee, sexe);
  if (!s || s.points == null) {
    return { erreur: `Aucun seuil publié pour ${visee}.`, cible: visee };
  }

  const manque = Math.max(0, s.points - bilan);
  const quota = s.victoires;
  const ctx = { echelon, bareme, acquises, quota };

  const matchsManquants = Math.max(0, quota - victoires);

  /* Le cas où les points sont déjà là. On ne dit pas « c'est bon » pour
     autant : il peut manquer des matchs joués, et c'est une condition à
     part entière. */
  if (manque === 0) {
    return {
      cible: visee, seuil: s, manque: 0, matchsManquants,
      atteint: matchsManquants === 0,
      scenarios: [],
    };
  }

  const scenarios = [];

  // D'abord les chemins purs : n victoires contre le même niveau.
  for (const adv of adversairesPlausibles(echelon)) {
    const r = combienPour(manque, adv, ctx);
    if (r) {
      scenarios.push({
        parts: [{ echelon: adv, n: r.n, points: r.points }],
        matchs: r.n,
        gain: r.gain,
        cout: r.n * difficulte(echelon, adv),
      });
    }
  }

  /* Puis les chemins mixtes : une victoire de prestige complétée par des
     victoires plus accessibles. C'est souvent le scénario le plus réaliste
     — et celui auquel on ne pense pas tout seul. */
  const advs = adversairesPlausibles(echelon);
  for (const fort of advs) {
    const pf = pointsVictoire(echelon, fort, bareme);
    if (pf <= 0) continue;
    const { gain: g1 } = gainReel([pf], acquises, quota);
    if (g1 >= manque) continue;            // déjà couvert par un chemin pur
    for (const appoint of advs) {
      if (appoint === fort) continue;
      const pa = pointsVictoire(echelon, appoint, bareme);
      if (pa <= 0 || pa >= pf) continue;   // l'appoint doit être plus accessible
      for (let n = 1; n <= 4; n++) {
        const { gain } = gainReel([pf, ...Array(n).fill(pa)], acquises, quota);
        if (gain >= manque) {
          scenarios.push({
            parts: [
              { echelon: fort, n: 1, points: pf },
              { echelon: appoint, n, points: pa },
            ],
            matchs: 1 + n,
            gain,
            cout: difficulte(echelon, fort) + n * difficulte(echelon, appoint),
          });
          break;
        }
      }
    }
  }

  /* On classe par effort ressenti — d'abord le moins de matchs, puis le
     moins difficile — et on écarte les doublons de forme identique. */
  scenarios.sort((a, b) => a.matchs - b.matchs || a.cout - b.cout);
  const vus = new Set();
  const retenus = scenarios.filter(s => {
    const cle = s.parts.map(p => `${p.n}×${p.echelon}`).join('+');
    if (vus.has(cle)) return false;
    vus.add(cle);
    return true;
  }).slice(0, 8);

  return {
    cible: visee,
    seuil: s,
    manque,
    matchsManquants,
    atteint: false,
    estime: !acquises.length,
    scenarios: retenus,
  };
}

/** Formule un scénario en français : « 2 victoires à 15/1 ». */
export function direScenario(sc) {
  return sc.parts
    .map(p => `${p.n} victoire${p.n > 1 ? 's' : ''} à ${p.echelon}`)
    .join(' + ');
}
