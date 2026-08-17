/* L'adresse du carnet en ligne.

   Cette clé est publique, et c'est voulu : Supabase l'appelle « publishable »
   pour cette raison. Elle ne donne aucun droit par elle-même — ce sont les
   règles de sécurité de la base (voir supabase/schema.sql) qui décident, et
   elles n'autorisent que la lecture et l'écriture de son propre carnet, une
   fois connecté. Sans compte, elle ne permet rien : une écriture anonyme est
   refusée par la base elle-même.

   La clé qui ne doit JAMAIS figurer ici est la clé secrète
   (`sb_secret_…` / `service_role`) : celle-là contourne toutes les règles.
   Le déploiement refuse d'ailleurs de publier si elle apparaît. */

export const SUPABASE_URL = 'https://ewgbilytqliqzdezcczo.supabase.co';
export const SUPABASE_CLE = 'sb_publishable_Yy0xYYEZFfpGenYL_lMM4Q_DRKNrZq5';

/* Le site de la fédération, vers lequel ce carnet renvoie sans jamais
   pouvoir y entrer : Ten'Up demande une connexion et n'ouvre aucun accès
   aux applications extérieures. On envoie donc à la porte, et la session
   du navigateur fait le reste — d'où l'adresse d'accueil plutôt qu'une
   page interne, dont le chemin changerait sans prévenir. */
export const URL_TENUP = 'https://tenup.fft.fr/';
