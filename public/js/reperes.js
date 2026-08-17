/* Les repères : les grands axes et quelques villes.
 *
 * Un contour de département situe la mer, pas le reste. Une autoroute et
 * le nom d'une ville qu'on connaît suffisent à répondre à « c'est où par
 * rapport à Rouen », qui est la vraie question qu'on se pose devant une
 * carte de ses propres clubs.
 *
 * ─── D'où viennent ces tracés ──────────────────────────────────────────
 *
 * Des données ouvertes d'OpenStreetMap, interrogées une fois et recousues
 * ici. Overpass rend une route en morceaux et dans le désordre : chaque
 * morceau a été raccroché à celui qui finit où il commence, puis le tracé
 * simplifié. Une autoroute ressortant en deux chaussées presque
 * superposées, on n'a gardé que la plus longue — dessiner les deux
 * doublait le trait sans rien apprendre.
 *
 * Six axes et six villes, et pas davantage. Ce sont des repères : une
 * carte routière complète cacherait les clubs, qui sont le sujet.
 *
 * Coordonnées en [longitude, latitude], comme partout ici. */

export const ROUTES = [
  { ref: "A 28", trace: [[1.146,49.49],[1.165,49.494],[1.205,49.53],[1.228,49.536],[1.272,49.564],[1.277,49.591],[1.262,49.622],[1.268,49.638],[1.265,49.648],[1.272,49.656],[1.302,49.661],[1.342,49.679],[1.383,49.711],[1.444,49.723],[1.468,49.735],[1.485,49.757],[1.474,49.771],[1.475,49.779],[1.501,49.794],[1.529,49.836],[1.55,49.846],[1.56,49.87],[1.596,49.884],[1.611,49.906],[1.632,49.915],[1.643,49.931],[1.64,49.942],[1.655,49.96]] },
  { ref: "A 29", trace: [[0.339,49.559],[0.351,49.569],[0.396,49.57],[0.438,49.582],[0.468,49.603],[0.496,49.603],[0.522,49.613],[0.591,49.621],[0.616,49.629],[0.778,49.645],[0.809,49.658],[0.848,49.652],[0.931,49.663],[0.969,49.645],[1.127,49.631],[1.218,49.64],[1.271,49.655]] },
  { ref: "A 150", trace: [[0.765,49.644],[0.788,49.644],[0.818,49.625],[0.853,49.617],[0.87,49.585],[0.921,49.549]] },
  { ref: "A 151", trace: [[1.045,49.646],[1.04,49.622],[1.049,49.585],[1.044,49.553],[0.985,49.511],[0.991,49.506]] },
  { ref: "N 27", trace: [[1.115,49.858],[1.106,49.85],[1.074,49.846],[1.067,49.835],[1.06,49.805],[1.068,49.74],[1.046,49.691],[1.032,49.68],[1.043,49.667],[1.045,49.646]] },
  { ref: "D 925", trace: [[0.736,49.863],[0.79,49.863],[0.802,49.871],[0.889,49.865],[0.923,49.872]] }
];

/* Les villes qu'on cite pour se situer, et non celles où l'on joue :
   celles-là ont déjà leur disque. */
export const VILLES = [
  { nom: "Rouen", point: [1.0912,49.4412] },
  { nom: "Dieppe", point: [1.0838,49.9199] },
  { nom: "Fécamp", point: [0.4012,49.7479] },
  { nom: "Le Havre", point: [0.1312,49.4958] },
  { nom: "Forges-les-Eaux", point: [1.5644,49.6104] },
  { nom: "Barentin", point: [0.9549,49.5431] },
];
