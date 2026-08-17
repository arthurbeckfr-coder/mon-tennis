/* =====================================================================
   Le portier de la fonction d'API.

   `/api/dicter` dépense des jetons pour de vrai. Avant d'en dépenser un
   seul, deux verrous :

     1. il faut un jeton de session Supabase valide ;
     2. il faut que le compte figure dans la liste blanche.

   Le second verrou n'est pas une précaution de principe. Les inscriptions
   sont ouvertes sur ce projet Supabase : sans liste blanche, n'importe qui
   pourrait se créer un compte et faire tourner la clé Anthropic aux frais
   du propriétaire. Et l'adresse d'une fonction finit toujours par se lire
   dans le code de la page — c'est inévitable, donc ce n'est pas là-dessus
   qu'on peut compter.

   La liste est fail-closed : sans variable `COMPTES_AUTORISES`, on refuse
   tout. Une porte qui s'ouvre faute de réglage n'est pas une porte.
   ===================================================================== */

// Mêmes coordonnées que le site : une seule source, pas de copie à tenir à jour.
import { SUPABASE_URL, SUPABASE_CLE } from '../public/js/config.js';

export const json = (corps, statut = 200) => new Response(JSON.stringify(corps), {
  status: statut,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
});

/** Qui est derrière ce jeton ? Rend l'email, ou null. */
async function quiEst(jeton) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SUPABASE_CLE, authorization: `Bearer ${jeton}` },
  });
  if (!res.ok) return null;
  const u = await res.json().catch(() => null);
  return u?.email ? String(u.email).toLowerCase() : null;
}

/**
 * Contrôle la méthode, la session et le compte.
 * @returns {Promise<Response|null>} la réponse à renvoyer telle quelle si
 *   l'accès est refusé, `null` si la demande peut suivre son cours.
 */
export async function garde(request, env) {
  if (request.method !== 'POST') return json({ erreur: 'Cette adresse ne répond qu\'en POST.' }, 405);

  const liste = (env?.COMPTES_AUTORISES || '')
    .split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  if (!liste.length) {
    return json({
      erreur: 'La dictée assistée n\'est pas configurée : aucun compte autorisé. '
            + 'Poser la variable COMPTES_AUTORISES sur le projet Cloudflare '
            + '(ton adresse email), puis redéployer.',
    }, 503);
  }

  const jeton = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!jeton) return json({ erreur: 'Connexion requise.' }, 401);

  let email;
  try {
    email = await quiEst(jeton);
  } catch {
    return json({ erreur: 'Vérification de la session impossible. Réessaie dans un moment.' }, 502);
  }
  if (!email) return json({ erreur: 'Session expirée. Reconnecte-toi.' }, 401);
  if (!liste.includes(email)) return json({ erreur: 'Ce compte n\'est pas autorisé.' }, 403);

  return null;
}
