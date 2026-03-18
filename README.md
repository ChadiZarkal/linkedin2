# LinkedIn AutoPilot v2 — Simplifié

Génération automatisée de posts LinkedIn avec IA (Gemini) et stockage GitHub.

## Architecture

```
2 Agents IA:
  🔍 Recherche  →  Cherche sur internet (Google Search grounding)
  ✍️  Rédacteur  →  Écrit le post LinkedIn

GitHub = Base de données:
  config/prompts.json   →  Prompts des agents
  config/schedule.json  →  Configuration planning
  articles/*.json       →  Tous les posts générés
```

## Pages

| Page | Description |
|------|-------------|
| `/` | Générer un post (sujet → recherche → rédaction) |
| `/posts` | Gérer, publier, programmer, modifier les posts |
| `/prompts` | Modifier les prompts des 2 agents + prompt global |
| `/schedule` | Configurer la publication automatique |

## API Routes

| Route | Méthode | Description |
|-------|---------|-------------|
| `/api/research` | POST | Recherche web sur un sujet |
| `/api/generate` | POST | Génère un post à partir de la recherche |
| `/api/prompts` | GET/PUT | Lire/modifier les prompts |
| `/api/posts` | GET/PUT/DELETE | Gérer les posts |
| `/api/schedule` | GET/PUT | Configurer le planning |
| `/api/cron` | GET | Cron (publication auto + buffer) |

## Variables d'environnement

```env
# Gemini / Vertex AI
GOOGLE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}
GOOGLE_CLOUD_PROJECT=ai-agent-cha-2y53
GOOGLE_CLOUD_LOCATION=global
GEMINI_MODEL=gemini-2.5-flash

# GitHub (stockage)
GITHUB_TOKEN=ghp_xxx
GITHUB_REPO=user/repo

# LinkedIn
LINKEDIN_ACCESS_TOKEN=xxx
LINKEDIN_USER_URN=urn:li:person:xxx

# Sécurité
CRON_SECRET=xxx
API_SECRET=xxx  # Protège le dashboard et les API routes
```

## Démarrage

```bash
cd app
npm install
npm run dev
```

## Flux de travail

1. **Entrer un sujet** sur la page d'accueil
2. **L'agent recherche** cherche sur internet les dernières actualités
3. **Relire la recherche** et cliquer "Rédiger"
4. **L'agent rédacteur** génère le post LinkedIn
5. **Le post est sauvegardé** automatiquement sur GitHub (`articles/`)
6. **Gérer les posts** : publier, programmer, modifier, supprimer

Ou utiliser le bouton **⚡ Auto** pour tout faire en un clic.

## Cron automatique

Le cron Vercel (`/api/cron`) tourne toutes les heures :
- Publie les posts programmés dont l'heure est passée
- Si jour de publication → publie le plus ancien post en attente
- Si buffer activé et trop bas → génère de nouveaux posts
