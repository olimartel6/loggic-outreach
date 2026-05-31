#!/usr/bin/env python3
"""
Rotate the Loggic Outreach submission token used by Hermes / build-demos / submit-leads.

Usage: python3 scripts/rotate-submission-token.py

What it does:
  1. Generates a new 64-char hex token
  2. UPDATEs private.app_secrets SET value = new_token WHERE key = 'submission_token'
  3. Updates ~/Desktop/loggic-outreach/.env.prod SUBMISSION_TOKEN line
  4. Prints the new token + reminder of where to paste it

After running:
  - Re-share the new token with Charles-Antoine for his Hermes skill
  - The frontend stores it in localStorage on first use (no manual update there)
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
        return json.loads(urllib.request.urlopen(req, timeout=30).read())
    except urllib.error.HTTPError as e:
        sys.exit(f"SQL failed: {e.read().decode()[:400]}")

def main():
    dry_run = "--dry-run" in sys.argv
    confirmed = "--yes" in sys.argv

    pat = get_pat()
    new_token = secrets.token_hex(32)  # 64 hex chars

    print(f"Generated new submission token ({len(new_token)} chars)")
    if dry_run:
        print("DRY RUN — not applying. New token would have been:")
        print(new_token)
        return
    if not confirmed:
        print("ROTATION IS DESTRUCTIVE — the old token will stop working immediately.")
        print("Re-run with --yes to actually apply, or --dry-run to preview.")
        sys.exit(2)

    # Update in DB
    sql = f"update private.app_secrets set value = '{new_token}', updated_at = now() where key = 'submission_token' returning key, length(value)"
    res = run_sql(pat, sql)
    if not isinstance(res, list) or not res:
        sys.exit(f"DB update returned unexpected: {res}")
    print(f"DB updated: {res}")

    # Update .env.prod
    if ENV_PROD.exists():
        lines = ENV_PROD.read_text().splitlines()
        out = []
        replaced = False
        for line in lines:
            if line.startswith("SUBMISSION_TOKEN="):
                out.append(f"SUBMISSION_TOKEN={new_token}")
                replaced = True
            else:
                out.append(line)
        if not replaced:
            out.append(f"SUBMISSION_TOKEN={new_token}")
        ENV_PROD.write_text("\n".join(out) + "\n")
        print(f".env.prod updated at {ENV_PROD}")
    else:
        print(f"WARN: {ENV_PROD} not found — paste manually")

    print()
    print("=" * 60)
    print("NEW SUBMISSION TOKEN:")
    print(new_token)
    print("=" * 60)
    print()
    print("Next steps:")
    print("  1. Send the new token to Charles-Antoine for his Hermes skill")
    print("  2. Frontend users may need to clear localStorage 'loggic_submission_token'")
    print("     (prompt will re-ask on next 'Construire les démos' click)")

if __name__ == "__main__":
    main()
