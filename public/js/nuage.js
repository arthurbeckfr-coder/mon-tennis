/* La synchronisation entre appareils.

   ─── Pourquoi pas la bibliothèque officielle ─────────────────────────

   Le site n'a aucune dépendance, et le déploiement refuse toute ressource
   chargée chez un tiers — c'est ce qui garantit qu'il démarre sur un court
   sans réseau. Embarquer la bibliothèque Supabase voudrait dire recopier
   cent kilo-octets de code dans le dépôt et les tenir à jour. Or ce dont
   ce carnet a besoin tient en quatre appels : se connecter, rafraîchir un
   jeton, lire une ligne, écrire une ligne. Autant les écrire.

   ─── Le principe : le navigateur d'abord ─────────────────────────────

   Rien ici ne conditionne le fonctionnement du site. On peut ne jamais se
   connecter et tout marche — c'est même le cas d'usage principal, sur un
   terrain sans réseau. La base ne fait que transporter l'état d'un appareil
   à l'autre.

   Et la fusion ne perd jamais rien : on complète, on n'écrase pas. Deux
   appareils qui ont chacun ajouté des choses de leur côté se retrouvent
   avec la somme des deux, jamais avec le dernier qui a parlé. C'est la
   propriété qui compte le plus ici, parce que la panne qu'on ne pardonne
   pas est celle qui efface trois conseils notés après un cours. */

import { SUPABASE_URL, SUPABASE_CLE } from './config.js';
import { store, exporterJSON, fusionnerDistant } from './store.js';
import { viderBrouillons } from './util.js';

const CLE_SESSION = 'tennis-session';
const CLE_SYNC = 'tennis-derniere-sync';

let enCours = false;

// =====================================================================
//  La session
// =====================================================================
const lireSession = () => {
  try { return JSON.parse(localStorage.getItem(CLE_SESSION) || 'null'); }
  catch { return null; }
};

const ecrireSession = (s) => {
  try {
    if (s) localStorage.setItem(CLE_SESSION, JSON.stringify(s));
    else localStorage.removeItem(CLE_SESSION);
  } catch { /* stockage refusé : la session ne durera pas */ }
};

export const connecte = () => !!lireSession()?.refresh_token;
export const courriel = () => lireSession()?.email || '';
export const derniereSync = () => {
  try { return localStorage.getItem(CLE_SYNC) || ''; } catch { return ''; }
};
export const enTrain = () => enCours;

/** Un appel à l'API d'authentification. */
async function auth(chemin, corps) {
  const r = await fetch(`${SUPABASE_URL}/auth/v1/${chemin}`, {
    method: 'POST',
    headers: { apikey: SUPABASE_CLE, 'Content-Type': 'application/json' },
    body: JSON.stringify(corps),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) {
    throw new Error(d.error_description || d.msg || d.message || `Erreur ${r.status}`);
  }
  return d;
}

function poserSession(d) {
  ecrireSession({
    access_token: d.access_token,
    refresh_token: d.refresh_token,
    // On garde la date d'expiration absolue : comparer des durées relatives
    // après une nuit de veille du téléphone ne marche pas.
    expire_le: Date.now() + (d.expires_in || 3600) * 1000,
    email: d.user?.email || '',
    utilisateur: d.user?.id || '',
  });
}

export async function connexion(email, motDePasse) {
  const d = await auth('token?grant_type=password', { email, password: motDePasse });
  poserSession(d);
  return { email: d.user?.email };
}

/** Créer un compte.
 *
 *  Deux réponses possibles, et il faut les distinguer pour ne pas mentir
 *  à celui qui vient de s'inscrire :
 *
 *  — une session complète, quand la base n'exige pas de confirmation :
 *    on est connecté, il n'y a plus rien à faire ;
 *  — un utilisateur sans session : un courriel de confirmation est
 *    parti, et le compte ne servira qu'une fois le lien suivi.
 *
 *  Un troisième cas se cache dans le second. Depuis quelques versions,
 *  Supabase répond la même chose pour une adresse déjà inscrite que pour
 *  une inscription neuve — c'est volontaire, cela empêche de deviner qui
 *  a un compte. On ne peut donc pas promettre « compte créé » : on dit ce
 *  qui est sûr, à savoir qu'un courriel a été envoyé s'il devait l'être.
 */
export async function inscription(email, motDePasse) {
  /* Où le lien de confirmation ramène : ici, et non sur la page d'accueil
     que la base a en réglage. Sans cela on confirme son compte et l'on se
     retrouve devant autre chose que le carnet qu'on venait d'ouvrir.

     L'adresse doit figurer dans les redirections autorisées du projet,
     faute de quoi la base la remplace par la sienne — ce qui n'est pas
     une panne, seulement un retour moins direct. */
  const retour = encodeURIComponent(location.origin + location.pathname);
  const d = await auth(`signup?redirect_to=${retour}`, { email, password: motDePasse });
  if (d.access_token) {
    poserSession(d);
    return { connecte: true, email: d.user?.email || email };
  }
  return { connecte: false, email: d.user?.email || d.email || email };
}

export function deconnexion() {
  ecrireSession(null);
  try { localStorage.removeItem(CLE_SYNC); } catch {}
}

/** Un jeton valide, rafraîchi si besoin. Rend null si la session est morte. */
async function jeton() {
  const s = lireSession();
  if (!s?.refresh_token) return null;
  // Une minute de marge : un jeton qui expire pendant la requête ne sert à rien.
  if (s.access_token && s.expire_le > Date.now() + 60000) return s;

  try {
    const d = await auth('token?grant_type=refresh_token', { refresh_token: s.refresh_token });
    poserSession(d);
    return lireSession();
  } catch {
    /* Le jeton de rafraîchissement a été révoqué ou a expiré. On efface la
       session plutôt que de réessayer indéfiniment, mais on ne touche à
       aucune donnée locale : le carnet reste entier. */
    ecrireSession(null);
    return null;
  }
}

/** Le jeton d'accès valide, pour les appels aux fonctions serveur.
 *  Rend null si la session est morte — l'appelant se rabat alors sur ce
 *  qui marche hors ligne. */
export async function jetonCourant() {
  const s = await jeton();
  return s?.access_token || null;
}

// =====================================================================
//  Le carnet distant
// =====================================================================
async function requete(chemin, options = {}) {
  const s = await jeton();
  if (!s) throw new Error('Session expirée — reconnecte-toi.');

  const r = await fetch(`${SUPABASE_URL}/rest/v1/${chemin}`, {
    ...options,
    headers: {
      apikey: SUPABASE_CLE,
      Authorization: `Bearer ${s.access_token}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  if (!r.ok) {
    const d = await r.json().catch(() => ({}));
    throw new Error(d.message || `Erreur ${r.status}`);
  }
  return r.status === 204 ? null : r.json().catch(() => null);
}

/** Le nom d'appareil, pour comprendre d'où vient une modification. */
function appareil() {
  const ua = navigator.userAgent;
  if (/iPhone|Android|Mobile/i.test(ua)) return 'Téléphone';
  if (/iPad|Tablet/i.test(ua)) return 'Tablette';
  return 'Ordinateur';
}

/**
 * Le tour complet : on lit ce qu'il y a en ligne, on le fusionne dans le
 * carnet local sans rien perdre, puis on renvoie le résultat fusionné.
 * Les deux appareils convergent ainsi vers la même somme.
 */
export async function synchroniser() {
  if (enCours) return { ok: false, erreur: 'Synchronisation déjà en cours.' };
  enCours = true;
  document.dispatchEvent(new CustomEvent('sync-change'));

  try {
    const s = await jeton();
    if (!s) throw new Error('Non connecté.');

    const lignes = await requete(`carnets?utilisateur=eq.${s.utilisateur}&select=donnees,modifie_le`);
    const distant = lignes?.[0]?.donnees || null;

    let recu = null;
    if (distant && (distant.matchs || distant.conseils)) {
      recu = fusionnerDistant(distant);
    }

    await requete('carnets', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({
        utilisateur: s.utilisateur,
        donnees: JSON.parse(exporterJSON()),
        appareil: appareil(),
      }),
    });

    const quand = new Date().toISOString();
    try { localStorage.setItem(CLE_SYNC, quand); } catch {}
    return { ok: true, recu, premiere: !distant, quand };
  } catch (err) {
    return { ok: false, erreur: err.message };
  } finally {
    enCours = false;
    document.dispatchEvent(new CustomEvent('sync-change'));
  }
}

/** L'envoi de la dernière chance.
 *
 *  Une requête ordinaire est annulée avec la page : sur un téléphone,
 *  fermer l'application au moment où le minuteur allait partir, c'était
 *  perdre l'envoi. `keepalive` demande au navigateur de la mener au bout
 *  quoi qu'il arrive — au prix d'un corps limité à soixante-quatre
 *  kilo-octets. Au-delà, on retombe sur l'envoi ordinaire : il a toutes
 *  ses chances quand on ne fait que passer à une autre application, et
 *  le tour suivant rattrapera de toute façon.
 *
 *  On n'y rafraîchit pas le jeton : le faire demande un aller-retour
 *  qui n'aura pas lieu. Jeton périmé, on ne tente rien — la donnée reste
 *  au chaud dans le navigateur et partira à la prochaine ouverture.
 */
function envoyerEnPartant() {
  const s = lireSession();
  if (!s?.access_token || s.expire_le <= Date.now()) return false;

  const corps = JSON.stringify({
    utilisateur: s.utilisateur,
    donnees: JSON.parse(exporterJSON()),
    appareil: appareil(),
  });
  attente = false;
  try {
    fetch(`${SUPABASE_URL}/rest/v1/carnets`, {
      method: 'POST',
      keepalive: corps.length <= 60_000,
      headers: {
        apikey: SUPABASE_CLE,
        Authorization: `Bearer ${s.access_token}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: corps,
    }).catch(() => { /* on s'en va : personne pour l'entendre */ });
    return true;
  } catch { return false; }
}

/* Une modification locale ne déclenche pas un envoi immédiat : on saisit
   souvent trois choses d'affilée, et trois envois pour un seul geste de
   l'utilisateur seraient du gaspillage. On attend un moment de calme —
   une seconde et demie, le temps de refermer une fenêtre et d'en rouvrir
   une autre. Quatre secondes, c'était assez long pour qu'on range le
   téléphone entre-temps, et l'envoi partait alors dans le vide.

   Ce qui attend encore part de toute façon au moment où la page s'en va :
   voir la fonction qui branche la synchronisation automatique. */
let minuteur = null;
let attente = false;

/** Y a-t-il une modification qui n'est pas encore partie ? */
export const enAttente = () => attente;

export function planifierEnvoi(delai = 1500) {
  if (!connecte()) return;
  attente = true;
  clearTimeout(minuteur);
  minuteur = setTimeout(() => { attente = false; synchroniser(); }, delai);
}

/* ─── La synchronisation d'elle-même ───────────────────────────────────
 *
 * Toucher un bouton pour synchroniser, c'est se souvenir de le faire. Or
 * ce carnet se tient d'une main au bord d'un court : on note un score, on
 * range le téléphone, et l'on ne pense plus à rien. Le bouton reste — il
 * dit où l'on en est et permet de forcer — mais il ne doit plus être la
 * condition de quoi que ce soit.
 *
 * Quatre moments, et pas un de plus. Chacun répond à une façon de perdre
 * ses données ou de rater celles d'ailleurs :
 *
 *   — au retour sur l'écran, parce qu'on a pu noter un match sur l'autre
 *     appareil pendant qu'on regardait ailleurs ;
 *   — au retour du réseau, parce qu'un envoi tenté sans réseau n'a rien
 *     envoyé du tout ;
 *   — toutes les dix minutes tant que l'écran est ouvert, pour l'appareil
 *     posé sur la table pendant qu'on joue ;
 *   — au moment où la page s'en va, pour ne pas emporter dans la
 *     fermeture ce que le minuteur de quatre secondes n'a pas encore eu
 *     le temps d'envoyer.
 *
 * Une garde commune à tous : rien ne part si l'on vient de synchroniser.
 * Sans elle, changer d'onglet trois fois en dix secondes ferait trois
 * tours complets pour rien.
 */
const REPOS = 30_000;          // le temps de calme minimal entre deux tours
const RYTHME = 600_000;        // dix minutes

/* `derniereSync` rend ce que le stockage garde, c'est-à-dire du texte.
   On lui demandait l'heure comme à une date, ce qui levait une erreur —
   dans une fonction asynchrone, donc en silence — et emportait avec elle
   les trois quarts de la synchronisation automatique : le retour sur
   l'écran, le retour au premier plan et le battement des dix minutes ne
   rapportaient plus rien. Seuls l'ouverture et le retour du réseau
   passaient encore, parce qu'ils forcent et ne consultent pas l'horloge.
   Une date illisible ne doit pas davantage bloquer : dans le doute, on
   synchronise. */
const tropTot = () => {
  const t = Date.parse(derniereSync());
  return Number.isFinite(t) && (Date.now() - t) < REPOS;
};

async function synchroSiUtile(force = false) {
  if (!connecte() || enCours) return;
  if (!force && tropTot()) return;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
  await synchroniser();
}

/** Branche la synchronisation automatique. Appelée une fois au démarrage. */
export function brancherSynchroAuto() {
  /* Le premier tour, à l'ouverture : c'est celui qui rapporte ce qui a été
     noté ailleurs, et il ne s'économise pas. */
  synchroSiUtile(true);

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') synchroSiUtile();
  });
  window.addEventListener('focus', () => synchroSiUtile());
  window.addEventListener('online', () => synchroSiUtile(true));

  setInterval(() => {
    if (document.visibilityState === 'visible') synchroSiUtile();
  }, RYTHME);

  /* En partant, on enregistre ce qui traîne dans les champs, puis on
     l'envoie. `pagehide` plutôt que `beforeunload` : c'est le seul que
     les navigateurs de téléphone déclenchent vraiment quand on ferme
     l'onglet ou qu'on change d'application. Et `visibilitychange`
     avec, parce qu'il arrive le premier quand on passe à une autre
     application — le moment où l'on perd la page sans la fermer. */
  const partir = () => {
    viderBrouillons();
    if (connecte() && enAttente()) envoyerEnPartant();
  };
  window.addEventListener('pagehide', partir);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') partir();
  });
}