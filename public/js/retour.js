/* D'où l'on vient, quand ce n'est pas d'une liste.
 *
 * La flèche de retour ramène d'ordinaire à la liste dont une fiche est
 * issue, et c'est le bon comportement : on arrive sur une fiche
 * d'adversaire depuis le répertoire, on y retourne.
 *
 * Mais on peut aussi y arriver depuis la fenêtre d'un match, pour vérifier
 * l'historique face à ce joueur. Renvoyer alors au répertoire ferait perdre
 * le match qu'on était en train de regarder, et c'est précisément ce qu'on
 * ne veut pas : le détour doit se refermer là où il s'est ouvert.
 *
 * D'où cette mémoire d'un seul cran. Elle est volontairement minuscule et
 * volatile : un empilement d'historique serait une machine à surprises, et
 * un rechargement de page doit simplement rendre le retour ordinaire.
 */

let memoire = null;

/**
 * Note qu'un écran, une fois atteint, devra se refermer autrement.
 * @param {string} ecran — le hash de l'écran concerné
 * @param {Function} action — ce qu'il faut faire au retour
 */
export function poserRetour(ecran, action) {
  memoire = { ecran, action };
}

/** L'action de retour prévue pour cet écran, ou null. */
export function retourPour(ecran) {
  return memoire && memoire.ecran === ecran ? memoire.action : null;
}

/** Oublie, dès qu'on s'éloigne de l'écran concerné. */
export function oublierRetourSi(ecran) {
  if (memoire && memoire.ecran !== ecran) memoire = null;
}
