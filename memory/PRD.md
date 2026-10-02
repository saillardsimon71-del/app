# PRD — PGP Projets (suivi de projets PGP Glass)

## Problème initial
« Créer une application mobile : un pote chef de projet commercial chez PGP Glass veut une application pour suivre différents projets facilement. » + document « processus dev.pdf » (types NPD/DUP/FLK/MLD, phases, rétroplanning depuis la MAD, leviers d'optimisation).

## Choix utilisateur
Un seul utilisateur sans connexion · clients + projets + rétroplanning auto + suivi des étapes + tableau de bord avec alertes · jours calendaires · pas d'IA · style Apple · UI en français.

## Architecture
- Backend FastAPI + MongoDB : `server.py` (routes /api), `planning.py` (moteur de rétroplanning vérifié sur le planning de référence NPD : 337 j / 49 sem.)
- Frontend Expo Router : onglets Accueil / Projets / Clients / Réglages (NativeTabs sur iOS 26+), modales projet/form et client/form, fiche project/[id]
- Polices Geist, icônes Ionicons, thème iOS (vert sauge #4A6B53)

## Implémenté (02/10/2026)
- Clients : CRUD, délai de validation (ajuste proportionnellement les étapes d'approbation, référence 10 j), recalcul auto des projets du client
- Projets : création avec aide au choix du type, MAD, MOQ, specs, présérie (séquentielle/parallèle), emballage (croisillons/barquettes/PTF + délai), cycles verre/décor ; aperçu en direct (durée, démarrage, Gantt, alerte « MAD trop serrée », leviers avec gain + bouton Appliquer)
- Fiche projet : statut, progression, KPI, Gantt avec ligne aujourd'hui, timeline cochable par phase, tags validation client/retard/en cours, archivage, suppression
- Tableau de bord : métriques, alertes de retard, échéances à 3 semaines, prochaines MAD
- Réglages : décalage commandes (45 j), délai par défaut, données de démo
- Tests : backend 11/11, frontend tous parcours OK

## Itération 2 (02/10/2026) — UI fluidifiée + photos
- Accueil : 2 chiffres clés (actifs / en retard) + une seule liste « À suivre » (retards puis échéances) + liste « Projets »
- Cartes projet épurées (miniature photo, nom, statut, « TYPE · client · MAD »)
- Fiche projet : photo de couverture (1re photo), KPI simples, Gantt replié (« Voir le planning »), étapes compactes (nom + date / retard), brief sans lignes vides
- Formulaire : type en segments + aide repliable, « Options avancées » repliées (référence, MOQ, specs, présérie, emballage, cycles, notes), aperçu rétroplanning compact
- Clients sans badge/texte d'aide ; réglages réduits à Rétroplanning + Données ; traits de séparation superflus retirés
- Photos (croquis/idées client) : Emergent Object Storage via `backend/storage.py` ; `POST/DELETE /api/projects/{id}/photos`, `GET /api/files/{path}` ; galerie + appareil photo (expo-image-picker, permissions gérées avec « Ouvrir les réglages ») ; ajout depuis la fiche et le formulaire (upload différé à la création)
- Tests : backend 20/20 (test_photos.py), frontend tous parcours OK

## Itération 3 (02/10/2026) — Replanification, notes d'étape, PDF client, documents client
- Replanification : bandeau « Replanifier » dans la fiche quand des étapes sont en retard → aperçu (MAD cible → MAD prévue +N j) puis confirmation ; décale les étapes non terminées du plus grand retard (`GET/POST /api/projects/{id}/replan`). MAD cible conservée, `projected_mad` affiché (fiche, carte, accueil).
- Notes par étape : tap sur la case = cocher, tap sur le nom = fiche étape (terminée, date réelle, commentaire) via `PATCH /steps/{key}` {done?, actual_end?, comment?}.
- PDF client : `GET /api/projects/{id}/export.pdf` (reportlab, en-tête PGP Glass, KPIs, phases/étapes, validations client, photos) ; bouton partage dans la fiche (expo-sharing, web = nouvel onglet).
- Documents client : photos + PDF sur la fiche client (`POST/DELETE /api/clients/{id}/documents`), expo-document-picker.
- Vérifié manuellement (API + écrans) ; test automatisé complet non relancé faute de crédits.

## Backlog
- P1 : replanification (décaler les étapes restantes quand une étape prend du retard), dates réelles par étape, notes/commentaires par étape
- P1 : export PDF / partage du rétroplanning au client
- P2 : pièces jointes non-image (BAG, plans 3D PDF) via stockage objet, vue calendrier, multi-utilisateurs
- P2 : durées de référence MLD spécifiques (à valider en interne)
