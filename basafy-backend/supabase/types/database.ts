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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      applications: {
        Row: {
          applied_at: string | null
          canonical_key: string | null
          company: string | null
          created_at: string
          email_snippet: string | null
          external_application_id: string | null
          gmail_message_id: string | null
          gmail_thread_id: string | null
          id: string
          is_hidden: boolean
          job_id: string | null
          last_synced_at: string | null
          location: string | null
          notes: string | null
          portal_domain: string | null
          requisition_id: string | null
          role: string | null
          role_title: string | null
          source_type: string
          status: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          applied_at?: string | null
          canonical_key?: string | null
          company?: string | null
          created_at?: string
          email_snippet?: string | null
          external_application_id?: string | null
          gmail_message_id?: string | null
          gmail_thread_id?: string | null
          id?: string
          is_hidden?: boolean
          job_id?: string | null
          last_synced_at?: string | null
          location?: string | null
          notes?: string | null
          portal_domain?: string | null
          requisition_id?: string | null
          role?: string | null
          role_title?: string | null
          source_type?: string
          status?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          applied_at?: string | null
          canonical_key?: string | null
          company?: string | null
          created_at?: string
          email_snippet?: string | null
          external_application_id?: string | null
          gmail_message_id?: string | null
          gmail_thread_id?: string | null
          id?: string
          is_hidden?: boolean
          job_id?: string | null
          last_synced_at?: string | null
          location?: string | null
          notes?: string | null
          portal_domain?: string | null
          requisition_id?: string | null
          role?: string | null
          role_title?: string | null
          source_type?: string
          status?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      events: {
        Row: {
          application_id: string | null
          created_at: string
          end_at: string | null
          event_type: string
          id: string
          location: string | null
          meeting_link: string | null
          provider: string | null
          source_type: string
          start_at: string
          title: string
          user_id: string
        }
        Insert: {
          application_id?: string | null
          created_at?: string
          end_at?: string | null
          event_type: string
          id?: string
          location?: string | null
          meeting_link?: string | null
          provider?: string | null
          source_type: string
          start_at: string
          title: string
          user_id: string
        }
        Update: {
          application_id?: string | null
          created_at?: string
          end_at?: string | null
          event_type?: string
          id?: string
          location?: string | null
          meeting_link?: string | null
          provider?: string | null
          source_type?: string
          start_at?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "v_pipeline_applications"
            referencedColumns: ["id"]
          },
        ]
      }
      gmail_connections: {
        Row: {
          access_token: string | null
          access_token_expires_at: string | null
          backfill_completed_at: string | null
          backfill_page_token: string | null
          backfill_processed_count: number | null
          backfill_started_at: string | null
          backfill_total_estimate: number | null
          created_at: string
          email: string
          id: string
          last_synced_at: string | null
          provider: string
          refresh_token: string
          refresh_token_expires_at: string | null
          token_scopes: string[] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token?: string | null
          access_token_expires_at?: string | null
          backfill_completed_at?: string | null
          backfill_page_token?: string | null
          backfill_processed_count?: number | null
          backfill_started_at?: string | null
          backfill_total_estimate?: number | null
          created_at?: string
          email: string
          id?: string
          last_synced_at?: string | null
          provider?: string
          refresh_token: string
          refresh_token_expires_at?: string | null
          token_scopes?: string[] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string | null
          access_token_expires_at?: string | null
          backfill_completed_at?: string | null
          backfill_page_token?: string | null
          backfill_processed_count?: number | null
          backfill_started_at?: string | null
          backfill_total_estimate?: number | null
          created_at?: string
          email?: string
          id?: string
          last_synced_at?: string | null
          provider?: string
          refresh_token?: string
          refresh_token_expires_at?: string | null
          token_scopes?: string[] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      gmail_sync_logs: {
        Row: {
          applications_created: number | null
          applications_updated: number | null
          created_at: string
          error_message: string | null
          finished_at: string | null
          id: number
          job_email_events_created: number | null
          job_email_events_updated: number | null
          messages_processed: number
          started_at: string
          status: string
          sync_type: string | null
          total_messages_fetched: number | null
          user_id: string
        }
        Insert: {
          applications_created?: number | null
          applications_updated?: number | null
          created_at?: string
          error_message?: string | null
          finished_at?: string | null
          id?: never
          job_email_events_created?: number | null
          job_email_events_updated?: number | null
          messages_processed?: number
          started_at?: string
          status: string
          sync_type?: string | null
          total_messages_fetched?: number | null
          user_id: string
        }
        Update: {
          applications_created?: number | null
          applications_updated?: number | null
          created_at?: string
          error_message?: string | null
          finished_at?: string | null
          id?: never
          job_email_events_created?: number | null
          job_email_events_updated?: number | null
          messages_processed?: number
          started_at?: string
          status?: string
          sync_type?: string | null
          total_messages_fetched?: number | null
          user_id?: string
        }
        Relationships: []
      }
      gmail_sync_state: {
        Row: {
          connection_id: string | null
          created_at: string
          id: string
          initial_import_progress: number | null
          initial_import_status: string
          last_deep_result_count: number
          last_phase1_result_count: number
          last_sync_summary: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          connection_id?: string | null
          created_at?: string
          id?: string
          initial_import_progress?: number | null
          initial_import_status?: string
          last_deep_result_count?: number
          last_phase1_result_count?: number
          last_sync_summary?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          connection_id?: string | null
          created_at?: string
          id?: string
          initial_import_progress?: number | null
          initial_import_status?: string
          last_deep_result_count?: number
          last_phase1_result_count?: number
          last_sync_summary?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gmail_sync_state_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "gmail_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      job_email_events: {
        Row: {
          application_id: string | null
          canonical_key: string | null
          confidence: number | null
          created_at: string
          event_type: string
          external_application_id: string | null
          gmail_message_id: string
          gmail_thread_id: string
          id: number
          internet_message_id: string | null
          job_id: string | null
          llm_parsed_json: Json | null
          message_features: Json | null
          parsed_company: string | null
          parsed_role: string | null
          parsed_status: string | null
          portal_domain: string | null
          raw_from: string | null
          requisition_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          application_id?: string | null
          canonical_key?: string | null
          confidence?: number | null
          created_at?: string
          event_type?: string
          external_application_id?: string | null
          gmail_message_id: string
          gmail_thread_id: string
          id?: number
          internet_message_id?: string | null
          job_id?: string | null
          llm_parsed_json?: Json | null
          message_features?: Json | null
          parsed_company?: string | null
          parsed_role?: string | null
          parsed_status?: string | null
          portal_domain?: string | null
          raw_from?: string | null
          requisition_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          application_id?: string | null
          canonical_key?: string | null
          confidence?: number | null
          created_at?: string
          event_type?: string
          external_application_id?: string | null
          gmail_message_id?: string
          gmail_thread_id?: string
          id?: number
          internet_message_id?: string | null
          job_id?: string | null
          llm_parsed_json?: Json | null
          message_features?: Json | null
          parsed_company?: string | null
          parsed_role?: string | null
          parsed_status?: string | null
          portal_domain?: string | null
          raw_from?: string | null
          requisition_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_email_events_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_email_events_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "v_pipeline_applications"
            referencedColumns: ["id"]
          },
        ]
      }
      mock_gmail_messages: {
        Row: {
          body_text: string | null
          created_at: string
          from_address: string | null
          gmail_message_id: string
          gmail_thread_id: string | null
          id: string
          internet_message_id: string | null
          received_at: string
          snippet: string | null
          subject: string | null
          user_id: string
        }
        Insert: {
          body_text?: string | null
          created_at?: string
          from_address?: string | null
          gmail_message_id: string
          gmail_thread_id?: string | null
          id?: string
          internet_message_id?: string | null
          received_at?: string
          snippet?: string | null
          subject?: string | null
          user_id: string
        }
        Update: {
          body_text?: string | null
          created_at?: string
          from_address?: string | null
          gmail_message_id?: string
          gmail_thread_id?: string | null
          id?: string
          internet_message_id?: string | null
          received_at?: string
          snippet?: string | null
          subject?: string | null
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          channel: string
          created_at: string
          delivered_at: string | null
          entity_id: string | null
          entity_type: string | null
          id: string
          is_read: boolean
          metadata: Json | null
          priority: string
          scheduled_for: string | null
          subtype: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          channel?: string
          created_at?: string
          delivered_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          is_read?: boolean
          metadata?: Json | null
          priority?: string
          scheduled_for?: string | null
          subtype?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          channel?: string
          created_at?: string
          delivered_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          is_read?: boolean
          metadata?: Json | null
          priority?: string
          scheduled_for?: string | null
          subtype?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          gmail_priority_domains: string[] | null
          has_seen_gmail_onboarding: boolean
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          gmail_priority_domains?: string[] | null
          has_seen_gmail_onboarding?: boolean
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          gmail_priority_domains?: string[] | null
          has_seen_gmail_onboarding?: boolean
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          application_id: string | null
          completed_at: string | null
          created_at: string
          description: string | null
          due_at: string | null
          id: string
          origin: string
          priority: string | null
          source_message_id: string | null
          status: string
          title: string
          user_id: string
        }
        Insert: {
          application_id?: string | null
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_at?: string | null
          id?: string
          origin: string
          priority?: string | null
          source_message_id?: string | null
          status: string
          title: string
          user_id: string
        }
        Update: {
          application_id?: string | null
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_at?: string | null
          id?: string
          origin?: string
          priority?: string | null
          source_message_id?: string | null
          status?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "v_pipeline_applications"
            referencedColumns: ["id"]
          },
        ]
      }
      user_devices: {
        Row: {
          created_at: string
          device_id: string
          expo_push_token: string | null
          id: string
          notifications_enabled: boolean
          platform: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          device_id: string
          expo_push_token?: string | null
          id?: string
          notifications_enabled?: boolean
          platform?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          device_id?: string
          expo_push_token?: string | null
          id?: string
          notifications_enabled?: boolean
          platform?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_notification_settings: {
        Row: {
          created_at: string
          event_reminder_15m: boolean
          event_reminder_24h: boolean
          event_reminder_2h: boolean
          push_enabled: boolean
          quiet_hours_end: string | null
          quiet_hours_start: string | null
          reminders_enabled: boolean
          task_due_enabled: boolean
          task_overdue_enabled: boolean
          updated_at: string
          updates_enabled: boolean
          user_id: string
        }
        Insert: {
          created_at?: string
          event_reminder_15m?: boolean
          event_reminder_24h?: boolean
          event_reminder_2h?: boolean
          push_enabled?: boolean
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          reminders_enabled?: boolean
          task_due_enabled?: boolean
          task_overdue_enabled?: boolean
          updated_at?: string
          updates_enabled?: boolean
          user_id: string
        }
        Update: {
          created_at?: string
          event_reminder_15m?: boolean
          event_reminder_24h?: boolean
          event_reminder_2h?: boolean
          push_enabled?: boolean
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          reminders_enabled?: boolean
          task_due_enabled?: boolean
          task_overdue_enabled?: boolean
          updated_at?: string
          updates_enabled?: boolean
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      v_calendar_events: {
        Row: {
          application_id: string | null
          company: string | null
          end_at: string | null
          event_date: string | null
          event_type: string | null
          id: string | null
          location: string | null
          meeting_link: string | null
          month_start: string | null
          provider: string | null
          role_title: string | null
          source_type: string | null
          start_at: string | null
          title: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "v_pipeline_applications"
            referencedColumns: ["id"]
          },
        ]
      }
      v_home_metrics: {
        Row: {
          avg_response_days: number | null
          interviews_next_7_days: number | null
          open_tasks: number | null
          success_rate: number | null
          total_active_applications: number | null
        }
        Relationships: []
      }
      v_home_upcoming_events: {
        Row: {
          application_id: string | null
          company: string | null
          end_at: string | null
          event_type: string | null
          id: string | null
          location: string | null
          meeting_link: string | null
          provider: string | null
          role_title: string | null
          source_type: string | null
          start_at: string | null
          title: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "v_pipeline_applications"
            referencedColumns: ["id"]
          },
        ]
      }
      v_pipeline_applications: {
        Row: {
          applied_at: string | null
          company: string | null
          id: string | null
          role_title: string | null
          status: string | null
        }
        Insert: {
          applied_at?: string | null
          company?: string | null
          id?: string | null
          role_title?: string | null
          status?: string | null
        }
        Update: {
          applied_at?: string | null
          company?: string | null
          id?: string | null
          role_title?: string | null
          status?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      get_insights_sankey: {
        Args: { p_end_at?: string; p_start_at?: string }
        Returns: Json
      }
      get_insights_source_effectiveness: {
        Args: { p_end_at?: string; p_start_at?: string }
        Returns: {
          avg_response_days: number
          interviews: number
          offers: number
          source_type: string
          total_count: number
        }[]
      }
      get_insights_stalled_apps: {
        Args: { p_end_at?: string; p_limit?: number; p_start_at?: string }
        Returns: {
          application_id: string
          applied_at: string
          company: string
          days_stalled: number
          role_title: string
          status: string
        }[]
      }
      get_insights_summary: {
        Args: { p_end_at?: string; p_start_at?: string }
        Returns: {
          avg_response_days: number
          open_tasks: number
          response_rate: number
          stage_applied: number
          stage_archived: number
          stage_assessment: number
          stage_interview: number
          stage_offer: number
          stage_rejected: number
          stalled_count: number
          total_applications: number
        }[]
      }
      get_insights_weekly_trend: {
        Args: { p_end_at?: string; p_start_at?: string }
        Returns: {
          replies: number
          week_start: string
        }[]
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
