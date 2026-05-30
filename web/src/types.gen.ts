export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      campaigns: {
        Row: {
          created_at: string
          created_by: string
          id: string
          name: string
          schedule: Json
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          name: string
          schedule?: Json
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          schedule?: Json
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      leads: {
        Row: {
          campaign_id: string
          company: string | null
          created_at: string
          current_step: number
          custom_body: string | null
          custom_subject: string | null
          custom1: string | null
          demo_link: string | null
          email: string
          first_name: string | null
          id: string
          last_name: string | null
          last_subject: string | null
          mailbox_id: string | null
          next_send_at: string | null
          status: string
          thread_message_id: string | null
          updated_at: string
        }
        Insert: {
          campaign_id: string
          company?: string | null
          created_at?: string
          current_step?: number
          custom_body?: string | null
          custom_subject?: string | null
          custom1?: string | null
          demo_link?: string | null
          email: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          last_subject?: string | null
          mailbox_id?: string | null
          next_send_at?: string | null
          status?: string
          thread_message_id?: string | null
          updated_at?: string
        }
        Update: {
          campaign_id?: string
          company?: string | null
          created_at?: string
          current_step?: number
          custom_body?: string | null
          custom_subject?: string | null
          custom1?: string | null
          demo_link?: string | null
          email?: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          last_subject?: string | null
          mailbox_id?: string | null
          next_send_at?: string | null
          status?: string
          thread_message_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_mailbox_id_fkey"
            columns: ["mailbox_id"]
            isOneToOne: false
            referencedRelation: "mailboxes"
            referencedColumns: ["id"]
          },
        ]
      }
      mailboxes: {
        Row: {
          created_at: string
          display_name: string
          email: string
          id: string
          imap_host: string
          imap_pass_encrypted: string
          imap_port: number
          imap_user: string
          last_error: string | null
          last_imap_uid_seen: number
          smtp_host: string
          smtp_pass_encrypted: string
          smtp_port: number
          smtp_user: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name: string
          email: string
          id?: string
          imap_host: string
          imap_pass_encrypted: string
          imap_port?: number
          imap_user: string
          last_error?: string | null
          last_imap_uid_seen?: number
          smtp_host: string
          smtp_pass_encrypted: string
          smtp_port?: number
          smtp_user: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string
          email?: string
          id?: string
          imap_host?: string
          imap_pass_encrypted?: string
          imap_port?: number
          imap_user?: string
          last_error?: string | null
          last_imap_uid_seen?: number
          smtp_host?: string
          smtp_pass_encrypted?: string
          smtp_port?: number
          smtp_user?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      replies: {
        Row: {
          detected_at: string
          id: string
          imap_uid: number
          lead_id: string
          mailbox_id: string
          snippet: string | null
        }
        Insert: {
          detected_at?: string
          id?: string
          imap_uid: number
          lead_id: string
          mailbox_id: string
          snippet?: string | null
        }
        Update: {
          detected_at?: string
          id?: string
          imap_uid?: number
          lead_id?: string
          mailbox_id?: string
          snippet?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "replies_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "replies_mailbox_id_fkey"
            columns: ["mailbox_id"]
            isOneToOne: false
            referencedRelation: "mailboxes"
            referencedColumns: ["id"]
          },
        ]
      }
      sends: {
        Row: {
          error_text: string | null
          id: string
          lead_id: string
          mailbox_id: string
          sent_at: string
          smtp_message_id: string | null
          status: string
          step_id: string
        }
        Insert: {
          error_text?: string | null
          id?: string
          lead_id: string
          mailbox_id: string
          sent_at?: string
          smtp_message_id?: string | null
          status: string
          step_id: string
        }
        Update: {
          error_text?: string | null
          id?: string
          lead_id?: string
          mailbox_id?: string
          sent_at?: string
          smtp_message_id?: string | null
          status?: string
          step_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sends_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sends_mailbox_id_fkey"
            columns: ["mailbox_id"]
            isOneToOne: false
            referencedRelation: "mailboxes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sends_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "sequence_steps"
            referencedColumns: ["id"]
          },
        ]
      }
      sequence_steps: {
        Row: {
          body_template: string
          campaign_id: string
          delay_days: number
          id: string
          step_order: number
          subject_template: string
        }
        Insert: {
          body_template: string
          campaign_id: string
          delay_days?: number
          id?: string
          step_order: number
          subject_template: string
        }
        Update: {
          body_template?: string
          campaign_id?: string
          delay_days?: number
          id?: string
          step_order?: number
          subject_template?: string
        }
        Relationships: [
          {
            foreignKeyName: "sequence_steps_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      contacted_domains: {
        Row: {
          domain: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      decrypt_secret_hex: { Args: { cipher_hex: string }; Returns: string }
      jitter_next_for_mailbox: {
        Args: { p_jitter_seconds: number; p_mailbox_id: string }
        Returns: undefined
      }
      test_encrypt_helper: { Args: { plain: string }; Returns: string }
      upsert_mailbox: {
        Args: {
          p_display_name: string
          p_email: string
          p_imap_host: string
          p_imap_pass: string
          p_imap_port: number
          p_imap_user: string
          p_smtp_host: string
          p_smtp_pass: string
          p_smtp_port: number
          p_smtp_user: string
        }
        Returns: string
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
