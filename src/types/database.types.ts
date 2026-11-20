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
    PostgrestVersion: "14.18"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      customers: {
        Row: {
          address: string
          created_at: string
          email: string | null
          has_staircase_only: boolean
          id: string
          lat: number
          lift_height: number | null
          lift_length: number | null
          lift_width: number | null
          lng: number
          name: string
          phone: string
        }
        Insert: {
          address: string
          created_at?: string
          email?: string | null
          has_staircase_only?: boolean
          id?: string
          lat: number
          lift_height?: number | null
          lift_length?: number | null
          lift_width?: number | null
          lng: number
          name: string
          phone: string
        }
        Update: {
          address?: string
          created_at?: string
          email?: string | null
          has_staircase_only?: boolean
          id?: string
          lat?: number
          lift_height?: number | null
          lift_length?: number | null
          lift_width?: number | null
          lng?: number
          name?: string
          phone?: string
        }
        Relationships: []
      }
      deliveries: {
        Row: {
          booking_token: string | null
          created_at: string
          d1_call_status: Database["public"]["Enums"]["call_status_type"]
          d4_call_status: Database["public"]["Enums"]["call_status_type"]
          failure_reason: string | null
          id: string
          order_id: string
          requires_porter: boolean
          scheduled_date: string
          sequence_order: number | null
          slot_booked_at: string | null
          status: Database["public"]["Enums"]["delivery_status_type"]
          time_slot: Database["public"]["Enums"]["delivery_slot_type"] | null
          trip_number: number | null
        }
        Insert: {
          booking_token?: string | null
          created_at?: string
          d1_call_status?: Database["public"]["Enums"]["call_status_type"]
          d4_call_status?: Database["public"]["Enums"]["call_status_type"]
          failure_reason?: string | null
          id?: string
          order_id: string
          requires_porter?: boolean
          scheduled_date: string
          sequence_order?: number | null
          slot_booked_at?: string | null
          status?: Database["public"]["Enums"]["delivery_status_type"]
          time_slot?: Database["public"]["Enums"]["delivery_slot_type"] | null
          trip_number?: number | null
        }
        Update: {
          booking_token?: string | null
          created_at?: string
          d1_call_status?: Database["public"]["Enums"]["call_status_type"]
          d4_call_status?: Database["public"]["Enums"]["call_status_type"]
          failure_reason?: string | null
          id?: string
          order_id?: string
          requires_porter?: boolean
          scheduled_date?: string
          sequence_order?: number | null
          slot_booked_at?: string | null
          status?: Database["public"]["Enums"]["delivery_status_type"]
          time_slot?: Database["public"]["Enums"]["delivery_slot_type"] | null
          trip_number?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "deliveries_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_records: {
        Row: {
          created_at: string
          decided_at: string | null
          decided_by: string | null
          id: string
          leave_date: string
          profile_id: string
          reason: string | null
          status: Database["public"]["Enums"]["leave_status_type"]
        }
        Insert: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          leave_date: string
          profile_id: string
          reason?: string | null
          status?: Database["public"]["Enums"]["leave_status_type"]
        }
        Update: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          leave_date?: string
          profile_id?: string
          reason?: string | null
          status?: Database["public"]["Enums"]["leave_status_type"]
        }
        Relationships: [
          {
            foreignKeyName: "leave_records_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_records_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          height: number
          id: string
          length: number
          name: string
          order_id: string
          weight: number
          width: number
        }
        Insert: {
          created_at?: string
          height: number
          id?: string
          length: number
          name: string
          order_id: string
          weight: number
          width: number
        }
        Update: {
          created_at?: string
          height?: number
          id?: string
          length?: number
          name?: string
          order_id?: string
          weight?: number
          width?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string
          customer_id: string
          id: string
          ready_date: string
          status: Database["public"]["Enums"]["order_status_type"]
        }
        Insert: {
          created_at?: string
          customer_id: string
          id?: string
          ready_date: string
          status?: Database["public"]["Enums"]["order_status_type"]
        }
        Update: {
          created_at?: string
          customer_id?: string
          id?: string
          ready_date?: string
          status?: Database["public"]["Enums"]["order_status_type"]
        }
        Relationships: [
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          app_role: Database["public"]["Enums"]["app_role_type"]
          created_at: string
          crew_role: Database["public"]["Enums"]["crew_role_type"] | null
          full_name: string
          id: string
          weekly_off_day: number | null
        }
        Insert: {
          app_role: Database["public"]["Enums"]["app_role_type"]
          created_at?: string
          crew_role?: Database["public"]["Enums"]["crew_role_type"] | null
          full_name: string
          id: string
          weekly_off_day?: number | null
        }
        Update: {
          app_role?: Database["public"]["Enums"]["app_role_type"]
          created_at?: string
          crew_role?: Database["public"]["Enums"]["crew_role_type"] | null
          full_name?: string
          id?: string
          weekly_off_day?: number | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      book_slot: {
        Args: {
          p_slot: Database["public"]["Enums"]["delivery_slot_type"]
          p_token: string
        }
        Returns: Json
      }
      current_app_role: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role_type"]
      }
      get_booking: { Args: { p_token: string }; Returns: Json }
      slot_capacity: { Args: never; Returns: number }
    }
    Enums: {
      app_role_type: "admin" | "ops" | "crew"
      call_status_type: "pending" | "confirmed" | "unreachable"
      crew_role_type: "driver" | "assembler"
      delivery_slot_type: "morning" | "midday" | "afternoon"
      delivery_status_type: "scheduled" | "delivered" | "failed"
      leave_status_type: "pending" | "approved" | "rejected"
      order_status_type: "unplanned" | "planned" | "delivered"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_role_type: ["admin", "ops", "crew"],
      call_status_type: ["pending", "confirmed", "unreachable"],
      crew_role_type: ["driver", "assembler"],
      delivery_slot_type: ["morning", "midday", "afternoon"],
      delivery_status_type: ["scheduled", "delivered", "failed"],
      leave_status_type: ["pending", "approved", "rejected"],
      order_status_type: ["unplanned", "planned", "delivered"],
    },
  },
} as const
