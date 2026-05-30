import type { Database } from './types.gen'
export type Campaign = Database['public']['Tables']['campaigns']['Row']
export type SequenceStep = Database['public']['Tables']['sequence_steps']['Row']
export type Lead = Database['public']['Tables']['leads']['Row']
export type Mailbox = Database['public']['Tables']['mailboxes']['Row']
export type LeadStatus = Lead['status']
