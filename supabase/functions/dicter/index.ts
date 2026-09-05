/* Ranger une dictée, avec l'aide de Claude.
 *
 * ─── Pourquoi une fonction serveur ───────────────────────────────────
 *
 * La clé de l'API ne peut pas vivre dans une page publique : elle y serait
 * lue en trois secondes et facturée à quelqu'un d'autre. Elle vit donc
 * ici, dans un secret du projet Supabase, et la page n'appelle que cette
 * fonction — avec son propre jeton de session. Sans compte, pas de tri
 * assisté.
 *
 * ─── Qui a le droit d'appeler ────────────────────────────────────────
 *
 * La fonction vérifie elle-même, plutôt que de laisser la plateforme le
 * faire à sa place. Le garde-fou de Supabase attend un jeton signé par
 * l'ancien secret ; les sessions d'aujourd'hui sont signées autrement, et
 * un carnet qui marche aurait été refusé à la porte sans qu'on sache
 * pourquoi.
 *
 * On demande donc à Supabase qui est ce jeton. S'il ne répond pas un
 * utilisateur, on s'arrête là : cette fonction dépense de l'argent à
 * chaque appel, et une porte ouverte serait une porte ouverte sur le
 * portefeuille de quelqu'un.
 *
 * ─── Ce que Claude fait, et ce qu'il ne fait pas ─────────────────────
 *
 * Il découpe, il range, il rattache. Il n'enregistre rien : la réponse
 * revient à la page, qui la montre et attend un geste. Une dictée mal
 * comprise doit se corriger sur-le-champ, pas se découvrir trois semaines
 * plus tard au milieu des statistiques.
 *
 * Et surtout, il choisit dans des listes fermées. Le carnet lui envoie ses
 * adversaires, ses tournois, ses clubs ; il doit y puiser avant d'inventer
 * un nom. « L'open de Puys » dicté trois fois de trois façons ferait sinon
 * trois tournois, et le palmarès compterait trois titres là où il y en a
 * un.
 *
 * ─── Déployer ────────────────────────────────────────────────────────
 *
 *   supabase secrets set ANTHROPIC_API_KEY=sk-ant-…
 *   supabase functions deploy dicter
 */

const MODELE = 'claude-sonnet-5';

/* Le format de sortie, décrit à Claude comme un outil. C'est plus sûr
   qu'un « réponds en JSON » : l'API garantit alors la forme, et l'on n'a
   pas à rattraper une virgule manquante. */
const OUTIL = {
  name: 'ranger',
  description: "Range une dictée dans les cases du carnet de tennis.",
  input_schema: {
    type: 'object',
    properties: {
      elements: {
        type: 'array',
        description: 'Un élément par chose à ranger. Une dictée en contient souvent plusieurs.',
        items: {
          type: 'object',
          properties: {
            destination: { type: 'string', enum: ['match', 'conseil', 'course', 'cordage', 'joueur'] },
            resume: { type: 'string', description: 'Une ligne pour reconnaître cet élément dans la liste.' },
            match: {
              type: 'object',
              properties: {
                date: { type: 'string', description: 'AAAA-MM-JJ. Aujourd\'hui si rien n\'est dit.' },
                issue: { type: 'string', enum: ['V', 'D'] },
                adversaire: { type: 'string' },
                echelonAdverse: { type: 'string' },
                score: { type: 'string', description: 'Sets séparés par une espace : « 6/4 7/5 ».' },
                tournoi: { type: 'string' },
                tour: { type: 'string', enum: ['finale', 'demie', 'quart', 'huitieme', 'seizieme',
                                               'trentedeuxieme', 'tour1', 'poule', 'qualif', ''] },
                surface: { type: 'string' },
                duree: { type: 'number', description: 'En minutes.' },
                wo: { type: 'boolean' },
                notes: { type: 'string', description: 'Le ressenti, ce qui a marché — pas le score.' },
              },
            },
            conseil: {
              type: 'object',
              properties: {
                titre: { type: 'string', description: 'Court : c\'est ce qu\'on lit en pleine partie.' },
                texte: { type: 'string' },
                categorie: { type: 'string', enum: ['tactique', 'technique', 'mental', 'physique'] },
                profils: { type: 'array', items: { type: 'string' } },
                moments: { type: 'array', items: { type: 'string' } },
                coups: { type: 'array', items: { type: 'string' } },
                source: { type: 'string', description: 'Qui l\'a dit, si c\'est dit.' },
              },
            },
            course: {
              type: 'object',
              properties: {
                nom: { type: 'string' },
                categorie: { type: 'string', enum: ['materiel', 'textile', 'soin', 'autre'] },
                recurrent: { type: 'boolean' },
                note: { type: 'string' },
              },
            },
            cordage: {
              type: 'object',
              properties: {
                cause: { type: 'string', enum: ['casse', 'usure', 'confort', 'autre'] },
                marque: { type: 'string' },
                tension: { type: 'string' },
                note: { type: 'string' },
              },
            },
            joueur: {
              type: 'object',
              properties: {
                nom: { type: 'string' },
                club: { type: 'string' },
                profils: { type: 'array', items: { type: 'string' } },
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

function consignes(c: Record<string, unknown>) {
  const liste = (x: unknown) => (Array.isArray(x) && x.length ? x.join(' · ') : '—');
  return `Tu ranges la dictée d'un joueur de tennis dans son carnet. Il parle en
marchant, souvent en une seule phrase, et une phrase contient souvent
plusieurs choses : un match, un conseil du prof, un truc à racheter.

DÉCOUPE
Un élément par chose à ranger. « J'ai gagné 6/4 6/2 contre Dupont, il
chipait tout, et il me faut des surgrips » fait trois éléments : un match,
un conseil, une course. Ne fusionne jamais deux choses de nature
différente dans un même élément.

CHOISIS DANS SES LISTES, N'INVENTE PAS
Ce carnet existe déjà. Quand ce qu'il dit ressemble à une entrée connue,
reprends le libellé exact de la liste, à la lettre près — majuscules
comprises. C'est vrai pour l'adversaire, le tournoi, le club, la surface.
Un même tournoi écrit de trois façons ferait trois tournois, et son
palmarès compterait trois titres au lieu d'un.
Si rien ne correspond vraiment, écris ce qu'il a dit — mais ne force
jamais un rapprochement douteux : deux noms qui se ressemblent ne sont pas
le même joueur.

SES ADVERSAIRES : ${liste(c.adversaires)}
SES TOURNOIS : ${liste(c.tournois)}
SES CLUBS : ${liste(c.clubs)}
SURFACES POSSIBLES : ${liste(c.surfaces)}
ÉCHELONS POSSIBLES : ${liste(c.echelons)}
CATÉGORIES DE CONSEIL : tactique · technique · mental · physique
PROFILS D'ADVERSAIRE : ${liste(c.profils)}
MOMENTS : ${liste(c.moments)}
COUPS : ${liste(c.coups)}
Pour les profils, moments et coups, n'emploie que les clés de ces listes.

CE QUE TU NE DEVINES PAS
Rien. Un champ dont il n'a pas parlé reste vide. N'invente ni score, ni
classement, ni durée, ni surface : une valeur fausse dans un carnet vaut
moins qu'une case vide, parce qu'elle se propage aux statistiques sans
qu'on la voie.
Le classement de l'adversaire ne se déduit pas du nom : s'il ne le dit
pas, laisse vide — même si ce joueur figure dans ses adversaires.

DÉTAILS
Aujourd'hui : ${c.aujourdhui}. Son classement à lui : ${c.echelon}.
« Gagné », « battu X » → V. « Perdu », « battu par X » → D.
Le score s'écrit « 6/4 7/5 », dans l'ordre où il le dit, son score d'abord.
Une durée dite en heures se convertit en minutes.
Le titre d'un conseil est court : on le lit debout, entre deux jeux.
Les notes d'un match, c'est le ressenti — jamais le score, qui a sa case.`;
}

Deno.serve(async (req: Request) => {
  /* Le navigateur demande la permission avant d'envoyer : sans cette
     réponse, l'appel n'a jamais lieu et l'on croit la fonction morte.

     La liste des en-têtes autorisés doit nommer chacun de ceux qu'on
     envoie,  compris : un en-tête sur mesure absent de
     cette liste fait refuser la requête avant même qu'elle parte, et la
     promesse échoue sans rien dire. */
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'access-control-allow-origin': '*',
        'access-control-allow-headers': 'authorization, content-type, apikey, x-cle-publique, x-jeton',
        'access-control-allow-methods': 'POST, OPTIONS',
      },
    });
  }

  if (req.method !== 'POST') {
    return json({ erreur: 'POST attendu.' }, 405);
  }

  const qui = await utilisateur(req);
  if (!qui.ok) {
    /* On distingue les trois refus : sans jeton, sans clé, ou jeton
       refusé par la base. « Connecte-toi » répondu à une clé manquante
       envoie chercher pendant une heure du côté du mot de passe. */
    return json({ erreur: qui.pourquoi }, 401);
  }

  const cle = Deno.env.get('ANTHROPIC_API_KEY');
  if (!cle) return json({ erreur: 'La clé de l\'API n\'est pas posée sur le projet.' }, 500);


  let corps: Record<string, unknown>;
  try { corps = await req.json(); }
  catch { return json({ erreur: 'Corps illisible.' }, 400); }

  const texte = String(corps.texte || '').trim();
  if (!texte) return json({ erreur: 'Rien à ranger.' }, 400);
  /* Une dictée fait quelques phrases. Au-delà, ce n'est plus une dictée :
     on coupe plutôt que de payer un roman. */
  if (texte.length > 4000) return json({ erreur: 'Dictée trop longue.' }, 400);

  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': cle,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODELE,
      max_tokens: 2000,
      /* Zéro : on veut le même rangement pour la même phrase. Un carnet
         qui range différemment d'une fois sur l'autre n'est pas un
         carnet. */
      temperature: 0,
      system: consignes(corps),
      tools: [OUTIL],
      tool_choice: { type: 'tool', name: 'ranger' },
      messages: [{ role: 'user', content: texte }],
    }),
  });

  if (!r.ok) {
    const d = await r.text();
    console.error('anthropic', r.status, d.slice(0, 400));
    return json({ erreur: `Le tri assisté n'a pas répondu (${r.status}).` }, 502);
  }

  const d = await r.json();
  const outil = (d.content || []).find((c: { type: string }) => c.type === 'tool_use');
  const elements = outil?.input?.elements;
  if (!Array.isArray(elements)) return json({ erreur: 'Réponse inattendue.' }, 502);

  return json({ elements });
});

/** La clé publique du projet, quel que soit le nom qu'elle porte.
 *
 *  `SUPABASE_ANON_KEY` est marquée dépréciée dans le tableau de bord et
 *  finira par disparaître ; la nouvelle, `SUPABASE_PUBLISHABLE_KEYS`, est
 *  un dictionnaire JSON de plusieurs clés. On prend la première venue :
 *  elles ouvrent toutes la même porte, celle qui ne donne accès à rien
 *  sans jeton d'utilisateur.
 *
 *  Le jour où l'ancienne s'en va, cette fonction continue — plutôt que
 *  de refuser tout le monde un matin, sans qu'on ait rien touché.
 */
function clePublique(): string {
  const ancienne = Deno.env.get('SUPABASE_ANON_KEY');
  if (ancienne) return ancienne;
  const dict = Deno.env.get('SUPABASE_PUBLISHABLE_KEYS');
  if (dict) {
    try {
      const o = JSON.parse(dict);
      const v = Array.isArray(o) ? o[0] : Object.values(o)[0];
      if (typeof v === 'string') return v;
      if (v && typeof v === 'object' && typeof (v as { api_key?: string }).api_key === 'string') {
        return (v as { api_key: string }).api_key;
      }
    } catch { /* dictionnaire illisible : on tentera avec le jeton */ }
  }
  return '';
}

/** L'utilisateur derrière le jeton, ou null.
 *
 *  On ne lit pas le jeton nous-mêmes : on le donne à Supabase, qui sait
 *  s'il est valide, s'il a expiré et à qui il appartient. Vérifier une
 *  signature à la main, c'est écrire un bout de sécurité de plus — et
 *  celui-là, personne ne le relit jamais.
 */
async function utilisateur(req: Request) {
  /* Le jeton voyage lui aussi sous un nom à nous. La passerelle des
     fonctions se sert de  pour son propre compte et y
     laisse sa propre valeur : on lisait bien quelque chose, mais pas la
     session — d'où un « jeton invalide » sur une session parfaitement
     valide. Ce qu'une passerelle touche ne peut pas servir de preuve. */
  const jeton = (req.headers.get('x-jeton')
    || (req.headers.get('authorization') || '').replace(/^Bearers+/i, '')).trim();
  if (!jeton) return { ok: false, pourquoi: 'Connecte-toi pour le tri assisté.' };

  const base = Deno.env.get('SUPABASE_URL');
  if (!base) return { ok: false, pourquoi: 'Le projet ne dit pas son adresse.' };

  /* La clé publique du projet, que `/auth/v1/user` exige en plus du
     jeton. On prend d'abord celle que l'appelant nous tend : elle est
     publique — elle est écrite en clair dans la page — et elle ne donne
     accès à rien sans un jeton d'utilisateur valide, qui est le vrai
     laissez-passer. La demander à l'environnement d'abord semblait plus
     propre, mais `SUPABASE_ANON_KEY` y est annoncée puis absente : la
     fonction refusait alors tout le monde, jeton valide compris.

     L'ordre compte donc : ce que l'appelant fournit, puis ce que le
     projet expose, et jamais le jeton en guise de clé — la base répond
     « Invalid API key », ce qui ressemble à s'y méprendre à « tu n'es
     personne ». */
  /* Sous un nom à nous : la passerelle des fonctions lit `apikey` pour
     son propre compte et ne la transmet pas toujours. Un en-tête qu'elle
     ne connaît pas traverse intact. */
  const publique = (req.headers.get('x-cle-publique')
    || req.headers.get('apikey') || '').trim() || clePublique();
  if (!publique) return { ok: false, pourquoi: "Clé publique absente de l'appel." };

  try {
    const r = await fetch(`${base}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${jeton}`, apikey: publique },
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || !d?.id) {
      return { ok: false,
        pourquoi: `Session refusée par la base (${r.status}${d?.msg ? ' — ' + d.msg : ''}).` };
    }
    return { ok: true, id: d.id };
  } catch (e) {
    return { ok: false, pourquoi: `Vérification impossible : ${(e as Error).message}` };
  }
}

function json(donnees: unknown, statut = 200) {
  return new Response(JSON.stringify(donnees), {
    status: statut,
    headers: {
      'content-type': 'application/json',
      /* Le site est servi depuis un autre domaine que la fonction : sans
         ces en-têtes, le navigateur refuse la réponse avant de la lire. */
      'access-control-allow-origin': '*',
      'access-control-allow-headers': 'authorization, content-type, apikey, x-cle-publique, x-jeton',
    },
  });
}
