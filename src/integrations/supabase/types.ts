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
  public: {
    Tables: {
      admin_profiles: {
        Row: {
          active: boolean
          created_at: string
          display_name: string
          role: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          display_name?: string
          role?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          display_name?: string
          role?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      artist_releases: {
        Row: {
          artist_id: string
          created_at: string
          id: string
          kind: string
          position: number
          release_date: string | null
          spotify_url: string | null
          status: string
          thumbnail_url: string | null
          title: string
          updated_at: string
          youtube_id: string | null
        }
        Insert: {
          artist_id: string
          created_at?: string
          id?: string
          kind?: string
          position: number
          release_date?: string | null
          spotify_url?: string | null
          status?: string
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
          youtube_id?: string | null
        }
        Update: {
          artist_id?: string
          created_at?: string
          id?: string
          kind?: string
          position?: number
          release_date?: string | null
          spotify_url?: string | null
          status?: string
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
          youtube_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "artist_releases_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "artists"
            referencedColumns: ["id"]
          },
        ]
      }
      artist_socials: {
        Row: {
          artist_id: string
          created_at: string
          id: string
          platform: string
          url: string
        }
        Insert: {
          artist_id: string
          created_at?: string
          id?: string
          platform: string
          url: string
        }
        Update: {
          artist_id?: string
          created_at?: string
          id?: string
          platform?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "artist_socials_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "artists"
            referencedColumns: ["id"]
          },
        ]
      }
      artist_tapes: {
        Row: {
          artist_id: string
          tape_id: string
        }
        Insert: {
          artist_id: string
          tape_id: string
        }
        Update: {
          artist_id?: string
          tape_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "artist_tapes_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "artists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "artist_tapes_tape_id_fkey"
            columns: ["tape_id"]
            isOneToOne: false
            referencedRelation: "tapes"
            referencedColumns: ["id"]
          },
        ]
      }
      artists: {
        Row: {
          alt_text: string | null
          bio: string
          canonical_url: string | null
          code: string
          created_at: string
          edition: string
          faixas: string[]
          focal_position: string | null
          frase: string
          id: string
          meta_description: string | null
          meta_title: string | null
          name: string
          og_image: string | null
          photo_url: string
          presence: string
          role: string
          slug: string
          spotify_artist_id: string
          status: string
          studio: string
          updated_at: string
          zona: string
        }
        Insert: {
          alt_text?: string | null
          bio?: string
          canonical_url?: string | null
          code: string
          created_at?: string
          edition?: string
          faixas?: string[]
          focal_position?: string | null
          frase?: string
          id?: string
          meta_description?: string | null
          meta_title?: string | null
          name: string
          og_image?: string | null
          photo_url?: string
          presence?: string
          role?: string
          slug: string
          spotify_artist_id?: string
          status?: string
          studio?: string
          updated_at?: string
          zona?: string
        }
        Update: {
          alt_text?: string | null
          bio?: string
          canonical_url?: string | null
          code?: string
          created_at?: string
          edition?: string
          faixas?: string[]
          focal_position?: string | null
          frase?: string
          id?: string
          meta_description?: string | null
          meta_title?: string | null
          name?: string
          og_image?: string | null
          photo_url?: string
          presence?: string
          role?: string
          slug?: string
          spotify_artist_id?: string
          status?: string
          studio?: string
          updated_at?: string
          zona?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          actor_user_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          payload: Json
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          payload?: Json
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          payload?: Json
        }
        Relationships: []
      }
      camping_events: {
        Row: {
          created_at: string
          day_label: string
          description: string
          event_time: string | null
          id: string
          order_index: number
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          day_label: string
          description?: string
          event_time?: string | null
          id?: string
          order_index?: number
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          day_label?: string
          description?: string
          event_time?: string | null
          id?: string
          order_index?: number
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      camping_sessions: {
        Row: {
          created_at: string
          description: string
          id: string
          order_index: number
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string
          id?: string
          order_index?: number
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          order_index?: number
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      drop_campaigns: {
        Row: {
          banner_url: string | null
          closing_message: string
          created_at: string
          enabled: boolean
          id: string
          opening_message: string
          primary_product_id: string | null
          starts_at: string | null
          status: string
          timezone: string
          title: string
          updated_at: string
        }
        Insert: {
          banner_url?: string | null
          closing_message?: string
          created_at?: string
          enabled?: boolean
          id?: string
          opening_message?: string
          primary_product_id?: string | null
          starts_at?: string | null
          status?: string
          timezone?: string
          title: string
          updated_at?: string
        }
        Update: {
          banner_url?: string | null
          closing_message?: string
          created_at?: string
          enabled?: boolean
          id?: string
          opening_message?: string
          primary_product_id?: string | null
          starts_at?: string | null
          status?: string
          timezone?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "drop_campaigns_primary_product_id_fkey"
            columns: ["primary_product_id"]
            isOneToOne: false
            referencedRelation: "merch_products"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_movements: {
        Row: {
          actor_user_id: string | null
          created_at: string
          delta: number
          id: string
          product_variant_id: string
          reason: string
          reference: string | null
        }
        Insert: {
          actor_user_id?: string | null
          created_at?: string
          delta: number
          id?: string
          product_variant_id: string
          reason: string
          reference?: string | null
        }
        Update: {
          actor_user_id?: string | null
          created_at?: string
          delta?: number
          id?: string
          product_variant_id?: string
          reason?: string
          reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_product_variant_id_fkey"
            columns: ["product_variant_id"]
            isOneToOne: false
            referencedRelation: "merch_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      media_assets: {
        Row: {
          alt_text: string
          asset_type: string
          created_at: string
          format: string | null
          height: number | null
          id: string
          name: string
          size_bytes: number | null
          status: string
          storage_url: string
          tags: string[]
          updated_at: string
          uploader_user_id: string | null
          width: number | null
        }
        Insert: {
          alt_text?: string
          asset_type: string
          created_at?: string
          format?: string | null
          height?: number | null
          id?: string
          name: string
          size_bytes?: number | null
          status?: string
          storage_url: string
          tags?: string[]
          updated_at?: string
          uploader_user_id?: string | null
          width?: number | null
        }
        Update: {
          alt_text?: string
          asset_type?: string
          created_at?: string
          format?: string | null
          height?: number | null
          id?: string
          name?: string
          size_bytes?: number | null
          status?: string
          storage_url?: string
          tags?: string[]
          updated_at?: string
          uploader_user_id?: string | null
          width?: number | null
        }
        Relationships: []
      }
      merch_products: {
        Row: {
          batch: string | null
          created_at: string
          currency: string
          description: string
          id: string
          name: string
          price: number
          sku: string | null
          status: string
          updated_at: string
        }
        Insert: {
          batch?: string | null
          created_at?: string
          currency?: string
          description?: string
          id?: string
          name: string
          price?: number
          sku?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          batch?: string | null
          created_at?: string
          currency?: string
          description?: string
          id?: string
          name?: string
          price?: number
          sku?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      merch_variants: {
        Row: {
          id: string
          product_id: string
          size: string
          stock_reserved: number
          stock_sold: number
          stock_total: number
        }
        Insert: {
          id?: string
          product_id: string
          size: string
          stock_reserved?: number
          stock_sold?: number
          stock_total?: number
        }
        Update: {
          id?: string
          product_id?: string
          size?: string
          stock_reserved?: number
          stock_sold?: number
          stock_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "merch_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "merch_products"
            referencedColumns: ["id"]
          },
        ]
      }
      partnership_requests: {
        Row: {
          budget: string
          company: string
          contact: string
          created_at: string
          follow_up_at: string | null
          id: string
          message: string
          name: string
          notes: string
          owner_user_id: string | null
          partnership_type: string
          priority: boolean
          status: string
        }
        Insert: {
          budget: string
          company: string
          contact: string
          created_at?: string
          follow_up_at?: string | null
          id?: string
          message: string
          name: string
          notes?: string
          owner_user_id?: string | null
          partnership_type: string
          priority?: boolean
          status?: string
        }
        Update: {
          budget?: string
          company?: string
          contact?: string
          created_at?: string
          follow_up_at?: string | null
          id?: string
          message?: string
          name?: string
          notes?: string
          owner_user_id?: string | null
          partnership_type?: string
          priority?: boolean
          status?: string
        }
        Relationships: []
      }
      releases: {
        Row: {
          artist_id: string | null
          cover_url: string | null
          created_at: string
          description: string
          id: string
          kind: string
          release_date: string | null
          spotify_url: string | null
          status: string
          title: string
          updated_at: string
          youtube_url: string | null
        }
        Insert: {
          artist_id?: string | null
          cover_url?: string | null
          created_at?: string
          description?: string
          id?: string
          kind?: string
          release_date?: string | null
          spotify_url?: string | null
          status?: string
          title: string
          updated_at?: string
          youtube_url?: string | null
        }
        Update: {
          artist_id?: string | null
          cover_url?: string | null
          created_at?: string
          description?: string
          id?: string
          kind?: string
          release_date?: string | null
          spotify_url?: string | null
          status?: string
          title?: string
          updated_at?: string
          youtube_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "releases_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "artists"
            referencedColumns: ["id"]
          },
        ]
      }
      reservations: {
        Row: {
          created_at: string
          customer_name: string
          id: string
          product_variant_id: string
          reservation_code: string
          status: string
        }
        Insert: {
          created_at?: string
          customer_name: string
          id?: string
          product_variant_id: string
          reservation_code: string
          status?: string
        }
        Update: {
          created_at?: string
          customer_name?: string
          id?: string
          product_variant_id?: string
          reservation_code?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "reservations_product_variant_id_fkey"
            columns: ["product_variant_id"]
            isOneToOne: false
            referencedRelation: "merch_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      revelation_media: {
        Row: {
          alt_text: string
          caption: string
          created_at: string
          download_name: string | null
          downloadable: boolean
          id: string
          media_type: string
          order_index: number
          public_id: string
          src: string | null
          status: string
          tags: string[]
          title: string
          updated_at: string
        }
        Insert: {
          alt_text?: string
          caption?: string
          created_at?: string
          download_name?: string | null
          downloadable?: boolean
          id?: string
          media_type: string
          order_index?: number
          public_id: string
          src?: string | null
          status?: string
          tags?: string[]
          title?: string
          updated_at?: string
        }
        Update: {
          alt_text?: string
          caption?: string
          created_at?: string
          download_name?: string | null
          downloadable?: boolean
          id?: string
          media_type?: string
          order_index?: number
          public_id?: string
          src?: string | null
          status?: string
          tags?: string[]
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      site_sections: {
        Row: {
          enabled: boolean
          key: string
          settings: Json
          sort_order: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          enabled?: boolean
          key: string
          settings?: Json
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          enabled?: boolean
          key?: string
          settings?: Json
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      site_settings: {
        Row: {
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      tapes: {
        Row: {
          audio_url: string
          cover_url: string | null
          created_at: string
          description: string
          duration_seconds: number
          id: string
          kind: string
          name: string
          release_date: string | null
          slug: string
          status: string
          updated_at: string
        }
        Insert: {
          audio_url?: string
          cover_url?: string | null
          created_at?: string
          description?: string
          duration_seconds?: number
          id?: string
          kind?: string
          name: string
          release_date?: string | null
          slug: string
          status?: string
          updated_at?: string
        }
        Update: {
          audio_url?: string
          cover_url?: string | null
          created_at?: string
          description?: string
          duration_seconds?: number
          id?: string
          kind?: string
          name?: string
          release_date?: string | null
          slug?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_admin_role: { Args: never; Returns: string }
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
  public: {
    Enums: {},
  },
} as const
