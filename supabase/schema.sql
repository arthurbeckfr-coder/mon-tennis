-- Mon tennis — schéma Supabase
--
-- À coller dans l'éditeur SQL de Supabase, en une fois.
-- Projet : ewgbilytqliqzdezcczo
--
-- ─── Pourquoi une seule table, et un seul document JSON ──────────────
--
-- La tentation serait de créer dix tables : matchs, conseils, clubs,
-- raquettes, cordages, chaussures, courses, joueurs, sources, profil. Ce
-- serait la bonne façon de faire pour une application classique, et la
-- mauvaise ici, pour deux raisons.
--
-- D'abord, ce carnet a gagné six domaines en une journée. Chaque nouveau
-- domaine imposerait une migration SQL, à coller à la main dans l'éditeur
-- Supabase avant que le site ne reparte — un frein à chaque idée.
--
-- Ensuite et surtout, la source de vérité n'est pas la base : c'est le
-- navigateur. L'application doit fonctionner sur un court sans réseau, donc
-- elle lit et écrit en local, toujours. La base ne fait que transporter
-- l'état d'un appareil à l'autre. Or transporter un état complet ne demande
-- pas dix tables : il demande un document et une date.
--
-- La fusion, elle, ne se fait pas ici mais dans le navigateur, avec la même
-- logique que l'import d'un fichier : on complète, on n'écrase jamais. Deux
-- appareils qui ont chacun ajouté des choses de leur côté se retrouvent avec
-- la somme des deux, et non avec le dernier qui a parlé.

-- ─── La table ─────────────────────────────────────────────────────────
create table if not exists public.carnets (
  utilisateur uuid primary key references auth.users (id) on delete cascade,
  donnees     jsonb       not null default '{}'::jsonb,
  modifie_le  timestamptz not null default now(),
  appareil    text                                   -- qui a écrit en dernier
);

comment on table  public.carnets is
  'Un carnet par personne. Le navigateur reste la source de vérité ; cette table transporte l''état entre appareils.';
comment on column public.carnets.donnees is
  'L''export complet du carnet, au même format que le fichier du bouton 💾.';
comment on column public.carnets.appareil is
  'Nom lisible du dernier appareil ayant écrit, pour comprendre un écart.';

-- ─── L'horodatage, tenu par la base et non par le client ──────────────
-- Un téléphone dont l'heure est fausse ne doit pas pouvoir se faire passer
-- pour la version la plus récente.
create or replace function public.touche_carnet()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.modifie_le := now();
  return new;
end;
$$;

drop trigger if exists carnets_modifie_le on public.carnets;
create trigger carnets_modifie_le
  before insert or update on public.carnets
  for each row execute function public.touche_carnet();

-- ─── Chacun chez soi ──────────────────────────────────────────────────
-- Sans ces règles, la clé publique du site — qui est dans la page, donc
-- lisible par tout le monde — donnerait accès à tous les carnets. Avec
-- elles, elle ne donne accès qu'au sien, et seulement une fois connecté.
alter table public.carnets enable row level security;

drop policy if exists "lire son carnet"      on public.carnets;
drop policy if exists "créer son carnet"     on public.carnets;
drop policy if exists "modifier son carnet"  on public.carnets;
drop policy if exists "supprimer son carnet" on public.carnets;

create policy "lire son carnet" on public.carnets
  for select using (auth.uid() = utilisateur);

create policy "créer son carnet" on public.carnets
  for insert with check (auth.uid() = utilisateur);

create policy "modifier son carnet" on public.carnets
  for update using (auth.uid() = utilisateur)
           with check (auth.uid() = utilisateur);

create policy "supprimer son carnet" on public.carnets
  for delete using (auth.uid() = utilisateur);

-- ─── Vérification ─────────────────────────────────────────────────────
-- Doit rendre une ligne : carnets, rowsecurity = true, 4 policies.
select
  c.relname                                   as table,
  c.relrowsecurity                            as securite_active,
  (select count(*) from pg_policies p
    where p.schemaname = 'public' and p.tablename = 'carnets') as nb_regles
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'carnets';
