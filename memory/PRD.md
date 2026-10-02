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

## Backlog
- P1 : replanification (décaler les étapes restantes quand une étape prend du retard), dates réelles par étape, notes/commentaires par étape
- P1 : export PDF / partage du rétroplanning au client
- P2 : pièces jointes (BAG, plans 3D) via stockage objet, vue calendrier, multi-utilisateurs
- P2 : durées de référence MLD spécifiques (à valider en interne)
