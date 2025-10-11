export type Database = {
    public: {
      Tables: {
        users: {
          Row: {
            id: string
            email: string
            full_name: string
            role: 'admin' | 'agent'
            position_id: string | null
            upline_id: string | null
            is_active: boolean
            created_at: string
            updated_at: string
          }
          Insert: {
            id?: string
            email: string
            full_name: string
            role?: 'admin' | 'agent'
            position_id?: string | null
            upline_id?: string | null
            is_active?: boolean
            created_at?: string
            updated_at?: string
          }
          Update: {
            id?: string
            email?: string
            full_name?: string
            role?: 'admin' | 'agent'
            position_id?: string | null
            upline_id?: string | null
            is_active?: boolean
            created_at?: string
            updated_at?: string
          }
        }
        // Add other tables here
      }
    }
  }