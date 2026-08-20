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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      agencies: {
        Row: {
          code: string
          commission_rate: number | null
          created_at: string | null
          id: string
          monthly_revenue: number | null
          name: string
          owner_id: string
          total_hosts: number | null
        }
        Insert: {
          code: string
          commission_rate?: number | null
          created_at?: string | null
          id: string
          monthly_revenue?: number | null
          name: string
          owner_id: string
          total_hosts?: number | null
        }
        Update: {
          code?: string
          commission_rate?: number | null
          created_at?: string | null
          id?: string
          monthly_revenue?: number | null
          name?: string
          owner_id?: string
          total_hosts?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "agencies_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      agency_hosts: {
        Row: {
          agency_id: string
          host_id: string
          joined_at: string | null
          status: string | null
        }
        Insert: {
          agency_id: string
          host_id: string
          joined_at?: string | null
          status?: string | null
        }
        Update: {
          agency_id?: string
          host_id?: string
          joined_at?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agency_hosts_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agency_hosts_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      bd_applications: {
        Row: {
          agency_experience: string | null
          contact_number: string
          created_at: string | null
          full_name: string
          id: string
          monthly_target_usd: number | null
          status: string | null
          user_id: string
        }
        Insert: {
          agency_experience?: string | null
          contact_number: string
          created_at?: string | null
          full_name: string
          id?: string
          monthly_target_usd?: number | null
          status?: string | null
          user_id: string
        }
        Update: {
          agency_experience?: string | null
          contact_number?: string
          created_at?: string | null
          full_name?: string
          id?: string
          monthly_target_usd?: number | null
          status?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bd_applications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      blocks: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "blocks_blocked_id_fkey"
            columns: ["blocked_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blocks_blocker_id_fkey"
            columns: ["blocker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cp_partnerships: {
        Row: {
          anniversary_date: string | null
          cp_level: number | null
          created_at: string | null
          id: string
          intimacy_points: number | null
          ring_name: string | null
          status: string | null
          user_1: string
          user_2: string
        }
        Insert: {
          anniversary_date?: string | null
          cp_level?: number | null
          created_at?: string | null
          id?: string
          intimacy_points?: number | null
          ring_name?: string | null
          status?: string | null
          user_1: string
          user_2: string
        }
        Update: {
          anniversary_date?: string | null
          cp_level?: number | null
          created_at?: string | null
          id?: string
          intimacy_points?: number | null
          ring_name?: string | null
          status?: string | null
          user_1?: string
          user_2?: string
        }
        Relationships: [
          {
            foreignKeyName: "cp_partnerships_user_1_fkey"
            columns: ["user_1"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cp_partnerships_user_2_fkey"
            columns: ["user_2"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_tasks: {
        Row: {
          icon: string | null
          id: string
          reward_coins: number | null
          reward_diamonds: number | null
          reward_exp: number | null
          target_count: number | null
          title: string
          type: string | null
        }
        Insert: {
          icon?: string | null
          id: string
          reward_coins?: number | null
          reward_diamonds?: number | null
          reward_exp?: number | null
          target_count?: number | null
          title: string
          type?: string | null
        }
        Update: {
          icon?: string | null
          id?: string
          reward_coins?: number | null
          reward_diamonds?: number | null
          reward_exp?: number | null
          target_count?: number | null
          title?: string
          type?: string | null
        }
        Relationships: []
      }
      direct_messages: {
        Row: {
          created_at: string | null
          encrypted_content: string
          id: string
          is_read: boolean | null
          read_at: string | null
          recipient_id: string | null
          sender_id: string | null
        }
        Insert: {
          created_at?: string | null
          encrypted_content: string
          id: string
          is_read?: boolean | null
          read_at?: string | null
          recipient_id?: string | null
          sender_id?: string | null
        }
        Update: {
          created_at?: string | null
          encrypted_content?: string
          id?: string
          is_read?: boolean | null
          read_at?: string | null
          recipient_id?: string | null
          sender_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "direct_messages_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "direct_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      families: {
        Row: {
          announcement: string | null
          badge_text: string
          created_at: string | null
          exp: number | null
          id: string
          leader_id: string | null
          level: number | null
          logo_url: string | null
          max_members: number | null
          name: string
        }
        Insert: {
          announcement?: string | null
          badge_text: string
          created_at?: string | null
          exp?: number | null
          id: string
          leader_id?: string | null
          level?: number | null
          logo_url?: string | null
          max_members?: number | null
          name: string
        }
        Update: {
          announcement?: string | null
          badge_text?: string
          created_at?: string | null
          exp?: number | null
          id?: string
          leader_id?: string | null
          level?: number | null
          logo_url?: string | null
          max_members?: number | null
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "families_leader_id_fkey"
            columns: ["leader_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      family_members: {
        Row: {
          family_id: string
          joined_at: string | null
          role: string | null
          user_id: string
        }
        Insert: {
          family_id: string
          joined_at?: string | null
          role?: string | null
          user_id: string
        }
        Update: {
          family_id?: string
          joined_at?: string | null
          role?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_members_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "family_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      follows: {
        Row: {
          created_at: string
          follower_id: string
          following_id: string
        }
        Insert: {
          created_at?: string
          follower_id: string
          following_id: string
        }
        Update: {
          created_at?: string
          follower_id?: string
          following_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "follows_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follows_following_id_fkey"
            columns: ["following_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      host_applications: {
        Row: {
          category: string | null
          created_at: string | null
          id: string
          monthly_diamonds_earned: number | null
          monthly_live_hours: number | null
          sample_video_url: string | null
          status: string | null
          target_met: boolean | null
          user_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          id?: string
          monthly_diamonds_earned?: number | null
          monthly_live_hours?: number | null
          sample_video_url?: string | null
          status?: string | null
          target_met?: boolean | null
          user_id: string
        }
        Update: {
          category?: string | null
          created_at?: string | null
          id?: string
          monthly_diamonds_earned?: number | null
          monthly_live_hours?: number | null
          sample_video_url?: string | null
          status?: string | null
          target_met?: boolean | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "host_applications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      level_definitions: {
        Row: {
          created_at: string
          level: number
          title: string | null
          xp_required: number
        }
        Insert: {
          created_at?: string
          level: number
          title?: string | null
          xp_required: number
        }
        Update: {
          created_at?: string
          level?: number
          title?: string | null
          xp_required?: number
        }
        Relationships: []
      }
      level_rewards: {
        Row: {
          created_at: string
          id: string
          level: number
          metadata: Json
          reward_amount: number
          reward_type: string
        }
        Insert: {
          created_at?: string
          id?: string
          level: number
          metadata?: Json
          reward_amount?: number
          reward_type: string
        }
        Update: {
          created_at?: string
          id?: string
          level?: number
          metadata?: Json
          reward_amount?: number
          reward_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "level_rewards_level_fkey"
            columns: ["level"]
            isOneToOne: false
            referencedRelation: "level_definitions"
            referencedColumns: ["level"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          created_at: string | null
          gift_data: Json | null
          id: string
          is_gift: boolean | null
          sender_id: string | null
          stream_id: string | null
        }
        Insert: {
          content: string
          created_at?: string | null
          gift_data?: Json | null
          id?: string
          is_gift?: boolean | null
          sender_id?: string | null
          stream_id?: string | null
        }
        Update: {
          content?: string
          created_at?: string | null
          gift_data?: Json | null
          id?: string
          is_gift?: boolean | null
          sender_id?: string | null
          stream_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_stream_id_fkey"
            columns: ["stream_id"]
            isOneToOne: false
            referencedRelation: "streams"
            referencedColumns: ["id"]
          },
        ]
      }
      mutes: {
        Row: {
          created_at: string
          muted_id: string
          muter_id: string
        }
        Insert: {
          created_at?: string
          muted_id: string
          muter_id: string
        }
        Update: {
          created_at?: string
          muted_id?: string
          muter_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mutes_muted_id_fkey"
            columns: ["muted_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mutes_muter_id_fkey"
            columns: ["muter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      offline_recharges: {
        Row: {
          amount_usd: number
          coins_credited: number
          created_at: string | null
          id: string
          payment_method: string
          status: string | null
          transaction_ref: string
          user_id: string
        }
        Insert: {
          amount_usd: number
          coins_credited: number
          created_at?: string | null
          id: string
          payment_method: string
          status?: string | null
          transaction_ref: string
          user_id: string
        }
        Update: {
          amount_usd?: number
          coins_credited?: number
          created_at?: string | null
          id?: string
          payment_method?: string
          status?: string | null
          transaction_ref?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "offline_recharges_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      post_likes: {
        Row: {
          created_at: string | null
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "user_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_visits: {
        Row: {
          id: string
          profile_id: string | null
          visited_at: string | null
          visitor_id: string | null
        }
        Insert: {
          id?: string
          profile_id?: string | null
          visited_at?: string | null
          visitor_id?: string | null
        }
        Update: {
          id?: string
          profile_id?: string | null
          visited_at?: string | null
          visitor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profile_visits_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_visits_visitor_id_fkey"
            columns: ["visitor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar: string | null
          bio: string | null
          coins: number | null
          country: string | null
          country_flag: string | null
          created_at: string | null
          diamonds: number | null
          followers: number | null
          following: number | null
          gender: string | null
          handle: string
          id: string
          is_admin: boolean
          is_verified: boolean | null
          level: number | null
          name: string
          role: Database["public"]["Enums"]["user_role"]
          svip: boolean | null
          vip_level: number | null
        }
        Insert: {
          avatar?: string | null
          bio?: string | null
          coins?: number | null
          country?: string | null
          country_flag?: string | null
          created_at?: string | null
          diamonds?: number | null
          followers?: number | null
          following?: number | null
          gender?: string | null
          handle: string
          id: string
          is_admin?: boolean
          is_verified?: boolean | null
          level?: number | null
          name: string
          role?: Database["public"]["Enums"]["user_role"]
          svip?: boolean | null
          vip_level?: number | null
        }
        Update: {
          avatar?: string | null
          bio?: string | null
          coins?: number | null
          country?: string | null
          country_flag?: string | null
          created_at?: string | null
          diamonds?: number | null
          followers?: number | null
          following?: number | null
          gender?: string | null
          handle?: string
          id?: string
          is_admin?: boolean
          is_verified?: boolean | null
          level?: number | null
          name?: string
          role?: Database["public"]["Enums"]["user_role"]
          svip?: boolean | null
          vip_level?: number | null
        }
        Relationships: []
      }
      room_join_requests: {
        Row: {
          created_at: string
          id: string
          responded_at: string | null
          room_id: string
          status: Database["public"]["Enums"]["room_request_status"]
          type: Database["public"]["Enums"]["room_request_type"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          responded_at?: string | null
          room_id: string
          status?: Database["public"]["Enums"]["room_request_status"]
          type: Database["public"]["Enums"]["room_request_type"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          responded_at?: string | null
          room_id?: string
          status?: Database["public"]["Enums"]["room_request_status"]
          type?: Database["public"]["Enums"]["room_request_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_join_requests_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_join_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      room_participants: {
        Row: {
          id: string
          joined_at: string
          left_at: string | null
          role: Database["public"]["Enums"]["room_participant_role"]
          room_id: string
          user_id: string
        }
        Insert: {
          id?: string
          joined_at?: string
          left_at?: string | null
          role: Database["public"]["Enums"]["room_participant_role"]
          room_id: string
          user_id: string
        }
        Update: {
          id?: string
          joined_at?: string
          left_at?: string | null
          role?: Database["public"]["Enums"]["room_participant_role"]
          room_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_participants_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rooms: {
        Row: {
          category: string | null
          cover: string | null
          created_at: string
          description: string | null
          ended_at: string | null
          host_id: string
          id: string
          livekit_room_name: string
          max_guest_slots: number
          playback_url: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["room_status"]
          title: string
        }
        Insert: {
          category?: string | null
          cover?: string | null
          created_at?: string
          description?: string | null
          ended_at?: string | null
          host_id: string
          id?: string
          livekit_room_name: string
          max_guest_slots?: number
          playback_url?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["room_status"]
          title: string
        }
        Update: {
          category?: string | null
          cover?: string | null
          created_at?: string
          description?: string | null
          ended_at?: string | null
          host_id?: string
          id?: string
          livekit_room_name?: string
          max_guest_slots?: number
          playback_url?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["room_status"]
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "rooms_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      store_items: {
        Row: {
          category: string
          created_at: string | null
          duration_days: number | null
          icon: string | null
          id: string
          is_vip: boolean | null
          name: string
          preview_url: string | null
          price: number
        }
        Insert: {
          category: string
          created_at?: string | null
          duration_days?: number | null
          icon?: string | null
          id: string
          is_vip?: boolean | null
          name: string
          preview_url?: string | null
          price: number
        }
        Update: {
          category?: string
          created_at?: string | null
          duration_days?: number | null
          icon?: string | null
          id?: string
          is_vip?: boolean | null
          name?: string
          preview_url?: string | null
          price?: number
        }
        Relationships: []
      }
      streams: {
        Row: {
          category: string | null
          country: string | null
          country_flag: string | null
          cover_image: string | null
          created_at: string | null
          host_id: string
          id: string
          is_active: boolean | null
          is_hot: boolean | null
          is_recommended: boolean | null
          like_count: number | null
          mode: string
          pinned_message: string | null
          tags: Json | null
          title: string
          type: string
          viewer_count: number | null
        }
        Insert: {
          category?: string | null
          country?: string | null
          country_flag?: string | null
          cover_image?: string | null
          created_at?: string | null
          host_id: string
          id: string
          is_active?: boolean | null
          is_hot?: boolean | null
          is_recommended?: boolean | null
          like_count?: number | null
          mode?: string
          pinned_message?: string | null
          tags?: Json | null
          title: string
          type?: string
          viewer_count?: number | null
        }
        Update: {
          category?: string | null
          country?: string | null
          country_flag?: string | null
          cover_image?: string | null
          created_at?: string | null
          host_id?: string
          id?: string
          is_active?: boolean | null
          is_hot?: boolean | null
          is_recommended?: boolean | null
          like_count?: number | null
          mode?: string
          pinned_message?: string | null
          tags?: Json | null
          title?: string
          type?: string
          viewer_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "streams_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          created_at: string
          description: string | null
          duration_type: string
          expiry_date: string | null
          icon_url: string | null
          id: string
          reward_coins: number
          status: string
          target_count: number
          target_gender: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          duration_type: string
          expiry_date?: string | null
          icon_url?: string | null
          id?: string
          reward_coins?: number
          status?: string
          target_count?: number
          target_gender?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          duration_type?: string
          expiry_date?: string | null
          icon_url?: string | null
          id?: string
          reward_coins?: number
          status?: string
          target_count?: number
          target_gender?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_inventory: {
        Row: {
          created_at: string | null
          expires_at: string | null
          id: string
          is_equipped: boolean | null
          item_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          expires_at?: string | null
          id?: string
          is_equipped?: boolean | null
          item_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          expires_at?: string | null
          id?: string
          is_equipped?: boolean | null
          item_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_inventory_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "store_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_inventory_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_level_history: {
        Row: {
          created_at: string
          id: string
          new_level: number
          old_level: number
          user_id: string
          xp_at_level_up: number
        }
        Insert: {
          created_at?: string
          id?: string
          new_level: number
          old_level: number
          user_id: string
          xp_at_level_up: number
        }
        Update: {
          created_at?: string
          id?: string
          new_level?: number
          old_level?: number
          user_id?: string
          xp_at_level_up?: number
        }
        Relationships: [
          {
            foreignKeyName: "user_level_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_level_progress: {
        Row: {
          total_xp: number
          updated_at: string
          user_id: string
          xp: number
        }
        Insert: {
          total_xp?: number
          updated_at?: string
          user_id: string
          xp?: number
        }
        Update: {
          total_xp?: number
          updated_at?: string
          user_id?: string
          xp?: number
        }
        Relationships: [
          {
            foreignKeyName: "user_level_progress_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_posts: {
        Row: {
          comments_count: number | null
          content: string
          created_at: string | null
          id: string
          likes_count: number | null
          media_urls: Json | null
          user_id: string
        }
        Insert: {
          comments_count?: number | null
          content: string
          created_at?: string | null
          id: string
          likes_count?: number | null
          media_urls?: Json | null
          user_id: string
        }
        Update: {
          comments_count?: number | null
          content?: string
          created_at?: string | null
          id?: string
          likes_count?: number | null
          media_urls?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_posts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_task_claims: {
        Row: {
          claimed_at: string | null
          id: string
          is_claimed: boolean | null
          is_completed: boolean | null
          progress: number | null
          task_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          claimed_at?: string | null
          id?: string
          is_claimed?: boolean | null
          is_completed?: boolean | null
          progress?: number | null
          task_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          claimed_at?: string | null
          id?: string
          is_claimed?: boolean | null
          is_completed?: boolean | null
          progress?: number | null
          task_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_task_claims_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "daily_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_task_claims_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_tasks: {
        Row: {
          claimed: boolean
          claimed_at: string | null
          completed: boolean
          completed_at: string | null
          created_at: string
          id: string
          progress: number
          task_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          claimed?: boolean
          claimed_at?: string | null
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          id?: string
          progress?: number
          task_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          claimed?: boolean
          claimed_at?: string | null
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          id?: string
          progress?: number
          task_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_tasks_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_tasks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_videos: {
        Row: {
          created_at: string | null
          id: string
          likes_count: number | null
          thumbnail_url: string | null
          title: string
          user_id: string
          video_url: string
          views_count: number | null
        }
        Insert: {
          created_at?: string | null
          id: string
          likes_count?: number | null
          thumbnail_url?: string | null
          title: string
          user_id: string
          video_url: string
          views_count?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          likes_count?: number | null
          thumbnail_url?: string | null
          title?: string
          user_id?: string
          video_url?: string
          views_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "user_videos_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      vip_subscriptions: {
        Row: {
          created_at: string | null
          expires_at: string
          id: string
          is_svip: boolean | null
          svip_level: number | null
          user_id: string
          vip_level: number | null
        }
        Insert: {
          created_at?: string | null
          expires_at: string
          id?: string
          is_svip?: boolean | null
          svip_level?: number | null
          user_id: string
          vip_level?: number | null
        }
        Update: {
          created_at?: string | null
          expires_at?: string
          id?: string
          is_svip?: boolean | null
          svip_level?: number | null
          user_id?: string
          vip_level?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "vip_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_create_task: {
        Args: {
          p_description: string
          p_duration_type: string
          p_expiry_date: string
          p_icon_url: string
          p_reward_coins: number
          p_target_count?: number
          p_target_gender: string
          p_title: string
        }
        Returns: {
          created_at: string
          description: string | null
          duration_type: string
          expiry_date: string | null
          icon_url: string | null
          id: string
          reward_coins: number
          status: string
          target_count: number
          target_gender: string
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "tasks"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_delete_task: { Args: { p_task_id: string }; Returns: undefined }
      admin_list_tasks: {
        Args: never
        Returns: {
          created_at: string
          description: string | null
          duration_type: string
          expiry_date: string | null
          icon_url: string | null
          id: string
          reward_coins: number
          status: string
          target_count: number
          target_gender: string
          title: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "tasks"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      admin_update_task: {
        Args: {
          p_description: string
          p_duration_type: string
          p_expiry_date: string
          p_icon_url: string
          p_reward_coins: number
          p_status: string
          p_target_count: number
          p_target_gender: string
          p_task_id: string
          p_title: string
        }
        Returns: {
          created_at: string
          description: string | null
          duration_type: string
          expiry_date: string | null
          icon_url: string | null
          id: string
          reward_coins: number
          status: string
          target_count: number
          target_gender: string
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "tasks"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      claim_task_reward: {
        Args: { p_task_id: string; p_user_id: string }
        Returns: number
      }
      get_client_tasks: {
        Args: { p_user_id: string }
        Returns: {
          claimed: boolean
          completed: boolean
          description: string
          duration_type: string
          expiry_date: string
          icon_url: string
          progress: number
          reward_coins: number
          target_count: number
          task_id: string
          title: string
        }[]
      }
      increment_task_progress: {
        Args: { p_amount?: number; p_task_id: string; p_user_id: string }
        Returns: {
          claimed: boolean
          claimed_at: string | null
          completed: boolean
          completed_at: string | null
          created_at: string
          id: string
          progress: number
          task_id: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "user_tasks"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      reset_weekly_tasks: { Args: never; Returns: undefined }
    }
    Enums: {
      room_participant_role: "host" | "moderator" | "speaker" | "audience"
      room_request_status: "pending" | "accepted" | "rejected" | "cancelled"
      room_request_type: "audio"
      room_status: "created" | "live" | "ending" | "ended"
      user_role:
        | "user"
        | "agency_agent"
        | "agency_admin"
        | "agency_owner"
        | "admin"
        | "super_admin"
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
      room_participant_role: ["host", "moderator", "speaker", "audience"],
      room_request_status: ["pending", "accepted", "rejected", "cancelled"],
      room_request_type: ["audio"],
      room_status: ["created", "live", "ending", "ended"],
      user_role: [
        "user",
        "agency_agent",
        "agency_admin",
        "agency_owner",
        "admin",
        "super_admin",
      ],
    },
  },
} as const
