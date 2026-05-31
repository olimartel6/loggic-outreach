import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

export async function notifyTelegram(db: SupabaseClient, message: string): Promise<void> {
  try {
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
  } catch (e) {
    console.error('telegram notify failed:', e)
    // never throw — alert failures must not break the caller
  }
}
