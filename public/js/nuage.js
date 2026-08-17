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

/* Une modification locale ne déclenche pas un envoi immédiat : on saisit
   souvent trois choses d'affilée, et trois envois pour un seul geste de
   l'utilisateur seraient du gaspillage. On attend quelques secondes de
   calme. */
let minuteur = null;
export function planifierEnvoi(delai = 4000) {
  if (!connecte()) return;
  clearTimeout(minuteur);
  minuteur = setTimeout(() => { synchroniser(); }, delai);
}
