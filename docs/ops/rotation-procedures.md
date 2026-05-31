# Rotation procedures

When and how to rotate the two sensitive secrets that protect Loggic Outreach.

## Submission token

Used by Hermes (CA's Antigravity agent) and the frontend localStorage to call `/submit-leads`, `/submit-dm-drafts`, `/build-demos`.

**When to rotate:**
- Suspected leak (token shared with wrong person, posted publicly by accident)
- CA leaves the team
- Routine rotation every ~6 months

**How:**
```bash
cd ~/Desktop/loggic-outreach
python3 scripts/rotate-submission-token.py --dry-run   # preview the new value
python3 scripts/rotate-submission-token.py --yes        # actually apply
```

**After rotation:**
1. New value printed to stdout AND written to `~/Desktop/loggic-outreach/.env.prod` line `SUBMISSION_TOKEN=...`
2. Send the new token to Charles-Antoine via Telegram or iMessage so he updates his Hermes skill
3. Frontend users hit a `Token invalide, retente` toast on next "Construire les démos" click — the localStorage value gets cleared and they re-paste the new token

**Downtime:** ~0. Old token stops working immediately, new token works immediately. Anyone mid-action just has to re-paste.

## Encryption key

Used by `pgp_sym_encrypt` / `pgp_sym_decrypt` to protect all mailbox SMTP+IMAP passwords stored in `mailboxes.{smtp,imap}_pass_encrypted`.

**When to rotate:**
- Suspected DB dump leak (someone got a backup or read access to `private.app_secrets`)
- Encryption key shared/posted by accident
- Routine rotation every ~12 months

**How:**
```bash
cd ~/Desktop/loggic-outreach
python3 scripts/rotate-encryption-key.py --dry-run   # preview the new key
python3 scripts/rotate-encryption-key.py             # actually apply (atomic SQL transaction)
```

**What the script does atomically:**
1. Generates new 48-byte base64 key
2. SQL function `rotate_encryption_key(new_key)` runs in a single transaction:
   - For each mailbox: decrypts current SMTP+IMAP passwords using the OLD key, re-encrypts with the NEW key
   - Updates `private.app_secrets.encryption_key` to the new value
3. If any step fails (corrupt ciphertext, network blip), the entire transaction rolls back — no mixed-encryption state possible
4. Roundtrip test confirms the new key works
5. `.env.prod` `ENCRYPTION_KEY=` line updated

**After rotation:**
- `send-tick` automatically picks up the new key on the next tick (re-reads from `private.app_secrets` each invocation, no restart needed)
- `imap-poll` same
- No frontend impact (frontend never sees the encryption key)

**Downtime:** 0. The SQL transaction is fast (<1s for ~10 mailboxes) and atomic.

**Disaster recovery:** if the rotation function fails partway and rolls back, the old key still works. If you lose the encryption key entirely (deleted from `app_secrets` with no backup), the mailbox passwords cannot be recovered — re-enter them via Settings UI.
