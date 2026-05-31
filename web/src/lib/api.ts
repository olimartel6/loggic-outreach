import { supabase } from './supabase'
import type { Campaign, SequenceStep, Lead, Mailbox } from '../types'

export const campaignsApi = {
  list: async (): Promise<Campaign[]> => {
    const { data, error } = await supabase.from('campaigns').select('*').order('created_at', { ascending: false })
    if (error) throw error
    return data
  },
  get: async (id: string) => {
    const { data, error } = await supabase.from('campaigns').select('*').eq('id', id).single()
    if (error) throw error
    return data
  },
  create: async (name: string, userId: string) => {
    const { data, error } = await supabase.from('campaigns').insert({ name, created_by: userId }).select().single()
    if (error) throw error
    return data
  },
  update: async (id: string, patch: Partial<Campaign>) => {
    const { error } = await supabase.from('campaigns').update(patch).eq('id', id)
    if (error) throw error
  },
}

export const stepsApi = {
  listByCampaign: async (campaignId: string): Promise<SequenceStep[]> => {
    const { data, error } = await supabase.from('sequence_steps').select('*').eq('campaign_id', campaignId).order('step_order')
    if (error) throw error
    return data
  },
  upsert: async (step: Partial<SequenceStep> & { campaign_id: string, step_order: number, subject_template: string, body_template: string, delay_days: number }) => {
    const { error } = await supabase.from('sequence_steps').upsert(step, { onConflict: 'campaign_id,step_order' })
    if (error) throw error
  },
  delete: async (id: string) => {
    const { error } = await supabase.from('sequence_steps').delete().eq('id', id)
    if (error) throw error
  },
}

export const leadsApi = {
  listByCampaign: async (campaignId: string): Promise<Lead[]> => {
    const { data, error } = await supabase.from('leads').select('*').eq('campaign_id', campaignId).order('created_at', { ascending: false })
    if (error) throw error
    return data
  },
  listAll: async (filter?: Lead['status']): Promise<(Lead & { campaigns: { name: string } | null })[]> => {
    let q = supabase.from('leads').select('*, campaigns(name)').order('created_at', { ascending: false })
    if (filter) q = q.eq('status', filter)
    const { data, error } = await q
    if (error) throw error
    return (data ?? []) as (Lead & { campaigns: { name: string } | null })[]
  },
  bulkInsert: async (campaignId: string, leads: { email: string, first_name?: string, last_name?: string, company?: string, demo_link?: string, custom1?: string, custom_subject?: string, custom_body?: string }[]) => {
    const rows = leads.map(l => ({ ...l, campaign_id: campaignId, status: 'queued' as const, current_step: 0, next_send_at: new Date().toISOString() }))
    const { data, error } = await supabase.from('leads').upsert(rows, { onConflict: 'campaign_id,email', ignoreDuplicates: true }).select()
    if (error) throw error
    return data
  },
  insertOne: async (campaignId: string, lead: { email: string, first_name?: string, company?: string, demo_link?: string }) => {
    const { error } = await supabase.from('leads').insert({ ...lead, campaign_id: campaignId, status: 'queued', current_step: 0, next_send_at: new Date().toISOString() })
    if (error) throw error
  },
}

export const mailboxesApi = {
  mine: async (userId: string): Promise<Mailbox[]> => {
    const { data, error } = await supabase.from('mailboxes').select('*').eq('user_id', userId).order('created_at', { ascending: true })
    if (error) throw error
    return data
  },
}

export const statsApi = {
  overview: async () => {
    const todayStart = new Date(); todayStart.setHours(0,0,0,0)
    const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7)
    const [sentToday, repliesWeek, queue] = await Promise.all([
      supabase.from('sends').select('id', { count: 'exact', head: true }).gte('sent_at', todayStart.toISOString()).eq('status', 'sent'),
      supabase.from('replies').select('id', { count: 'exact', head: true }).gte('detected_at', weekAgo.toISOString()),
      supabase.from('leads').select('id', { count: 'exact', head: true }).in('status', ['queued','in_progress']),
    ])
    const totalSent = (await supabase.from('sends').select('id', { count: 'exact', head: true }).eq('status','sent')).count ?? 0
    const totalReplies = (await supabase.from('replies').select('id', { count: 'exact', head: true })).count ?? 0
    return {
      sentToday: sentToday.count ?? 0,
      repliesWeek: repliesWeek.count ?? 0,
      queue: queue.count ?? 0,
      replyRate: totalSent > 0 ? (totalReplies / totalSent) * 100 : 0,
    }
  },
}

export const settingsApi = {
  listMine: async (userId: string): Promise<Mailbox[]> => {
    const { data, error } = await supabase.from('mailboxes').select('*').eq('user_id', userId).order('created_at', { ascending: true })
    if (error) throw error
    return data
  },
  upsertMailbox: async (input: {
    display_name: string, email: string,
    smtp_host: string, smtp_port: number, smtp_user: string, smtp_pass: string,
    imap_host: string, imap_port: number, imap_user: string, imap_pass: string,
    daily_limit?: number,
    mailbox_id?: string,
  }) => {
    const { data, error } = await supabase.rpc('upsert_mailbox', {
      p_display_name: input.display_name,
      p_email: input.email,
      p_smtp_host: input.smtp_host,
      p_smtp_port: input.smtp_port,
      p_smtp_user: input.smtp_user,
      p_smtp_pass: input.smtp_pass,
      p_imap_host: input.imap_host,
      p_imap_port: input.imap_port,
      p_imap_user: input.imap_user,
      p_imap_pass: input.imap_pass,
      p_daily_limit: input.daily_limit ?? 5,
      p_mailbox_id: input.mailbox_id ?? undefined,
    })
    if (error) throw error
    return data
  },
  deleteMailbox: async (id: string) => {
    const { error } = await supabase.rpc('delete_mailbox', { p_mailbox_id: id })
    if (error) throw error
  },
}
