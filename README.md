# SN Streaming

**SN Streaming** est une plateforme de streaming développée en **HTML, CSS et JavaScript vanilla**, sans framework, sans base de données et sans système de build.

Le projet propose une interface de streaming complète avec catalogue de films, lecteur vidéo personnalisé, comptes utilisateurs, favoris, historique, reprise de lecture, recherche avancée et statistiques.

> **Projet personnel / expérimental — utilisation à vos propres risques.**

---

## Fonctionnalités

* Catalogue de **35+ films**
* Affiches provenant de **TMDB**
* Lecteur vidéo personnalisé
* Reprise automatique de la lecture
* Sauvegarde de la progression toutes les 4 secondes
* Historique des films regardés
* Watchlist des films en cours
* Système de favoris
* Comptes utilisateurs locaux
* Sessions via cookies
* Statistiques de visionnage
* Top 10 personnel
* Film du jour
* Fonction **« Surprends-moi »**
* Films similaires basés sur les genres
* Recherche simple
* Recherche avancée :

  * année minimale / maximale
  * note minimale
  * genre
  * titre
  * réalisateur
  * casting
* Thème sombre / clair
* Interface responsive et mobile-first
* Menu mobile
* Contrôles tactiles
* Raccourcis clavier du lecteur
* Support du plein écran
* Vitesse de lecture réglable
* Gestion du volume et de la barre de progression

---

## Aperçu du projet

### Pages principales

| Page                    | Description                                                    |
| ----------------------- | -------------------------------------------------------------- |
| `index.html`            | Accueil, hero, genres, catalogue, Top 10 et reprise de lecture |
| `movie.html`            | Page détaillée d'un film et lecteur vidéo                      |
| `parametres.html`       | Compte, favoris, watchlist et statistiques                     |
| `favoris.html`          | Liste personnelle des favoris                                  |
| `historique.html`       | Historique complet des visionnages                             |
| `mentions-legales.html` | Mentions légales                                               |

---

## Structure du projet

```text
sn-streaming/
│
├── index.html
├── movie.html
├── parametres.html
├── favoris.html
├── historique.html
├── mentions-legales.html
├── lancer.bat
├── server.js
│
├── css/
│   └── style.css
│
└── js/
    ├── data.js
    ├── accounts.js
    ├── app.js
    ├── home.js
    ├── detail.js
    ├── player.js
    └── parametres.js
```

---

## Technologies

* **HTML5**
* **CSS3**
* **JavaScript Vanilla**
* **Node.js** pour le serveur local
* **Cookies / Local Storage**
* **GitHub Pages** pour l'hébergement statique

Le projet ne nécessite :

* aucun framework ;
* aucune dépendance front-end ;
* aucune base de données ;
* aucun système de compilation ;
* aucun `npm install` pour le fonctionnement du site statique.

---

## Fonctionnement des comptes

Les comptes sont gérés localement dans le navigateur.

Les utilisateurs disposent notamment de données séparées pour :

```text
sn_users
sn_session
sn_history_<hash>
sn_fav_<hash>
```

Chaque utilisateur possède donc son propre :

* historique ;
* watchlist ;
* système de favoris ;
* session.

Les utilisateurs non connectés utilisent les données locales générales :

```text
sn_history
sn_fav
```

Les mots de passe ne sont pas stockés directement en clair : le projet utilise un hash local côté navigateur.

> Ce système de comptes est destiné à un usage local/expérimental et **ne constitue pas un système d'authentification sécurisé pour une application de production**.

---

## Reprise de lecture

La progression d'un film est automatiquement enregistrée pendant la lecture.

La position est sauvegardée environ toutes les **4 secondes**.

Lorsqu'un film est terminé :

* il est marqué comme terminé ;
* il est retiré de la watchlist ;
* il reste dans l'historique.

La reprise est automatiquement proposée lors d'une nouvelle lecture.

---

## Ajouter un film

Les films sont définis dans :

```text
js/data.js
```

Pour ajouter un film :

1. Ouvrir `js/data.js`
2. Copier le dernier objet du catalogue
3. Incrémenter son `id`
4. Renseigner les informations du film

Exemple de structure :

```js
{
    id: 36,
    title: "Nom du film",
    year: 2026,
    rating: 7.5,
    genres: ["Action", "Thriller"],
    duration: "1h 50min",
    synopsis: "Description du film...",
    director: "Réalisateur",
    cast: ["Acteur 1", "Acteur 2"],
    poster: "https://media.themoviedb.org/t/p/w500/...",
    source: "https://exemple.com/video.mp4"
}
```

Puis sauvegarder et effectuer un rechargement forcé :

```text
Ctrl + F5
```

---

## Fichiers importants

### `js/data.js`

Contient le catalogue des films.

**C'est le fichier principal à modifier pour ajouter ou supprimer un film.**

### `js/accounts.js`

Gère :

* les comptes ;
* les sessions ;
* les cookies ;
* les données utilisateur.

### `js/app.js`

Contient les fonctions communes :

* affiches ;
* cartes de films ;
* grilles ;
* notifications ;
* historique ;
* favoris ;
* watchlist ;
* statistiques ;
* Top 10 ;
* films similaires ;
* recherche avancée ;
* film du jour ;
* film aléatoire.

### `js/home.js`

Gère la page d'accueil :

* hero ;
* film du jour ;
* genres ;
* reprise de lecture ;
* Top 10 ;
* catalogue ;
* filtres ;
* recherche.

### `js/detail.js`

Gère la page d'un film :

* informations ;
* lecture ;
* reprise ;
* favoris ;
* partage ;
* suivi de progression ;
* films similaires.

### `js/player.js`

Gère le lecteur :

* lecture / pause ;
* progression ;
* volume ;
* vitesse ;
* plein écran ;
* raccourcis clavier.

### `js/parametres.js`

Gère :

* connexion ;
* inscription ;
* déconnexion ;
* suppression du compte ;
* watchlist ;
* favoris ;
* statistiques.

### `css/style.css`

Contient le design complet du site :

* thème sombre / clair ;
* variables CSS ;
* cartes ;
* grilles ;
* hero ;
* lecteur ;
* statistiques ;
* recherche ;
* responsive design.

---

# Lancement en local

Le projet contient un serveur Node permettant notamment de servir les fichiers et de gérer le proxy vidéo local.

### Prérequis

* **Node.js 18+**
* Windows pour utiliser `lancer.bat`

### Démarrage

Double-cliquer sur :

```text
lancer.bat
```

Le serveur démarre sur :

```text
http://127.0.0.1:8766/
```

Il est également possible de lancer manuellement :

```bash
node server.js
```

---

## Serveur local

`server.js` fournit :

* le serveur de fichiers statiques ;
* le proxy `/proxy?url=...` ;
* la gestion nécessaire à certains flux vidéo.

Le proxy est notamment utilisé pour certains liens **Sibnet** qui nécessitent une gestion spécifique des requêtes et redirections.

---

# Hébergement GitHub Pages

Le projet peut fonctionner comme site statique sur GitHub Pages.

Le site actuellement prévu pour le projet est :

**synnox.github.io/test/**

Sur GitHub Pages, le projet fonctionne uniquement avec les fichiers statiques.

### Important concernant le proxy

GitHub Pages ne permet pas d'exécuter le serveur Node.js `server.js`.

Par conséquent :

```text
Local
HTML/CSS/JS + Node.js + Proxy
        ↓
Flux compatibles avec le proxy
```

alors que :

```text
GitHub Pages
HTML/CSS/JS uniquement
        ↓
Pas de serveur Node
        ↓
Pas de proxy Sibnet
```

Les sources vidéo nécessitant le proxy local ne fonctionneront donc pas nécessairement sur GitHub Pages.

Les sources directes compatibles avec le navigateur peuvent cependant fonctionner en ligne.

---

## Problèmes possibles avec certains liens vidéo

Certains hébergeurs vidéo peuvent :

* expirer leurs liens ;
* bloquer certaines requêtes ;
* renvoyer `403 Forbidden` ;
* modifier leurs protections ;
* nécessiter certains paramètres HTTP ;
* empêcher la lecture depuis certains domaines.

Les liens vidéo externes ne sont donc pas garantis dans le temps.

Un lien vidéo expiré peut nécessiter la mise à jour de la propriété :

```js
source: "..."
```

dans `js/data.js`.

---

# Cache Busting

Le projet utilise un paramètre de version dans les fichiers HTML afin d'éviter certains problèmes de cache navigateur.

Version actuelle :

```text
?v=20260919
```

Après une modification importante de JavaScript ou CSS, mettre à jour cette version dans les fichiers HTML concernés.

Exemple :

```html
<script src="js/app.js?v=20260919"></script>
```

devient par exemple :

```html
<script src="js/app.js?v=20260920"></script>
```

Puis effectuer :

```text
Ctrl + F5
```

---

# Responsive Design

SN Streaming est conçu en **mobile-first**.

Le site prend notamment en charge :

* smartphones ;
* tablettes ;
* ordinateurs ;
* écrans larges ;
* navigation tactile ;
* menu burger ;
* `safe-area-inset` pour les appareils mobiles.

---

# Données et confidentialité

Le projet fonctionne principalement côté client.

Les données utilisateur sont conservées localement dans le navigateur, notamment via les cookies et le stockage local utilisé par l'application.

Il n'y a actuellement :

* aucune base de données distante ;
* aucun serveur d'authentification ;
* aucune synchronisation entre appareils ;
* aucun compte centralisé.

La suppression des données du navigateur peut donc entraîner la perte de l'historique, des favoris et des autres données locales.

---

# Limites actuelles

Les fonctionnalités suivantes ne sont pas encore complètement implémentées :

* [ ] Séries
* [ ] Gestion des saisons et épisodes
* [ ] Sous-titres `.vtt` / `.srt`
* [ ] Sélection de qualité vidéo
* [ ] Import / export JSON des favoris et watchlist
* [ ] Synchronisation entre appareils
* [ ] PWA
* [ ] Service Worker
* [ ] Manifest mobile

Une partie de la structure nécessaire aux séries existe déjà dans `app.js` et `detail.js`, mais les données et l'interface des épisodes restent à développer.

---

# Avertissement légal et responsabilité

**SN Streaming est un projet personnel et expérimental.**

Le développeur de ce projet **ne fournit pas, ne contrôle pas et n'héberge pas nécessairement les contenus vidéo accessibles via les sources externes référencées dans le catalogue**.

Les liens présents dans `js/data.js` peuvent pointer vers des services, hébergeurs ou ressources appartenant à des tiers. Le développeur n'est pas responsable du contenu de ces services tiers, de leur disponibilité, de leur légalité, de leurs conditions d'utilisation ou de leurs pratiques.

**L'utilisateur est seul responsable de l'utilisation qu'il fait du projet et des ressources auxquelles il accède par son intermédiaire.**

Le développeur ne saurait être tenu responsable :

* de contenus hébergés par des services tiers ;
* de liens ajoutés ou modifiés par des utilisateurs ;
* de l'utilisation illégale ou abusive du projet ;
* de violations éventuelles de droits d'auteur commises par des tiers ;
* de la disponibilité ou de la disparition des sources externes ;
* des changements de fonctionnement des hébergeurs vidéo ;
* des éventuels dommages résultant de l'utilisation du logiciel.

Les utilisateurs doivent respecter les **lois applicables dans leur pays**, ainsi que les droits d'auteur et les conditions d'utilisation des services auxquels ils accèdent.

> **Le projet est fourni à titre éducatif et expérimental. Son utilisation ne doit pas servir à contourner les droits d'auteur, les restrictions d'accès ou les conditions d'utilisation de services tiers.**

---

# Sources externes

Le projet peut utiliser des ressources provenant de services tiers, notamment pour :

* les affiches et métadonnées de films ;
* les fichiers vidéo ;
* les hébergeurs de contenu.

Ces services restent indépendants du projet **SN Streaming**.

Leur disponibilité et leurs conditions peuvent changer à tout moment.

---

# Développement

Pour modifier le projet :

```text
1. Modifier les fichiers HTML / CSS / JS
2. Tester localement avec lancer.bat
3. Vérifier le fonctionnement sur mobile et desktop
4. Mettre à jour le cache-buster si nécessaire
5. Commit
6. Push vers GitHub
```

---

# Roadmap

### Catalogue

* [x] Catalogue de films
* [x] Genres
* [x] Affiches
* [x] Recherche
* [x] Recherche avancée
* [x] Films similaires
* [x] Top 10

### Lecture

* [x] Lecteur personnalisé
* [x] Reprise de lecture
* [x] Sauvegarde de progression
* [x] Plein écran
* [x] Contrôle du volume
* [x] Vitesse de lecture
* [ ] Sous-titres
* [ ] Multi-qualité

### Utilisateur

* [x] Inscription
* [x] Connexion
* [x] Session
* [x] Historique
* [x] Favoris
* [x] Watchlist
* [x] Statistiques
* [x] Suppression du compte
* [ ] Synchronisation multi-appareils
* [ ] Import / export

### Plateforme

* [x] Responsive
* [x] Dark / Light mode
* [x] GitHub Pages
* [x] Serveur local Node.js
* [x] PWA
* [ ] Séries
* [ ] Saisons / épisodes

---

# Licence

Projet personnel.

Les fichiers du projet peuvent contenir ou référencer des ressources appartenant à leurs propriétaires respectifs. La présence d'une ressource externe dans le projet ne signifie pas que celle-ci appartient au développeur.

**SN Streaming n'est affilié à aucun des services tiers utilisés comme sources de données ou de vidéos.**
