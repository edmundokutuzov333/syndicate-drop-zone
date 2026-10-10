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
          role: string
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
          position: number
          spotify_url: string | null
          status: string
          title: string
          updated_at: string
          youtube_id: string | null
        }
        Insert: {
          artist_id: string
          created_at?: string
          id?: string
          position?: number
          spotify_url?: string | null
          status?: string
          title: string
          updated_at?: string
          youtube_id?: string | null
        }
        Update: {
          artist_id?: string
          created_at?: string
          id?: string
          position?: number
          spotify_url?: string | null
          status?: string
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
          position: number
          status: string
          updated_at: string
          url: string
        }
        Insert: {
          artist_id: string
          created_at?: string
          id?: string
          platform: string
          position?: number
          status?: string
          updated_at?: string
          url: string
        }
        Update: {
          artist_id?: string
          created_at?: string
          id?: string
          platform?: string
          position?: number
          status?: string
          updated_at?: string
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
      artist_status: {
        Row: {
          artist_id: string
          status: string
          updated_at: string
        }
        Insert: {
          artist_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          artist_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "artist_status_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: true
            referencedRelation: "artists"
            referencedColumns: ["id"]
          },
        ]
      }
      artists: {
        Row: {
          bio: string
          code: string
          created_at: string
          edition: string
          faixas: string[]
          frase: string
          id: string
          name: string
          photo_url: string | null
          position: number
          presence: string
          role: string
          slug: string
          spotify_artist_id: string | null
          status: string
          studio: string
          updated_at: string
          zona: string
        }
        Insert: {
          bio?: string
          code: string
          created_at?: string
          edition?: string
          faixas?: string[]
          frase?: string
          id?: string
          name: string
          photo_url?: string | null
          position?: number
          presence?: string
          role?: string
          slug: string
          spotify_artist_id?: string | null
          status?: string
          studio?: string
          updated_at?: string
          zona?: string
        }
        Update: {
          bio?: string
          code?: string
          created_at?: string
          edition?: string
          faixas?: string[]
          frase?: string
          id?: string
          name?: string
          photo_url?: string | null
          position?: number
          presence?: string
          role?: string
          slug?: string
          spotify_artist_id?: string | null
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
          changed_fields: string[]
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          payload: Json
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          changed_fields?: string[]
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          payload?: Json
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          changed_fields?: string[]
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          payload?: Json
        }
        Relationships: []
      }
      beats: {
        Row: {
          audio_url: string | null
          bpm: number | null
          created_at: string
          currency: string
          id: string
          key_signature: string | null
          licence_terms: string | null
          position: number
          preview_url: string | null
          price: number | null
          producer: string
          slug: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          audio_url?: string | null
          bpm?: number | null
          created_at?: string
          currency?: string
          id?: string
          key_signature?: string | null
          licence_terms?: string | null
          position?: number
          preview_url?: string | null
          price?: number | null
          producer: string
          slug: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          audio_url?: string | null
          bpm?: number | null
          created_at?: string
          currency?: string
          id?: string
          key_signature?: string | null
          licence_terms?: string | null
          position?: number
          preview_url?: string | null
          price?: number | null
          producer?: string
          slug?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      camping_events: {
        Row: {
          created_at: string
          description: string
          ends_at: string | null
          id: string
          number: string
          position: number
          slug: string
          starts_at: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string
          ends_at?: string | null
          id?: string
          number?: string
          position?: number
          slug: string
          starts_at?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          ends_at?: string | null
          id?: string
          number?: string
          position?: number
          slug?: string
          starts_at?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      camping_sessions: {
        Row: {
          created_at: string
          day: number
          description: string
          ends_at: string | null
          event_id: string | null
          gallery_tag: string
          id: string
          position: number
          room_id: string
          room_name: string
          slug: string | null
          starts_at: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          day?: number
          description?: string
          ends_at?: string | null
          event_id?: string | null
          gallery_tag?: string
          id?: string
          position?: number
          room_id?: string
          room_name?: string
          slug?: string | null
          starts_at?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          day?: number
          description?: string
          ends_at?: string | null
          event_id?: string | null
          gallery_tag?: string
          id?: string
          position?: number
          room_id?: string
          room_name?: string
          slug?: string | null
          starts_at?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "camping_sessions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "camping_events"
            referencedColumns: ["id"]
          },
        ]
      }
      drop_campaigns: {
        Row: {
          created_at: string
          description: string
          drop_at: string | null
          ends_at: string | null
          id: string
          marquee: string | null
          name: string
          position: number
          slug: string
          starts_at: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string
          drop_at?: string | null
          ends_at?: string | null
          id?: string
          marquee?: string | null
          name: string
          position?: number
          slug: string
          starts_at?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          drop_at?: string | null
          ends_at?: string | null
          id?: string
          marquee?: string | null
          name?: string
          position?: number
          slug?: string
          starts_at?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      events: {
        Row: {
          created_at: string
          id: string
          name: string
          props: Json
          sid: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          props?: Json
          sid: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          props?: Json
          sid?: string
        }
        Relationships: []
      }
      fan_memberships: {
        Row: {
          alias: string
          code: string
          created_at: string
          fan_number: number
          id: string
          referred_by_fan_id: string | null
          rules_version: string
          since: string
          status: string
        }
        Insert: {
          alias: string
          code: string
          created_at?: string
          fan_number?: number
          id?: string
          referred_by_fan_id?: string | null
          rules_version?: string
          since?: string
          status?: string
        }
        Update: {
          alias?: string
          code?: string
          created_at?: string
          fan_number?: number
          id?: string
          referred_by_fan_id?: string | null
          rules_version?: string
          since?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "fan_memberships_referred_by_fan_id_fkey"
            columns: ["referred_by_fan_id"]
            isOneToOne: false
            referencedRelation: "fan_memberships"
            referencedColumns: ["id"]
          },
        ]
      }
      frequency_badges: {
        Row: {
          badge: string
          code: string
          earned_at: string
        }
        Insert: {
          badge?: string
          code: string
          earned_at?: string
        }
        Update: {
          badge?: string
          code?: string
          earned_at?: string
        }
        Relationships: []
      }
      frequency_listeners: {
        Row: {
          last_seen: string
          sid: string
        }
        Insert: {
          last_seen?: string
          sid: string
        }
        Update: {
          last_seen?: string
          sid?: string
        }
        Relationships: []
      }
      frequency_station: {
        Row: {
          id: number
          program_seed: number
          station_started_at: string
          updated_at: string
        }
        Insert: {
          id?: number
          program_seed?: number
          station_started_at?: string
          updated_at?: string
        }
        Update: {
          id?: number
          program_seed?: number
          station_started_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      gallery_items: {
        Row: {
          alt: string
          caption: string
          created_at: string
          day: number
          download_name: string | null
          downloadable: boolean
          id: string
          media_asset_id: string | null
          position: number
          poster_media_asset_id: string | null
          poster_url: string | null
          ratio: string
          roll: string
          slug: string
          status: string
          tag: string
          timecode: string
          type: string
          updated_at: string
          url: string | null
        }
        Insert: {
          alt?: string
          caption?: string
          created_at?: string
          day?: number
          download_name?: string | null
          downloadable?: boolean
          id?: string
          media_asset_id?: string | null
          position?: number
          poster_media_asset_id?: string | null
          poster_url?: string | null
          ratio?: string
          roll?: string
          slug: string
          status?: string
          tag?: string
          timecode?: string
          type: string
          updated_at?: string
          url?: string | null
        }
        Update: {
          alt?: string
          caption?: string
          created_at?: string
          day?: number
          download_name?: string | null
          downloadable?: boolean
          id?: string
          media_asset_id?: string | null
          position?: number
          poster_media_asset_id?: string | null
          poster_url?: string | null
          ratio?: string
          roll?: string
          slug?: string
          status?: string
          tag?: string
          timecode?: string
          type?: string
          updated_at?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gallery_items_media_asset_id_fkey"
            columns: ["media_asset_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gallery_items_poster_media_asset_id_fkey"
            columns: ["poster_media_asset_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_movements: {
        Row: {
          actor_user_id: string | null
          created_at: string
          id: string
          movement_type: string
          notes: string
          quantity: number
          reference: string | null
          variant_id: string
        }
        Insert: {
          actor_user_id?: string | null
          created_at?: string
          id?: string
          movement_type: string
          notes?: string
          quantity: number
          reference?: string | null
          variant_id: string
        }
        Update: {
          actor_user_id?: string | null
          created_at?: string
          id?: string
          movement_type?: string
          notes?: string
          quantity?: number
          reference?: string | null
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "merch_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      live_notifications: {
        Row: {
          contact_key: string
          contact_type: string
          contact_value: string
          created_at: string
          id: string
          kind: string
        }
        Insert: {
          contact_key: string
          contact_type: string
          contact_value: string
          created_at?: string
          id?: string
          kind?: string
        }
        Update: {
          contact_key?: string
          contact_type?: string
          contact_value?: string
          created_at?: string
          id?: string
          kind?: string
        }
        Relationships: []
      }
      media_assets: {
        Row: {
          alt_text: string
          asset_type: string
          created_at: string
          format: string | null
          id: string
          mime_type: string | null
          name: string
          public_url: string | null
          size_bytes: number
          status: string
          storage_path: string | null
          storage_url: string | null
          tags: string[]
          updated_at: string
          uploader_user_id: string | null
          url: string | null
        }
        Insert: {
          alt_text?: string
          asset_type?: string
          created_at?: string
          format?: string | null
          id?: string
          mime_type?: string | null
          name: string
          public_url?: string | null
          size_bytes?: number
          status?: string
          storage_path?: string | null
          storage_url?: string | null
          tags?: string[]
          updated_at?: string
          uploader_user_id?: string | null
          url?: string | null
        }
        Update: {
          alt_text?: string
          asset_type?: string
          created_at?: string
          format?: string | null
          id?: string
          mime_type?: string | null
          name?: string
          public_url?: string | null
          size_bytes?: number
          status?: string
          storage_path?: string | null
          storage_url?: string | null
          tags?: string[]
          updated_at?: string
          uploader_user_id?: string | null
          url?: string | null
        }
        Relationships: []
      }
      members: {
        Row: {
          alias: string
          code: string
          contact_key: string
          contact_type: string
          contact_value: string
          created_at: string
          id: string
          member_number: number
          referred_by_member_id: string | null
          signature_present: boolean
          since: string
          status: string
          statute_version: string
          updated_at: string
        }
        Insert: {
          alias: string
          code: string
          contact_key: string
          contact_type: string
          contact_value: string
          created_at?: string
          id?: string
          member_number?: number
          referred_by_member_id?: string | null
          signature_present?: boolean
          since?: string
          status?: string
          statute_version?: string
          updated_at?: string
        }
        Update: {
          alias?: string
          code?: string
          contact_key?: string
          contact_type?: string
          contact_value?: string
          created_at?: string
          id?: string
          member_number?: number
          referred_by_member_id?: string | null
          signature_present?: boolean
          since?: string
          status?: string
          statute_version?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "members_referred_by_member_id_fkey"
            columns: ["referred_by_member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      merch_products: {
        Row: {
          code: string
          created_at: string
          currency: string
          description: string
          detail: string[]
          id: string
          image_url: string | null
          media_asset_id: string | null
          name: string
          position: number
          price: number
          slug: string
          spec: string
          status: string
          subtitle: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          currency?: string
          description?: string
          detail?: string[]
          id?: string
          image_url?: string | null
          media_asset_id?: string | null
          name: string
          position?: number
          price?: number
          slug: string
          spec?: string
          status?: string
          subtitle?: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          currency?: string
          description?: string
          detail?: string[]
          id?: string
          image_url?: string | null
          media_asset_id?: string | null
          name?: string
          position?: number
          price?: number
          slug?: string
          spec?: string
          status?: string
          subtitle?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "merch_products_media_asset_id_fkey"
            columns: ["media_asset_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      merch_variants: {
        Row: {
          created_at: string
          id: string
          product_id: string
          size: string
          sku: string | null
          status: string
          stock_reserved: number
          stock_sold: number
          stock_total: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          size: string
          sku?: string | null
          status?: string
          stock_reserved?: number
          stock_sold?: number
          stock_total?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          size?: string
          sku?: string | null
          status?: string
          stock_reserved?: number
          stock_sold?: number
          stock_total?: number
          updated_at?: string
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
          partnership_type: string
          priority: boolean
          status: string
        }
        Insert: {
          budget?: string
          company: string
          contact: string
          created_at?: string
          follow_up_at?: string | null
          id?: string
          message: string
          name: string
          notes?: string
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
          partnership_type?: string
          priority?: boolean
          status?: string
        }
        Relationships: []
      }
      radio_blocks: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
          randomize: boolean
          track_ids: string[]
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
          randomize?: boolean
          track_ids?: string[]
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          randomize?: boolean
          track_ids?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      radio_station: {
        Row: {
          active_block_id: string | null
          autoplay: boolean
          crossfade_ms: number
          forced_started_at: string | null
          forced_track_id: string | null
          id: number
          station_name: string
          station_seed: number
          station_tag_url: string
          tag_interval: number
          updated_at: string
        }
        Insert: {
          active_block_id?: string | null
          autoplay?: boolean
          crossfade_ms?: number
          forced_started_at?: string | null
          forced_track_id?: string | null
          id?: number
          station_name?: string
          station_seed?: number
          station_tag_url?: string
          tag_interval?: number
          updated_at?: string
        }
        Update: {
          active_block_id?: string | null
          autoplay?: boolean
          crossfade_ms?: number
          forced_started_at?: string | null
          forced_track_id?: string | null
          id?: number
          station_name?: string
          station_seed?: number
          station_tag_url?: string
          tag_interval?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "radio_station_active_block_id_fkey"
            columns: ["active_block_id"]
            isOneToOne: false
            referencedRelation: "radio_blocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "radio_station_forced_track_id_fkey"
            columns: ["forced_track_id"]
            isOneToOne: false
            referencedRelation: "radio_tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      radio_tracks: {
        Row: {
          artist: string
          artist_slug: string | null
          audio_url: string
          created_at: string
          duration_seconds: number | null
          effects_enabled: boolean
          failure_count: number
          id: string
          kind: string
          last_failure_at: string | null
          position: number
          rotation_weight: number
          status: string
          tags_enabled: boolean
          temporarily_disabled: boolean
          title: string
          updated_at: string
        }
        Insert: {
          artist?: string
          artist_slug?: string | null
          audio_url: string
          created_at?: string
          duration_seconds?: number | null
          effects_enabled?: boolean
          failure_count?: number
          id?: string
          kind?: string
          last_failure_at?: string | null
          position?: number
          rotation_weight?: number
          status?: string
          tags_enabled?: boolean
          temporarily_disabled?: boolean
          title: string
          updated_at?: string
        }
        Update: {
          artist?: string
          artist_slug?: string | null
          audio_url?: string
          created_at?: string
          duration_seconds?: number | null
          effects_enabled?: boolean
          failure_count?: number
          id?: string
          kind?: string
          last_failure_at?: string | null
          position?: number
          rotation_weight?: number
          status?: string
          tags_enabled?: boolean
          temporarily_disabled?: boolean
          title?: string
          updated_at?: string
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
          position: number
          published_at: string | null
          slug: string
          status: string
          subtitle: string
          title: string
          updated_at: string
        }
        Insert: {
          artist_id?: string | null
          cover_url?: string | null
          created_at?: string
          description?: string
          id?: string
          position?: number
          published_at?: string | null
          slug: string
          status?: string
          subtitle?: string
          title: string
          updated_at?: string
        }
        Update: {
          artist_id?: string | null
          cover_url?: string | null
          created_at?: string
          description?: string
          id?: string
          position?: number
          published_at?: string | null
          slug?: string
          status?: string
          subtitle?: string
          title?: string
          updated_at?: string
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
          alias: string
          amount: number | null
          code: string | null
          codename: string | null
          created_at: string
          id: string
          item_name: string | null
          merch_product_id: string | null
          merch_variant_id: string | null
          price: number | null
          product_id: string | null
          product_name: string | null
          qty: number | null
          quantity: number
          recipient_alias: string | null
          reference: string | null
          selected_size: string | null
          serial_number: number | null
          size: string | null
          status: string
          unit_price: number | null
          variant_id: string | null
        }
        Insert: {
          alias?: string
          amount?: number | null
          code?: string | null
          codename?: string | null
          created_at?: string
          id?: string
          item_name?: string | null
          merch_product_id?: string | null
          merch_variant_id?: string | null
          price?: number | null
          product_id?: string | null
          product_name?: string | null
          qty?: number | null
          quantity?: number
          recipient_alias?: string | null
          reference?: string | null
          selected_size?: string | null
          serial_number?: number | null
          size?: string | null
          status?: string
          unit_price?: number | null
          variant_id?: string | null
        }
        Update: {
          alias?: string
          amount?: number | null
          code?: string | null
          codename?: string | null
          created_at?: string
          id?: string
          item_name?: string | null
          merch_product_id?: string | null
          merch_variant_id?: string | null
          price?: number | null
          product_id?: string | null
          product_name?: string | null
          qty?: number | null
          quantity?: number
          recipient_alias?: string | null
          reference?: string | null
          selected_size?: string | null
          serial_number?: number | null
          size?: string | null
          status?: string
          unit_price?: number | null
          variant_id?: string | null
        }
        Relationships: []
      }
      revelation_media: {
        Row: {
          alt: string
          caption: string
          created_at: string
          day: number
          download_name: string | null
          downloadable: boolean
          id: string
          media_asset_id: string | null
          position: number
          poster_media_asset_id: string | null
          poster_url: string | null
          ratio: string
          roll: string
          status: string
          tag: string
          timecode: string
          type: string
          updated_at: string
          url: string | null
        }
        Insert: {
          alt?: string
          caption?: string
          created_at?: string
          day?: number
          download_name?: string | null
          downloadable?: boolean
          id?: string
          media_asset_id?: string | null
          position?: number
          poster_media_asset_id?: string | null
          poster_url?: string | null
          ratio?: string
          roll?: string
          status?: string
          tag?: string
          timecode?: string
          type?: string
          updated_at?: string
          url?: string | null
        }
        Update: {
          alt?: string
          caption?: string
          created_at?: string
          day?: number
          download_name?: string | null
          downloadable?: boolean
          id?: string
          media_asset_id?: string | null
          position?: number
          poster_media_asset_id?: string | null
          poster_url?: string | null
          ratio?: string
          roll?: string
          status?: string
          tag?: string
          timecode?: string
          type?: string
          updated_at?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "revelation_media_media_asset_id_fkey"
            columns: ["media_asset_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "revelation_media_poster_media_asset_id_fkey"
            columns: ["poster_media_asset_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      site_flags: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      site_sections: {
        Row: {
          content: Json
          created_at: string
          description: string
          id: string
          key: string
          position: number
          status: string
          subtitle: string
          title: string
          updated_at: string
        }
        Insert: {
          content?: Json
          created_at?: string
          description?: string
          id?: string
          key: string
          position?: number
          status?: string
          subtitle?: string
          title?: string
          updated_at?: string
        }
        Update: {
          content?: Json
          created_at?: string
          description?: string
          id?: string
          key?: string
          position?: number
          status?: string
          subtitle?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      site_settings: {
        Row: {
          created_at: string
          id: string
          key: string
          position: number
          status: string
          updated_at: string
          value: Json
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          position?: number
          status?: string
          updated_at?: string
          value?: Json
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          position?: number
          status?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      tapes: {
        Row: {
          cover_url: string | null
          created_at: string
          description: string
          dur: string
          feat: string
          id: string
          position: number
          slug: string
          src: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          cover_url?: string | null
          created_at?: string
          description?: string
          dur?: string
          feat?: string
          id?: string
          position?: number
          slug: string
          src: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          cover_url?: string | null
          created_at?: string
          description?: string
          dur?: string
          feat?: string
          id?: string
          position?: number
          slug?: string
          src?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      beats_public: {
        Row: {
          bpm: number | null
          currency: string | null
          id: string | null
          key_signature: string | null
          licence_terms: string | null
          position: number | null
          preview_url: string | null
          price: number | null
          producer: string | null
          slug: string | null
          status: string | null
          title: string | null
        }
        Insert: {
          bpm?: number | null
          currency?: string | null
          id?: string | null
          key_signature?: string | null
          licence_terms?: string | null
          position?: number | null
          preview_url?: string | null
          price?: number | null
          producer?: string | null
          slug?: string | null
          status?: string | null
          title?: string | null
        }
        Update: {
          bpm?: number | null
          currency?: string | null
          id?: string | null
          key_signature?: string | null
          licence_terms?: string | null
          position?: number | null
          preview_url?: string | null
          price?: number | null
          producer?: string | null
          slug?: string | null
          status?: string | null
          title?: string | null
        }
        Relationships: []
      }
      partnership_public: {
        Row: {
          budget: string | null
          company: string | null
          created_at: string | null
          id: string | null
          name: string | null
          partnership_type: string | null
          priority: boolean | null
          status: string | null
        }
        Insert: {
          budget?: string | null
          company?: string | null
          created_at?: string | null
          id?: string | null
          name?: string | null
          partnership_type?: string | null
          priority?: boolean | null
          status?: string | null
        }
        Update: {
          budget?: string | null
          company?: string | null
          created_at?: string | null
          id?: string | null
          name?: string | null
          partnership_type?: string | null
          priority?: boolean | null
          status?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      create_live_notification: {
        Args: {
          p_contact_type: string
          p_contact_value: string
          p_kind: string
        }
        Returns: {
          accepted: boolean
        }[]
      }
      create_public_merch_reservation: {
        Args: {
          p_alias: string
          p_price: number
          p_product_id: string
          p_product_name: string
          p_size: string
          p_variant_id: string
        }
        Returns: Json
      }
      current_admin_role: { Args: never; Returns: string }
      delegados: {
        Args: never
        Returns: {
          alias: string
          referrals: number
        }[]
      }
      fan_public: {
        Args: { p_code: string }
        Returns: {
          alias: string
          code: string
          fan_number: number
          since: string
        }[]
      }
      frequency_award_night: {
        Args: { p_code: string; p_local_hour: number }
        Returns: boolean
      }
      frequency_clock: {
        Args: never
        Returns: {
          program_seed: number
          server_now: string
          station_started_at: string
        }[]
      }
      frequency_has_night_badge: { Args: { p_code: string }; Returns: boolean }
      frequency_heartbeat: { Args: { p_sid: string }; Returns: undefined }
      frequency_listener_count: { Args: never; Returns: number }
      frequency_mark_track_failure: {
        Args: { p_track_id: string }
        Returns: number
      }
      frequency_radio_blocks: {
        Args: never
        Returns: {
          active: boolean
          id: string
          name: string
          randomize: boolean
          track_ids: string[]
        }[]
      }
      frequency_radio_catalog: {
        Args: never
        Returns: {
          artist: string
          artist_slug: string
          audio_url: string
          duration_seconds: number
          failure_count: number
          id: string
          kind: string
          rotation_weight: number
          temporarily_disabled: boolean
          title: string
          track_position: number
        }[]
      }
      frequency_radio_station: {
        Args: never
        Returns: {
          active_block_id: string
          autoplay: boolean
          crossfade_ms: number
          forced_started_at: string
          forced_track_id: string
          station_name: string
          station_seed: number
          station_tag_url: string
          tag_interval: number
        }[]
      }
      join_union: {
        Args: {
          p_alias: string
          p_contact_type: string
          p_contact_value: string
          p_referred_by?: string
          p_signature_present?: boolean
          p_statute_version?: string
        }
        Returns: {
          alias: string
          already_member: boolean
          code: string
          member_number: number
          since: string
        }[]
      }
      member_count: { Args: never; Returns: number }
      member_public: {
        Args: { p_code: string }
        Returns: {
          alias: string
          code: string
          member_number: number
          since: string
        }[]
      }
      register_fan: {
        Args: {
          p_alias: string
          p_referred_by?: string
          p_rules_version?: string
        }
        Returns: {
          alias: string
          code: string
          fan_number: number
          since: string
        }[]
      }
      submit_partnership_request: {
        Args: {
          p_budget: string
          p_company: string
          p_contact: string
          p_message: string
          p_name: string
          p_partnership_type: string
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
