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

## 2bis. Ramp progressif — IMPORTANT

Quand CA configure sa mailbox dans Settings, la limite quotidienne par défaut est maintenant **5 emails/jour**. C'est volontaire — sa boîte `charles-antoine@logiccsupplies.ca` n'a pas encore d'historique d'envoi et part avec une réputation neutre.

**Ramp suggéré:**
- Semaine 1: 5/jour
- Semaine 2: 10/jour
- Semaine 3: 20/jour
- Semaine 4: 35/jour
- Semaine 5+: 50/jour max

Si CA te demande de pousser à 50 dès la semaine 1, refuse poliment: "C'est pas la limite cron le bottleneck — c'est Gmail qui classe en spam. On rampe lentement sinon tout fini en pourriel et la réputation prend des mois à se réparer."

Pour modifier: Settings → champ "Limite quotidienne" → enregistrer.

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
description: Génère des prospects personnalisés pour Loggic Outreach (cold email B2B QC, vente d'apps de fidélité) et les soumet directement en draft dans la DB. Auto-dedup contre les domaines déjà contactés. Utilise quand Olivier ou Charles-Antoine demande "génère X leads de [segment] à [ville]", "trouve X commerces pour Loggic Outreach", "DM batch [segment]" ou similaire.
---

# Loggic Outreach — Génération + soumission directe de prospects

## Quand t'invoquer

- "génère N leads de [segment] à [ville]"
- "trouve N [type de commerce] à [QC/Lévis/etc]"
- "DM batch [segment]"
- Tout ce qui mentionne génération de prospects pour Loggic Outreach

## Étapes (dans l'ordre, sans skip)

### 1. Comprendre le brief

Identifie:
- **Segment** (salons coiffure, barbiers, esthétique, boulangeries, gyms, traiteurs, etc.)
- **Ville/région** (Québec, Lévis, St-Augustin, Beauport — JAMAIS Trois-Rivières/Sherbrooke/Gatineau/Saguenay)
- **Nombre cible** (défaut 10)
- **Niches à skip** (bijouteries, vélo, fine-dining; cafés et fitness saturés par DataCandy/FLiiP)
- **Campaign cible** — si l'utilisateur dit "campagne X" (par nom), fetch la liste et trouve l'UUID toi-même (voir étape 2). S'il a pas spécifié, demande-lui le nom de la campagne ou propose-lui les noms que tu vois.

Si le brief est vague, propose 2-3 segments + villes en tableau et demande confirmation.

### 2. Auto-découvrir l'UUID de la campagne par son nom

```bash
ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR5dGZqbmxjbHZtc2phb2Zwbm1xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAxNjY5NDQsImV4cCI6MjA5NTc0Mjk0NH0.AESgQ5sxjzYyQHIZj6tNp5vCJd0Mfkve_KKVFF2t8Ok"

curl -s 'https://tytfjnlclvmsjaofpnmq.supabase.co/rest/v1/campaigns_public?select=id,name,status' \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY"
```

Retourne une liste comme `[{"id":"f3afdd9a-...","name":"charlo email","status":"draft"}, ...]`. Match le nom que l'utilisateur a dit (case-insensitive, ignore les tirets/espaces si nécessaire). Si plusieurs matchent ou aucun, demande à l'utilisateur de préciser. Pour ignorer les vieilles campagnes, filter `status != 'archived'`.

### 3. Fetch la dedup list

```bash
curl -s 'https://tytfjnlclvmsjaofpnmq.supabase.co/rest/v1/contacted_domains?select=domain' \
  -H 'apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR5dGZqbmxjbHZtc2phb2Zwbm1xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAxNjY5NDQsImV4cCI6MjA5NTc0Mjk0NH0.AESgQ5sxjzYyQHIZj6tNp5vCJd0Mfkve_KKVFF2t8Ok' \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR5dGZqbmxjbHZtc2phb2Zwbm1xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAxNjY5NDQsImV4cCI6MjA5NTc0Mjk0NH0.AESgQ5sxjzYyQHIZj6tNp5vCJd0Mfkve_KKVFF2t8Ok'
```

### 4. Trouver les prospects

Utilise Firecrawl ou WebSearch. Pour chaque candidat: email RÉEL (jamais inventé), prénom du propriétaire, site web, slug. Si pas de vrai email → SKIP ce prospect (ne le mets pas en `EMAIL_TBD`, il sert à rien tant qu'on a pas l'email).

### 5. Dedup par domaine

Pour chaque prospect: si `email.split('@')[1].toLowerCase()` est dans la dedup list → SKIP avec log "skipped: [nom] — déjà contacté".

### 6. Personnaliser le `custom_subject` + `custom_body` — RÈGLES STRICTES

**Format du custom_subject:**
- 4 à 8 mots
- Mentionne quelque chose de SPÉCIFIQUE au business (nom, quartier, service signature)
- Pas de mots clichés ("opportunité", "transformer", "révolutionner")

**Bons exemples de sujet:**
- "Pour Marie — petit truc pour Borderon"
- "Une idée vue chez votre voisin Salon Diana"
- "Question rapide sur votre offre de gel polish"

**Mauvais exemples (à ÉVITER):**
- "Une opportunité pour votre business" — générique
- "Augmentez vos ventes de 30%!" — vendeur, faux chiffre
- "Bonjour" — vide

**Format du custom_body:**
- 3 à 6 phrases (max ~600 caractères)
- 1ère phrase: mentionne quelque chose de spécifique au business (un service vu sur leur site, un détail Google Maps, un quartier, une couleur de leur logo, etc.). PAS "j'ai vu votre business" ni "je passais par là".
- 2-3 phrases au milieu: explique en 1 phrase ce que fait l'app de fidélité (carte de points sur le téléphone pour leurs clients). Pas de jargon SaaS.
- Dernière phrase: CTA — propose un appel court (5 min) OU demande simplement une réponse si intéressé. PAS de lien démo. PAS de prix.
- Signature: `Olivier — Loggic` (si Oli demande) ou `Charles-Antoine — Loggic` (si CA demande)

**Bon exemple de body (Sophie chez Urbania Beauté):**
```
Salut Sophie, j'ai jeté un œil à votre offre de microblading sur Urbania et le look "duvet de cils" sur votre page — c'est solide.

J'ai bâti une app de fidélité simple (carte de points sur le tél des clientes, fonctionne par texto, pas d'install) pour des commerces comme le tien à Québec. Quelques esthéticiennes l'utilisent déjà au Lévis.

Si jamais ça t'intrigue, dis-moi et je t'écris en plus de détails — sinon ignore.

Olivier — Loggic
```

**Mauvais exemple à ne PAS faire:**
```
Bonjour Sophie, j'ai remarqué que votre business est sur Instagram. Saviez-vous qu'une app de fidélité peut augmenter vos ventes de 30%? Notre solution est la meilleure du marché. Cliquez ici pour voir une démo: [LIEN]. Merci, Olivier.
```
Générique, prétention chiffrée, lien démo, ton vendeur.

**JAMAIS:**
- Mentionner un prix
- Dire "j'ai remarqué que vous n'avez pas X mais que Y" (ton condescendant, banni)
- Inventer des stats ou des features
- **OBLIGATOIRE — Inclure `{demo_link}` dans CHAQUE `custom_body`.** Place le placeholder littéral `{demo_link}` dans le body à l'endroit naturel pour mentionner la démo (généralement dans la phrase d'ouverture du CTA). Quand toi/Oli/CA cliquent "Activer" sur la campagne, le système auto-construit les démos personnalisées et l'URL réelle (`https://demo.logiccsupplies.ca/?tenant=<slug-du-business>`) est injectée à l'envoi. Sans `{demo_link}` dans ton body, le prospect n'a pas de CTA visuel → taux de réponse plombé. Exemple OBLIGATOIRE: `Si tu veux voir ce que ça donnerait pour Coiffure Sophie spécifiquement: {demo_link}` ou `Voici à quoi ça ressemblerait pour ton barbershop: {demo_link}`. **N'OMETS JAMAIS le `{demo_link}`** — c'est ton meilleur outil pour convertir.
- Utiliser "vous" — toujours "tu" pour des commerces de proximité QC
- Émojis dans le sujet

### 7. Soumettre directement à la DB (PAS de CSV)

**⚠⚠⚠ CRITIQUE — Encoding UTF-8:** sur Windows, PowerShell/cmd encodent en cp1252 et corrompent les accents français (`é` → `�` côté serveur). **Tu DOIS construire le payload via TON outil d'écriture de fichier (filesystem write), JAMAIS en passant les strings dans une commande shell.** Le flow obligatoire:

**Étape A — Écris le payload entier dans un fichier UTF-8 via ton Write/Edit tool (PAS via shell):**

Crée le fichier `C:\Users\caddu\OneDrive\Desktop\drafts.json` (ou path équivalent) avec le tool `Write` (ou `create_file`) en passant un STRING JSON valide UTF-8. Exemple de contenu (les accents doivent rester intacts dans ce que tu écris):

```json
{
  "campaign_id": "UUID_DE_LA_CAMPAGNE_CIBLE",
  "submitted_by": "Hermes (CA)",
  "leads": [
    {
      "email": "sophie@urbaniabeaute.com",
      "first_name": "Sophie",
      "company": "Urbania Beauté",
      "custom_subject": "Pour Sophie — petit truc pour Urbania",
      "custom_body": "Salut Sophie, j'ai jeté un œil à...\n\nOlivier — Loggic"
    }
  ]
}
```

**Étape B — Envoie le fichier avec `curl --data-binary @file`:**

```bash
TOKEN="SUBMISSION_TOKEN_HERE"
curl -X POST 'https://tytfjnlclvmsjaofpnmq.supabase.co/functions/v1/submit-leads' \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json; charset=utf-8" \
  --data-binary @/c/Users/caddu/OneDrive/Desktop/drafts.json
```

(Ou équivalent Windows-natif: `curl.exe -X POST ... --data-binary "@C:\Users\caddu\OneDrive\Desktop\drafts.json"`)

**Étape C — VÉRIFIE avant de déclarer succès:** lis les drafts insérés via la clé anon:

```bash
ANON_KEY="..."
curl -s "https://tytfjnlclvmsjaofpnmq.supabase.co/rest/v1/leads?campaign_id=eq.UUID&status=eq.draft&select=email,custom_subject,custom_body" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY"
```

Si TU VOIS LE CARACTÈRE `�` (U+FFFD) dans la réponse → l'encoding a foiré, **DELETE les drafts immédiatement** (via Edge Function admin OU dis à Oli/CA) puis recommence. NE PRÉSENTE PAS un succès tant que tu as pas confirmé que les accents sont intacts.

```bash
TOKEN="SUBMISSION_TOKEN_HERE"  # Voir section 5bis pour le vrai token
CAMPAIGN_ID="UUID_DE_LA_CAMPAGNE_CIBLE"  # Récupéré à l'étape 2 via campaigns_public

# Construis le body en Python (encoding UTF-8 garanti) ou en écrivant directement un fichier .json
# Exemple avec Python (recommandé):
python3 -c '
import json, sys
body = {
  "campaign_id": "'"$CAMPAIGN_ID"'",
  "submitted_by": "Hermes (CA)",
  "leads": [
    {
      "email": "sophie@urbaniabeaute.com",
      "first_name": "Sophie",
      "company": "Urbania Beauté",
      "custom_subject": "Pour Sophie — petit truc pour Urbania",
      "custom_body": "Salut Sophie, jai jeté un oeil à...\n\nOlivier — Loggic"
    }
  ]
}
with open("/tmp/loggic_drafts.json", "w", encoding="utf-8") as f:
  json.dump(body, f, ensure_ascii=False)
'

# Puis envoie avec --data-binary (préserve les bytes UTF-8 exacts)
curl -X POST 'https://tytfjnlclvmsjaofpnmq.supabase.co/functions/v1/submit-leads' \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json; charset=utf-8" \
  --data-binary @/tmp/loggic_drafts.json
```

**Vérification après soumission:** lis les drafts via une requête GET et confirme qu'aucun champ ne contient le caractère U+FFFD (`�`). Si oui, c'est un bug d'encoding — DELETE les drafts cassés et recommence en utilisant le pattern Python ci-dessus.

Réponse attendue: `{"ok":true,"inserted":N,"skipped_duplicates":N}`.

Les leads atterrissent en `status='draft'` — visibles dans CampaignDetail sous "Brouillons", en attente que Oli/CA cliquent "Tout activer". DÈS qu'ils sont insérés, ils comptent dans `contacted_domains` — pas de risque de doublon entre sessions.

### 8. Rapport final à l'utilisateur

- Combien trouvés / skipped dedup / soumis en draft
- Lien direct vers la campagne: `https://logiccsupplies.ca/outreach/#/campaigns/<CAMPAIGN_ID>`
- Suggestion: "Va activer les brouillons quand t'es prêt"

## Ne fais PAS

- Ne crée pas le CSV (ancien workflow, déprécié)
- Ne change pas le statut des leads (Oli/CA le fait via l'UI)
- Ne crée pas de nouvelles campagnes
- N'utilise PAS le SUBMISSION_TOKEN ailleurs que pour `/submit-leads`
````

## 5bis. Token de soumission

Le skill ci-dessus utilise un `SUBMISSION_TOKEN` pour pousser des drafts dans la DB. Avant de sauvegarder le skill, remplace la ligne `TOKEN="SUBMISSION_TOKEN_HERE"` par:

`SUBMISSION_TOKEN=<PASTE_TOKEN_HERE>`

Oli te passera la vraie valeur via Telegram ou un autre canal sécurisé. Si tu ne l'as pas, demande-la avant de continuer — ne génère pas de prospects sans, sinon l'API refuse les appels (401).

## 6. Workflow DM en parallèle (canal complémentaire)

Pour chaque prospect que tu génères, tu produis aussi 1 DM Instagram (ou Messenger si le business n'a pas d'IG actif) en plus de l'email. Le DM va dans l'onglet "DMs" de l'app, Oli ou CA le copie-colle manuellement dans IG. Marqué envoyé → compte dans la dedup.

### Endpoint

```
POST https://tytfjnlclvmsjaofpnmq.supabase.co/functions/v1/submit-dm-drafts
Authorization: Bearer SUBMISSION_TOKEN_HERE
Content-Type: application/json

{
  "submitted_by": "Hermes (CA)",
  "drafts": [
    {
      "business_name": "Coiffure Sophie & Co",
      "business_handle": "@coiffuresophieco",
      "business_url": "https://www.instagram.com/coiffuresophieco",
      "channel": "instagram",
      "draft_text": "Salut Sophie, super le balayage que t'as posté dimanche..."
    }
  ]
}
```

### Règles pour le `draft_text`

Même règles que pour `custom_body` (3-5 phrases, spécifique, "tu", pas de prix, pas de lien) MAIS:
- Plus court (max ~400 caractères — IG/Messenger préfèrent court)
- Pas de signature formelle ("Olivier — Loggic"), un simple "Olivier" suffit
- Si tu veux mentionner la démo, NE PAS mettre `{demo_link}` (l'auto-build ne fait pas les DMs). Si tu mentionnes une démo, mets `{demo_link}` literal qu'Oli remplacera à la main, OU laisse vide.
- Pas d'emoji dans le texte (looks template-y)

### Ne fais PAS

- Pas plus d'1 DM par business (1 IG OU 1 Messenger, pas les deux)
- Pas de DM si le business n'a pas de présence IG/FB active (regarde s'ils ont posté dans les 30 derniers jours, sinon skip)
- Pas de DM pour des business qui ont déjà été contactés par email (`contacted_domains` te dit)

## 7. Vérifier l'installation

Après avoir créé le skill:

```bash
ls -la ~/.claude/skills/loggic-outreach-leads/SKILL.md
```

Le fichier devrait exister et faire entre 4 et 8 KB.

Puis dis à Charles-Antoine: "Skill installé. Prochaine fois que tu me demandes 'génère 10 leads de salons de coiffure à Québec', je vais suivre le pipeline auto: dedup → recherche → personnalisation → CSV sur Desktop."

## 8. Liens utiles pour CA

- App: https://logiccsupplies.ca/outreach/
- Repo source: https://github.com/olimartel6/loggic-outreach
- Repo landing (où l'app est servie): https://github.com/olimartel6/logiccsupplies-landing
- Supabase dashboard: https://supabase.com/dashboard/project/tytfjnlclvmsjaofpnmq

## 9. À garder en tête

- L'anon key Supabase dans ce doc est PUBLIQUE par design (RLS protège tout)
- Les vrais secrets (DB password, encryption_key, service_role_key) sont chez Oli dans `~/Desktop/loggic-outreach/.env.prod` — tu n'en as pas besoin pour le workflow leads
- Pour debug le système (logs, sends, mailboxes), passe par Oli — c'est lui qui a les creds Management API
