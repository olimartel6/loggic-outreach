import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Suppress duplicate alerts (same message text) sent within this window.
const DEDUP_WINDOW_MS = 15 * 60 * 1000

async function shaHash(s: string): Promise<string> {
  const data = new TextEncoder().encode(s)
  const buf = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(buf)).slice(0, 8).map(b => b.toString(16).padStart(2, '0')).join('')
}

export async function notifyTelegram(db: SupabaseClient, message: string): Promise<void> {
  try {
    const hash = await shaHash(message)
    const dedupKey = `last_alert_${hash}`

    // Dedup check — skip if same alert sent within window.
    const { data: lastSent } = await db.from('app_secrets').select('value').eq('key', dedupKey).maybeSingle()
    if (lastSent?.value) {
      const lastTime = new Date(lastSent.value).getTime()
      if (Number.isFinite(lastTime) && Date.now() - lastTime < DEDUP_WINDOW_MS) return
    }

    const { data: tokenRow } = await db.from('app_secrets').select('value').eq('key', 'telegram_bot_token').maybeSingle()
    const { data: chatRow } = await db.from('app_secrets').select('value').eq('key', 'telegram_alert_chat_id').maybeSingle()
    if (!tokenRow?.value || !chatRow?.value) return // silently skip if not configured

    const url = `https://api.telegram.org/bot${tokenRow.value}/sendMessage`
    await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatRow.value,
        text: `🚨 Loggic Outreach\n${message.slice(0, 3500)}`,
        disable_web_page_preview: true,
      }),
    })

    // Record dedup via RPC (app_secrets view is read-only for service_role; the RPC
    // is SECURITY DEFINER and writes to private.app_secrets).
    try { await db.rpc('record_alert_dedup', { p_key: dedupKey, p_value: new Date().toISOString() }) } catch { /* best effort */ }
  } catch (e) {
    console.error('telegram notify failed:', e)
    // never throw — alert failures must not break the caller
  }
}
