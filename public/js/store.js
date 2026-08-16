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
import { pointsVictoire, BAREME_DEFAUT, seuil } from './classement.js';

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

export const SURFACES = ['Terre battue', 'Dur', 'Dur indoor', 'Gazon', 'Moquette', 'Autre'];

export const nomProfil  = c => PROFILS.find(p => p.cle === c)?.nom || c;
export const nomMoment  = c => MOMENTS.find(m => m.cle === c)?.nom || c;
export const nomCategorie = c => CATEGORIES.find(x => x.cle === c)?.nom || c;

// =====================================================================
//  L'état
// =====================================================================
function vide() {
  return {
    version: VERSION,
    profil: { prenom: '', sexe: 'h', echelon: '30/2', bilan: 0, victoiresJouees: null },
    bareme: { ...BAREME_DEFAUT },
    matchs: [],
    conseils: [],
    sources: [],
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

/** Modifie puis enregistre en un geste. */
export function maj(fn) {
  fn(store);
  return sauver();
}

// =====================================================================
//  Écritures
// =====================================================================
export const ajouterMatch = m => maj(s => s.matchs.unshift({ id: uid(), ...m }));
export const modifierMatch = (id, m) => maj(s => {
  const i = s.matchs.findIndex(x => x.id === id);
  if (i >= 0) s.matchs[i] = { ...s.matchs[i], ...m };
});
export const supprimerMatch = id => maj(s => { s.matchs = s.matchs.filter(m => m.id !== id); });

export const ajouterConseil = c => maj(s => s.conseils.unshift({ id: uid(), ...c }));
export const modifierConseil = (id, c) => maj(s => {
  const i = s.conseils.findIndex(x => x.id === id);
  if (i >= 0) s.conseils[i] = { ...s.conseils[i], ...c };
});
export const supprimerConseil = id => maj(s => { s.conseils = s.conseils.filter(c => c.id !== id); });
export const basculerFavori = id => maj(s => {
  const c = s.conseils.find(x => x.id === id);
  if (c) c.favori = !c.favori;
});

export const ajouterSource = x => maj(s => s.sources.push({ id: uid(), ...x }));
export const supprimerSource = id => maj(s => { s.sources = s.sources.filter(x => x.id !== id); });

// =====================================================================
//  Lectures calculées
// =====================================================================
/** Les points des victoires qui comptent pour le classement : sur les
 *  douze derniers mois, hors abandons adverses non joués. */
export function victoiresComptees() {
  const { echelon } = store.profil;
  return store.matchs
    .filter(m => m.issue === 'V' && !m.wo && dansLesDouzeMois(m.date))
    .map(m => pointsVictoire(echelon, m.echelonAdverse, store.bareme))
    .filter(p => p > 0)
    .sort((a, b) => b - a);
}

/** Nombre de matchs joués sur douze mois — le quota de victoires exigé
 *  par la fédération se compte là-dessus. */
export function matchsDouzeMois() {
  return store.matchs.filter(m => dansLesDouzeMois(m.date));
}

export function bilanEstime() {
  const s = seuil(store.profil.echelon, store.profil.sexe);
  const quota = s?.victoires ?? 8;
  const pts = victoiresComptees().slice(0, quota).reduce((a, b) => a + b, 0);
  return { pointsVictoires: pts, quota };
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

  let nm = 0, nc = 0, ns = 0;
  const cleMatch = m => m.id || `${m.date}|${(m.adversaire || '').toLowerCase()}`;
  const cleConseil = c => c.id || (c.titre || '').toLowerCase();

  const vusM = new Set(store.matchs.map(cleMatch));
  for (const m of (lu.matchs || [])) {
    if (vusM.has(cleMatch(m))) continue;
    store.matchs.push({ ...m, id: m.id || uid() });
    vusM.add(cleMatch(m));
    nm++;
  }
  const vusC = new Set(store.conseils.map(cleConseil));
  for (const c of (lu.conseils || [])) {
    if (vusC.has(cleConseil(c))) continue;
    store.conseils.push({ ...c, id: c.id || uid() });
    vusC.add(cleConseil(c));
    nc++;
  }
  const vusS = new Set(store.sources.map(x => (x.url || '').toLowerCase()));
  for (const x of (lu.sources || [])) {
    if (vusS.has((x.url || '').toLowerCase())) continue;
    store.sources.push({ ...x, id: x.id || uid() });
    vusS.add((x.url || '').toLowerCase());
    ns++;
  }

  store.matchs.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const r = sauver();
  return r.ok ? { ok: true, matchs: nm, conseils: nc, sources: ns, mode }
              : { ok: false, erreur: r.erreur };
}

export function toutEffacer() {
  store = vide();
  return sauver();
}
