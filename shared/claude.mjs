/* =====================================================================
   L'appel à Claude, et rien d'autre.

   Un seul dépouillement s'en sert pour l'instant — la note dictée
   (`dictee-noyau.mjs`) — mais ce fichier n'en connaît rien. Il sait poser
   la question, traduire les pannes en français, et rendre l'objet que
   l'outil a renvoyé.

   Il ne connaît ni Supabase ni le navigateur, et tourne aussi bien sous
   Node que sur Cloudflare.
   ===================================================================== */

/** Erreur portant le code HTTP à renvoyer à la page. */
export class ErreurAnalyse extends Error {
  constructor(message, statut = 500) { super(message); this.statut = statut; }
}

const MODELES = { haiku: 'claude-haiku-4-5-20251001', sonnet: 'claude-sonnet-5', opus: 'claude-opus-5' };

/**
 * Pose la question à Claude en l'obligeant à répondre par un outil : la
 * réponse est donc toujours un objet conforme au schéma, jamais du texte
 * libre à interpréter.
 *
 * @param {object} demande
 * @param {string} [demande.modele]     'haiku' | 'sonnet' | 'opus'
 * @param {string} demande.systeme      la consigne
 * @param {object} demande.outil        { name, description, input_schema }
 * @param {Array}  demande.contenu      les blocs du message utilisateur
 * @param {number} [demande.maxTokens]
 * @param {string} cle                  clé API — ne doit jamais atteindre le navigateur
 */
export async function appelerClaude({ modele = 'sonnet', systeme, outil, contenu, maxTokens = 4000 }, cle) {
  // Sans clé, rien à tenter. Le message dit où la poser : ce défaut n'arrive
  // qu'à l'installation, et « aucune clé » tout court n'aide personne.
  if (!cle) {
    throw new ErreurAnalyse(
      'La dictée assistée n\'est pas configurée : le serveur n\'a pas de clé API. '
      + 'En ligne, poser le secret ANTHROPIC_API_KEY sur le projet Cloudflare, puis redéployer — '
      + 'un secret ajouté ne vaut que pour les déploiements suivants. '
      + 'En local avec wrangler, le mettre dans le fichier .dev.vars à la racine du dépôt.', 503);
  }

  let res;
  try {
    res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': cle,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODELES[modele] || MODELES.sonnet,
        max_tokens: maxTokens,
        system: systeme,
        tools: [outil],
        tool_choice: { type: 'tool', name: outil.name },
        messages: [{ role: 'user', content: contenu }],
      }),
    });
  } catch (err) {
    throw new ErreurAnalyse('Impossible de joindre l\'API Anthropic : ' + err.message, 502);
  }

  if (!res.ok) {
    let detail = '';
    try { detail = (await res.json()).error?.message || ''; } catch { /* réponse illisible */ }
    const messages = {
      401: 'La clé API est refusée. Vérifie le secret ANTHROPIC_API_KEY.',
      400: 'Demande refusée par l\'API' + (detail ? ` : ${detail}` : '.'),
      429: 'Trop de demandes d\'affilée, ou crédit épuisé. Réessaie dans un moment.',
      529: 'L\'API est surchargée. Réessaie dans un moment.',
    };
    throw new ErreurAnalyse(messages[res.status] || `L'API a répondu ${res.status}${detail ? ` : ${detail}` : ''}.`,
      res.status === 429 || res.status === 529 ? res.status : 502);
  }

  const data = await res.json();
  const bloc = data.content?.find(c => c.type === 'tool_use');
  if (!bloc) {
    throw new ErreurAnalyse(
      data.stop_reason === 'max_tokens'
        ? 'La réponse a été coupée avant la fin : la dictée est trop longue. Coupe-la en deux.'
        : 'Aucun dépouillement n\'a été renvoyé. La dictée est peut-être inaudible.', 502);
  }
  return { ...bloc.input, _usage: data.usage };
}
