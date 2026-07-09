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
      calendar_events: {
        Row: {
          all_day: boolean
          counts_as_study: boolean
          course_id: string | null
          created_at: string
          description: string | null
          ends_at: string
          external_id: string | null
          id: string
          location: string | null
          source: string
          starts_at: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          all_day?: boolean
          counts_as_study?: boolean
          course_id?: string | null
          created_at?: string
          description?: string | null
          ends_at: string
          external_id?: string | null
          id?: string
          location?: string | null
          source?: string
          starts_at: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          all_day?: boolean
          counts_as_study?: boolean
          course_id?: string | null
          created_at?: string
          description?: string | null
          ends_at?: string
          external_id?: string | null
          id?: string
          location?: string | null
          source?: string
          starts_at?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      course_files: {
        Row: {
          course_id: string
          created_at: string
          id: string
          mime_type: string | null
          name: string
          size_bytes: number | null
          storage_path: string
          user_id: string
        }
        Insert: {
          course_id: string
          created_at?: string
          id?: string
          mime_type?: string | null
          name: string
          size_bytes?: number | null
          storage_path: string
          user_id: string
        }
        Update: {
          course_id?: string
          created_at?: string
          id?: string
          mime_type?: string | null
          name?: string
          size_bytes?: number | null
          storage_path?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_files_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          archived: boolean
          arskurs: number | null
          code: string | null
          color: string
          completed: boolean
          created_at: string
          final_grade: string | null
          hp: number | null
          icon: string | null
          id: string
          literature: string | null
          name: string
          period: Database["public"]["Enums"]["course_period"] | null
          sort_order: number
          teacher_contact: string | null
          teacher_name: string | null
          university_id: string | null
          updated_at: string
          user_id: string
          weekly_goal_hours: number
        }
        Insert: {
          archived?: boolean
          arskurs?: number | null
          code?: string | null
          color?: string
          completed?: boolean
          created_at?: string
          final_grade?: string | null
          hp?: number | null
          icon?: string | null
          id?: string
          literature?: string | null
          name: string
          period?: Database["public"]["Enums"]["course_period"] | null
          sort_order?: number
          teacher_contact?: string | null
          teacher_name?: string | null
          university_id?: string | null
          updated_at?: string
          user_id: string
          weekly_goal_hours?: number
        }
        Update: {
          archived?: boolean
          arskurs?: number | null
          code?: string | null
          color?: string
          completed?: boolean
          created_at?: string
          final_grade?: string | null
          hp?: number | null
          icon?: string | null
          id?: string
          literature?: string | null
          name?: string
          period?: Database["public"]["Enums"]["course_period"] | null
          sort_order?: number
          teacher_contact?: string | null
          teacher_name?: string | null
          university_id?: string | null
          updated_at?: string
          user_id?: string
          weekly_goal_hours?: number
        }
        Relationships: [
          {
            foreignKeyName: "courses_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
          },
        ]
      }
      email_reminders_sent: {
        Row: {
          dedupe_key: string
          id: string
          kind: string
          sent_at: string
          task_id: string | null
          user_id: string
        }
        Insert: {
          dedupe_key: string
          id?: string
          kind: string
          sent_at?: string
          task_id?: string | null
          user_id: string
        }
        Update: {
          dedupe_key?: string
          id?: string
          kind?: string
          sent_at?: string
          task_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_reminders_sent_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      google_calendar_prefs: {
        Row: {
          background_color: string | null
          counts_as_study: boolean
          created_at: string
          google_calendar_id: string
          id: string
          name: string
          sync_enabled: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          background_color?: string | null
          counts_as_study?: boolean
          created_at?: string
          google_calendar_id: string
          id?: string
          name: string
          sync_enabled?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          background_color?: string | null
          counts_as_study?: boolean
          created_at?: string
          google_calendar_id?: string
          id?: string
          name?: string
          sync_enabled?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      pages: {
        Row: {
          archived: boolean
          content: Json
          course_id: string | null
          created_at: string
          icon: string | null
          id: string
          is_favorite: boolean
          parent_id: string | null
          sort_order: number
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          archived?: boolean
          content?: Json
          course_id?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          is_favorite?: boolean
          parent_id?: string | null
          sort_order?: number
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          archived?: boolean
          content?: Json
          course_id?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          is_favorite?: boolean
          parent_id?: string | null
          sort_order?: number
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pages_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pages_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "pages"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      study_session_tasks: {
        Row: {
          created_at: string
          session_id: string
          task_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          session_id: string
          task_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          session_id?: string
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "study_session_tasks_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "study_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "study_session_tasks_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      study_sessions: {
        Row: {
          actual_end: string | null
          actual_start: string | null
          completed: boolean
          course_id: string | null
          created_at: string
          google_event_id: string | null
          id: string
          needs_review: boolean
          notes: string | null
          planned_end: string
          planned_start: string
          source: string
          updated_at: string
          user_id: string
        }
        Insert: {
          actual_end?: string | null
          actual_start?: string | null
          completed?: boolean
          course_id?: string | null
          created_at?: string
          google_event_id?: string | null
          id?: string
          needs_review?: boolean
          notes?: string | null
          planned_end: string
          planned_start: string
          source?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          actual_end?: string | null
          actual_start?: string | null
          completed?: boolean
          course_id?: string | null
          created_at?: string
          google_event_id?: string | null
          id?: string
          needs_review?: boolean
          notes?: string | null
          planned_end?: string
          planned_start?: string
          source?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "study_sessions_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      task_reminder_overrides: {
        Row: {
          created_at: string
          disabled: boolean
          offsets: number[] | null
          task_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          disabled?: boolean
          offsets?: number[] | null
          task_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          disabled?: boolean
          offsets?: number[] | null
          task_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_reminder_overrides_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: true
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          completed_at: string | null
          course_id: string | null
          created_at: string
          description: string | null
          due_at: string | null
          grade: string | null
          id: string
          pending_review: boolean
          points: string | null
          priority: Database["public"]["Enums"]["task_priority"]
          sort_order: number
          status: Database["public"]["Enums"]["task_status"]
          task_kind: string
          task_type: Database["public"]["Enums"]["task_type"]
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          course_id?: string | null
          created_at?: string
          description?: string | null
          due_at?: string | null
          grade?: string | null
          id?: string
          pending_review?: boolean
          points?: string | null
          priority?: Database["public"]["Enums"]["task_priority"]
          sort_order?: number
          status?: Database["public"]["Enums"]["task_status"]
          task_kind?: string
          task_type?: Database["public"]["Enums"]["task_type"]
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          course_id?: string | null
          created_at?: string
          description?: string | null
          due_at?: string | null
          grade?: string | null
          id?: string
          pending_review?: boolean
          points?: string | null
          priority?: Database["public"]["Enums"]["task_priority"]
          sort_order?: number
          status?: Database["public"]["Enums"]["task_status"]
          task_kind?: string
          task_type?: Database["public"]["Enums"]["task_type"]
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      term_dates: {
        Row: {
          created_at: string
          end_date: string
          id: string
          start_date: string
          term: Database["public"]["Enums"]["term_kind"]
          updated_at: string
          user_id: string
          year: number
        }
        Insert: {
          created_at?: string
          end_date: string
          id?: string
          start_date: string
          term: Database["public"]["Enums"]["term_kind"]
          updated_at?: string
          user_id: string
          year: number
        }
        Update: {
          created_at?: string
          end_date?: string
          id?: string
          start_date?: string
          term?: Database["public"]["Enums"]["term_kind"]
          updated_at?: string
          user_id?: string
          year?: number
        }
        Relationships: []
      }
      time_entries: {
        Row: {
          course_id: string | null
          created_at: string
          description: string | null
          duration_seconds: number | null
          ended_at: string | null
          id: string
          source: string
          started_at: string
          task_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          course_id?: string | null
          created_at?: string
          description?: string | null
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          source?: string
          started_at: string
          task_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          course_id?: string | null
          created_at?: string
          description?: string | null
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          source?: string
          started_at?: string
          task_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_entries_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      universities: {
        Row: {
          created_at: string
          id: string
          name: string
          sort_order: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          sort_order?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          created_at: string
          current_year: number
          daily_summary_enabled: boolean
          density: string
          email_reminders_enabled: boolean
          google_calendar_id: string | null
          google_connected: boolean
          reminder_email: string | null
          reminder_email_verification_code: string | null
          reminder_email_verification_sent_at: string | null
          reminder_email_verified: boolean
          reminder_fallback_hour: number
          reminder_offsets: number[]
          timezone: string
          translucent: boolean
          updated_at: string
          user_id: string
          weekly_summary_enabled: boolean
        }
        Insert: {
          created_at?: string
          current_year?: number
          daily_summary_enabled?: boolean
          density?: string
          email_reminders_enabled?: boolean
          google_calendar_id?: string | null
          google_connected?: boolean
          reminder_email?: string | null
          reminder_email_verification_code?: string | null
          reminder_email_verification_sent_at?: string | null
          reminder_email_verified?: boolean
          reminder_fallback_hour?: number
          reminder_offsets?: number[]
          timezone?: string
          translucent?: boolean
          updated_at?: string
          user_id: string
          weekly_summary_enabled?: boolean
        }
        Update: {
          created_at?: string
          current_year?: number
          daily_summary_enabled?: boolean
          density?: string
          email_reminders_enabled?: boolean
          google_calendar_id?: string | null
          google_connected?: boolean
          reminder_email?: string | null
          reminder_email_verification_code?: string | null
          reminder_email_verification_sent_at?: string | null
          reminder_email_verified?: boolean
          reminder_fallback_hour?: number
          reminder_offsets?: number[]
          timezone?: string
          translucent?: boolean
          updated_at?: string
          user_id?: string
          weekly_summary_enabled?: boolean
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      email_queue_dispatch: { Args: never; Returns: undefined }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
    }
    Enums: {
      course_period: "P1" | "P2" | "P3" | "P4" | "P5"
      task_priority: "low" | "medium" | "high"
      task_status: "todo" | "doing" | "done"
      task_type:
        | "annat"
        | "inlamningsuppgift"
        | "kontrollskrivning"
        | "laboration"
        | "modul"
        | "quiz"
        | "redovisning"
        | "seminarie"
        | "tenta"
        | "ovning"
      term_kind: "host" | "var" | "sommar"
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
    Enums: {
      course_period: ["P1", "P2", "P3", "P4", "P5"],
      task_priority: ["low", "medium", "high"],
      task_status: ["todo", "doing", "done"],
      task_type: [
        "annat",
        "inlamningsuppgift",
        "kontrollskrivning",
        "laboration",
        "modul",
        "quiz",
        "redovisning",
        "seminarie",
        "tenta",
        "ovning",
      ],
      term_kind: ["host", "var", "sommar"],
    },
  },
} as const
