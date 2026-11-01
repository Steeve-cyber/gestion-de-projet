# 🎨 Atelier - Gestion de Projets & Architecture SCSS

> Un projet front-end moderne structuré selon une architecture SCSS professionnelle et modulaire, combiné à du JavaScript vanilla (sans framework).

---

## 🚀 Aperçu du projet

Ce projet a été conçu pour structurer proprement un site web en séparant les responsabilités stylistiques grâce à une architecture SCSS modulaire (méthodologie 7-1 simplifiée), tout en garantissant des performances optimales sans la lourdeur d'un framework JavaScript.

---

## 🛠️ Stack Technique

* **HTML5** : Structure sémantique et accessible.
* **SCSS / SASS** : Organisation modulaire en fichiers partiels (`partials`).
* **JavaScript (Vanilla)** : Interactivité et logique front-end sans dépendance externe.

---

## 📂 Architecture du Projet

L'organisation des dossiers et des fichiers SCSS respecte les bonnes pratiques de maintenance :

```text

📁 gestion-de-projet/
├── js/
│   └── app.js
├── scss/
│   ├── _variables.scss
│   ├── _mixins.scss
│   ├── _base.scss
│   ├── _components.scss
│   ├── main.scss        # importe tous les partiels
│   ├── main.css         # CSS compilé
│   └── main.css.map
└── index.html
