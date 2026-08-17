/* Le matériel et l'intendance : raquettes, cordages, chaussures, courses.

   Une remarque sur les icônes, puisque c'est ce qui a été demandé : ce sont
   des emoji et non des photos de produits. Deux raisons, et la première
   suffit. Le site doit rester utilisable sans réseau, dans un sac de sport
   ou un magasin en sous-sol ; aller chercher des images chez un tiers
   casserait cette promesse, et le déploiement refuse d'ailleurs toute
   ressource externe. La seconde : une photo de produit est datée et pèse,
   là où « 🎾 » se reconnaît d'un coup d'œil et ne vieillit pas.

   Le vrai apport de l'icône n'est pas décoratif. Une liste de courses se
   lit debout, une main sur le caddie : les pictogrammes permettent de
   retrouver sa ligne sans lire, ce qu'aucune police ne permet. */

export const ICONES = [
  '🎾', '🪢', '🎒', '👟', '🧦', '🎽', '🧢', '🕶️',
  '🧤', '💧', '🥤', '🧂', '🍌', '🍫', '💊', '🧴',
  '🩹', '🩺', '🧊', '🌡️', '☀️', '🧻', '✂️', '🔋',
];

export const CATEGORIES_COURSES = [
  { cle: 'nutrition', emoji: '🍫', nom: 'Nutrition et boisson' },
  { cle: 'soin',      emoji: '🩹', nom: 'Trousse de secours' },
  { cle: 'materiel',  emoji: '🎾', nom: 'Matériel' },
  { cle: 'tenue',     emoji: '🎽', nom: 'Tenue' },
  { cle: 'autre',     emoji: '📦', nom: 'Autre' },
];

export const CAUSES_CORDAGE = [
  { cle: 'casse',     nom: 'Cassé' },
  { cle: 'usure',     nom: 'Changé pour usure' },
  { cle: 'preventif', nom: 'Changé par précaution' },
];

export const nomCategorie = c => CATEGORIES_COURSES.find(x => x.cle === c)?.nom || c;
export const emojiCategorie = c => CATEGORIES_COURSES.find(x => x.cle === c)?.emoji || '📦';
export const nomCause = c => CAUSES_CORDAGE.find(x => x.cle === c)?.nom || c;

/* Une trousse de secours vide n'aide personne, et personne n'a envie de la
   remplir ligne à ligne un dimanche soir. Ces articles-là sont proposés
   d'emblée — comme une liste type qu'on coche ou qu'on jette, pas comme
   des données déjà saisies. */
export const TROUSSE_TYPE = [
  { nom: 'Pansements ampoules', icone: '🩹', categorie: 'soin' },
  { nom: 'Bande de strapping',  icone: '🩹', categorie: 'soin' },
  { nom: 'Spray froid',         icone: '🧊', categorie: 'soin' },
  { nom: 'Crème anti-douleur',  icone: '🧴', categorie: 'soin' },
  { nom: 'Antiseptique',        icone: '🩺', categorie: 'soin' },
  { nom: 'Crème solaire',       icone: '☀️', categorie: 'soin' },
  { nom: 'Pastilles de sel',    icone: '🧂', categorie: 'nutrition' },
  { nom: 'Barres protéinées',   icone: '🍫', categorie: 'nutrition' },
  { nom: 'Boisson isotonique',  icone: '🥤', categorie: 'nutrition' },
  { nom: 'Bananes',             icone: '🍌', categorie: 'nutrition' },
  { nom: 'Tube de balles',      icone: '🎾', categorie: 'materiel' },
  { nom: 'Surgrips',            icone: '🧤', categorie: 'materiel' },
  { nom: 'Anti-vibrateur',      icone: '🪢', categorie: 'materiel' },
];

// =====================================================================
//  Ce que l'historique des cordages raconte
// =====================================================================
/* Le nombre de cordages cassés ne dit pas grand-chose seul. Ce qui compte
   est la durée de vie : combien de temps un cordage tient, sur quelle
   raquette, et si ça se dégrade. On la calcule par écart entre deux poses
   sur la même raquette — c'est la seule mesure que les données permettent,
   faute de savoir combien d'heures on a joué entre les deux. */

/** Durées de vie observées sur une raquette, en jours. */
export function dureesDeVie(cordages, raquetteId) {
  const poses = cordages
    .filter(c => c.raquetteId === raquetteId && c.date)
    .sort((a, b) => a.date.localeCompare(b.date));

  const durees = [];
  for (let i = 1; i < poses.length; i++) {
    const j = Math.round(
      (new Date(poses[i].date) - new Date(poses[i - 1].date)) / 86400000);
    if (j > 0) durees.push({ jours: j, du: poses[i - 1], au: poses[i] });
  }
  return durees;
}

/** Le résumé affiché en tête d'écran. */
export function statsCordages(cordages, raquettes) {
  const parRaquette = raquettes.map(r => {
    const d = dureesDeVie(cordages, r.id);
    const moyenne = d.length
      ? Math.round(d.reduce((t, x) => t + x.jours, 0) / d.length) : null;
    return {
      raquette: r,
      poses: cordages.filter(c => c.raquetteId === r.id).length,
      casses: cordages.filter(c => c.raquetteId === r.id && c.cause === 'casse').length,
      moyenne,
    };
  });

  const douzeMois = cordages.filter(c => {
    if (!c.date) return false;
    const limite = new Date();
    limite.setFullYear(limite.getFullYear() - 1);
    return new Date(c.date) >= limite;
  });

  const toutes = raquettes.flatMap(r => dureesDeVie(cordages, r.id)).map(d => d.jours);
  const moyenneGenerale = toutes.length
    ? Math.round(toutes.reduce((a, b) => a + b, 0) / toutes.length) : null;

  return {
    total: cordages.length,
    casses: cordages.filter(c => c.cause === 'casse').length,
    surDouzeMois: douzeMois.length,
    cassesSurDouzeMois: douzeMois.filter(c => c.cause === 'casse').length,
    moyenneGenerale,
    parRaquette,
  };
}

/** Depuis combien de jours le cordage actuel est en place. */
export function ageCordage(cordages, raquetteId) {
  const derniere = cordages
    .filter(c => c.raquetteId === raquetteId && c.date)
    .sort((a, b) => b.date.localeCompare(a.date))[0];
  if (!derniere) return null;
  return {
    jours: Math.round((Date.now() - new Date(derniere.date)) / 86400000),
    pose: derniere,
  };
}
