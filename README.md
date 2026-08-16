# Mon tennis

Carnet personnel de tennis : historique de matchs, simulateur de classement
FFT, et carnet de conseils consultable en plein match.

Site statique, sans framework, sans base de données, sans compte.
Publié automatiquement sur GitHub Pages à chaque push sur `main`.

---

## Les quatre écrans

| Écran | À quoi il sert |
|---|---|
| **Matchs** | L'historique, avec les points rapportés par chaque victoire, le ratio sur douze mois glissants et le nombre de victoires contre plus fort que soi. |
| **Classement** | « Combien de matchs il me faut pour monter ? », répondu en scénarios concrets plutôt qu'en points. |
| **Conseils** | Ce que disent les profs, rangé par profil d'adversaire et par moment du match. |
| **Sur le court** | Le même carnet, en gros caractères, filtrable en deux gestes. Conçu pour les 90 secondes du changement de côté. |
| **Clubs** | Les comptes des clubs suivis, ouvrables d'un geste. |

---

## Où vivent les données

Dans le `localStorage` du navigateur, et nulle part ailleurs. Rien ne part
sur internet, rien n'est stocké sur GitHub.

Ce choix vient d'un usage précis : ce carnet se consulte sur un court, où
le réseau ne passe pas. Une application qui attend une réponse du serveur
au changement de côté ne sert à rien.

**La contrepartie est réelle** : ce qui est saisi sur l'ordinateur n'est pas
sur le téléphone. Le bouton 💾 de la barre du haut est le pont entre les
deux — il exporte un fichier JSON qu'on reprend sur l'autre appareil.
L'import complète par défaut au lieu d'écraser, pour qu'un aller-retour ne
fasse jamais perdre une saisie.

---

## Les règles FFT : ce qui est vérifié, ce qui ne l'est pas

Tout est rassemblé dans [`public/js/classement.js`](public/js/classement.js).
Ces règles bougent — la 5ᵉ série est née le 1ᵉʳ juillet 2025 — d'où le
fichier unique.

**Recoupé par deux sources indépendantes** (Wikipédia et tennis-classement.fr) :
le barème des victoires selon l'écart d'échelons.

| Écart avec l'adversaire battu | Points |
|---|---|
| 2 échelons au-dessus ou plus | 120 |
| 1 échelon au-dessus | 90 |
| Même échelon | 60 |
| 1 échelon en dessous | 30 |
| 2 échelons en dessous | 20 |
| 3 échelons en dessous | 15 ⚠️ |
| 4 échelons en dessous ou plus | 0 |

⚠️ Seul point de désaccord entre les sources : 15 points selon Wikipédia,
10 selon tennis-classement.fr. La valeur haute est retenue, **et le barème
est modifiable dans l'application** (écran Classement → « Voir et corriger
le barème »). Si Ten'Up dit autre chose, la correction prend dix secondes
et tout le simulateur suit.

**Recopié d'une seule source** : les seuils de bilan minimum et le nombre de
victoires exigé par échelon. Une anomalie y subsiste (5/6 et 4/6 sont donnés
au même bilan de 435 chez les hommes) ; elle est recopiée telle quelle plutôt
que corrigée à l'aveugle.

**Non modélisé, faute de source fiable** :

- Le **capital de départ** par échelon n'est publié nulle part de sérieux.
  C'est pourquoi le simulateur ne recalcule jamais un bilan à partir de
  zéro : il part du bilan affiché par Ten'Up et raisonne sur l'écart
  restant. Moins ambitieux, mais juste.
- Les **bonus** (victoires en tournoi, absence de défaite marquante) sont
  ignorés. Ils ne peuvent que jouer en votre faveur : le simulateur est
  donc légèrement pessimiste, ce qui est le bon sens de l'erreur.

Le simulateur modélise en revanche correctement le **jeu des remplacements** :
seules les meilleures victoires comptent, en nombre limité. Une fois le quota
atteint, une victoire supplémentaire ne s'ajoute pas — elle remplace la moins
bonne et ne rapporte que la différence. C'est ce qui explique qu'une victoire
facile ne fasse parfois rien bouger.

---

## L'import depuis Ten'Up

**Il n'existe aucun moyen d'aller chercher ces matchs automatiquement.**
Ten'Up exige une connexion, n'expose aucune interface publique, et un site
n'a de toute façon pas le droit d'interroger un autre domaine depuis le
navigateur. Toute promesse d'import « automatique » serait mensongère.

Le chemin qui marche : ouvrir son palmarès sur Ten'Up, tout copier, coller
dans l'application. [`public/js/import-fft.js`](public/js/import-fft.js)
relit ce bloc de texte — il tolère aussi bien un match par ligne qu'un match
étalé sur cinq lignes, et les tableaux copiés avec des tabulations.

Rien n'est ajouté sans relecture : chaque ligne comprise est présentée dans
un tableau corrigeable, et celles où l'issue ou le classement manquent sont
surlignées.

Les pièges déjoués par l'analyseur, tous rencontrés pour de vrai :

- un score `4/6` n'est pas le classement `4/6` — les scores sont reconnus
  par séquences d'au moins deux jeux ;
- un classement `30/1` seul sur sa ligne ne doit pas être avalé par le score
  qui suit — les jeux sont bornés à un chiffre, puisqu'un set ne dépasse
  jamais 7 ;
- « battu par » contient « bat » — la défaite est testée avant la victoire ;
- le nom du tournoi, souvent capitalisé, ne doit pas se coller au patronyme.

---

## Réseaux sociaux des clubs : ce qui n'est pas faisable

L'écran **Clubs** range les comptes et les ouvre d'un geste. Il n'affiche pas
les dernières publications, et ce n'est pas un raccourci :

- Facebook, Instagram et TikTok ont fermé la lecture publique des pages.
  Il faut une autorisation officielle, accordée au **propriétaire** de la
  page — donc au club, pas à son adhérent.
- Sans serveur, un site ne peut pas aller lire un autre domaine depuis le
  navigateur.

**Une porte reste ouverte** : YouTube publie un flux libre par chaîne. Faire
remonter les vidéos ici est faisable — il faudra ajouter un petit serveur
(une fonction Cloudflare ou équivalent). C'est la seule des quatre
plateformes où c'est vrai.

---

## Structure

```
public/
  index.html            ossature, barres, chien de garde du démarrage
  manifest.json         installable sur l'écran d'accueil du téléphone
  css/style.css         toute la couleur passe par les variables de :root
  js/
    app.js              routeur, bouton +, démarrage
    store.js            les données, l'export et l'import
    classement.js       échelons, barème, seuils, simulateur (règles FFT)
    import-fft.js       relecture du copier-coller Ten'Up
    forms.js            tous les formulaires
    theme.js            clair / sombre / comme l'appareil
    util.js             échappement, fenêtres, dates, messages
    views/              un fichier par écran
.github/workflows/      publication automatique
```

---

## Développer

```bash
npx serve public -l 4321
```

Puis <http://localhost:4321>.

Aucune dépendance, aucune étape de construction : les fichiers de `public/`
sont le site.

Si une correction CSS doit arriver chez tout le monde, incrémenter le `?v=`
de la feuille de style dans `index.html`.

---

## Déploiement

Automatique à chaque push sur `main`, via GitHub Pages.

**Aucun secret à configurer** — c'est le point important, et la leçon tirée
du site santé, dont le workflow réclamait un `CLOUDFLARE_API_TOKEN` jamais
créé, ce qui condamnait à déployer à la main. Ici, GitHub Pages s'authentifie
avec le jeton fourni d'office à l'action. Pousser suffit.

Le workflow refuse de publier si une ressource externe (police, script,
feuille de style tierce) s'est glissée dans `public/` : le site doit rester
utilisable hors ligne.
