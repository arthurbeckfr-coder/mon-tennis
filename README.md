# Mon tennis

Carnet personnel de tennis : historique de matchs, simulateur de classement
FFT, et carnet de conseils consultable en plein match.

Site statique, sans framework, sans base de données, sans compte.
Publié automatiquement sur GitHub Pages à chaque push sur `main`.

---

## Les cinq écrans

| Écran | À quoi il sert |
|---|---|
| **Matchs** | L'historique, avec les points rapportés par chaque victoire, le ratio sur douze mois et le nombre de victoires contre plus fort que soi. |
| **Classement** | « Combien de matchs pour monter ? », répondu en scénarios concrets plutôt qu'en points. |
| **Conseils** | Ce que disent les profs, rangé par profil d'adversaire et par moment du match. |
| **Sur le court** | Le même carnet, en gros caractères, filtrable en deux gestes. Conçu pour les 90 secondes du changement de côté. |
| **Clubs** | Les clubs où l'on a joué, déduits de l'historique : adresse, juge-arbitre, surfaces, comptes à suivre, et le bilan des matchs joués là-bas. |

---

## Où vivent les données

Dans le `localStorage` du navigateur, et nulle part ailleurs. Rien ne part
sur internet, rien n'est stocké sur GitHub.

Ce choix vient d'un usage précis : ce carnet se consulte sur un court, où le
réseau ne passe pas. Une application qui attend une réponse du serveur au
changement de côté ne sert à rien.

**La contrepartie est réelle** : ce qui est saisi sur l'ordinateur n'est pas
sur le téléphone. Le bouton 💾 est le pont entre les deux — il exporte un
fichier JSON qu'on reprend sur l'autre appareil. L'import complète par
défaut au lieu d'écraser, pour qu'un aller-retour ne fasse jamais perdre une
saisie.

---

## Le calcul du classement : vérifié, pas déduit

Tout est dans [`public/js/classement.js`](public/js/classement.js).

Le modèle **n'est pas repris de sources de seconde main**. Il a été confronté
à la page « Bilan de classement » de Ten'Up d'un joueur réel classé 15, sur
ses 28 matchs de la période, et il reproduit les **trois** bilans officiels
au point près :

| Bilan à | Points des victoires retenues | Bonus | Total | Ten'Up |
|---|---|---|---|---|
| 15 | 120+120+60+60+60+30+30+30+30+30+20 = 590 | +20 | **610** | 610 ✅ |
| 5/6 | 90+90+30+30+30+20+20+20+20+20 = 370 | +20 | **390** | 390 ✅ |
| 4/6 | 60+60+20+20+20+15+15+15+15 = 240 | +20 | **260** | 260 ✅ |

Trois enseignements en découlent, dont deux contredisent ce qu'on lit
partout ailleurs.

### Il n'y a pas de « capital de départ »

Le bilan est la somme des meilleures victoires plus les bonus. Rien d'autre.
Il se calcule donc entièrement depuis l'historique : **le bilan ne se saisit
pas**, il s'affiche.

### Le bilan se calcule échelon par échelon

Les points d'une victoire dépendent de l'échelon **visé**, pas de celui
qu'on porte. Battre un 4/6 vaut 120 points quand on se juge à 15, mais
seulement 60 quand on se juge à 4/6. C'est toute la difficulté de monter, et
c'est ce que les simulateurs naïfs ratent.

### Le barème, vérifié valeur par valeur

| Écart avec l'adversaire battu | Points |
|---|---|
| 2 échelons au-dessus ou plus | 120 |
| 1 échelon au-dessus | 90 |
| Même échelon | 60 |
| 1 échelon en dessous | 30 |
| 2 échelons en dessous | 20 |
| 3 échelons en dessous | **15** |
| 4 échelons en dessous ou plus | 0 |

La valeur à trois échelons d'écart faisait débat : 15 selon Wikipédia, 10
selon tennis-classement.fr. C'est **15**, doublement établi — observé sur un
bilan réel, puis confirmé par le document officiel
[*Classement — Barème et Normes 2026*](https://tenup.fft.fr/classement-tennis/agsiyhIAACYAj4yS)
de la fédération, qui formule d'ailleurs chaque ligne « par rapport à
l'échelon de calcul ». Le barème reste modifiable depuis l'application
(Classement → « Voir et corriger le barème »).

Les **21 normes** de `SEUILS` ont été relues ligne à ligne contre ce même
document, hommes et femmes. Le doublon 435/435 en 5/6 et 4/6 chez les
hommes, que je prenais pour une coquille, est bien réel.

### La limitation de montée

Règle officielle, et souvent la vraie raison d'un blocage :

> pour pouvoir prétendre monter à un échelon (sauf pour l'échelon 40), il
> est impératif d'avoir battu un joueur déjà classé à cet échelon (hors WO).

On peut donc avoir les points et rester bloqué, faute d'avoir battu
quelqu'un de l'échelon visé. Le simulateur le vérifie, le dit, et **écarte
les scénarios qui ne passent pas par cette victoire-là** : les proposer
serait faire miroiter une montée qui n'arrivera pas.

### Ce qui reste saisi à la main, et pourquoi

Une seule chose : le **bonus de victoires** — le « +2 » de « victoires
comptabilisées : 9+2 ». La fédération ajoute ou retire des victoires
retenues selon un paramètre nommé **V-E-2I-5G**, dont le document officiel
publie les seuils (2ᵉ série positive, de 15 à 0) :

| V-E-2I-5G | Victoires |  | V-E-2I-5G | Victoires |
|---|---|---|---|---|
| de −20 à −0,1 | 0 |  | de 15 à 22,9 | +3 |
| de 0 à 7,9 | +1 |  | de 23 à 29,9 | +4 |
| de 8 à 14,9 | +2 |  | de 30 à 39,9 | +5 |
|  |  |  | 40 et plus | +6 |

Ce que le document **ne** publie **pas**, c'est la définition exacte des
termes : la pondération des défaites par le coefficient du match, le
traitement des W.O. Les décimales des seuils trahissent des poids
fractionnaires. Sur le cas mesuré, une lecture naïve retombe bien sur le +2
observé à l'échelon 15, mais pas sur le +1 observé à 5/6 — la formule n'est
donc pas reconstituable de façon sûre.

Reconstituer une formule à partir de deux observations produirait un chiffre
faux avec l'assurance d'un chiffre juste. Le bonus reste donc saisi, il vaut
zéro par défaut, et surtout **il n'est appliqué qu'à l'échelon où il a été
relevé** : il change selon l'échelon visé (+2 à 15, +1 à 5/6, +0 à 4/6 sur
le cas mesuré), et l'appliquer partout ferait annoncer des échelons déjà
acquis qui ne le sont pas — l'erreur exactement dans le mauvais sens.

### La fenêtre de calcul

La fédération calcule sur les douze mois précédant son traitement ; ce site
calcule sur les douze mois précédant **aujourd'hui**. Un écart avec le
chiffre officiel est donc normal et attendu : il correspond aux matchs joués
depuis le dernier traitement. C'est, à résultats constants, le bilan du
prochain calcul.

---

## L'import depuis Ten'Up

**Le site ne peut pas aller chercher ces matchs tout seul.** Ten'Up exige une
connexion, n'expose aucune interface publique, et un site n'a pas le droit
d'interroger un autre domaine depuis le navigateur. Le copier-coller est le
seul chemin depuis l'application elle-même.

[`public/js/import-fft.js`](public/js/import-fft.js) relit le bloc collé.
La méthode n'est pas de deviner mais de **se repérer** : la ligne d'issue —
un `V` ou un `D` seul — est la seule impossible à confondre. Tout se lit par
rapport à elle : le classement juste avant, l'année encore avant, le nom
encore avant, le score juste après.

Les pièges déjoués, tous rencontrés pour de vrai sur un palmarès réel :

- **la date de Ten'Up est en dernier**, pas en premier ; découper les blocs
  *à* la date fait hériter chaque match de la date du précédent et du nom du
  suivant ;
- les noms sont **« Prénom NOM »**, pas tout en capitales : chercher la plus
  longue suite de majuscules ramène « MASCULIN PRINTEMPS » ;
- un score `4/6` n'est pas le classement `4/6` ;
- un classement `30/1` seul sur sa ligne ne doit pas être avalé par le score
  qui suit — les jeux sont bornés à un chiffre, un set ne dépassant jamais 7 ;
- « battu par » contient « bat ».

Résultat sur un palmarès réel de 28 matchs : **28 reconnus, 0 ignoré, 0 à
vérifier**. Rien n'est ajouté sans relecture pour autant — chaque ligne est
présentée dans un tableau corrigeable.

### Récupérer plusieurs saisons

Le palmarès Ten'Up n'affiche qu'une saison à la fois. Pour tout reprendre, il
faut parcourir le sélecteur de saison et concaténer — ce que le copier-coller
ne fait pas tout seul. Un historique complet se construit donc saison par
saison, ou par extraction directe depuis un navigateur connecté.

---

## Le terrain cliquable

[`public/js/terrain.js`](public/js/terrain.js) dessine un court vu du dessus,
en SVG, dont chaque zone se touche du pouce. Le même dessin sert des deux
côtés : à **étiqueter** un conseil quand on le note, à le **retrouver** en
match. Ce qui a servi à ranger sert à chercher.

Pourquoi un dessin plutôt qu'une liste de cases : un conseil de tennis parle
presque toujours d'un endroit. « Avance d'un mètre », « joue croisé long »,
« monte derrière ton coup droit » — la liste oblige à traduire, le terrain
non. Et un tracé, contrairement à une photo de court, reste net à toutes les
tailles, fonctionne hors ligne et se colore avec le thème.

Douze coups, de trois natures, parce qu'un coup n'est pas toujours un
endroit :

| Nature | Coups |
|---|---|
| **Zones** cliquables sur le court | Service, Coup droit, Revers, Montée, Volée, Son coup droit, Son revers |
| **Flèches** de direction | Croisé, Long de ligne |
| **Pastilles** à côté | Lob, Smash, Amortie |

L'orientation est celle de la caméra derrière le joueur : mon côté en bas,
l'adversaire en haut. Pour un droitier le coup droit tombe à droite de
l'image, comme sur le court — tout s'inverse pour un gaucher, et c'est le
seul réglage dont le dessin a besoin (Classement → Régler → Ma main).

Chaque zone porte le **nombre de conseils** qu'elle contient, recalculé
d'après les autres filtres actifs : la pastille montre ce qu'il y a vraiment
à lire, pas un total qui ne correspondrait à rien.

Les flèches portent un double tracé — un large invisible pour attraper le
pouce, un fin visible pour l'œil. Viser un trait de deux pixels de large sur
un téléphone serait un jeu d'adresse.

Enfin, le mode court ne montre **qu'un seul sélecteur à la fois** (le coup,
l'adversaire, ou le moment). Un écran qu'il faut faire défiler pour trouver
son conseil a déjà perdu la partie.

---

## Les clubs

La liste des clubs ne se saisit pas : elle se déduit des matchs. Chaque
fiche porte l'adresse, le téléphone, le mail, le juge-arbitre, les surfaces,
les comptes de réseaux sociaux, et l'historique des matchs joués là-bas avec
son bilan.

### Rattacher un match à un club

La fédération ne conserve que le **libellé de l'épreuve** — pas le lieu. D'où
deux niveaux, dans cet ordre :

1. **Le rattachement explicite** (`clubId` sur le match) fait foi. L'import
   le pose quand Ten'Up garde le lien vers la fiche du tournoi, laquelle
   nomme le club organisateur.
2. **Sinon, les mots-clés** du club sont cherchés dans le libellé, en mot
   entier — sans quoi « VEULES » attraperait « VEULETTES », qui est un autre
   club à quinze kilomètres.

Quand deux clubs se reconnaissent dans le même libellé — « TOURNOI TPCV ACE
CREDIT DIEPPE » contient le sigle d'un club et le nom de la ville d'un autre
— on tranche **par la position** : dans un nom d'épreuve, l'organisateur est
cité avant le lieu.

Sur un palmarès réel de 273 matchs : 143 rattachés par le lien Ten'Up, 38 de
plus par mots-clés, **92 sans club**. Ces 92 ne sont pas un défaut de
l'algorithme : ce sont surtout des championnats par équipes, qui se jouent
une fois chez soi et une fois ailleurs sans que ce soit écrit nulle part, et
des libellés qui ne nomment personne (« TOURNOI SENIORS »). L'écran les liste
pour qu'on les rattache à la main.

### Les surfaces

Trois origines, de la plus sûre à la plus faible :

| Origine | Ce que ça vaut |
|---|---|
| **La fiche du tournoi** | Exacte. C'est elle qui tranche quand un club a plusieurs surfaces — Mers-les-Bains a de la terre battue *et* de la résine. |
| **Le club**, s'il n'en a qu'une | Déduite, affichée comme telle. |
| **Ambigu** | Le club en a plusieurs et le tournoi est inconnu : on ne tranche pas, on le dit. |

Sur le même palmarès : 100 surfaces exactes, 43 déduites, 7 ambiguës.

Le vocabulaire est celui de la fédération (résine, béton poreux, terre
artificielle…) et non le vocabulaire courant — c'est celui des fiches de
tournoi, donc celui qui permet de recouper.

---

## Réseaux sociaux des clubs : ce qui n'est pas faisable

L'écran **Clubs** range les comptes et les ouvre d'un geste. Il n'affiche pas
les dernières publications, et ce n'est pas un raccourci :

- Facebook, Instagram et TikTok ont fermé la lecture publique des pages. Il
  faut une autorisation officielle, accordée au **propriétaire** de la page —
  donc au club, pas à son adhérent.
- Sans serveur, un site ne peut pas aller lire un autre domaine depuis le
  navigateur.

**Une porte reste ouverte** : YouTube publie un flux libre par chaîne. Faire
remonter les vidéos ici est faisable — il faudra ajouter un petit serveur.
C'est la seule des quatre plateformes où c'est vrai.

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
    classement.js       barème, seuils, bilan, simulateur (règles FFT)
    import-fft.js       relecture du copier-coller Ten'Up
    forms.js            tous les formulaires
    terrain.js          le court cliquable, en SVG
    theme.js            clair / sombre / comme l'appareil
    util.js             échappement, fenêtres, dates, messages
    views/              un fichier par écran (matchs, classement, coaching, clubs)
.github/workflows/      publication automatique
```

---

## Développer

```bash
npx serve public -l 4321
```

Puis <http://localhost:4321>.

Aucune dépendance, aucune étape de construction : les fichiers de `public/`
sont le site. Si une correction CSS doit arriver chez tout le monde,
incrémenter le `?v=` de la feuille de style dans `index.html`.

---

## Déploiement

Automatique à chaque push sur `main`, via GitHub Pages.

**Aucun secret à configurer** — c'est le point important, et la leçon tirée
d'un dépôt voisin dont le workflow réclamait un `CLOUDFLARE_API_TOKEN` jamais
créé, ce qui condamnait à déployer à la main. Ici, GitHub Pages s'authentifie
avec le jeton fourni d'office à l'action. Pousser suffit.

Le workflow refuse de publier si une ressource externe (police, script,
feuille de style tierce) s'est glissée dans `public/` : le site doit rester
utilisable hors ligne, sur un court.
