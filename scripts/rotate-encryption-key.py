#!/usr/bin/env python3
"""
Rotate the Loggic Outreach mailbox encryption key.

Usage: python3 scripts/rotate-encryption-key.py [--dry-run]

What it does:
  1. Generates a new 48-byte base64 encryption key
  2. Calls the SQL function rotate_encryption_key(new_key) which atomically:
     - Decrypts ALL mailbox SMTP+IMAP passwords using the current key
     - Re-encrypts them with the new key
     - Updates private.app_secrets.encryption_key = new_key
     ALL in a single transaction (rolls back on any failure)
  3. Updates ~/Desktop/loggic-outreach/.env.prod ENCRYPTION_KEY line
  4. Verifies a round-trip decrypt works with the new key

Safety:
  - Atomic SQL transaction means partial-rotation failure cannot leave the DB in a mixed state
  - Old key is kept in memory only during the function call
  - Dry-run mode prints the new key but doesn't apply

After running:
  - send-tick should continue to work with the next cron tick (re-decrypts using the new key from app_secrets)
  - No restart needed
"""
import os, sys, json, base64, secrets, subprocess, urllib.request, pathlib

ENV_PROD = pathlib.Path.home() / "Desktop" / "loggic-outreach" / ".env.prod"
PROJECT_REF = "tytfjnlclvmsjaofpnmq"

def get_pat():
    raw = subprocess.run(["security", "find-generic-password", "-s", "Supabase CLI", "-a", "supabase", "-w"], capture_output=True, text=True).stdout.strip()
    if not raw.startswith("go-keyring-base64:"): raise RuntimeError("unexpected keychain format")
    b64 = raw[len("go-keyring-base64:"):]
    return base64.b64decode(b64 + "=" * (-len(b64) % 4)).decode()

def run_sql(pat, sql):
    req = urllib.request.Request(
        f"https://api.supabase.com/v1/projects/{PROJECT_REF}/database/query",
        data=json.dumps({"query": sql}).encode(),
        headers={"Authorization": f"Bearer {pat}", "Content-Type": "application/json", "User-Agent": "rotate-tool/1.0"},
        method="POST",
    )
    try:
        return json.loads(urllib.request.urlopen(req, timeout=60).read())
    except urllib.error.HTTPError as e:
        body = e.read().decode()[:600]
        sys.exit(f"SQL failed: {body}")

def main():
    dry_run = "--dry-run" in sys.argv

    pat = get_pat()
    new_key = base64.b64encode(secrets.token_bytes(48)).decode().rstrip("=")
    assert len(new_key) >= 32, "generated key too short — try again"

    print(f"Generated new encryption key ({len(new_key)} chars)")
    if dry_run:
        print("DRY RUN — not applying. New key would have been:")
        print(new_key)
        return

    # Apply the rotation via the dedicated RPC
    # We escape the key for SQL since it contains base64 chars that could include / or +
    safe = new_key.replace("'", "''")
    sql = f"select public.rotate_encryption_key('{safe}') as rotated_count"
    res = run_sql(pat, sql)
    rotated = res[0]["rotated_count"] if isinstance(res, list) and res else None
    if rotated is None:
        sys.exit(f"Rotation returned unexpected: {res}")
    print(f"Rotated {rotated} mailbox(es)")

    # Roundtrip verification: encrypt then decrypt a test value via the test_encrypt_helper
    rt = run_sql(pat, "select public.decrypt_secret_hex(public.test_encrypt_helper('rotation-test')) as t")
    if not isinstance(rt, list) or rt[0].get("t") != "rotation-test":
        sys.exit(f"WARNING: roundtrip test FAILED after rotation. Manual recovery needed: {rt}")
    print("Roundtrip test passed")

    # Update .env.prod
    if ENV_PROD.exists():
        lines = ENV_PROD.read_text().splitlines()
        out = []
        replaced = False
        for line in lines:
            if line.startswith("ENCRYPTION_KEY="):
                out.append(f"ENCRYPTION_KEY={new_key}")
                replaced = True
            else:
                out.append(line)
        if not replaced:
            out.append(f"ENCRYPTION_KEY={new_key}")
        ENV_PROD.write_text("\n".join(out) + "\n")
        print(f".env.prod updated")
    else:
        print(f"WARN: {ENV_PROD} not found — record this key elsewhere")

    print()
    print("=" * 60)
    print("Encryption key rotated successfully")
    print("=" * 60)
    print("- All mailbox SMTP+IMAP passwords re-encrypted")
    print("- send-tick will use the new key on the next tick (auto, no restart)")
    print("- Old key is now invalid; do NOT use it anywhere")

if __name__ == "__main__":
    main()
