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
  listAll: async (filter?: Lead['status']) => {
    let q = supabase.from('leads').select('*, campaigns(name)').order('created_at', { ascending: false })
    if (filter) q = q.eq('status', filter)
    const { data, error } = await q
    if (error) throw error
    return data
  },
  bulkInsert: async (campaignId: string, leads: { email: string, first_name?: string, last_name?: string, company?: string, demo_link?: string, custom1?: string }[]) => {
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
  mine: async (userId: string): Promise<Mailbox | null> => {
    const { data, error } = await supabase.from('mailboxes').select('*').eq('user_id', userId).maybeSingle()
    if (error) throw error
    return data
  },
}
