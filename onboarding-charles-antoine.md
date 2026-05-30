# Onboarding Loggic Outreach — pour le Claude Code de Charles-Antoine

Salut Claude. Charles-Antoine (cofondateur Loggic, avec Olivier) va te coller ce document. Lis-le au complet puis exécute les étapes dans l'ordre. À la fin, tu auras un skill installé qui automatise toute la prospection.

## 1. C'est quoi Loggic Outreach

Outil interne de cold email pour vendre des apps de fidélité à des PME du Québec. Remplace Instantly.ai (économie ~$444/an). Backend Supabase, frontend React déployé à **https://logiccsupplies.ca/outreach/**.

- 2 utilisateurs: olivier@logiccsupplies.ca, charles-antoine@logiccsupplies.ca
- Chacun envoie depuis sa propre boîte Spacemail (creds chiffrés)
- Volume cible: 15-50 emails/jour par user, schedule Lun-Ven 8h-17h America/Toronto par défaut
- Pas de warmup automatique, pas d'unibox — les réponses arrivent dans la vraie boîte Spacemail
- Cron jobs: `send-tick` toutes les 2 min, `imap-poll` toutes les 10 min (détection réponses + bounces, stop-on-reply auto)

## 2. Première fois — setup de Charles-Antoine

Fais lui faire ça une seule fois:

1. Ouvrir **https://logiccsupplies.ca/outreach/**
2. Login: entrer `charles-antoine@logiccsupplies.ca` → cliquer "Envoyer le lien" → ouvrir sa boîte Spacemail → cliquer le magic link → redirigé sur le dashboard
3. Aller dans **Settings** → remplir les 9 champs:
   - Nom affiché: `Charles-Antoine Loggic`
   - Email: `charles-antoine@logiccsupplies.ca`
   - SMTP host: `mail.spacemail.com`, **port: 465** (PAS 587 — denomailer galère avec STARTTLS, on utilise TLS implicite)
   - SMTP user: `charles-antoine@logiccsupplies.ca`
   - SMTP password: son vrai mot de passe Spacemail
   - IMAP host: `mail.spacemail.com`, port: 993
   - IMAP user: `charles-antoine@logiccsupplies.ca`
   - IMAP password: même mot de passe Spacemail
4. Save. Ça appelle la RPC `upsert_mailbox` qui chiffre les mots de passe via pgcrypto et les stocke chiffrés dans la table `mailboxes`.

## 3. Comment marche le workflow de prospection (logique)

Une campagne = un nom + un horaire + une liste d'étapes (séquence). Chaque étape = un délai en jours + un sujet template + un corps template. Les templates supportent les variables `{first_name}, {last_name}, {company}, {demo_link}, {custom1}, {custom_subject}, {custom_body}`.

**Pattern recommandé pour de l'outreach personnalisé:**
- Sujet template = `{custom_subject}`
- Corps template = `{custom_body}`
- Chaque ligne du CSV contient son propre `custom_subject` et `custom_body` écrits à la main (ou par toi, l'IA) pour ce business précis. Pas de "Salut {first_name}, j'ai vu {company}" générique — vraiment 3-6 lignes spécifiques au business.

Les leads sont importés via la page CampaignDetail (drag-drop CSV). Le cron `send-tick` les envoie un à la fois avec jitter 3-8 min entre envois. Stop automatique si réponse détectée par `imap-poll`.

## 4. Endpoint dedup public

Pour éviter de re-pitcher les mêmes business à travers les campagnes, l'app expose une vue Supabase publique:

```
GET https://tytfjnlclvmsjaofpnmq.supabase.co/rest/v1/contacted_domains?select=domain
Headers:
  apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR5dGZqbmxjbHZtc2phb2Zwbm1xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAxNjY5NDQsImV4cCI6MjA5NTc0Mjk0NH0.AESgQ5sxjzYyQHIZj6tNp5vCJd0Mfkve_KKVFF2t8Ok
  Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR5dGZqbmxjbHZtc2phb2Zwbm1xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAxNjY5NDQsImV4cCI6MjA5NTc0Mjk0NH0.AESgQ5sxjzYyQHIZj6tNp5vCJd0Mfkve_KKVFF2t8Ok
```

Retourne `[{"domain":"urbania-beaute.com"}, {"domain":"salon-x.ca"}, ...]`. Filtrer par domaine pas par email exact: si `info@urbania.com` est dans la liste, alors `contact@urbania.com` est aussi bloqué.

La clé anon est PUBLIQUE par design — RLS protège tout le reste. Mets-la directement dans le skill.

## 5. CRÉE LE SKILL MAINTENANT

Crée le fichier suivant. Si le dossier n'existe pas, mkdir d'abord.

**Path:** `~/.claude/skills/loggic-outreach-leads/SKILL.md`

**Contenu:**

````markdown
---
name: loggic-outreach-leads
description: Génère un CSV de prospects personnalisés pour Loggic Outreach (cold email pour vendre des apps de fidélité au QC). Auto-dedup contre les domaines déjà contactés. Utilise quand l'utilisateur demande "génère X leads de [segment] à [ville]", "trouve X commerces pour Loggic Outreach", "crée un CSV pour [niche]", "DM batch [segment]" ou similaire.
---

# Loggic Outreach — Génération de leads avec dedup

## Quand t'invoquer

Déclenche-toi quand Olivier ou Charles-Antoine demande:
- "génère N leads de [segment] à [ville]"
- "trouve N [type de commerce] à [QC/Lévis/etc]"
- "crée un CSV pour [niche]"
- "DM batch [segment]"
- Tout ce qui mentionne génération de prospects pour Loggic Outreach

## Étapes (dans l'ordre, sans skip)

### 1. Comprendre le brief

Identifie depuis le prompt:
- **Segment** (salons coiffure, barbiers, esthétique, boulangeries, gyms, traiteurs, etc.)
- **Ville/région** (Québec, Lévis, St-Augustin, Beauport, banlieues — JAMAIS Trois-Rivières/Sherbrooke/Gatineau/Saguenay)
- **Nombre cible** (5, 10, 20 — défaut: 10)
- **Niches à SKIP** (jamais bijouteries/joailleries, jamais boutiques vélo, jamais fine-dining; cafés et fitness sont saturés par DataCandy/FLiiP)

Si le brief est vague, propose un tableau de segments + villes et demande confirmation avant de continuer.

### 2. Fetch la dedup list

```bash
curl -s 'https://tytfjnlclvmsjaofpnmq.supabase.co/rest/v1/contacted_domains?select=domain' \
  -H 'apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR5dGZqbmxjbHZtc2phb2Zwbm1xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAxNjY5NDQsImV4cCI6MjA5NTc0Mjk0NH0.AESgQ5sxjzYyQHIZj6tNp5vCJd0Mfkve_KKVFF2t8Ok' \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR5dGZqbmxjbHZtc2phb2Zwbm1xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAxNjY5NDQsImV4cCI6MjA5NTc0Mjk0NH0.AESgQ5sxjzYyQHIZj6tNp5vCJd0Mfkve_KKVFF2t8Ok'
```

Garde la liste de domaines en tête. Tu vas devoir matcher CHAQUE prospect contre.

### 3. Trouver les prospects

Utilise Firecrawl (skills `firecrawl-search`, `firecrawl-scrape`, `firecrawl-agent`) ou WebSearch si Firecrawl indispo. Sources fréquentes:
- Google: `"site:[ville] [segment]"` ou `"[segment] [ville] facebook"`
- FB Pages locales
- Yelp QC
- Bing pour les widgets Instagram CDN

Pour chaque candidat: extrais email, téléphone, propriétaire/manager (prénom), site web, slug du business.

**JAMAIS inventer un email `info@domain.com`.** Si tu trouves pas le vrai email, mets `EMAIL_TBD` dans la cellule et indique-le clairement dans le rapport final.

### 4. Dedup

Pour chaque prospect:
1. Extrais le domaine de son email (`split('@')[1].toLowerCase()`)
2. Si le domaine est dans la dedup list → **SKIP** (ne l'ajoute pas au CSV, log "skipped: [nom] — déjà contacté")
3. Sinon → continue

Si tu skips trop (>50% du batch), prends note et propose un autre segment ou ville à Oli/CA.

### 5. Personnaliser le custom_subject et custom_body

**Pour chaque prospect retenu**, écris un email comme un humain l'écrirait. Pas de template feel.

**Règles de ton:**
- Français québécois casual mais professionnel
- Accents proprement (à, é, è, ç) — JAMAIS sans accents
- "tu" pas "vous" pour des commerces de proximité
- Court (3-6 phrases max le custom_body)
- Mentionne UN détail spécifique au business (un service, un avis client, un quartier, un produit, l'année de fondation, etc.) — pas de "j'ai vu votre business"
- CTA: proposer un échange court (5 min, Zoom ou téléphone) ou demander une réponse — PAS "voir une démo" car le lien démo se rajoute après
- Signature: `Olivier — Loggic` (ou `Charles-Antoine — Loggic` selon qui demande)

**`demo_link`: laisse TOUJOURS vide.** Oli build les démos personnalisées en batch après réception du CSV (séparation des responsabilités: génération de prospects = ton job, construction de démos = job d'Oli sur son Mac où le repo `logicsupplies` est installé). Ne mentionne PAS de lien démo dans le `custom_body` non plus, sinon ça crée une référence à un truc qui n'existe pas.

**JAMAIS:**
- Mentionner un prix dans le custom_body (politique stricte Oli)
- Dire "j'ai remarqué que vous n'avez pas X mais que Y" (ton condescendant, banni)
- Inventer des stats ou des features
- Inventer un `demo_link` ou pointer vers `demo.logiccsupplies.ca` sans vérifier — laisse VIDE

**Custom_subject:** 5-9 mots, accroche spécifique. Exemples:
- "Une question pour {nom du commerce}"
- "Pour {nom propriétaire} — petite idée"
- "À propos de votre {service spécifique}"

### 6. Écrire le CSV

**Path:** `~/Desktop/leads-<segment-slug>-<YYYY-MM-DD>.csv`

**Format:** UTF-8, première ligne = header. Colonnes dans cet ordre exact:

```
email,first_name,last_name,company,demo_link,custom1,custom_subject,custom_body
```

Le `custom_body` peut contenir des sauts de ligne — entoure la cellule de guillemets doubles et double les guillemets internes. Papaparse côté frontend gère ça.

### 7. Rapport final à l'utilisateur

Termine ton tour avec:
- Combien de prospects trouvés au total
- Combien skipped par dedup (avec leurs noms)
- Combien dans le CSV final
- Path absolu du CSV
- Combien ont `EMAIL_TBD` (à compléter manuellement)
- Suggestion de prochaine batch si volume insuffisant

## Ne fais PAS

- N'importe pas le CSV automatiquement dans l'app — c'est Oli ou CA qui drag-drop dans CampaignDetail manuellement (validation humaine avant envoi)
- Ne lance pas send-tick manuellement
- Ne touche pas à la DB prod
- Ne crée pas de nouvelles campagnes sans demander
````

## 6. Vérifier l'installation

Après avoir créé le skill:

```bash
ls -la ~/.claude/skills/loggic-outreach-leads/SKILL.md
```

Le fichier devrait exister et faire entre 4 et 8 KB.

Puis dis à Charles-Antoine: "Skill installé. Prochaine fois que tu me demandes 'génère 10 leads de salons de coiffure à Québec', je vais suivre le pipeline auto: dedup → recherche → personnalisation → CSV sur Desktop."

## 7. Liens utiles pour CA

- App: https://logiccsupplies.ca/outreach/
- Repo source: https://github.com/olimartel6/loggic-outreach
- Repo landing (où l'app est servie): https://github.com/olimartel6/logiccsupplies-landing
- Supabase dashboard: https://supabase.com/dashboard/project/tytfjnlclvmsjaofpnmq

## 8. À garder en tête

- L'anon key Supabase dans ce doc est PUBLIQUE par design (RLS protège tout)
- Les vrais secrets (DB password, encryption_key, service_role_key) sont chez Oli dans `~/Desktop/loggic-outreach/.env.prod` — tu n'en as pas besoin pour le workflow leads
- Pour debug le système (logs, sends, mailboxes), passe par Oli — c'est lui qui a les creds Management API
