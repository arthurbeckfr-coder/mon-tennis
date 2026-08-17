/* =====================================================================
   POST /api/dicter — range une note dictée dans le carnet.

   Fonction Cloudflare Pages. Elle existe pour une seule raison : la clé de
   l'API Anthropic ne peut pas vivre dans une page web. Le téléphone envoie
   ici le texte dicté, la fonction appelle Claude avec la clé, et ne renvoie
   que le rangement proposé.

   Rien n'est enregistré ici : la fonction propose, le navigateur dispose.
   L'utilisateur relit avant que quoi que ce soit n'entre dans son carnet —
   une dictée mal comprise doit pouvoir être corrigée, pas découverte trois
   semaines plus tard dans les statistiques.

   Secrets et variables à créer côté Cloudflare
   (Pages → Settings → Variables and Secrets) :
     ANTHROPIC_API_KEY   (secret)   la clé Anthropic
     COMPTES_AUTORISES   (variable) ton adresse email
   ===================================================================== */

import { appelerClaude, ErreurAnalyse } from '../../shared/claude.mjs';
import { OUTIL, consigne } from '../../shared/dictee-noyau.mjs';
import { garde, json } from '../../shared/acces.mjs';

export async function onRequest({ request, env }) {
  const refus = await garde(request, env);
  if (refus) return refus;

  let demande;
  try {
    demande = await request.json();
  } catch {
    return json({ erreur: 'Demande illisible.' }, 400);
  }

  const texte = String(demande?.texte || '').trim();
  if (!texte) return json({ erreur: 'Rien à ranger : la dictée est vide.' }, 400);
  if (texte.length > 4000) {
    return json({ erreur: 'Dictée trop longue. Coupe-la en deux.' }, 413);
  }

  try {
    /* Haiku suffit largement : trier une phrase en trois destinations n'est
       pas un travail de raisonnement, et une dictée doit revenir vite —
       on est souvent debout à côté du court. */
    const resultat = await appelerClaude({
      modele: 'haiku',
      systeme: consigne({
        aujourdhui: new Date().toISOString().slice(0, 10),
        monEchelon: String(demande?.echelon || '15'),
        adversairesConnus: Array.isArray(demande?.adversaires) ? demande.adversaires : [],
      }),
      outil: OUTIL,
      contenu: [{ type: 'text', text: texte }],
      maxTokens: 2000,
    }, env.ANTHROPIC_API_KEY);

    return json({ elements: resultat.elements || [] });
  } catch (err) {
    if (err instanceof ErreurAnalyse) return json({ erreur: err.message }, err.statut);
    return json({ erreur: 'Rangement impossible : ' + err.message }, 500);
  }
}
