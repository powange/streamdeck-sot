# Stream Deck – Sea of Thieves

Plugin Stream Deck pour Sea of Thieves (bêta).

## Installation

1. Télécharge [com.powange.seaofthieves.streamDeckPlugin](https://github.com/powange/streamdeck-sot/releases/latest/download/com.powange.seaofthieves.streamDeckPlugin) (dernière version).
2. Double-clique sur le fichier : Stream Deck l'installe (ou le met à jour).

Prérequis : Stream Deck 7.1 ou plus récent, sous Windows.

## Actions

- **Minuteur de cuisson** : appuie quand la nourriture est posée sur le feu. Le bouton décompte jusqu'à la cuisson, passe au vert, puis clignote en rouge 10 s avant que ça brûle. Un nouvel appui arrête le minuteur.
  Aliments : poisson, poisson trophée, poulet, porc, serpent, requin, kraken, mégalodon. Les temps peuvent être modifiés dans les réglages du bouton.
- **Compteur de session** : appui court = +1, appui long = remise à zéro. Icônes : coffre, crâne, mort, navire coulé, autre.
- **Commendation** : affiche la progression d'une commendation de ton profil pirate [seaofthieves.com](https://www.seaofthieves.com/profile/reputation) (grade, valeur / seuil, image). Choix en cascade : faction → campagne → commendation. Appuie pour actualiser.
- **Succès Xbox** : affiche la progression d'un succès Xbox de Sea of Thieves via [OpenXBL](https://xbl.io). Appuie pour actualiser.

### Connexion au profil seaofthieves.com

Rare ne fournit pas d'API publique : le plugin utilise l'API interne du site (`/fr/api/profilev2/reputation`), authentifiée par le cookie `rat` de ta session.

1. Connecte-toi sur www.seaofthieves.com.
2. F12 → **Application** → **Cookies** → `https://www.seaofthieves.com` → copie la valeur du cookie `rat`.
3. Colle-la dans le champ « Token RAT » des réglages d'un bouton Commendation (elle est partagée par tous les boutons).

Le token expire au bout d'environ 14 jours (le bouton affiche alors « Connexion expirée »). Il donne accès à ton compte sur le site : ne le partage pas. Il est stocké localement par Stream Deck.

### Connexion Xbox (OpenXBL)

Crée une clé API sur [xbl.io](https://xbl.io) (connexion avec ton compte Microsoft) et colle-la dans le champ « Clé OpenXBL ». L'offre gratuite est limitée à ~150 requêtes / heure : les succès sont mis en cache 10 minutes.

## Développement

Prérequis : Node.js 24, Stream Deck 7.1+ (Windows).

```bash
npm install
npm run build        # compile vers com.powange.seaofthieves.sdPlugin/bin
npm run validate     # valide le manifest
npm run deploy:win   # depuis WSL : build, copie dans le Stream Deck Windows et redémarre l'appli
npm run pack         # génère le fichier .streamDeckPlugin
```

Sous Windows directement, `npx streamdeck link com.powange.seaofthieves.sdPlugin` puis `npm run watch` pour le rechargement à chaud.

Les logs du plugin sont dans `com.powange.seaofthieves.sdPlugin/logs/` (dans le dossier des plugins Stream Deck : `%APPDATA%\Elgato\StreamDeck\Plugins\`).

### Publier une version

Pousser un tag `vX.Y.Z` déclenche le workflow [release.yml](.github/workflows/release.yml), qui construit le plugin et publie une release GitHub avec le fichier `.streamDeckPlugin` :

```bash
npm version 0.2.0      # met à jour package.json, commite et crée le tag v0.2.0
git push --follow-tags
```

## Temps de cuisson

Temps depuis la pose sur le feu (cuit / brûlé), valeur « cuit » la plus prudente entre
[sotfr.net](https://sotfr.net/guides/gameplay/guide-peche-chasse/) et le [wiki](https://seaofthieves.wiki.gg/wiki/Cooking) :

| Nourriture | Cuit | Brûlé |
| --- | --- | --- |
| Poisson | 45 s | 80 s |
| Poisson trophée | 90 s | 180 s |
| Viandes (poulet, porc, serpent, requin) | 60 s | 120 s |
| Kraken, mégalodon | 120 s | 240 s |
