/* =====================================================================
   Trier une note dictée.

   Ce qu'on dit après un match n'arrive jamais rangé. « Il chipait tout,
   j'ai fini par monter au filet, j'ai gagné 6/4 6/2 contre Dupont, et il
   faut que je rachète des surgrips » — c'est un match, un conseil, une
   observation sur l'adversaire et une course, en une seule phrase. Le
   travail est de les séparer et de les envoyer chacun au bon écran.

   Le modèle est obligé de répondre par un outil : la sortie est donc
   toujours un objet conforme au schéma, jamais du texte à réinterpréter.

   ─── Le vocabulaire est recopié, et c'est délibéré ───────────────────

   Les listes ci-dessous existent aussi côté navigateur (store.js,
   terrain.js, materiel.js). Les importer d'ici serait tentant mais faux :
   ces fichiers touchent au DOM au chargement, et cette fonction tourne sur
   un serveur qui n'en a pas. Trente chaînes recopiées valent mieux qu'un
   module qui plante à froid. Si l'une des listes change, celle-ci doit
   suivre — d'où le rappel en tête de chaque constante.
   ===================================================================== */

// Doit suivre PROFILS de public/js/store.js
const PROFILS = ['jeune', 'decalage', 'chipeur', 'gaucher', 'defenseur',
                 'attaquant', 'lifteur', 'irregulier', 'physique', 'ancien'];

// Doit suivre MOMENTS de public/js/store.js
const MOMENTS = ['avant', 'entre', 'service', 'retour', 'changement',
                 'mene', 'devant', 'apres'];

// Doit suivre CATEGORIES de public/js/store.js
const CATEGORIES = ['tactique', 'mental', 'technique', 'physique', 'schema'];

// Doit suivre COUPS de public/js/terrain.js
const COUPS = ['service', 'coup-droit', 'revers', 'montee', 'volee',
               'adv-coup-droit', 'adv-revers', 'croise', 'long-ligne',
               'lob', 'smash', 'amortie'];

// Doit suivre CATEGORIES_COURSES de public/js/materiel.js
const RAYONS = ['nutrition', 'soin', 'materiel', 'tenue', 'autre'];

// Doit suivre ECHELONS de public/js/classement.js
const ECHELONS = ['NC', '40/2', '40/1', '40', '30/5', '30/4', '30/3', '30/2',
                  '30/1', '30', '15/5', '15/4', '15/3', '15/2', '15/1', '15',
                  '5/6', '4/6', '3/6', '2/6', '1/6', '0', '-2/6', '-4/6', '-15'];

export const OUTIL = {
  name: 'ranger_la_dictee',
  description: 'Range une note dictée dans les écrans du carnet de tennis.',
  input_schema: {
    type: 'object',
    properties: {
      elements: {
        type: 'array',
        description: 'Un élément par chose à enregistrer. Une même dictée en contient souvent plusieurs.',
        items: {
          type: 'object',
          properties: {
            destination: {
              type: 'string',
              enum: ['match', 'conseil', 'joueur', 'course', 'cordage'],
              description: 'match = un résultat ; conseil = une consigne de jeu à retenir ; '
                + 'joueur = une observation sur un adversaire ; course = quelque chose à acheter ; '
                + 'cordage = un cordage cassé ou changé.',
            },
            resume: {
              type: 'string',
              description: 'Ce qui a été compris, en une courte phrase, pour relecture avant validation.',
            },
            match: {
              type: 'object',
              properties: {
                date: { type: 'string', description: 'AAAA-MM-JJ si elle est dite ou déductible.' },
                issue: { type: 'string', enum: ['V', 'D'] },
                adversaire: { type: 'string' },
                echelonAdverse: { type: 'string', enum: ECHELONS },
                score: { type: 'string', description: 'Tel qu\'il est dit : « 6/4 6/2 ».' },
                tournoi: { type: 'string' },
                notes: { type: 'string', description: 'Le ressenti sur ce match.' },
              },
            },
            conseil: {
              type: 'object',
              properties: {
                titre: { type: 'string', description: 'Le conseil en une phrase, à l\'impératif.' },
                texte: { type: 'string', description: 'Le détail, avec les mots dits.' },
                categorie: { type: 'string', enum: CATEGORIES },
                profils: { type: 'array', items: { type: 'string', enum: PROFILS } },
                moments: { type: 'array', items: { type: 'string', enum: MOMENTS } },
                coups: { type: 'array', items: { type: 'string', enum: COUPS } },
                source: { type: 'string', description: 'Qui l\'a dit, si c\'est précisé.' },
              },
            },
            joueur: {
              type: 'object',
              properties: {
                nom: { type: 'string' },
                profils: { type: 'array', items: { type: 'string', enum: PROFILS } },
                note: { type: 'string', description: 'Ce qu\'on retient de sa façon de jouer.' },
              },
            },
            course: {
              type: 'object',
              properties: {
                nom: { type: 'string' },
                categorie: { type: 'string', enum: RAYONS },
                note: { type: 'string' },
              },
            },
            cordage: {
              type: 'object',
              properties: {
                cause: { type: 'string', enum: ['casse', 'usure', 'preventif'] },
                marque: { type: 'string' },
                tension: { type: 'string' },
                note: { type: 'string' },
              },
            },
          },
          required: ['destination', 'resume'],
        },
      },
    },
    required: ['elements'],
  },
};

export function consigne({ aujourdhui, monEchelon, adversairesConnus = [] }) {
  return `Tu ranges les notes dictées d'un joueur de tennis dans son carnet personnel.

Nous sommes le ${aujourdhui}. Le joueur est classé ${monEchelon}.

Découpe la dictée en éléments et envoie chacun à sa destination. Une seule phrase
peut en contenir plusieurs : « il chipait tout, j'ai gagné 6/4 6/2 contre Dupont et
il me faut des surgrips » donne un match, une observation sur l'adversaire, et une course.

Règles :
— N'invente jamais une information absente. Un champ inconnu reste vide.
— Une date dite en clair (« hier », « samedi ») se convertit en AAAA-MM-JJ.
  Sans date dite, laisse le champ vide pour un match ancien, mets aujourd'hui
  pour un match qui vient d'être joué.
— Un conseil est une consigne de jeu qu'on veut retrouver plus tard ; un ressenti
  sur un match précis va dans les notes du match.
— Une remarque sur la façon de jouer d'un adversaire nommé va dans « joueur »,
  même si elle ressemble à un conseil.
— Le classement d'un adversaire ne se devine pas : ne le remplis que s'il est dit.
— Le résumé doit être court et factuel : il sera relu avant enregistrement.
${adversairesConnus.length
  ? `\nAdversaires déjà connus du carnet, à reconnaître malgré l'orthographe de la dictée :\n${adversairesConnus.slice(0, 60).join(', ')}.`
  : ''}`;
}
