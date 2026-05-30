# Loggic Outreach — Design

**Date:** 2026-05-30
**Status:** Design approuvé, prêt pour plan d'implémentation
**Auteurs:** Olivier Martel, Claude

## 1. Contexte et but

Olivier utilise actuellement Instantly.ai (37 $ US/mois) pour envoyer des séquences de cold email afin de vendre des apps de fidélité à des commerces du Québec. Le besoin: remplacer Instantly par un outil interne pour économiser ~444 $ US/an et avoir un outil partagé avec son cofondateur Charles-Antoine.

**Non-objectif:** Cloner Instantly entièrement. On bâtit uniquement les fonctionnalités utilisées (sequencer + import CSV + stop-on-reply) et on délègue l'infrastructure complexe (warmup, deliverability) à des services existants ou à la réputation actuelle de la mailbox.

## 2. Utilisateurs et volume

- **Utilisateurs:** 2 admins (olivier@logiccsupplies.ca, charles-antoine@logiccsupplies.ca).
- **Volume cible:** 15-50 emails/jour par utilisateur (≤ 1500/mois total).
- **Mailboxes:** chacun envoie depuis sa propre boîte Spacemail. Pas de rotation, pas de pool.
- **Collaboration:** campagnes et leads partagés (visibilité totale entre les 2 users).

## 3. Fonctionnalités en scope (MVP)

1. **Authentification** — magic link Supabase, accès restreint à 2 emails listés.
2. **Gestion de campagnes** — créer, éditer, activer, mettre en pause.
3. **Séquences multi-étapes** — 1 à N étapes, délai en jours entre chaque, sujet + corps avec variables.
4. **Variables de substitution** — `{first_name}`, `{last_name}`, `{company}`, `{demo_link}`, `{custom1}`.
5. **Import CSV de leads** — colonnes `email,first_name,last_name,company,demo_link,custom1`.
6. **Lead manuel** — ajout one-off via formulaire.
7. **Stop-on-reply** — détecter une réponse en boîte de réception et arrêter la séquence pour ce lead.
8. **Détection de bounces** — marquer comme `bounced` si l'envoi SMTP échoue ou si on reçoit un bounce email; ne pas continuer la séquence.
9. **Horaire d'envoi** — fenêtre jours/heures configurable (défaut Lun-Ven 8h-17h EST), limite quotidienne par user, délai aléatoire 3-8 min entre envois.
10. **Vue dashboard** — compteurs envoyés aujourd'hui / réponses 7j / en queue / taux de réponse.
11. **Vue leads** — table filtrable (Tous / En queue / Contactés / Réponses / Bounced).
12. **Settings** — SMTP/IMAP creds par user (chiffrés), horaire d'envoi global.

## 4. Fonctionnalités hors scope (explicitement rejetées)

- Warmup automatique (irréalisable solo — on s'appuie sur la réputation existante de olivier@ et on chauffera manuellement la nouvelle boîte de Charles-Antoine si nécessaire).
- Unibox / boîte de réception unifiée (les réponses arrivent dans la vraie boîte Spacemail).
- A/B testing.
- Génération AI des emails.
- Analytics opens / clicks (mauvais pour la deliverability et Oli ne s'en sert pas).
- Validation d'emails (utiliser Hunter ou autre service externe en amont).
- Multi-tenancy / billing SaaS (outil interne, pas un produit à vendre).

## 5. Architecture

### Vue d'ensemble

```
[Browser]
   │
   ▼
[Vercel: React + Vite frontend]   outreach.logiccsupplies.ca
   │   REST + Realtime
   ▼
[Supabase]
   ├── Postgres (DB)
   ├── Auth (magic link)
   ├── Edge Functions
   │     ├── send-tick      (cron, chaque 2 min)
   │     ├── imap-poll      (cron, chaque 10 min)
   │     └── import-csv     (HTTP)
   └── Vault (chiffrement creds SMTP/IMAP)
        │
        ▼
[Spacemail SMTP/IMAP] (mail.spacemail.com)
```

### Composants

#### 5.1 Frontend (React + Vite + TanStack Query)

Single-page app sous `outreach.logiccsupplies.ca`. Top-nav avec 4 onglets: **Dashboard**, **Campagnes**, **Leads**, **Settings**. Auth via Supabase magic link. UI shadcn/ui + Tailwind, palette dark cohérente avec Loggic.

#### 5.2 Base de données (Supabase Postgres)

Tables principales:

- `users` — géré par Supabase Auth (whitelist 2 emails).
- `mailboxes` — 1 par user. `user_id, smtp_host, smtp_port, smtp_user, smtp_pass_encrypted, imap_host, imap_port, imap_pass_encrypted, last_imap_uid_seen, status`.
- `campaigns` — `id, name, status (draft|active|paused|archived), created_by, schedule_jsonb (jours/heures/limite quotidienne), created_at`.
- `sequence_steps` — `id, campaign_id, step_order, delay_days, subject_template, body_template`.
- `leads` — `id, campaign_id, email, first_name, last_name, company, demo_link, custom1, status (queued|in_progress|replied|bounced|completed|unsubscribed), current_step, next_send_at, mailbox_id (nullable, qui envoie à ce lead), thread_message_id (pour le threading des suivis), created_at`.
- `sends` — log de chaque envoi: `id, lead_id, step_id, mailbox_id, sent_at, smtp_message_id, status (sent|bounced|failed), error_text`.
- `replies` — `id, lead_id, mailbox_id, detected_at, imap_uid, snippet`.

#### 5.3 Edge Function: `send-tick`

Cron toutes les 2 minutes. Pour chaque mailbox active:

1. Vérifier l'horaire d'envoi (jours/heures de la campagne) et la limite quotidienne du user.
2. Sélectionner les leads `WHERE status IN ('queued','in_progress') AND next_send_at <= NOW()` jusqu'à la limite restante.
3. Pour chaque lead: rendre le template avec les variables, ouvrir une connexion SMTP, envoyer.
   - Si lead a un `thread_message_id` (suivi), poser les headers `In-Reply-To` et `References` pour threading.
   - Stocker le `Message-ID` retourné dans `leads.thread_message_id` (premier envoi seulement).
4. Logger dans `sends`, incrémenter `current_step`, calculer le `next_send_at` du prochain step (ou `status = completed` si dernier).
5. **Pas de sleep bloquant dans un tick.** Après avoir envoyé un lead, on programme `leads.next_send_at = NOW() + random(3, 8) min` pour le PROCHAIN lead candidat de la même mailbox. Donc 1-2 leads max par tick par mailbox; les autres attendront un tick suivant. Cela respecte le timeout de 60s des Edge Functions et étale les envois.

#### 5.4 Edge Function: `imap-poll`

Cron toutes les 10 minutes. Pour chaque mailbox active:

1. Connexion IMAP, `SELECT INBOX`, chercher tous les emails avec `UID > last_imap_uid_seen`.
2. Pour chaque nouveau message:
   - Parser headers `In-Reply-To` et `References` → matcher contre `leads.thread_message_id`.
   - Si match: insérer dans `replies`, mettre le lead à `status = 'replied'`, court-circuiter la suite de la séquence.
   - Parser le sujet pour détecter les bounces (`Delivery Status Notification`, `Mail Delivery Failed`, etc.) → marquer le lead `bounced`.
3. Mettre à jour `last_imap_uid_seen`.

#### 5.5 Edge Function: `import-csv`

Reçoit un upload CSV + `campaign_id`. Valide les colonnes obligatoires (`email`). Dedupe les emails déjà dans la campagne. Insère les leads avec `status='queued'`, `current_step=0`, `next_send_at=NOW()` (sera traité au prochain `send-tick`).

#### 5.6 Chiffrement des credentials

Les mots de passe SMTP/IMAP sont chiffrés au repos via `pgcrypto` avec une clé symétrique stockée dans les secrets Supabase (`ENCRYPTION_KEY`, jamais commitée). Les Edge Functions sont les seules à pouvoir décrypter, via une fonction SECURITY DEFINER appelée uniquement côté serveur. Le frontend ne reçoit jamais le mot de passe — il peut le set ou le clear, pas le lire.

## 6. Sécurité

- **RLS** activé sur toutes les tables. Tous les utilisateurs whitelistés voient tout (campagnes partagées), mais aucun accès sans login.
- **Whitelist par email** stockée dans la variable d'environnement `ALLOWED_EMAILS` (CSV) lue par un trigger Supabase Auth `before user inserted`. Tout email non whitelisté = refus de création du compte. Modifier la liste = update env var + redeploy.
- **Creds chiffrés** via Vault, jamais en clair dans la DB.
- **CASL compliance:** chaque email inclut un lien d'unsubscribe statique (mailto: olivier+unsubscribe@…) + identification de l'expéditeur. Footer obligatoire injecté automatiquement à la fin de chaque corps de message.

## 7. Gestion d'erreurs

- **Échec SMTP transient (timeout, 4xx):** retry exponentiel à 5 min, 15 min, 1h. Après 3 échecs → log `failed`, ne pas avancer le lead.
- **Échec SMTP permanent (5xx, bounce immédiat):** marquer le lead `bounced`, ne pas réessayer.
- **Échec IMAP poll:** logger l'erreur, retry au prochain cron. Si 5 polls consécutifs échouent → alerte par email à olivier@.
- **Erreur de template (variable manquante):** garder le placeholder tel quel (`{first_name}` → `{first_name}`) et logger un warning. Ne pas bloquer l'envoi.

## 8. Tests

- **Unit:** rendu des templates avec variables, parsing des headers de threading, détection des bounces, calcul du `next_send_at`.
- **Integration:** end-to-end avec un compte SMTP test (Mailtrap) — envoyer une séquence à un lead test, vérifier que le 2e step part au bon moment, simuler une réponse, vérifier que la séquence s'arrête.
- **Manual smoke:** avant d'activer en prod, envoyer une campagne d'1 lead à soi-même et vérifier que tout s'enchaîne.

## 9. Déploiement

- **Frontend:** Vercel, connecté au repo GitHub `olimartel6/loggic-outreach`. Auto-deploy sur push `main`.
- **Backend:** Supabase project dédié `loggic-outreach`. Edge Functions déployées via `supabase functions deploy`.
- **DNS:** `outreach.logiccsupplies.ca` → CNAME Vercel.
- **Secrets:** clés SMTP/IMAP entrées via UI Settings (jamais dans le repo).

## 10. Coûts

- Supabase free tier (DB 500MB, 2M Edge Fn invocations/mois): largement suffisant.
- Vercel free tier: suffisant.
- Spacemail: déjà payé (inclus dans hébergement actuel).
- **Total mensuel: 0 $ US.**
- **vs Instantly:** 37 $ US/mois × 12 = 444 $ US/an économisés.

## 11. Risques et mitigations

| Risque | Impact | Mitigation |
|---|---|---|
| Deliverability dégrade sans warmup actif | Moyen | Garder volume modéré (<50/jour), surveiller bounces, garder olivier@ chaude par usage régulier |
| IMAP poll rate Spacemail | Bas | 10 min interval, 2 mailboxes seulement |
| Supabase Edge Fn timeout sur gros volumes | Bas | Batch par tick limité (50 envois max), si ça grossit → migrer le sender vers un cron job persistant (Railway $5/mo) |
| Charles-Antoine boîte pas chauffée → spam | Moyen | Démarrer à 5/jour, augmenter progressivement sur 2-3 semaines |
| Perte d'un Message-ID → threading cassé | Bas | Toujours stocker `Message-ID` du premier envoi avant d'envoyer le 2e step |

## 12. Critères de succès

- Olivier peut importer 50 leads, créer une séquence 3-step, l'activer, et tout part au bon moment sans intervention manuelle pendant 2 semaines.
- Détection de réponse fonctionne dans les 10 min, séquence stoppée.
- Charles-Antoine peut se connecter, voir les campagnes partagées, configurer sa propre mailbox, et envoyer depuis sa propre boîte.
- Coût mensuel reste 0 $.
- Le compte Instantly peut être annulé à la fin du sprint MVP (2 semaines après le go-live).
