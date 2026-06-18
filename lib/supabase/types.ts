export type Role = 'pending' | 'member' | 'mod' | 'admin'
export type SetType = 'standard' | 'special' | 'special-collections' | 'tins'

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          discord_id: string | null
          username: string | null
          display_name: string | null
          avatar_url: string | null
          role: Role
          approved_at: string | null
        }
        Insert: {
          id?: string
          discord_id?: string | null
          username?: string | null
          display_name?: string | null
          avatar_url?: string | null
          role?: Role
          approved_at?: string | null
        }
        Update: {
          id?: string
          discord_id?: string | null
          username?: string | null
          display_name?: string | null
          avatar_url?: string | null
          role?: Role
          approved_at?: string | null
        }
      }
      sets: {
        Row: {
          id: string
          name: string
          set_type: SetType
          sort_order: number
          is_active: boolean
        }
        Insert: {
          id?: string
          name: string
          set_type: SetType
          sort_order?: number
          is_active?: boolean
        }
        Update: {
          id?: string
          name?: string
          set_type?: SetType
          sort_order?: number
          is_active?: boolean
        }
      }
      products: {
        Row: {
          id: string
          set_id: string
          name: string
          sort_order: number
          is_active: boolean
        }
        Insert: {
          id?: string
          set_id: string
          name: string
          sort_order?: number
          is_active?: boolean
        }
        Update: {
          id?: string
          set_id?: string
          name?: string
          sort_order?: number
          is_active?: boolean
        }
      }
      retailers: {
        Row: {
          id: string
          name: string
        }
        Insert: {
          id?: string
          name: string
        }
        Update: {
          id?: string
          name?: string
        }
      }
      store_locations: {
        Row: {
          id: string
          retailer_id: string
          area: string
          label: string
          address: string
          latitude: number | null
          longitude: number | null
          is_active: boolean
        }
        Insert: {
          id?: string
          retailer_id: string
          area: string
          label: string
          address: string
          latitude?: number | null
          longitude?: number | null
          is_active?: boolean
        }
        Update: {
          id?: string
          retailer_id?: string
          area?: string
          label?: string
          address?: string
          latitude?: number | null
          longitude?: number | null
          is_active?: boolean
        }
      }
      machines: {
        Row: {
          id: string
          machine_code: string
          area: string
          venue: string
          address: string
          nickname: string | null
          latitude: number | null
          longitude: number | null
          is_active: boolean
        }
        Insert: {
          id?: string
          machine_code: string
          area: string
          venue: string
          address: string
          nickname?: string | null
          latitude?: number | null
          longitude?: number | null
          is_active?: boolean
        }
        Update: {
          id?: string
          machine_code?: string
          area?: string
          venue?: string
          address?: string
          nickname?: string | null
          latitude?: number | null
          longitude?: number | null
          is_active?: boolean
        }
      }
      product_types: {
        Row: {
          id: string
          name: string
          sort_order: number
        }
        Insert: {
          id?: string
          name: string
          sort_order?: number
        }
        Update: {
          id?: string
          name?: string
          sort_order?: number
        }
      }
      product_interest: {
        Row: {
          id: string
          user_id: string
          product_id: string
          note: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          product_id: string
          note?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          product_id?: string
          note?: string | null
          created_at?: string
        }
      }
      stock_checks: {
        Row: {
          id: string
          user_id: string
          store_location_id: string
          product_type_id: string
          note: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          store_location_id: string
          product_type_id: string
          note?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          store_location_id?: string
          product_type_id?: string
          note?: string | null
          created_at?: string
        }
      }
      timer_reports: {
        Row: {
          id: string
          user_id: string
          machine_id: string
          minutes: number
          success: boolean
          reported_at: string
        }
        Insert: {
          id?: string
          user_id: string
          machine_id: string
          minutes: number
          success: boolean
          reported_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          machine_id?: string
          minutes?: number
          success?: boolean
          reported_at?: string
        }
      }
    }
    Views: {
      v_interest_overview: {
        Row: {
          product_id: string
          product_name: string
          set_id: string
          set_name: string
          set_type: SetType
          set_sort: number
          interested_count: number
          interested_users: string[]
        }
      }
    }
    Functions: {
      approve_user: {
        Args: { target: string }
        Returns: void
      }
      set_role: {
        Args: { target: string; new_role: string }
        Returns: void
      }
    }
  }
}
