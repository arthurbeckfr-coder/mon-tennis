/* Transformer une adresse en un point sur la carte.
 *
 * ─── Pourquoi c'est le seul endroit du carnet qui exige du réseau ─────
 *
 * Une adresse postale ne contient pas ses coordonnées : il faut les
 * demander à quelqu'un qui tient le fichier des adresses de France. Le
 * carnet ne peut donc pas le faire sur un court sans réseau, et c'est
 * assumé — on demande une fois, on garde le résultat, et tout le reste
 * fonctionne hors ligne pour toujours. C'est exactement la règle de la
 * synchronisation : le réseau ajoute, il ne conditionne rien.
 *
 * Le service est celui de l'État (Base Adresse Nationale), sans clé ni
 * compte. Aucune donnée personnelle n'est envoyée ailleurs, et l'adresse
 * saisie ne sort du carnet qu'au moment où l'on demande à la situer.
 *
 * ─── Ce qu'on ne fait pas ────────────────────────────────────────────
 *
 * On ne devine pas. Si l'adresse n'est pas reconnue, on le dit et le
 * champ reste sans point : un domicile placé au centre d'une commune
 * qu'on n'a pas choisie donnerait des distances fausses avec l'air
 * d'être justes.
 */

const SERVICE = 'https://api-adresse.data.gouv.fr/search/';

/**
 * Situe une adresse.
 *
 * @param {string} adresse — telle qu'on l'écrirait sur une enveloppe
 * @returns {Promise<{ok: true, point: [number, number], libelle: string, score: number}
 *                  | {ok: false, erreur: string}>}
 */
export async function situer(adresse) {
  const q = (adresse || '').trim();
  if (q.length < 6) return { ok: false, erreur: 'Adresse trop courte pour être cherchée.' };

  let r;
  try {
    r = await fetch(`${SERVICE}?q=${encodeURIComponent(q)}&limit=1`);
  } catch {
    return { ok: false, erreur: 'Pas de réseau : on réessaiera plus tard.' };
  }
  if (!r.ok) return { ok: false, erreur: `Le service des adresses a répondu ${r.status}.` };

  let d;
  try { d = await r.json(); } catch { return { ok: false, erreur: 'Réponse illisible.' }; }

  const f = d?.features?.[0];
  if (!f) {
    return { ok: false, erreur: 'Adresse introuvable. Ajoute la commune et le code postal.' };
  }

  /* En dessous d'un score correct, la Base Adresse rend « la rue qui
     ressemble le plus », souvent à cent kilomètres. Mieux vaut ne rien
     placer que placer ailleurs. */
  const score = f.properties?.score ?? 0;
  if (score < 0.5) {
    return { ok: false, erreur: `Trouvé « ${f.properties.label} », mais avec trop peu de certitude.` };
  }

  return {
    ok: true,
    point: f.geometry.coordinates,
    libelle: f.properties.label,
    score,
  };
}

/* ─── Les distances ────────────────────────────────────────────────────

   À vol d'oiseau, et jamais autrement. On pourrait multiplier par un
   facteur pour « estimer » la route, mais ce serait un chiffre faux qui a
   l'air vrai : entre deux clubs séparés par la vallée de la Scie, la
   route fait le double du vol d'oiseau ; le long de la côte, à peine
   plus. Le carnet dit donc la distance qu'il sait, et laisse le vrai
   temps de trajet à une application d'itinéraire, qui connaît les
   routes. */

const R_TERRE = 6371;   // km

/** La distance à vol d'oiseau entre deux points [longitude, latitude]. */
export function distanceKm(a, b) {
  if (!a || !b) return null;
  const rad = x => x * Math.PI / 180;
  const dLat = rad(b[1] - a[1]);
  const dLon = rad(b[0] - a[0]);
  const s = Math.sin(dLat / 2) ** 2
          + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLon / 2) ** 2;
  return 2 * R_TERRE * Math.asin(Math.sqrt(s));
}

/** « 12 km », ou « 800 m » quand c'est tout près. */
export const direDistance = km =>
  km == null ? ''
  : km < 1 ? `${Math.round(km * 1000)} m à vol d'oiseau`
  : `${km < 10 ? km.toFixed(1) : Math.round(km)} km à vol d'oiseau`;

/** Le lien qui ouvre l'itinéraire dans l'application de cartes du
 *  téléphone — seule à connaître les routes, les travaux et l'heure. */
export function lienItineraire(depart, arrivee) {
  if (!depart || !arrivee) return '';
  const p = ([lon, lat]) => `${lat},${lon}`;
  return 'https://www.google.com/maps/dir/?api=1'
    + `&origin=${encodeURIComponent(p(depart))}`
    + `&destination=${encodeURIComponent(p(arrivee))}`;
}
