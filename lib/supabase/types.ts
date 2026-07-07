// types.ts
// Supabase database types for the TCG Tracker (public schema).
// Generated from schema.sql — matches the output of:
//   supabase gen types typescript --schema public
// Use with: createClient<Database>(url, anonKey)

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          discord_id: string | null
          username: string | null
          display_name: string | null
          avatar_url: string | null
          role: Database["public"]["Enums"]["app_role"]
          approved_by: string | null
          approved_at: string | null
          created_at: string
        }
        Insert: {
          id: string
          discord_id?: string | null
          username?: string | null
          display_name?: string | null
          avatar_url?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          approved_by?: string | null
          approved_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          discord_id?: string | null
          username?: string | null
          display_name?: string | null
          avatar_url?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          approved_by?: string | null
          approved_at?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      sets: {
        Row: { id: number; name: string; set_type: string; sort_order: number; is_active: boolean; created_at: string }
        Insert: { id?: number; name: string; set_type: string; sort_order?: number; is_active?: boolean; created_at?: string }
        Update: { id?: number; name?: string; set_type?: string; sort_order?: number; is_active?: boolean; created_at?: string }
        Relationships: []
      }
      products: {
        Row: { id: number; set_id: number; name: string; sort_order: number; is_active: boolean; created_at: string }
        Insert: { id?: number; set_id: number; name: string; sort_order?: number; is_active?: boolean; created_at?: string }
        Update: { id?: number; set_id?: number; name?: string; sort_order?: number; is_active?: boolean; created_at?: string }
        Relationships: [
          {
            foreignKeyName: "products_set_id_fkey"
            columns: ["set_id"]
            isOneToOne: false
            referencedRelation: "sets"
            referencedColumns: ["id"]
          }
        ]
      }
      retailers: {
        Row: { id: number; name: string }
        Insert: { id?: number; name: string }
        Update: { id?: number; name?: string }
        Relationships: []
      }
      store_locations: {
        Row: {
          id: number
          retailer_id: number
          region: string
          city: string
          neighborhood: string | null
          label: string | null
          address: string | null
          latitude: number | null
          longitude: number | null
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: number
          retailer_id: number
          region: string
          city: string
          neighborhood?: string | null
          label?: string | null
          address?: string | null
          latitude?: number | null
          longitude?: number | null
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: number
          retailer_id?: number
          region?: string
          city?: string
          neighborhood?: string | null
          label?: string | null
          address?: string | null
          latitude?: number | null
          longitude?: number | null
          is_active?: boolean
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_locations_retailer_id_fkey"
            columns: ["retailer_id"]
            isOneToOne: false
            referencedRelation: "retailers"
            referencedColumns: ["id"]
          }
        ]
      }
      machines: {
        Row: {
          id: number
          machine_code: string | null
          region: string
          city: string
          neighborhood: string | null
          venue: string
          address: string | null
          nickname: string | null
          latitude: number | null
          longitude: number | null
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: number
          machine_code?: string | null
          region: string
          city: string
          neighborhood?: string | null
          venue: string
          address?: string | null
          nickname?: string | null
          latitude?: number | null
          longitude?: number | null
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: number
          machine_code?: string | null
          region?: string
          city?: string
          neighborhood?: string | null
          venue?: string
          address?: string | null
          nickname?: string | null
          latitude?: number | null
          longitude?: number | null
          is_active?: boolean
          created_at?: string
        }
        Relationships: []
      }
      product_types: {
        Row: { id: number; name: string; sort_order: number }
        Insert: { id?: number; name: string; sort_order?: number }
        Update: { id?: number; name?: string; sort_order?: number }
        Relationships: []
      }
      condition_types: {
        Row: { id: number; name: string; sort_order: number; is_active: boolean }
        Insert: { id?: number; name: string; sort_order?: number; is_active?: boolean }
        Update: { id?: number; name?: string; sort_order?: number; is_active?: boolean }
        Relationships: []
      }
      product_interest: {
        Row: { id: number; user_id: string; product_id: number; note: string | null; created_at: string }
        Insert: { id?: number; user_id: string; product_id: number; note?: string | null; created_at?: string }
        Update: { id?: number; user_id?: string; product_id?: number; note?: string | null; created_at?: string }
        Relationships: [
          {
            foreignKeyName: "product_interest_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_interest_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          }
        ]
      }
      stock_checks: {
        Row: {
          id: number
          user_id: string | null
          store_location_id: number
          product_type_id: number
          note: string | null
          created_at: string
        }
        Insert: {
          id?: number
          user_id?: string | null
          store_location_id: number
          product_type_id: number
          note?: string | null
          created_at?: string
        }
        Update: {
          id?: number
          user_id?: string | null
          store_location_id?: number
          product_type_id?: number
          note?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_checks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_checks_store_location_id_fkey"
            columns: ["store_location_id"]
            isOneToOne: false
            referencedRelation: "store_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_checks_product_type_id_fkey"
            columns: ["product_type_id"]
            isOneToOne: false
            referencedRelation: "product_types"
            referencedColumns: ["id"]
          }
        ]
      }
      timer_reports: {
        Row: {
          id: number
          user_id: string | null
          machine_id: number
          minutes: number
          success: boolean
          reported_at: string
        }
        Insert: {
          id?: number
          user_id?: string | null
          machine_id: number
          minutes: number
          success?: boolean
          reported_at?: string
        }
        Update: {
          id?: number
          user_id?: string | null
          machine_id?: number
          minutes?: number
          success?: boolean
          reported_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "timer_reports_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timer_reports_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          }
        ]
      }
      machine_favorites: {
        Row: { id: number; user_id: string; machine_id: number; created_at: string }
        Insert: { id?: number; user_id: string; machine_id: number; created_at?: string }
        Update: { id?: number; user_id?: string; machine_id?: number; created_at?: string }
        Relationships: [
          {
            foreignKeyName: "machine_favorites_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machine_favorites_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          }
        ]
      }
      machine_conditions: {
        Row: {
          id: number
          user_id: string | null
          machine_id: number
          condition_type_id: number
          note: string | null
          created_at: string
        }
        Insert: {
          id?: number
          user_id?: string | null
          machine_id: number
          condition_type_id: number
          note?: string | null
          created_at?: string
        }
        Update: {
          id?: number
          user_id?: string | null
          machine_id?: number
          condition_type_id?: number
          note?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "machine_conditions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machine_conditions_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machine_conditions_condition_type_id_fkey"
            columns: ["condition_type_id"]
            isOneToOne: false
            referencedRelation: "condition_types"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      v_interest_overview: {
        Row: {
          set_id: number | null
          set_name: string | null
          set_type: string | null
          set_sort: number | null
          product_id: number | null
          product_name: string | null
          product_sort: number | null
          interested_count: number | null
          interested_users: string[] | null
        }
        Relationships: []
      }
    }
    Functions: {
      approve_user: { Args: { target: string }; Returns: undefined }
      set_role: { Args: { target: string; new_role: Database["public"]["Enums"]["app_role"] }; Returns: undefined }
      is_admin: { Args: Record<PropertyKey, never>; Returns: boolean }
      is_member: { Args: Record<PropertyKey, never>; Returns: boolean }
      is_mod: { Args: Record<PropertyKey, never>; Returns: boolean }
      user_role: { Args: { uid: string }; Returns: Database["public"]["Enums"]["app_role"] }
    }
    Enums: {
      app_role: "pending" | "contributor" | "member" | "mod" | "admin"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

// ---- Convenience helpers (same as the Supabase CLI emits) ----
type PublicSchema = Database["public"]

export type Tables<T extends keyof (PublicSchema["Tables"] & PublicSchema["Views"])> =
  (PublicSchema["Tables"] & PublicSchema["Views"])[T] extends { Row: infer R } ? R : never

export type TablesInsert<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T] extends { Insert: infer I } ? I : never

export type TablesUpdate<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T] extends { Update: infer U } ? U : never

export type Enums<T extends keyof PublicSchema["Enums"]> = PublicSchema["Enums"][T]

export const Constants = {
  public: {
    Enums: {
      app_role: ["pending", "contributor", "member", "mod", "admin"],
    },
  },
} as const
