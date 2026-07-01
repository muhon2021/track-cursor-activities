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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      accountability_charts: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          is_current: boolean | null
          name: string
          published_at: string | null
          published_by: string | null
          tenant_id: string
          updated_at: string | null
          version: number | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_current?: boolean | null
          name: string
          published_at?: string | null
          published_by?: string | null
          tenant_id?: string
          updated_at?: string | null
          version?: number | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_current?: boolean | null
          name?: string
          published_at?: string | null
          published_by?: string | null
          tenant_id?: string
          updated_at?: string | null
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "accountability_charts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accountability_charts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      accountability_responsibilities: {
        Row: {
          chart_id: string
          created_at: string | null
          department: string | null
          department_id: string | null
          id: string
          reports_to: string | null
          responsibilities: Json | null
          role_title: string
          sort_order: number | null
          tenant_id: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          chart_id: string
          created_at?: string | null
          department?: string | null
          department_id?: string | null
          id?: string
          reports_to?: string | null
          responsibilities?: Json | null
          role_title: string
          sort_order?: number | null
          tenant_id?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          chart_id?: string
          created_at?: string | null
          department?: string | null
          department_id?: string | null
          id?: string
          reports_to?: string | null
          responsibilities?: Json | null
          role_title?: string
          sort_order?: number | null
          tenant_id?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "accountability_responsibilities_chart_id_fkey"
            columns: ["chart_id"]
            isOneToOne: false
            referencedRelation: "accountability_charts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accountability_responsibilities_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accountability_responsibilities_reports_to_fkey"
            columns: ["reports_to"]
            isOneToOne: false
            referencedRelation: "accountability_responsibilities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accountability_responsibilities_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accountability_responsibilities_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          id: string
          ip_address: string | null
          resource_id: string | null
          resource_type: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          resource_id?: string | null
          resource_type?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          resource_id?: string | null
          resource_type?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      agent_conversations: {
        Row: {
          agent_id: string
          created_at: string
          id: string
          is_archived: boolean
          is_pinned: boolean
          last_message_at: string | null
          message_count: number
          metadata: Json
          summary: string | null
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          agent_id: string
          created_at?: string
          id?: string
          is_archived?: boolean
          is_pinned?: boolean
          last_message_at?: string | null
          message_count?: number
          metadata?: Json
          summary?: string | null
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          agent_id?: string
          created_at?: string
          id?: string
          is_archived?: boolean
          is_pinned?: boolean
          last_message_at?: string | null
          message_count?: number
          metadata?: Json
          summary?: string | null
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_conversations_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_execution_plans: {
        Row: {
          agent_id: string
          completed_at: string | null
          created_at: string | null
          current_step_number: number | null
          execution_time_ms: number | null
          final_output: Json | null
          goal: string
          id: string
          input: string
          metadata: Json | null
          plan_summary: string | null
          planning_time_ms: number | null
          started_at: string | null
          status: string
          steps: Json
          success: boolean | null
          total_cost: number | null
          total_steps: number | null
          total_tokens_used: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          agent_id: string
          completed_at?: string | null
          created_at?: string | null
          current_step_number?: number | null
          execution_time_ms?: number | null
          final_output?: Json | null
          goal: string
          id?: string
          input: string
          metadata?: Json | null
          plan_summary?: string | null
          planning_time_ms?: number | null
          started_at?: string | null
          status?: string
          steps?: Json
          success?: boolean | null
          total_cost?: number | null
          total_steps?: number | null
          total_tokens_used?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          agent_id?: string
          completed_at?: string | null
          created_at?: string | null
          current_step_number?: number | null
          execution_time_ms?: number | null
          final_output?: Json | null
          goal?: string
          id?: string
          input?: string
          metadata?: Json | null
          plan_summary?: string | null
          planning_time_ms?: number | null
          started_at?: string | null
          status?: string
          steps?: Json
          success?: boolean | null
          total_cost?: number | null
          total_steps?: number | null
          total_tokens_used?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_execution_plans_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_execution_plans_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_execution_steps: {
        Row: {
          action_details: Json | null
          action_type: string
          can_run_parallel: boolean | null
          completed_at: string | null
          cost: number | null
          created_at: string | null
          depends_on: number[] | null
          description: string | null
          error_code: string | null
          error_message: string | null
          execution_time_ms: number | null
          id: string
          max_retries: number | null
          output_for_next_step: string | null
          parent_step_id: string | null
          plan_id: string
          result: Json | null
          retry_count: number | null
          started_at: string | null
          status: string
          step_name: string | null
          step_number: number
          tokens_used: number | null
          updated_at: string | null
        }
        Insert: {
          action_details?: Json | null
          action_type: string
          can_run_parallel?: boolean | null
          completed_at?: string | null
          cost?: number | null
          created_at?: string | null
          depends_on?: number[] | null
          description?: string | null
          error_code?: string | null
          error_message?: string | null
          execution_time_ms?: number | null
          id?: string
          max_retries?: number | null
          output_for_next_step?: string | null
          parent_step_id?: string | null
          plan_id: string
          result?: Json | null
          retry_count?: number | null
          started_at?: string | null
          status?: string
          step_name?: string | null
          step_number: number
          tokens_used?: number | null
          updated_at?: string | null
        }
        Update: {
          action_details?: Json | null
          action_type?: string
          can_run_parallel?: boolean | null
          completed_at?: string | null
          cost?: number | null
          created_at?: string | null
          depends_on?: number[] | null
          description?: string | null
          error_code?: string | null
          error_message?: string | null
          execution_time_ms?: number | null
          id?: string
          max_retries?: number | null
          output_for_next_step?: string | null
          parent_step_id?: string | null
          plan_id?: string
          result?: Json | null
          retry_count?: number | null
          started_at?: string | null
          status?: string
          step_name?: string | null
          step_number?: number
          tokens_used?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_execution_steps_parent_step_id_fkey"
            columns: ["parent_step_id"]
            isOneToOne: false
            referencedRelation: "agent_execution_steps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_execution_steps_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "agent_execution_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_learning_events: {
        Row: {
          agent_action_taken: string | null
          agent_id: string
          behavior_change: Json | null
          created_at: string | null
          event_description: string
          event_type: string
          feedback_text: string | null
          feedback_type: string | null
          id: string
          related_conversation_id: string | null
          related_memory_id: string | null
          related_message_id: string | null
          user_id: string
        }
        Insert: {
          agent_action_taken?: string | null
          agent_id: string
          behavior_change?: Json | null
          created_at?: string | null
          event_description: string
          event_type: string
          feedback_text?: string | null
          feedback_type?: string | null
          id?: string
          related_conversation_id?: string | null
          related_memory_id?: string | null
          related_message_id?: string | null
          user_id: string
        }
        Update: {
          agent_action_taken?: string | null
          agent_id?: string
          behavior_change?: Json | null
          created_at?: string | null
          event_description?: string
          event_type?: string
          feedback_text?: string | null
          feedback_type?: string | null
          id?: string
          related_conversation_id?: string | null
          related_memory_id?: string | null
          related_message_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_learning_events_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_learning_events_related_memory_id_fkey"
            columns: ["related_memory_id"]
            isOneToOne: false
            referencedRelation: "agent_memories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_learning_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_memories: {
        Row: {
          access_count: number | null
          agent_id: string
          consolidated: boolean | null
          content: string
          created_at: string | null
          deleted_at: string | null
          deleted_by: string | null
          embedding: string | null
          id: string
          importance_score: number | null
          is_active: boolean | null
          last_accessed_at: string | null
          memory_category: string | null
          memory_type: string
          metadata: Json | null
          source_id: string | null
          source_type: string | null
          summary: string | null
          superseded_by: string | null
          updated_at: string | null
          user_id: string
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          access_count?: number | null
          agent_id: string
          consolidated?: boolean | null
          content: string
          created_at?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          embedding?: string | null
          id?: string
          importance_score?: number | null
          is_active?: boolean | null
          last_accessed_at?: string | null
          memory_category?: string | null
          memory_type: string
          metadata?: Json | null
          source_id?: string | null
          source_type?: string | null
          summary?: string | null
          superseded_by?: string | null
          updated_at?: string | null
          user_id: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          access_count?: number | null
          agent_id?: string
          consolidated?: boolean | null
          content?: string
          created_at?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          embedding?: string | null
          id?: string
          importance_score?: number | null
          is_active?: boolean | null
          last_accessed_at?: string | null
          memory_category?: string | null
          memory_type?: string
          metadata?: Json | null
          source_id?: string | null
          source_type?: string | null
          summary?: string | null
          superseded_by?: string | null
          updated_at?: string | null
          user_id?: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_memories_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_memories_superseded_by_fkey"
            columns: ["superseded_by"]
            isOneToOne: false
            referencedRelation: "agent_memories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_memories_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_messages: {
        Row: {
          citations: Json
          content: string
          conversation_id: string
          created_at: string
          id: string
          latency_ms: number | null
          metadata: Json
          model_used: string | null
          provider_used: string | null
          role: string
          tokens_input: number | null
          tokens_output: number | null
          tool_calls: Json | null
          tool_results: Json | null
        }
        Insert: {
          citations?: Json
          content?: string
          conversation_id: string
          created_at?: string
          id?: string
          latency_ms?: number | null
          metadata?: Json
          model_used?: string | null
          provider_used?: string | null
          role?: string
          tokens_input?: number | null
          tokens_output?: number | null
          tool_calls?: Json | null
          tool_results?: Json | null
        }
        Update: {
          citations?: Json
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          latency_ms?: number | null
          metadata?: Json
          model_used?: string | null
          provider_used?: string | null
          role?: string
          tokens_input?: number | null
          tokens_output?: number | null
          tool_calls?: Json | null
          tool_results?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "agent_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_prompt_versions: {
        Row: {
          agent_id: string
          change_summary: string | null
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          metadata: Json
          system_prompt: string
          version_number: number
        }
        Insert: {
          agent_id: string
          change_summary?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          metadata?: Json
          system_prompt: string
          version_number: number
        }
        Update: {
          agent_id?: string
          change_summary?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          metadata?: Json
          system_prompt?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "agent_prompt_versions_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_prompt_versions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_reasoning_traces: {
        Row: {
          confidence_score: number | null
          content: string
          context: Json | null
          created_at: string | null
          id: string
          plan_id: string
          reasoning_type: string
          step_id: string | null
        }
        Insert: {
          confidence_score?: number | null
          content: string
          context?: Json | null
          created_at?: string | null
          id?: string
          plan_id: string
          reasoning_type: string
          step_id?: string | null
        }
        Update: {
          confidence_score?: number | null
          content?: string
          context?: Json | null
          created_at?: string | null
          id?: string
          plan_id?: string
          reasoning_type?: string
          step_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_reasoning_traces_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "agent_execution_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_reasoning_traces_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "agent_execution_steps"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_run_audit_log: {
        Row: {
          agent_id: string
          conversation_id: string | null
          cost_micro: number | null
          created_at: string
          event_type: string
          id: string
          latency_ms: number | null
          message_id: string | null
          metadata: Json
          run_id: string | null
          status: string | null
          tokens_input: number | null
          tokens_output: number | null
          tool_input: Json | null
          tool_name: string | null
          tool_output: Json | null
          user_id: string | null
        }
        Insert: {
          agent_id: string
          conversation_id?: string | null
          cost_micro?: number | null
          created_at?: string
          event_type: string
          id?: string
          latency_ms?: number | null
          message_id?: string | null
          metadata?: Json
          run_id?: string | null
          status?: string | null
          tokens_input?: number | null
          tokens_output?: number | null
          tool_input?: Json | null
          tool_name?: string | null
          tool_output?: Json | null
          user_id?: string | null
        }
        Update: {
          agent_id?: string
          conversation_id?: string | null
          cost_micro?: number | null
          created_at?: string
          event_type?: string
          id?: string
          latency_ms?: number | null
          message_id?: string | null
          metadata?: Json
          run_id?: string | null
          status?: string | null
          tokens_input?: number | null
          tokens_output?: number | null
          tool_input?: Json | null
          tool_name?: string | null
          tool_output?: Json | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_run_audit_log_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_run_audit_log_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "ai_agent_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_run_audit_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_agent_categories: {
        Row: {
          created_at: string | null
          description: string | null
          display_order: number | null
          icon: string | null
          id: string
          is_active: boolean | null
          name: string
          slug: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          slug: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          slug?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      ai_agent_runs: {
        Row: {
          agent_id: string
          context: Json | null
          created_at: string
          error_message: string | null
          id: string
          input: string | null
          latency_ms: number | null
          metadata: Json | null
          model_used: string | null
          output: string | null
          provider_used: string | null
          status: string | null
          token_metrics: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          agent_id: string
          context?: Json | null
          created_at?: string
          error_message?: string | null
          id?: string
          input?: string | null
          latency_ms?: number | null
          metadata?: Json | null
          model_used?: string | null
          output?: string | null
          provider_used?: string | null
          status?: string | null
          token_metrics?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          agent_id?: string
          context?: Json | null
          created_at?: string
          error_message?: string | null
          id?: string
          input?: string | null
          latency_ms?: number | null
          metadata?: Json | null
          model_used?: string | null
          output?: string | null
          provider_used?: string | null
          status?: string | null
          token_metrics?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_agent_runs_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_agents: {
        Row: {
          avatar: string | null
          category: string | null
          conversation_starters: Json | null
          created_at: string
          data_sources: Json | null
          deleted_at: string | null
          description: string | null
          id: string
          is_enabled: boolean | null
          mcp_server_ids: string[] | null
          memory_enabled: boolean | null
          metadata: Json | null
          name: string
          provider_config: Json | null
          rag_enabled: boolean
          required_role: Database["public"]["Enums"]["app_role"] | null
          slug: string
          system_prompt: string
          tool_code_interpreter: boolean | null
          tool_file_search: boolean | null
          tool_image_generation: boolean | null
          tool_mcp: boolean | null
          tool_web_search: boolean | null
          tools_config: Json | null
          updated_at: string
          welcome_message: string | null
        }
        Insert: {
          avatar?: string | null
          category?: string | null
          conversation_starters?: Json | null
          created_at?: string
          data_sources?: Json | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          is_enabled?: boolean | null
          mcp_server_ids?: string[] | null
          memory_enabled?: boolean | null
          metadata?: Json | null
          name: string
          provider_config?: Json | null
          rag_enabled?: boolean
          required_role?: Database["public"]["Enums"]["app_role"] | null
          slug: string
          system_prompt: string
          tool_code_interpreter?: boolean | null
          tool_file_search?: boolean | null
          tool_image_generation?: boolean | null
          tool_mcp?: boolean | null
          tool_web_search?: boolean | null
          tools_config?: Json | null
          updated_at?: string
          welcome_message?: string | null
        }
        Update: {
          avatar?: string | null
          category?: string | null
          conversation_starters?: Json | null
          created_at?: string
          data_sources?: Json | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          is_enabled?: boolean | null
          mcp_server_ids?: string[] | null
          memory_enabled?: boolean | null
          metadata?: Json | null
          name?: string
          provider_config?: Json | null
          rag_enabled?: boolean
          required_role?: Database["public"]["Enums"]["app_role"] | null
          slug?: string
          system_prompt?: string
          tool_code_interpreter?: boolean | null
          tool_file_search?: boolean | null
          tool_image_generation?: boolean | null
          tool_mcp?: boolean | null
          tool_web_search?: boolean | null
          tools_config?: Json | null
          updated_at?: string
          welcome_message?: string | null
        }
        Relationships: []
      }
      ai_chat_history: {
        Row: {
          agent_id: string | null
          content: string
          created_at: string
          id: string
          metadata: Json | null
          role: string
          session_id: string
          user_id: string
        }
        Insert: {
          agent_id?: string | null
          content: string
          created_at?: string
          id?: string
          metadata?: Json | null
          role: string
          session_id: string
          user_id: string
        }
        Update: {
          agent_id?: string | null
          content?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          role?: string
          session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_chat_history_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_digest_logs: {
        Row: {
          created_at: string
          digest_type: string
          id: string
          read_at: string | null
          sent_at: string
          subject: string
          summary: Json
          user_id: string
          was_read: boolean
        }
        Insert: {
          created_at?: string
          digest_type?: string
          id?: string
          read_at?: string | null
          sent_at?: string
          subject: string
          summary?: Json
          user_id: string
          was_read?: boolean
        }
        Update: {
          created_at?: string
          digest_type?: string
          id?: string
          read_at?: string | null
          sent_at?: string
          subject?: string
          summary?: Json
          user_id?: string
          was_read?: boolean
        }
        Relationships: []
      }
      ai_models: {
        Row: {
          category: string
          context_window: number
          created_at: string
          embedding_cost_per_1k: number
          enabled: boolean
          features: Json
          id: string
          input_cost_per_1k: number
          is_default: boolean
          model_id: string
          name: string
          output_cost_per_1k: number
          provider_id: string
          updated_at: string
        }
        Insert: {
          category: string
          context_window?: number
          created_at?: string
          embedding_cost_per_1k?: number
          enabled?: boolean
          features?: Json
          id?: string
          input_cost_per_1k?: number
          is_default?: boolean
          model_id: string
          name: string
          output_cost_per_1k?: number
          provider_id: string
          updated_at?: string
        }
        Update: {
          category?: string
          context_window?: number
          created_at?: string
          embedding_cost_per_1k?: number
          enabled?: boolean
          features?: Json
          id?: string
          input_cost_per_1k?: number
          is_default?: boolean
          model_id?: string
          name?: string
          output_cost_per_1k?: number
          provider_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_models_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "ai_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_productivity_insights: {
        Row: {
          confidence_score: number | null
          content: string
          created_at: string | null
          department: string | null
          employee_email: string | null
          id: string
          insight_type: string
          model_used: string | null
          pod_id: string | null
          recommendations: string[] | null
          title: string
          week_start: string | null
        }
        Insert: {
          confidence_score?: number | null
          content: string
          created_at?: string | null
          department?: string | null
          employee_email?: string | null
          id?: string
          insight_type: string
          model_used?: string | null
          pod_id?: string | null
          recommendations?: string[] | null
          title: string
          week_start?: string | null
        }
        Update: {
          confidence_score?: number | null
          content?: string
          created_at?: string | null
          department?: string | null
          employee_email?: string | null
          id?: string
          insight_type?: string
          model_used?: string | null
          pod_id?: string | null
          recommendations?: string[] | null
          title?: string
          week_start?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_productivity_insights_pod_id_fkey"
            columns: ["pod_id"]
            isOneToOne: false
            referencedRelation: "pods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_productivity_insights_pod_id_fkey"
            columns: ["pod_id"]
            isOneToOne: false
            referencedRelation: "pods_with_stats"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_providers: {
        Row: {
          api_key_secret_name: string | null
          base_url: string | null
          created_at: string
          description: string | null
          enabled: boolean
          id: string
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          api_key_secret_name?: string | null
          base_url?: string | null
          created_at?: string
          description?: string | null
          enabled?: boolean
          id?: string
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          api_key_secret_name?: string | null
          base_url?: string | null
          created_at?: string
          description?: string | null
          enabled?: boolean
          id?: string
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      ai_usage_logs: {
        Row: {
          created_at: string
          embedding_tokens: number
          estimated_cost: number
          function_name: string | null
          id: string
          input_tokens: number
          metadata: Json | null
          model_id: string | null
          output_tokens: number
          user_id: string
        }
        Insert: {
          created_at?: string
          embedding_tokens?: number
          estimated_cost?: number
          function_name?: string | null
          id?: string
          input_tokens?: number
          metadata?: Json | null
          model_id?: string | null
          output_tokens?: number
          user_id: string
        }
        Update: {
          created_at?: string
          embedding_tokens?: number
          estimated_cost?: number
          function_name?: string | null
          id?: string
          input_tokens?: number
          metadata?: Json | null
          model_id?: string | null
          output_tokens?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_logs_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "ai_models"
            referencedColumns: ["id"]
          },
        ]
      }
      app_config: {
        Row: {
          category: string
          created_at: string | null
          description: string | null
          id: string
          is_sensitive: boolean | null
          key: string
          updated_at: string | null
          value: Json
        }
        Insert: {
          category?: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_sensitive?: boolean | null
          key: string
          updated_at?: string | null
          value?: Json
        }
        Update: {
          category?: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_sensitive?: boolean | null
          key?: string
          updated_at?: string | null
          value?: Json
        }
        Relationships: []
      }
      app_modules: {
        Row: {
          category: string | null
          created_at: string | null
          dependencies: string[] | null
          description: string | null
          icon: string | null
          id: string
          is_active: boolean | null
          is_core: boolean | null
          name: string
          page_route: string | null
          slug: string
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          dependencies?: string[] | null
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          is_core?: boolean | null
          name: string
          page_route?: string | null
          slug: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          dependencies?: string[] | null
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          is_core?: boolean | null
          name?: string
          page_route?: string | null
          slug?: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          details: Json
          id: string
          ip_address: string | null
          previous_row_hash: string | null
          resource_id: string | null
          resource_type: string | null
          row_hash: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json
          id?: string
          ip_address?: string | null
          previous_row_hash?: string | null
          resource_id?: string | null
          resource_type?: string | null
          row_hash?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json
          id?: string
          ip_address?: string | null
          previous_row_hash?: string | null
          resource_id?: string | null
          resource_type?: string | null
          row_hash?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      client_feedback: {
        Row: {
          client_access_id: string | null
          created_at: string | null
          feedback_text: string
          id: string
          project_id: string
          rating: number | null
          week_number: number | null
          year: number | null
        }
        Insert: {
          client_access_id?: string | null
          created_at?: string | null
          feedback_text: string
          id?: string
          project_id: string
          rating?: number | null
          week_number?: number | null
          year?: number | null
        }
        Update: {
          client_access_id?: string | null
          created_at?: string | null
          feedback_text?: string
          id?: string
          project_id?: string
          rating?: number | null
          week_number?: number | null
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "client_feedback_client_access_id_fkey"
            columns: ["client_access_id"]
            isOneToOne: false
            referencedRelation: "project_client_access"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_feedback_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_risk_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_feedback_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      client_meetings: {
        Row: {
          client_id: string
          created_at: string
          id: string
          meeting_id: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          meeting_id: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          meeting_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_meetings_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_meetings_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          company: string | null
          created_at: string
          created_by: string | null
          data_source: string | null
          email: string | null
          external_id: string | null
          external_url: string | null
          id: string
          last_synced_at: string | null
          metadata: Json | null
          name: string
          phone: string | null
          status: string | null
          updated_at: string
        }
        Insert: {
          company?: string | null
          created_at?: string
          created_by?: string | null
          data_source?: string | null
          email?: string | null
          external_id?: string | null
          external_url?: string | null
          id?: string
          last_synced_at?: string | null
          metadata?: Json | null
          name: string
          phone?: string | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          company?: string | null
          created_at?: string
          created_by?: string | null
          data_source?: string | null
          email?: string | null
          external_id?: string | null
          external_url?: string | null
          id?: string
          last_synced_at?: string | null
          metadata?: Json | null
          name?: string
          phone?: string | null
          status?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      common_knowledge: {
        Row: {
          category: string | null
          content: string
          created_at: string | null
          created_by: string | null
          id: string
          is_active: boolean | null
          tags: string[] | null
          title: string
          updated_at: string | null
        }
        Insert: {
          category?: string | null
          content: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          tags?: string[] | null
          title: string
          updated_at?: string | null
        }
        Update: {
          category?: string | null
          content?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          tags?: string[] | null
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      contact_activities: {
        Row: {
          activity_type: string
          channel: string
          contact_id: string
          created_at: string | null
          created_by: string | null
          deleted_at: string | null
          description: string | null
          direction: string
          email_bcc: string[] | null
          email_body: string | null
          email_cc: string[] | null
          email_sent_at: string | null
          email_to: string[] | null
          id: string
          metadata: Json | null
          subject: string | null
        }
        Insert: {
          activity_type: string
          channel: string
          contact_id: string
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          direction: string
          email_bcc?: string[] | null
          email_body?: string | null
          email_cc?: string[] | null
          email_sent_at?: string | null
          email_to?: string[] | null
          id?: string
          metadata?: Json | null
          subject?: string | null
        }
        Update: {
          activity_type?: string
          channel?: string
          contact_id?: string
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          direction?: string
          email_bcc?: string[] | null
          email_body?: string | null
          email_cc?: string[] | null
          email_sent_at?: string | null
          email_to?: string[] | null
          id?: string
          metadata?: Json | null
          subject?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contact_activities_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_ai_summaries: {
        Row: {
          contact_id: string
          created_at: string | null
          data_snapshot: Json | null
          engagement_level: string | null
          expires_at: string | null
          generated_at: string | null
          id: string
          lead_score: number | null
          recommended_approach: string | null
          summary_text: string | null
          talking_points: Json | null
          updated_at: string | null
        }
        Insert: {
          contact_id: string
          created_at?: string | null
          data_snapshot?: Json | null
          engagement_level?: string | null
          expires_at?: string | null
          generated_at?: string | null
          id?: string
          lead_score?: number | null
          recommended_approach?: string | null
          summary_text?: string | null
          talking_points?: Json | null
          updated_at?: string | null
        }
        Update: {
          contact_id?: string
          created_at?: string | null
          data_snapshot?: Json | null
          engagement_level?: string | null
          expires_at?: string | null
          generated_at?: string | null
          id?: string
          lead_score?: number | null
          recommended_approach?: string | null
          summary_text?: string | null
          talking_points?: Json | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contact_ai_summaries_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: true
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_communications: {
        Row: {
          channel: string
          contact_id: string
          content: string | null
          created_at: string | null
          direction: string | null
          id: string
          subject: string | null
          user_id: string | null
        }
        Insert: {
          channel: string
          contact_id: string
          content?: string | null
          created_at?: string | null
          direction?: string | null
          id?: string
          subject?: string | null
          user_id?: string | null
        }
        Update: {
          channel?: string
          contact_id?: string
          content?: string | null
          created_at?: string | null
          direction?: string | null
          id?: string
          subject?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contact_communications_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_email_templates: {
        Row: {
          body: string
          category: string | null
          created_at: string | null
          created_by: string | null
          id: string
          is_active: boolean | null
          is_system: boolean | null
          name: string
          subject: string
          updated_at: string | null
          usage_count: number | null
          variables: Json | null
        }
        Insert: {
          body: string
          category?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          is_system?: boolean | null
          name: string
          subject: string
          updated_at?: string | null
          usage_count?: number | null
          variables?: Json | null
        }
        Update: {
          body?: string
          category?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          is_system?: boolean | null
          name?: string
          subject?: string
          updated_at?: string | null
          usage_count?: number | null
          variables?: Json | null
        }
        Relationships: []
      }
      contact_meeting_links: {
        Row: {
          contact_id: string
          created_at: string
          id: string
          meeting_id: string
        }
        Insert: {
          contact_id: string
          created_at?: string
          id?: string
          meeting_id: string
        }
        Update: {
          contact_id?: string
          created_at?: string
          id?: string
          meeting_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_meeting_links_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_meeting_links_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          client_id: string | null
          company: string | null
          created_at: string | null
          created_by: string | null
          current_intent_status: string | null
          current_mood_label: string | null
          current_mood_score: number | null
          data_source: string | null
          deal_potential_score: number | null
          department: string | null
          email: string | null
          engagement_score: number | null
          external_id: string | null
          external_url: string | null
          first_name: string
          followup_assigned_to: string | null
          followup_attempt_count: number | null
          followup_interval_days: number | null
          followup_notes: string | null
          followup_status: string | null
          hubspot_id: string | null
          id: string
          is_lead_follow_up: boolean | null
          is_upwork_lead: boolean | null
          last_contact_date: string | null
          last_contacted_at: string | null
          last_intent_analysis_at: string | null
          last_mood_analysis_at: string | null
          last_name: string | null
          last_score_calculated_at: string | null
          last_synced_at: string | null
          lead_score: number | null
          lead_temperature: string | null
          linkedin_url: string | null
          next_followup_date: string | null
          notes: string | null
          phone: string | null
          preferred_contact_channel: string | null
          profile_score: number | null
          recency_score: number | null
          source: string | null
          tags: string[] | null
          title: string | null
          updated_at: string | null
          website: string | null
        }
        Insert: {
          client_id?: string | null
          company?: string | null
          created_at?: string | null
          created_by?: string | null
          current_intent_status?: string | null
          current_mood_label?: string | null
          current_mood_score?: number | null
          data_source?: string | null
          deal_potential_score?: number | null
          department?: string | null
          email?: string | null
          engagement_score?: number | null
          external_id?: string | null
          external_url?: string | null
          first_name: string
          followup_assigned_to?: string | null
          followup_attempt_count?: number | null
          followup_interval_days?: number | null
          followup_notes?: string | null
          followup_status?: string | null
          hubspot_id?: string | null
          id?: string
          is_lead_follow_up?: boolean | null
          is_upwork_lead?: boolean | null
          last_contact_date?: string | null
          last_contacted_at?: string | null
          last_intent_analysis_at?: string | null
          last_mood_analysis_at?: string | null
          last_name?: string | null
          last_score_calculated_at?: string | null
          last_synced_at?: string | null
          lead_score?: number | null
          lead_temperature?: string | null
          linkedin_url?: string | null
          next_followup_date?: string | null
          notes?: string | null
          phone?: string | null
          preferred_contact_channel?: string | null
          profile_score?: number | null
          recency_score?: number | null
          source?: string | null
          tags?: string[] | null
          title?: string | null
          updated_at?: string | null
          website?: string | null
        }
        Update: {
          client_id?: string | null
          company?: string | null
          created_at?: string | null
          created_by?: string | null
          current_intent_status?: string | null
          current_mood_label?: string | null
          current_mood_score?: number | null
          data_source?: string | null
          deal_potential_score?: number | null
          department?: string | null
          email?: string | null
          engagement_score?: number | null
          external_id?: string | null
          external_url?: string | null
          first_name?: string
          followup_assigned_to?: string | null
          followup_attempt_count?: number | null
          followup_interval_days?: number | null
          followup_notes?: string | null
          followup_status?: string | null
          hubspot_id?: string | null
          id?: string
          is_lead_follow_up?: boolean | null
          is_upwork_lead?: boolean | null
          last_contact_date?: string | null
          last_contacted_at?: string | null
          last_intent_analysis_at?: string | null
          last_mood_analysis_at?: string | null
          last_name?: string | null
          last_score_calculated_at?: string | null
          last_synced_at?: string | null
          lead_score?: number | null
          lead_temperature?: string | null
          linkedin_url?: string | null
          next_followup_date?: string | null
          notes?: string | null
          phone?: string | null
          preferred_contact_channel?: string | null
          profile_score?: number | null
          recency_score?: number | null
          source?: string | null
          tags?: string[] | null
          title?: string | null
          updated_at?: string | null
          website?: string | null
        }
        Relationships: []
      }
      dashboard_widgets: {
        Row: {
          agency_roles: string[]
          component_name: string
          created_at: string
          description: string | null
          display_name: string
          id: string
          is_enabled: boolean
          metadata: Json | null
          sort_order: number
          updated_at: string
          widget_slug: string
        }
        Insert: {
          agency_roles?: string[]
          component_name: string
          created_at?: string
          description?: string | null
          display_name: string
          id?: string
          is_enabled?: boolean
          metadata?: Json | null
          sort_order?: number
          updated_at?: string
          widget_slug: string
        }
        Update: {
          agency_roles?: string[]
          component_name?: string
          created_at?: string
          description?: string | null
          display_name?: string
          id?: string
          is_enabled?: boolean
          metadata?: Json | null
          sort_order?: number
          updated_at?: string
          widget_slug?: string
        }
        Relationships: []
      }
      deal_activities: {
        Row: {
          activity_type: string
          content: string
          created_at: string | null
          deal_id: string
          id: string
          metadata: Json | null
          user_id: string | null
        }
        Insert: {
          activity_type: string
          content: string
          created_at?: string | null
          deal_id: string
          id?: string
          metadata?: Json | null
          user_id?: string | null
        }
        Update: {
          activity_type?: string
          content?: string
          created_at?: string | null
          deal_id?: string
          id?: string
          metadata?: Json | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deal_activities_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_activities_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_comments: {
        Row: {
          content: string
          created_at: string | null
          deal_id: string
          id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          deal_id: string
          id?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          deal_id?: string
          id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_comments_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_comments_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      deals: {
        Row: {
          client_id: string | null
          closed_at: string | null
          contact_id: string | null
          created_at: string | null
          created_by: string | null
          currency: string | null
          data_source: string | null
          description: string | null
          expected_close_date: string | null
          external_id: string | null
          external_url: string | null
          id: string
          last_synced_at: string | null
          lost_reason: string | null
          metadata: Json | null
          owner_id: string | null
          probability: number | null
          slug: string
          source: string | null
          stage: string
          tags: string[] | null
          title: string
          updated_at: string | null
          value: number | null
        }
        Insert: {
          client_id?: string | null
          closed_at?: string | null
          contact_id?: string | null
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          data_source?: string | null
          description?: string | null
          expected_close_date?: string | null
          external_id?: string | null
          external_url?: string | null
          id?: string
          last_synced_at?: string | null
          lost_reason?: string | null
          metadata?: Json | null
          owner_id?: string | null
          probability?: number | null
          slug: string
          source?: string | null
          stage?: string
          tags?: string[] | null
          title: string
          updated_at?: string | null
          value?: number | null
        }
        Update: {
          client_id?: string | null
          closed_at?: string | null
          contact_id?: string | null
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          data_source?: string | null
          description?: string | null
          expected_close_date?: string | null
          external_id?: string | null
          external_url?: string | null
          id?: string
          last_synced_at?: string | null
          lost_reason?: string | null
          metadata?: Json | null
          owner_id?: string | null
          probability?: number | null
          slug?: string
          source?: string | null
          stage?: string
          tags?: string[] | null
          title?: string
          updated_at?: string | null
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "deals_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_created_by_profiles_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_owner_id_profiles_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      department_users: {
        Row: {
          created_at: string
          department_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          department_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          department_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "department_users_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          color: string | null
          created_at: string | null
          description: string | null
          head_user_id: string | null
          id: string
          is_active: boolean | null
          manager_id: string | null
          name: string
          parent_department_id: string | null
          updated_at: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          head_user_id?: string | null
          id?: string
          is_active?: boolean | null
          manager_id?: string | null
          name: string
          parent_department_id?: string | null
          updated_at?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          head_user_id?: string | null
          id?: string
          is_active?: boolean | null
          manager_id?: string | null
          name?: string
          parent_department_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "departments_parent_department_id_fkey"
            columns: ["parent_department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      disposable_email_domains: {
        Row: {
          domain: string
          id: string
        }
        Insert: {
          domain: string
          id?: string
        }
        Update: {
          domain?: string
          id?: string
        }
        Relationships: []
      }
      document_images: {
        Row: {
          caption: string | null
          created_at: string
          description: string | null
          document_id: string
          id: string
          image_index: number
          metadata: Json | null
          ocr_confidence: number | null
          ocr_text: string | null
          page_number: number | null
        }
        Insert: {
          caption?: string | null
          created_at?: string
          description?: string | null
          document_id: string
          id?: string
          image_index?: number
          metadata?: Json | null
          ocr_confidence?: number | null
          ocr_text?: string | null
          page_number?: number | null
        }
        Update: {
          caption?: string | null
          created_at?: string
          description?: string | null
          document_id?: string
          id?: string
          image_index?: number
          metadata?: Json | null
          ocr_confidence?: number | null
          ocr_text?: string | null
          page_number?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "document_images_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "parsed_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      document_pages: {
        Row: {
          content: string
          created_at: string
          document_id: string
          id: string
          metadata: Json | null
          page_number: number
        }
        Insert: {
          content: string
          created_at?: string
          document_id: string
          id?: string
          metadata?: Json | null
          page_number: number
        }
        Update: {
          content?: string
          created_at?: string
          document_id?: string
          id?: string
          metadata?: Json | null
          page_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "document_pages_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "parsed_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      document_tables: {
        Row: {
          created_at: string
          document_id: string
          headers: string[] | null
          id: string
          markdown_repr: string | null
          metadata: Json | null
          page_number: number | null
          rows: Json | null
          table_index: number
        }
        Insert: {
          created_at?: string
          document_id: string
          headers?: string[] | null
          id?: string
          markdown_repr?: string | null
          metadata?: Json | null
          page_number?: number | null
          rows?: Json | null
          table_index?: number
        }
        Update: {
          created_at?: string
          document_id?: string
          headers?: string[] | null
          id?: string
          markdown_repr?: string | null
          metadata?: Json | null
          page_number?: number | null
          rows?: Json | null
          table_index?: number
        }
        Relationships: [
          {
            foreignKeyName: "document_tables_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "parsed_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      email_logs: {
        Row: {
          bcc: string | null
          body_html: string | null
          body_text: string | null
          cc: string | null
          clicked_at: string | null
          client_id: string | null
          contact_id: string | null
          created_at: string | null
          delivered_at: string | null
          error_message: string | null
          id: string
          metadata: Json | null
          opened_at: string | null
          priority: string | null
          provider: string | null
          provider_message_id: string | null
          recipient: string
          recipient_name: string | null
          scheduled_for: string | null
          sent_at: string | null
          status: string | null
          subject: string
          template_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          bcc?: string | null
          body_html?: string | null
          body_text?: string | null
          cc?: string | null
          clicked_at?: string | null
          client_id?: string | null
          contact_id?: string | null
          created_at?: string | null
          delivered_at?: string | null
          error_message?: string | null
          id?: string
          metadata?: Json | null
          opened_at?: string | null
          priority?: string | null
          provider?: string | null
          provider_message_id?: string | null
          recipient: string
          recipient_name?: string | null
          scheduled_for?: string | null
          sent_at?: string | null
          status?: string | null
          subject: string
          template_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          bcc?: string | null
          body_html?: string | null
          body_text?: string | null
          cc?: string | null
          clicked_at?: string | null
          client_id?: string | null
          contact_id?: string | null
          created_at?: string | null
          delivered_at?: string | null
          error_message?: string | null
          id?: string
          metadata?: Json | null
          opened_at?: string | null
          priority?: string | null
          provider?: string | null
          provider_message_id?: string | null
          recipient?: string
          recipient_name?: string | null
          scheduled_for?: string | null
          sent_at?: string | null
          status?: string | null
          subject?: string
          template_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_logs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_logs_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_logs_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "contact_email_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      email_tracking_events: {
        Row: {
          activity_id: string | null
          clicked_url: string | null
          contact_id: string | null
          created_at: string | null
          event_type: string
          id: string
          ip_address: string | null
          metadata: Json | null
          sendgrid_event_id: string | null
          sendgrid_message_id: string | null
          user_agent: string | null
        }
        Insert: {
          activity_id?: string | null
          clicked_url?: string | null
          contact_id?: string | null
          created_at?: string | null
          event_type: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          sendgrid_event_id?: string | null
          sendgrid_message_id?: string | null
          user_agent?: string | null
        }
        Update: {
          activity_id?: string | null
          clicked_url?: string | null
          contact_id?: string | null
          created_at?: string | null
          event_type?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          sendgrid_event_id?: string | null
          sendgrid_message_id?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_tracking_events_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "contact_activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_tracking_events_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      embedding_queue: {
        Row: {
          attempts: number | null
          completed_at: string | null
          created_at: string | null
          entity_id: string
          entity_type: string
          error_message: string | null
          id: string
          max_attempts: number | null
          priority: number | null
          scheduled_at: string | null
          started_at: string | null
          status: string | null
        }
        Insert: {
          attempts?: number | null
          completed_at?: string | null
          created_at?: string | null
          entity_id: string
          entity_type: string
          error_message?: string | null
          id?: string
          max_attempts?: number | null
          priority?: number | null
          scheduled_at?: string | null
          started_at?: string | null
          status?: string | null
        }
        Update: {
          attempts?: number | null
          completed_at?: string | null
          created_at?: string | null
          entity_id?: string
          entity_type?: string
          error_message?: string | null
          id?: string
          max_attempts?: number | null
          priority?: number | null
          scheduled_at?: string | null
          started_at?: string | null
          status?: string | null
        }
        Relationships: []
      }
      embeddings: {
        Row: {
          chunk_index: number | null
          content: string
          created_at: string
          embedding: string | null
          entity_id: string
          entity_type: string
          gemini_corpus_id: string | null
          gemini_document_id: string | null
          id: string
          metadata: Json | null
          provider_corpus_id: string | null
          provider_document_id: string | null
          unified_document_id: string | null
          user_id: string | null
        }
        Insert: {
          chunk_index?: number | null
          content: string
          created_at?: string
          embedding?: string | null
          entity_id: string
          entity_type: string
          gemini_corpus_id?: string | null
          gemini_document_id?: string | null
          id?: string
          metadata?: Json | null
          provider_corpus_id?: string | null
          provider_document_id?: string | null
          unified_document_id?: string | null
          user_id?: string | null
        }
        Update: {
          chunk_index?: number | null
          content?: string
          created_at?: string
          embedding?: string | null
          entity_id?: string
          entity_type?: string
          gemini_corpus_id?: string | null
          gemini_document_id?: string | null
          id?: string
          metadata?: Json | null
          provider_corpus_id?: string | null
          provider_document_id?: string | null
          unified_document_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "embeddings_unified_document_id_fkey"
            columns: ["unified_document_id"]
            isOneToOne: false
            referencedRelation: "unified_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_pods: {
        Row: {
          created_at: string
          employee_id: string
          id: string
          is_primary: boolean | null
          pod_id: string
          synced_from_hr: boolean | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          employee_id: string
          id?: string
          is_primary?: boolean | null
          pod_id: string
          synced_from_hr?: boolean | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          employee_id?: string
          id?: string
          is_primary?: boolean | null
          pod_id?: string
          synced_from_hr?: boolean | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_pods_pod_id_fkey"
            columns: ["pod_id"]
            isOneToOne: false
            referencedRelation: "pods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_pods_pod_id_fkey"
            columns: ["pod_id"]
            isOneToOne: false
            referencedRelation: "pods_with_stats"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_profiles: {
        Row: {
          created_at: string | null
          department_id: string | null
          email: string
          employment_type: string | null
          full_name: string
          hire_date: string | null
          id: string
          is_active: boolean | null
          location: string | null
          manager_email: string | null
          metadata: Json | null
          title: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          department_id?: string | null
          email: string
          employment_type?: string | null
          full_name: string
          hire_date?: string | null
          id?: string
          is_active?: boolean | null
          location?: string | null
          manager_email?: string | null
          metadata?: Json | null
          title?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          department_id?: string | null
          email?: string
          employment_type?: string | null
          full_name?: string
          hire_date?: string | null
          id?: string
          is_active?: boolean | null
          location?: string | null
          manager_email?: string | null
          metadata?: Json | null
          title?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_profiles_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      eos_issue_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          issue_id: string
          tenant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          issue_id: string
          tenant_id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          issue_id?: string
          tenant_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "eos_issue_comments_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "eos_issues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eos_issue_comments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eos_issue_comments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      eos_issue_suggestions: {
        Row: {
          ai_model: string | null
          confidence: number | null
          content: string
          created_at: string | null
          id: string
          issue_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string | null
          suggestion_type: string
          tenant_id: string
        }
        Insert: {
          ai_model?: string | null
          confidence?: number | null
          content: string
          created_at?: string | null
          id?: string
          issue_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
          suggestion_type: string
          tenant_id?: string
        }
        Update: {
          ai_model?: string | null
          confidence?: number | null
          content?: string
          created_at?: string | null
          id?: string
          issue_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
          suggestion_type?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "eos_issue_suggestions_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "eos_issues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eos_issue_suggestions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eos_issue_suggestions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      eos_issues: {
        Row: {
          archived_at: string | null
          assigned_to: string | null
          category: string | null
          created_at: string | null
          description: string | null
          id: string
          is_anonymous: boolean | null
          meeting_id: string | null
          pod_id: string | null
          priority: string
          reported_by: string | null
          resolution_history: Json | null
          root_cause: Json | null
          solved_at: string | null
          source: string | null
          status: string
          tenant_id: string
          title: string
          updated_at: string | null
        }
        Insert: {
          archived_at?: string | null
          assigned_to?: string | null
          category?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_anonymous?: boolean | null
          meeting_id?: string | null
          pod_id?: string | null
          priority?: string
          reported_by?: string | null
          resolution_history?: Json | null
          root_cause?: Json | null
          solved_at?: string | null
          source?: string | null
          status?: string
          tenant_id?: string
          title: string
          updated_at?: string | null
        }
        Update: {
          archived_at?: string | null
          assigned_to?: string | null
          category?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_anonymous?: boolean | null
          meeting_id?: string | null
          pod_id?: string | null
          priority?: string
          reported_by?: string | null
          resolution_history?: Json | null
          root_cause?: Json | null
          solved_at?: string | null
          source?: string | null
          status?: string
          tenant_id?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "eos_issues_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eos_issues_pod_id_fkey"
            columns: ["pod_id"]
            isOneToOne: false
            referencedRelation: "eos_pods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eos_issues_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eos_issues_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      eos_l10_meeting_sections: {
        Row: {
          completed_at: string | null
          created_at: string
          duration_minutes: number | null
          id: string
          meeting_id: string
          notes: string | null
          section_key: string
          started_at: string | null
          tenant_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          duration_minutes?: number | null
          id?: string
          meeting_id: string
          notes?: string | null
          section_key: string
          started_at?: string | null
          tenant_id?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          duration_minutes?: number | null
          id?: string
          meeting_id?: string
          notes?: string | null
          section_key?: string
          started_at?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "eos_l10_meeting_sections_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eos_l10_meeting_sections_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eos_l10_meeting_sections_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      eos_notification_preferences: {
        Row: {
          created_at: string
          email: boolean
          event_type: string
          id: string
          in_app: boolean
          tenant_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: boolean
          event_type: string
          id?: string
          in_app?: boolean
          tenant_id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: boolean
          event_type?: string
          id?: string
          in_app?: boolean
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "eos_notification_preferences_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eos_notification_preferences_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      eos_people_reviews: {
        Row: {
          core_values_scores: Json
          created_at: string
          gwc_gets_it: boolean | null
          gwc_has_capacity: boolean | null
          gwc_wants_it: boolean | null
          id: string
          notes: string | null
          overall_score: string
          review_period: string
          reviewer_id: string
          tenant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          core_values_scores?: Json
          created_at?: string
          gwc_gets_it?: boolean | null
          gwc_has_capacity?: boolean | null
          gwc_wants_it?: boolean | null
          id?: string
          notes?: string | null
          overall_score?: string
          review_period: string
          reviewer_id: string
          tenant_id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          core_values_scores?: Json
          created_at?: string
          gwc_gets_it?: boolean | null
          gwc_has_capacity?: boolean | null
          gwc_wants_it?: boolean | null
          id?: string
          notes?: string | null
          overall_score?: string
          review_period?: string
          reviewer_id?: string
          tenant_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "eos_people_reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eos_people_reviews_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eos_people_reviews_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eos_people_reviews_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      eos_pods: {
        Row: {
          color: string | null
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          lead_id: string | null
          name: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          lead_id?: string | null
          name: string
          tenant_id?: string
          updated_at?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          lead_id?: string | null
          name?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "eos_pods_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eos_pods_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      eos_rock_attachments: {
        Row: {
          created_at: string
          file_name: string
          file_url: string
          id: string
          rock_id: string
          tenant_id: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          file_name: string
          file_url: string
          id?: string
          rock_id: string
          tenant_id?: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          file_name?: string
          file_url?: string
          id?: string
          rock_id?: string
          tenant_id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "eos_rock_attachments_rock_id_fkey"
            columns: ["rock_id"]
            isOneToOne: false
            referencedRelation: "okrs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eos_rock_attachments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eos_rock_attachments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      eos_rock_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          rock_id: string
          tenant_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          rock_id: string
          tenant_id?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          rock_id?: string
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "eos_rock_comments_rock_id_fkey"
            columns: ["rock_id"]
            isOneToOne: false
            referencedRelation: "okrs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eos_rock_comments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eos_rock_comments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      eos_rock_dependencies: {
        Row: {
          created_at: string
          depends_on_rock_id: string
          id: string
          rock_id: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          depends_on_rock_id: string
          id?: string
          rock_id: string
          tenant_id?: string
        }
        Update: {
          created_at?: string
          depends_on_rock_id?: string
          id?: string
          rock_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "eos_rock_dependencies_depends_on_rock_id_fkey"
            columns: ["depends_on_rock_id"]
            isOneToOne: false
            referencedRelation: "okrs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eos_rock_dependencies_rock_id_fkey"
            columns: ["rock_id"]
            isOneToOne: false
            referencedRelation: "okrs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eos_rock_dependencies_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eos_rock_dependencies_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      eos_scorecard_metrics: {
        Row: {
          created_at: string | null
          current_value: number | null
          description: string | null
          goal_direction: string | null
          id: string
          metric_type: string | null
          name: string
          scorecard_id: string
          sort_order: number | null
          status: string | null
          target_value: number | null
          tenant_id: string
          unit: string | null
          updated_at: string | null
          week_of: string | null
        }
        Insert: {
          created_at?: string | null
          current_value?: number | null
          description?: string | null
          goal_direction?: string | null
          id?: string
          metric_type?: string | null
          name: string
          scorecard_id: string
          sort_order?: number | null
          status?: string | null
          target_value?: number | null
          tenant_id?: string
          unit?: string | null
          updated_at?: string | null
          week_of?: string | null
        }
        Update: {
          created_at?: string | null
          current_value?: number | null
          description?: string | null
          goal_direction?: string | null
          id?: string
          metric_type?: string | null
          name?: string
          scorecard_id?: string
          sort_order?: number | null
          status?: string | null
          target_value?: number | null
          tenant_id?: string
          unit?: string | null
          updated_at?: string | null
          week_of?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "eos_scorecard_metrics_scorecard_id_fkey"
            columns: ["scorecard_id"]
            isOneToOne: false
            referencedRelation: "eos_scorecards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eos_scorecard_metrics_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eos_scorecard_metrics_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      eos_scorecards: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          frequency: string | null
          id: string
          is_active: boolean | null
          name: string
          owner_id: string | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          frequency?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          owner_id?: string | null
          tenant_id?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          frequency?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          owner_id?: string | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "eos_scorecards_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eos_scorecards_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      eos_sla_targets: {
        Row: {
          approval_rate_pct: number
          created_at: string | null
          cycle_time_days: number
          id: string
          pod_id: string | null
          role_name: string | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          approval_rate_pct?: number
          created_at?: string | null
          cycle_time_days?: number
          id?: string
          pod_id?: string | null
          role_name?: string | null
          tenant_id?: string
          updated_at?: string | null
        }
        Update: {
          approval_rate_pct?: number
          created_at?: string | null
          cycle_time_days?: number
          id?: string
          pod_id?: string | null
          role_name?: string | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "eos_sla_targets_pod_id_fkey"
            columns: ["pod_id"]
            isOneToOne: false
            referencedRelation: "eos_pods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eos_sla_targets_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eos_sla_targets_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      eos_vto: {
        Row: {
          content: Json | null
          created_at: string | null
          id: string
          section: string
          sort_order: number | null
          tenant_id: string
          title: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          content?: Json | null
          created_at?: string | null
          id?: string
          section: string
          sort_order?: number | null
          tenant_id?: string
          title: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          content?: Json | null
          created_at?: string | null
          id?: string
          section?: string
          sort_order?: number | null
          tenant_id?: string
          title?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "eos_vto_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eos_vto_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      eos_vto_versions: {
        Row: {
          content: Json
          created_at: string
          id: string
          section: string
          tenant_id: string
          updated_by: string | null
          version: number
          vto_id: string
        }
        Insert: {
          content?: Json
          created_at?: string
          id?: string
          section: string
          tenant_id?: string
          updated_by?: string | null
          version?: number
          vto_id: string
        }
        Update: {
          content?: Json
          created_at?: string
          id?: string
          section?: string
          tenant_id?: string
          updated_by?: string | null
          version?: number
          vto_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "eos_vto_versions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eos_vto_versions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eos_vto_versions_vto_id_fkey"
            columns: ["vto_id"]
            isOneToOne: false
            referencedRelation: "eos_vto"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback: {
        Row: {
          admin_notes: string | null
          created_at: string
          id: string
          message: string
          metadata: Json | null
          module: string | null
          rating: number | null
          status: string | null
          subject: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          id?: string
          message: string
          metadata?: Json | null
          module?: string | null
          rating?: number | null
          status?: string | null
          subject: string
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          id?: string
          message?: string
          metadata?: Json | null
          module?: string | null
          rating?: number | null
          status?: string | null
          subject?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      files: {
        Row: {
          created_at: string
          deleted_at: string | null
          folder_id: string | null
          id: string
          is_public: boolean
          is_shared: boolean
          is_starred: boolean
          metadata: Json
          mime_type: string
          name: string
          openai: Json | null
          original_name: string
          path: string
          s3_key: string | null
          shared_with: Json
          size: number
          storage_path: string | null
          storage_type: string
          type: string
          updated_at: string
          url: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          folder_id?: string | null
          id?: string
          is_public?: boolean
          is_shared?: boolean
          is_starred?: boolean
          metadata?: Json
          mime_type: string
          name: string
          openai?: Json | null
          original_name: string
          path: string
          s3_key?: string | null
          shared_with?: Json
          size?: number
          storage_path?: string | null
          storage_type?: string
          type: string
          updated_at?: string
          url: string
          user_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          folder_id?: string | null
          id?: string
          is_public?: boolean
          is_shared?: boolean
          is_starred?: boolean
          metadata?: Json
          mime_type?: string
          name?: string
          openai?: Json | null
          original_name?: string
          path?: string
          s3_key?: string | null
          shared_with?: Json
          size?: number
          storage_path?: string | null
          storage_type?: string
          type?: string
          updated_at?: string
          url?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "files_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "folders"
            referencedColumns: ["id"]
          },
        ]
      }
      float_synced_allocations: {
        Row: {
          created_at: string
          ends_at: string | null
          float_allocation_id: string
          float_people_id: string | null
          float_project_id: string | null
          hours: number | null
          id: string
          raw: Json
          source_type: string | null
          starts_at: string | null
          synced_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          ends_at?: string | null
          float_allocation_id: string
          float_people_id?: string | null
          float_project_id?: string | null
          hours?: number | null
          id?: string
          raw?: Json
          source_type?: string | null
          starts_at?: string | null
          synced_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          ends_at?: string | null
          float_allocation_id?: string
          float_people_id?: string | null
          float_project_id?: string | null
          hours?: number | null
          id?: string
          raw?: Json
          source_type?: string | null
          starts_at?: string | null
          synced_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      float_synced_people: {
        Row: {
          created_at: string
          email: string | null
          float_people_id: string
          id: string
          name: string | null
          raw: Json
          role: string | null
          synced_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          float_people_id: string
          id?: string
          name?: string | null
          raw?: Json
          role?: string | null
          synced_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          float_people_id?: string
          id?: string
          name?: string | null
          raw?: Json
          role?: string | null
          synced_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      float_synced_projects: {
        Row: {
          client_name: string | null
          created_at: string
          float_project_id: string
          id: string
          name: string | null
          projects_linked: boolean
          raw: Json
          synced_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          client_name?: string | null
          created_at?: string
          float_project_id: string
          id?: string
          name?: string | null
          projects_linked?: boolean
          raw?: Json
          synced_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          client_name?: string | null
          created_at?: string
          float_project_id?: string
          id?: string
          name?: string | null
          projects_linked?: boolean
          raw?: Json
          synced_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      folders: {
        Row: {
          color: string
          created_at: string
          deleted_at: string | null
          file_count: number
          id: string
          is_public: boolean
          is_shared: boolean
          name: string
          shared_with: Json
          size: number
          updated_at: string
          user_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          deleted_at?: string | null
          file_count?: number
          id?: string
          is_public?: boolean
          is_shared?: boolean
          name: string
          shared_with?: Json
          size?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string
          deleted_at?: string | null
          file_count?: number
          id?: string
          is_public?: boolean
          is_shared?: boolean
          name?: string
          shared_with?: Json
          size?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      gemini_corpora: {
        Row: {
          created_at: string | null
          display_name: string | null
          document_count: number | null
          external_corpus_id: string | null
          id: string
          is_active: boolean | null
          metadata: Json | null
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          display_name?: string | null
          document_count?: number | null
          external_corpus_id?: string | null
          id?: string
          is_active?: boolean | null
          metadata?: Json | null
          name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          display_name?: string | null
          document_count?: number | null
          external_corpus_id?: string | null
          id?: string
          is_active?: boolean | null
          metadata?: Json | null
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      gemini_query_logs: {
        Row: {
          corpus_id: string | null
          created_at: string | null
          duration_ms: number | null
          id: string
          metadata: Json | null
          query_text: string
          result_count: number | null
          user_id: string | null
        }
        Insert: {
          corpus_id?: string | null
          created_at?: string | null
          duration_ms?: number | null
          id?: string
          metadata?: Json | null
          query_text: string
          result_count?: number | null
          user_id?: string | null
        }
        Update: {
          corpus_id?: string | null
          created_at?: string | null
          duration_ms?: number | null
          id?: string
          metadata?: Json | null
          query_text?: string
          result_count?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gemini_query_logs_corpus_id_fkey"
            columns: ["corpus_id"]
            isOneToOne: false
            referencedRelation: "gemini_corpora"
            referencedColumns: ["id"]
          },
        ]
      }
      gemini_sync_logs: {
        Row: {
          completed_at: string | null
          corpus_id: string
          created_at: string | null
          documents_added: number | null
          documents_removed: number | null
          error_message: string | null
          id: string
          metadata: Json | null
          started_at: string | null
          status: string | null
          sync_type: string
          triggered_by: string | null
        }
        Insert: {
          completed_at?: string | null
          corpus_id: string
          created_at?: string | null
          documents_added?: number | null
          documents_removed?: number | null
          error_message?: string | null
          id?: string
          metadata?: Json | null
          started_at?: string | null
          status?: string | null
          sync_type: string
          triggered_by?: string | null
        }
        Update: {
          completed_at?: string | null
          corpus_id?: string
          created_at?: string | null
          documents_added?: number | null
          documents_removed?: number | null
          error_message?: string | null
          id?: string
          metadata?: Json | null
          started_at?: string | null
          status?: string | null
          sync_type?: string
          triggered_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gemini_sync_logs_corpus_id_fkey"
            columns: ["corpus_id"]
            isOneToOne: false
            referencedRelation: "gemini_corpora"
            referencedColumns: ["id"]
          },
        ]
      }
      graph_webhook_logs: {
        Row: {
          client_state_valid: boolean
          error_message: string | null
          event_type: string
          id: string
          metadata: Json | null
          processed_at: string | null
          processing_status: string
          received_at: string
          resource_data: Json | null
          subscription_id: string
        }
        Insert: {
          client_state_valid?: boolean
          error_message?: string | null
          event_type: string
          id?: string
          metadata?: Json | null
          processed_at?: string | null
          processing_status?: string
          received_at?: string
          resource_data?: Json | null
          subscription_id: string
        }
        Update: {
          client_state_valid?: boolean
          error_message?: string | null
          event_type?: string
          id?: string
          metadata?: Json | null
          processed_at?: string | null
          processing_status?: string
          received_at?: string
          resource_data?: Json | null
          subscription_id?: string
        }
        Relationships: []
      }
      graph_webhook_subscriptions: {
        Row: {
          change_types: string[]
          client_state: string
          created_at: string
          error_count: number
          expiration_datetime: string
          id: string
          is_active: boolean
          last_notification_at: string | null
          metadata: Json | null
          notification_url: string
          resource: string
          subscription_id: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          change_types?: string[]
          client_state: string
          created_at?: string
          error_count?: number
          expiration_datetime: string
          id?: string
          is_active?: boolean
          last_notification_at?: string | null
          metadata?: Json | null
          notification_url: string
          resource: string
          subscription_id: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          change_types?: string[]
          client_state?: string
          created_at?: string
          error_count?: number
          expiration_datetime?: string
          id?: string
          is_active?: boolean
          last_notification_at?: string | null
          metadata?: Json | null
          notification_url?: string
          resource?: string
          subscription_id?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      gwc_assessments: {
        Row: {
          assessment_date: string | null
          assessor_id: string
          created_at: string | null
          gets_it: boolean | null
          has_capacity: boolean | null
          id: string
          notes: string | null
          responsibility_id: string
          tenant_id: string
          wants_it: boolean | null
        }
        Insert: {
          assessment_date?: string | null
          assessor_id: string
          created_at?: string | null
          gets_it?: boolean | null
          has_capacity?: boolean | null
          id?: string
          notes?: string | null
          responsibility_id: string
          tenant_id?: string
          wants_it?: boolean | null
        }
        Update: {
          assessment_date?: string | null
          assessor_id?: string
          created_at?: string | null
          gets_it?: boolean | null
          has_capacity?: boolean | null
          id?: string
          notes?: string | null
          responsibility_id?: string
          tenant_id?: string
          wants_it?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "gwc_assessments_responsibility_id_fkey"
            columns: ["responsibility_id"]
            isOneToOne: false
            referencedRelation: "accountability_responsibilities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gwc_assessments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gwc_assessments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_categories: {
        Row: {
          created_at: string
          description: string | null
          display_order: number | null
          enabled: boolean | null
          icon: string | null
          id: string
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_order?: number | null
          enabled?: boolean | null
          icon?: string | null
          id?: string
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_order?: number | null
          enabled?: boolean | null
          icon?: string | null
          id?: string
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      integration_fields: {
        Row: {
          created_at: string
          default_value: string | null
          display_order: number | null
          field_key: string
          field_type: string
          help_text: string | null
          id: string
          is_required: boolean | null
          is_sensitive: boolean | null
          label: string
          placeholder: string | null
          provider_id: string
          select_options: Json | null
          validation_regex: string | null
        }
        Insert: {
          created_at?: string
          default_value?: string | null
          display_order?: number | null
          field_key: string
          field_type?: string
          help_text?: string | null
          id?: string
          is_required?: boolean | null
          is_sensitive?: boolean | null
          label: string
          placeholder?: string | null
          provider_id: string
          select_options?: Json | null
          validation_regex?: string | null
        }
        Update: {
          created_at?: string
          default_value?: string | null
          display_order?: number | null
          field_key?: string
          field_type?: string
          help_text?: string | null
          id?: string
          is_required?: boolean | null
          is_sensitive?: boolean | null
          label?: string
          placeholder?: string | null
          provider_id?: string
          select_options?: Json | null
          validation_regex?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "integration_fields_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "integration_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_providers: {
        Row: {
          auth_type: string
          category_id: string
          created_at: string
          description: string | null
          display_order: number | null
          docs_url: string | null
          id: string
          is_available: boolean | null
          is_beta: boolean | null
          is_coming_soon: boolean | null
          logo_url: string | null
          name: string
          oauth_config: Json | null
          slug: string
          updated_at: string
        }
        Insert: {
          auth_type?: string
          category_id: string
          created_at?: string
          description?: string | null
          display_order?: number | null
          docs_url?: string | null
          id?: string
          is_available?: boolean | null
          is_beta?: boolean | null
          is_coming_soon?: boolean | null
          logo_url?: string | null
          name: string
          oauth_config?: Json | null
          slug: string
          updated_at?: string
        }
        Update: {
          auth_type?: string
          category_id?: string
          created_at?: string
          description?: string | null
          display_order?: number | null
          docs_url?: string | null
          id?: string
          is_available?: boolean | null
          is_beta?: boolean | null
          is_coming_soon?: boolean | null
          logo_url?: string | null
          name?: string
          oauth_config?: Json | null
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "integration_providers_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "integration_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_services: {
        Row: {
          cost_model: Json | null
          created_at: string
          description: string | null
          display_order: number | null
          enabled: boolean | null
          features: Json | null
          has_cost: boolean | null
          id: string
          is_beta: boolean | null
          is_default: boolean | null
          name: string
          provider_id: string
          requires_config: boolean | null
          service_key: string
          updated_at: string
        }
        Insert: {
          cost_model?: Json | null
          created_at?: string
          description?: string | null
          display_order?: number | null
          enabled?: boolean | null
          features?: Json | null
          has_cost?: boolean | null
          id?: string
          is_beta?: boolean | null
          is_default?: boolean | null
          name: string
          provider_id: string
          requires_config?: boolean | null
          service_key: string
          updated_at?: string
        }
        Update: {
          cost_model?: Json | null
          created_at?: string
          description?: string | null
          display_order?: number | null
          enabled?: boolean | null
          features?: Json | null
          has_cost?: boolean | null
          id?: string
          is_beta?: boolean | null
          is_default?: boolean | null
          name?: string
          provider_id?: string
          requires_config?: boolean | null
          service_key?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "integration_services_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "integration_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_settings: {
        Row: {
          ai_model_policy: Json
          created_at: string
          id: string
          organization_id: string | null
          primary_by_category: Json
          primary_integrations: Json
          primary_knowledge_sources: Json
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          ai_model_policy?: Json
          created_at?: string
          id?: string
          organization_id?: string | null
          primary_by_category?: Json
          primary_integrations?: Json
          primary_knowledge_sources?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          ai_model_policy?: Json
          created_at?: string
          id?: string
          organization_id?: string | null
          primary_by_category?: Json
          primary_integrations?: Json
          primary_knowledge_sources?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      integration_usage_logs: {
        Row: {
          action: string
          created_at: string
          error_message: string | null
          estimated_cost: number | null
          id: string
          provider_id: string | null
          request_metadata: Json | null
          response_metadata: Json | null
          service_id: string | null
          status: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          error_message?: string | null
          estimated_cost?: number | null
          id?: string
          provider_id?: string | null
          request_metadata?: Json | null
          response_metadata?: Json | null
          service_id?: string | null
          status?: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          error_message?: string | null
          estimated_cost?: number | null
          id?: string
          provider_id?: string | null
          request_metadata?: Json | null
          response_metadata?: Json | null
          service_id?: string | null
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "integration_usage_logs_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "integration_providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integration_usage_logs_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "integration_services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integration_usage_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      kb_eval_results: {
        Row: {
          chunk_id: string | null
          chunk_preview: string | null
          created_at: string
          id: string
          metadata: Json | null
          rerank_score: number | null
          run_id: string
          similarity_score: number | null
          source_name: string | null
        }
        Insert: {
          chunk_id?: string | null
          chunk_preview?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          rerank_score?: number | null
          run_id: string
          similarity_score?: number | null
          source_name?: string | null
        }
        Update: {
          chunk_id?: string | null
          chunk_preview?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          rerank_score?: number | null
          run_id?: string
          similarity_score?: number | null
          source_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kb_eval_results_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "kb_eval_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      kb_eval_runs: {
        Row: {
          answer: string | null
          cost: number | null
          created_at: string
          created_by: string | null
          generation_latency_ms: number | null
          id: string
          latency_ms: number | null
          metadata: Json | null
          query: string
          rerank_latency_ms: number | null
          retrieval_latency_ms: number | null
          source_id: string | null
        }
        Insert: {
          answer?: string | null
          cost?: number | null
          created_at?: string
          created_by?: string | null
          generation_latency_ms?: number | null
          id?: string
          latency_ms?: number | null
          metadata?: Json | null
          query: string
          rerank_latency_ms?: number | null
          retrieval_latency_ms?: number | null
          source_id?: string | null
        }
        Update: {
          answer?: string | null
          cost?: number | null
          created_at?: string
          created_by?: string | null
          generation_latency_ms?: number | null
          id?: string
          latency_ms?: number | null
          metadata?: Json | null
          query?: string
          rerank_latency_ms?: number | null
          retrieval_latency_ms?: number | null
          source_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kb_eval_runs_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "knowledge_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      kb_eval_test_cases: {
        Row: {
          created_at: string
          created_by: string | null
          expected_answer: string | null
          id: string
          question: string
          run_id: string | null
          tags: string[] | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expected_answer?: string | null
          id?: string
          question: string
          run_id?: string | null
          tags?: string[] | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expected_answer?: string | null
          id?: string
          question?: string
          run_id?: string | null
          tags?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "kb_eval_test_cases_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "kb_eval_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      kb_memory_decay_snapshots: {
        Row: {
          id: string
          importance_score: number
          memory_id: string
          recorded_at: string
          snapshot_index: number
          user_id: string
        }
        Insert: {
          id?: string
          importance_score: number
          memory_id: string
          recorded_at?: string
          snapshot_index: number
          user_id: string
        }
        Update: {
          id?: string
          importance_score?: number
          memory_id?: string
          recorded_at?: string
          snapshot_index?: number
          user_id?: string
        }
        Relationships: []
      }
      kb_reembed_job_items: {
        Row: {
          created_at: string
          entity_id: string
          entity_type: string
          error: string | null
          id: string
          job_id: string
          processed_at: string | null
          status: string
        }
        Insert: {
          created_at?: string
          entity_id: string
          entity_type: string
          error?: string | null
          id?: string
          job_id: string
          processed_at?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          entity_id?: string
          entity_type?: string
          error?: string | null
          id?: string
          job_id?: string
          processed_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "kb_reembed_job_items_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "kb_reembed_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      kb_reembed_jobs: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by: string | null
          error: string | null
          failed_documents: number | null
          id: string
          processed_documents: number | null
          source_id: string
          started_at: string | null
          status: string
          total_documents: number | null
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          error?: string | null
          failed_documents?: number | null
          id?: string
          processed_documents?: number | null
          source_id: string
          started_at?: string | null
          status?: string
          total_documents?: number | null
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          error?: string | null
          failed_documents?: number | null
          id?: string
          processed_documents?: number | null
          source_id?: string
          started_at?: string | null
          status?: string
          total_documents?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kb_reembed_jobs_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "knowledge_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      kb_slack_channels: {
        Row: {
          channel_id: string
          channel_name: string
          created_at: string
          id: string
          is_enabled: boolean
          is_public: boolean
          last_synced_at: string | null
          member_count: number | null
          metadata: Json
          sync_status: string
          updated_at: string
        }
        Insert: {
          channel_id: string
          channel_name: string
          created_at?: string
          id?: string
          is_enabled?: boolean
          is_public?: boolean
          last_synced_at?: string | null
          member_count?: number | null
          metadata?: Json
          sync_status?: string
          updated_at?: string
        }
        Update: {
          channel_id?: string
          channel_name?: string
          created_at?: string
          id?: string
          is_enabled?: boolean
          is_public?: boolean
          last_synced_at?: string | null
          member_count?: number | null
          metadata?: Json
          sync_status?: string
          updated_at?: string
        }
        Relationships: []
      }
      kb_slack_sync_ledger: {
        Row: {
          channel_id: string
          completed_at: string | null
          error_message: string | null
          id: string
          messages_synced: number | null
          metadata: Json
          started_at: string
          status: string
          triggered_by: string | null
        }
        Insert: {
          channel_id: string
          completed_at?: string | null
          error_message?: string | null
          id?: string
          messages_synced?: number | null
          metadata?: Json
          started_at?: string
          status?: string
          triggered_by?: string | null
        }
        Update: {
          channel_id?: string
          completed_at?: string | null
          error_message?: string | null
          id?: string
          messages_synced?: number | null
          metadata?: Json
          started_at?: string
          status?: string
          triggered_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kb_slack_sync_ledger_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "kb_slack_channels"
            referencedColumns: ["channel_id"]
          },
        ]
      }
      kb_source_config: {
        Row: {
          chunk_overlap: number
          chunk_size: number
          chunk_strategy: string
          created_at: string
          id: string
          reranker_enabled: boolean | null
          reranker_max_results: number | null
          reranker_override_global: boolean | null
          reranker_provider: string | null
          reranker_threshold: number | null
          source_id: string
          strategy_config: Json
          updated_at: string
        }
        Insert: {
          chunk_overlap?: number
          chunk_size?: number
          chunk_strategy?: string
          created_at?: string
          id?: string
          reranker_enabled?: boolean | null
          reranker_max_results?: number | null
          reranker_override_global?: boolean | null
          reranker_provider?: string | null
          reranker_threshold?: number | null
          source_id: string
          strategy_config?: Json
          updated_at?: string
        }
        Update: {
          chunk_overlap?: number
          chunk_size?: number
          chunk_strategy?: string
          created_at?: string
          id?: string
          reranker_enabled?: boolean | null
          reranker_max_results?: number | null
          reranker_override_global?: boolean | null
          reranker_provider?: string | null
          reranker_threshold?: number | null
          source_id?: string
          strategy_config?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kb_source_config_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: true
            referencedRelation: "knowledge_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      kb_source_permissions: {
        Row: {
          app_role: Database["public"]["Enums"]["app_role"] | null
          created_at: string
          department_id: string | null
          id: string
          permissions: Json
          pod_id: string | null
          role_id: string | null
          source_id: string
          updated_at: string
        }
        Insert: {
          app_role?: Database["public"]["Enums"]["app_role"] | null
          created_at?: string
          department_id?: string | null
          id?: string
          permissions?: Json
          pod_id?: string | null
          role_id?: string | null
          source_id: string
          updated_at?: string
        }
        Update: {
          app_role?: Database["public"]["Enums"]["app_role"] | null
          created_at?: string
          department_id?: string | null
          id?: string
          permissions?: Json
          pod_id?: string | null
          role_id?: string | null
          source_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kb_source_permissions_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kb_source_permissions_pod_id_fkey"
            columns: ["pod_id"]
            isOneToOne: false
            referencedRelation: "pods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kb_source_permissions_pod_id_fkey"
            columns: ["pod_id"]
            isOneToOne: false
            referencedRelation: "pods_with_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kb_source_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kb_source_permissions_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "knowledge_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      kb_user_search_history: {
        Row: {
          created_at: string
          id: string
          metadata: Json
          platform: string
          query: string
          result_count: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          metadata?: Json
          platform?: string
          query: string
          result_count?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          metadata?: Json
          platform?: string
          query?: string
          result_count?: number | null
          user_id?: string
        }
        Relationships: []
      }
      key_result_history: {
        Row: {
          id: string
          key_result_id: string
          new_value: number
          notes: string | null
          previous_value: number | null
          tenant_id: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          id?: string
          key_result_id: string
          new_value: number
          notes?: string | null
          previous_value?: number | null
          tenant_id?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          id?: string
          key_result_id?: string
          new_value?: number
          notes?: string | null
          previous_value?: number | null
          tenant_id?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "key_result_history_key_result_id_fkey"
            columns: ["key_result_id"]
            isOneToOne: false
            referencedRelation: "okr_key_results"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "key_result_history_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "key_result_history_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_categories: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          icon: string | null
          id: string
          metadata: Json | null
          name: string
          owner_id: string | null
          parent_id: string | null
          slug: string
          sort_order: number | null
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          metadata?: Json | null
          name: string
          owner_id?: string | null
          parent_id?: string | null
          slug: string
          sort_order?: number | null
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          metadata?: Json | null
          name?: string
          owner_id?: string | null
          parent_id?: string | null
          slug?: string
          sort_order?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "knowledge_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_embeddings: {
        Row: {
          chunk_index: number | null
          content: string
          created_at: string | null
          entry_id: string | null
          file_id: string | null
          id: string
          metadata: Json | null
          token_count: number | null
        }
        Insert: {
          chunk_index?: number | null
          content: string
          created_at?: string | null
          entry_id?: string | null
          file_id?: string | null
          id?: string
          metadata?: Json | null
          token_count?: number | null
        }
        Update: {
          chunk_index?: number | null
          content?: string
          created_at?: string | null
          entry_id?: string | null
          file_id?: string | null
          id?: string
          metadata?: Json | null
          token_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_embeddings_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "knowledge_files"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_entries: {
        Row: {
          author_id: string
          category_id: string | null
          content: string
          created_at: string
          id: string
          metadata: Json | null
          search_vector: unknown
          slug: string
          status: string | null
          summary: string | null
          tags: string[] | null
          title: string
          updated_at: string
          view_count: number | null
        }
        Insert: {
          author_id: string
          category_id?: string | null
          content: string
          created_at?: string
          id?: string
          metadata?: Json | null
          search_vector?: unknown
          slug: string
          status?: string | null
          summary?: string | null
          tags?: string[] | null
          title: string
          updated_at?: string
          view_count?: number | null
        }
        Update: {
          author_id?: string
          category_id?: string | null
          content?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          search_vector?: unknown
          slug?: string
          status?: string | null
          summary?: string | null
          tags?: string[] | null
          title?: string
          updated_at?: string
          view_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_entries_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "knowledge_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_files: {
        Row: {
          category_id: string | null
          chunk_count: number | null
          created_at: string | null
          embedding_model: string | null
          file_name: string
          file_size: number | null
          file_type: string | null
          id: string
          last_sync_attempt_at: string | null
          metadata: Json | null
          parse_version: string | null
          processed_at: string | null
          processing_error: string | null
          processing_status: string | null
          source_id: string | null
          storage_path: string | null
          title: string
          updated_at: string | null
          uploaded_by: string | null
        }
        Insert: {
          category_id?: string | null
          chunk_count?: number | null
          created_at?: string | null
          embedding_model?: string | null
          file_name: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          last_sync_attempt_at?: string | null
          metadata?: Json | null
          parse_version?: string | null
          processed_at?: string | null
          processing_error?: string | null
          processing_status?: string | null
          source_id?: string | null
          storage_path?: string | null
          title: string
          updated_at?: string | null
          uploaded_by?: string | null
        }
        Update: {
          category_id?: string | null
          chunk_count?: number | null
          created_at?: string | null
          embedding_model?: string | null
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          last_sync_attempt_at?: string | null
          metadata?: Json | null
          parse_version?: string | null
          processed_at?: string | null
          processing_error?: string | null
          processing_status?: string | null
          source_id?: string | null
          storage_path?: string | null
          title?: string
          updated_at?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_files_category_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "knowledge_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_files_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "knowledge_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_hidden_items: {
        Row: {
          created_at: string
          id: string
          resource_id: string
          resource_type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          resource_id: string
          resource_type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          resource_id?: string
          resource_type?: string
          user_id?: string
        }
        Relationships: []
      }
      knowledge_sources: {
        Row: {
          config: Json | null
          created_at: string | null
          created_by: string | null
          id: string
          is_active: boolean | null
          last_synced_at: string | null
          name: string
          source_type: string
          updated_at: string | null
        }
        Insert: {
          config?: Json | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          last_synced_at?: string | null
          name: string
          source_type: string
          updated_at?: string | null
        }
        Update: {
          config?: Json | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          last_synced_at?: string | null
          name?: string
          source_type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      lead_followup_contacts: {
        Row: {
          assigned_to: string | null
          contact_id: string
          converted_deal_id: string | null
          created_at: string | null
          follow_up_notes: string | null
          id: string
          next_follow_up: string | null
          priority: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          assigned_to?: string | null
          contact_id: string
          converted_deal_id?: string | null
          created_at?: string | null
          follow_up_notes?: string | null
          id?: string
          next_follow_up?: string | null
          priority?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          assigned_to?: string | null
          contact_id?: string
          converted_deal_id?: string | null
          created_at?: string | null
          follow_up_notes?: string | null
          id?: string
          next_follow_up?: string | null
          priority?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_followup_contacts_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: true
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_followup_contacts_converted_deal_id_fkey"
            columns: ["converted_deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_intent_analysis: {
        Row: {
          agent_run_id: string | null
          analyzed_at: string | null
          confidence: string | null
          contact_id: string
          created_at: string | null
          days_since_activity: number | null
          decay_signals: Json | null
          id: string
          intent_status: string
          lead_id: string | null
          momentum_score: number
          momentum_signals: Json | null
          reasoning: string | null
          suggested_action: string | null
        }
        Insert: {
          agent_run_id?: string | null
          analyzed_at?: string | null
          confidence?: string | null
          contact_id: string
          created_at?: string | null
          days_since_activity?: number | null
          decay_signals?: Json | null
          id?: string
          intent_status: string
          lead_id?: string | null
          momentum_score: number
          momentum_signals?: Json | null
          reasoning?: string | null
          suggested_action?: string | null
        }
        Update: {
          agent_run_id?: string | null
          analyzed_at?: string | null
          confidence?: string | null
          contact_id?: string
          created_at?: string | null
          days_since_activity?: number | null
          decay_signals?: Json | null
          id?: string
          intent_status?: string
          lead_id?: string | null
          momentum_score?: number
          momentum_signals?: Json | null
          reasoning?: string | null
          suggested_action?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_intent_analysis_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_intent_analysis_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_mood_analysis: {
        Row: {
          agent_run_id: string | null
          analyzed_at: string | null
          confidence: string | null
          contact_id: string
          created_at: string | null
          id: string
          key_signals: Json | null
          lead_id: string | null
          mood_label: string
          mood_score: number
          reasoning: string | null
          suggested_action: string | null
        }
        Insert: {
          agent_run_id?: string | null
          analyzed_at?: string | null
          confidence?: string | null
          contact_id: string
          created_at?: string | null
          id?: string
          key_signals?: Json | null
          lead_id?: string | null
          mood_label: string
          mood_score: number
          reasoning?: string | null
          suggested_action?: string | null
        }
        Update: {
          agent_run_id?: string | null
          analyzed_at?: string | null
          confidence?: string | null
          contact_id?: string
          created_at?: string | null
          id?: string
          key_signals?: Json | null
          lead_id?: string | null
          mood_label?: string
          mood_score?: number
          reasoning?: string | null
          suggested_action?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_mood_analysis_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_mood_analysis_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_events: {
        Row: {
          approved_by: string | null
          created_at: string | null
          employee_email: string
          end_date: string
          id: string
          is_half_day: boolean | null
          leave_type: string
          notes: string | null
          start_date: string
          status: string | null
        }
        Insert: {
          approved_by?: string | null
          created_at?: string | null
          employee_email: string
          end_date: string
          id?: string
          is_half_day?: boolean | null
          leave_type: string
          notes?: string | null
          start_date: string
          status?: string | null
        }
        Update: {
          approved_by?: string | null
          created_at?: string | null
          employee_email?: string
          end_date?: string
          id?: string
          is_half_day?: boolean | null
          leave_type?: string
          notes?: string | null
          start_date?: string
          status?: string | null
        }
        Relationships: []
      }
      login_attempts: {
        Row: {
          attempted_at: string
          email: string
          id: string
          ip_address: string | null
          was_successful: boolean
        }
        Insert: {
          attempted_at?: string
          email: string
          id?: string
          ip_address?: string | null
          was_successful?: boolean
        }
        Update: {
          attempted_at?: string
          email?: string
          id?: string
          ip_address?: string | null
          was_successful?: boolean
        }
        Relationships: []
      }
      mcp_servers: {
        Row: {
          auth_config: Json | null
          auth_type: string
          created_at: string | null
          created_by: string | null
          description: string | null
          documentation_url: string | null
          homepage_url: string | null
          icon_url: string | null
          id: string
          is_enabled: boolean | null
          is_global: boolean | null
          is_verified: boolean | null
          last_used_at: string | null
          last_verified_at: string | null
          name: string
          organization_id: string | null
          server_url: string
          slug: string
          supports_prompts: boolean | null
          supports_resources: boolean | null
          supports_sampling: boolean | null
          supports_tools: boolean | null
          total_tool_calls: number | null
          transport_type: string
          updated_at: string | null
          verification_error: string | null
          verification_status: string | null
          version: string | null
        }
        Insert: {
          auth_config?: Json | null
          auth_type?: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          documentation_url?: string | null
          homepage_url?: string | null
          icon_url?: string | null
          id?: string
          is_enabled?: boolean | null
          is_global?: boolean | null
          is_verified?: boolean | null
          last_used_at?: string | null
          last_verified_at?: string | null
          name: string
          organization_id?: string | null
          server_url: string
          slug: string
          supports_prompts?: boolean | null
          supports_resources?: boolean | null
          supports_sampling?: boolean | null
          supports_tools?: boolean | null
          total_tool_calls?: number | null
          transport_type?: string
          updated_at?: string | null
          verification_error?: string | null
          verification_status?: string | null
          version?: string | null
        }
        Update: {
          auth_config?: Json | null
          auth_type?: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          documentation_url?: string | null
          homepage_url?: string | null
          icon_url?: string | null
          id?: string
          is_enabled?: boolean | null
          is_global?: boolean | null
          is_verified?: boolean | null
          last_used_at?: string | null
          last_verified_at?: string | null
          name?: string
          organization_id?: string | null
          server_url?: string
          slug?: string
          supports_prompts?: boolean | null
          supports_resources?: boolean | null
          supports_sampling?: boolean | null
          supports_tools?: boolean | null
          total_tool_calls?: number | null
          transport_type?: string
          updated_at?: string | null
          verification_error?: string | null
          verification_status?: string | null
          version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mcp_servers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      mcp_tool_executions: {
        Row: {
          agent_id: string | null
          completed_at: string | null
          created_at: string | null
          error_code: string | null
          error_message: string | null
          execution_context: Json | null
          execution_time_ms: number | null
          id: string
          input_parameters: Json
          output_result: Json | null
          server_id: string
          started_at: string | null
          status: string
          tool_id: string
          user_id: string
        }
        Insert: {
          agent_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          error_code?: string | null
          error_message?: string | null
          execution_context?: Json | null
          execution_time_ms?: number | null
          id?: string
          input_parameters: Json
          output_result?: Json | null
          server_id: string
          started_at?: string | null
          status: string
          tool_id: string
          user_id: string
        }
        Update: {
          agent_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          error_code?: string | null
          error_message?: string | null
          execution_context?: Json | null
          execution_time_ms?: number | null
          id?: string
          input_parameters?: Json
          output_result?: Json | null
          server_id?: string
          started_at?: string | null
          status?: string
          tool_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mcp_tool_executions_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mcp_tool_executions_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: false
            referencedRelation: "mcp_servers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mcp_tool_executions_tool_id_fkey"
            columns: ["tool_id"]
            isOneToOne: false
            referencedRelation: "mcp_tools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mcp_tool_executions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      mcp_tools: {
        Row: {
          avg_execution_time_ms: number | null
          description: string | null
          discovered_at: string | null
          failed_executions: number | null
          id: string
          input_schema: Json
          is_enabled: boolean | null
          last_executed_at: string | null
          name: string
          server_id: string
          successful_executions: number | null
          total_executions: number | null
          updated_at: string | null
        }
        Insert: {
          avg_execution_time_ms?: number | null
          description?: string | null
          discovered_at?: string | null
          failed_executions?: number | null
          id?: string
          input_schema: Json
          is_enabled?: boolean | null
          last_executed_at?: string | null
          name: string
          server_id: string
          successful_executions?: number | null
          total_executions?: number | null
          updated_at?: string | null
        }
        Update: {
          avg_execution_time_ms?: number | null
          description?: string | null
          discovered_at?: string | null
          failed_executions?: number | null
          id?: string
          input_schema?: Json
          is_enabled?: boolean | null
          last_executed_at?: string | null
          name?: string
          server_id?: string
          successful_executions?: number | null
          total_executions?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mcp_tools_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: false
            referencedRelation: "mcp_servers"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_action_items: {
        Row: {
          assignee_email: string | null
          assignee_id: string | null
          created_at: string
          due_date: string | null
          extracted_from_transcript: boolean | null
          extraction_confidence: number | null
          id: string
          meeting_id: string
          priority: string | null
          status: string | null
          task_id: string | null
          text: string
          updated_at: string
        }
        Insert: {
          assignee_email?: string | null
          assignee_id?: string | null
          created_at?: string
          due_date?: string | null
          extracted_from_transcript?: boolean | null
          extraction_confidence?: number | null
          id?: string
          meeting_id: string
          priority?: string | null
          status?: string | null
          task_id?: string | null
          text: string
          updated_at?: string
        }
        Update: {
          assignee_email?: string | null
          assignee_id?: string | null
          created_at?: string
          due_date?: string | null
          extracted_from_transcript?: boolean | null
          extraction_confidence?: number | null
          id?: string
          meeting_id?: string
          priority?: string | null
          status?: string | null
          task_id?: string | null
          text?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_action_items_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_action_items_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_agenda_items: {
        Row: {
          assigned_to: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          duration_minutes: number | null
          id: string
          is_completed: boolean | null
          meeting_id: string
          notes: string | null
          presenter_id: string | null
          sort_order: number | null
          title: string
          updated_at: string | null
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          duration_minutes?: number | null
          id?: string
          is_completed?: boolean | null
          meeting_id: string
          notes?: string | null
          presenter_id?: string | null
          sort_order?: number | null
          title: string
          updated_at?: string | null
        }
        Update: {
          assigned_to?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          duration_minutes?: number | null
          id?: string
          is_completed?: boolean | null
          meeting_id?: string
          notes?: string | null
          presenter_id?: string | null
          sort_order?: number | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meeting_agenda_items_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_assignment_suggestions: {
        Row: {
          confidence: number | null
          created_at: string
          id: string
          meeting_id: string
          reasoning: string | null
          review_status: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          suggested_id: string
          suggested_type: string
          updated_at: string
        }
        Insert: {
          confidence?: number | null
          created_at?: string
          id?: string
          meeting_id: string
          reasoning?: string | null
          review_status?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          suggested_id: string
          suggested_type: string
          updated_at?: string
        }
        Update: {
          confidence?: number | null
          created_at?: string
          id?: string
          meeting_id?: string
          reasoning?: string | null
          review_status?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          suggested_id?: string
          suggested_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_assignment_suggestions_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_assignments: {
        Row: {
          assigned_by: string | null
          created_at: string | null
          entity_id: string
          entity_type: string
          id: string
          meeting_id: string
        }
        Insert: {
          assigned_by?: string | null
          created_at?: string | null
          entity_id: string
          entity_type: string
          id?: string
          meeting_id: string
        }
        Update: {
          assigned_by?: string | null
          created_at?: string | null
          entity_id?: string
          entity_type?: string
          id?: string
          meeting_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_assignments_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_categorizations: {
        Row: {
          category: string
          confidence: number | null
          created_at: string | null
          created_by: string | null
          id: string
          meeting_id: string
          meeting_type: string | null
          related_clients: Json | null
          related_pods: Json | null
          related_projects: Json | null
          rule_id: string | null
          source: string | null
          tags: Json | null
        }
        Insert: {
          category: string
          confidence?: number | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          meeting_id: string
          meeting_type?: string | null
          related_clients?: Json | null
          related_pods?: Json | null
          related_projects?: Json | null
          rule_id?: string | null
          source?: string | null
          tags?: Json | null
        }
        Update: {
          category?: string
          confidence?: number | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          meeting_id?: string
          meeting_type?: string | null
          related_clients?: Json | null
          related_pods?: Json | null
          related_projects?: Json | null
          rule_id?: string | null
          source?: string | null
          tags?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "meeting_categorizations_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_external_participants: {
        Row: {
          created_at: string
          external_email: string
          external_name: string | null
          id: string
          meeting_id: string
          role: string
          status: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          external_email: string
          external_name?: string | null
          id?: string
          meeting_id: string
          role?: string
          status?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          external_email?: string
          external_name?: string | null
          id?: string
          meeting_id?: string
          role?: string
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_external_participants_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_files: {
        Row: {
          assignment_confidence: number | null
          assignment_reasoning: string | null
          assignment_status: string | null
          created_at: string
          download_url: string | null
          external_meeting_id: string | null
          file_name: string
          file_path: string | null
          file_size: number | null
          file_type: string
          has_embeddings: boolean | null
          id: string
          is_processed: boolean | null
          meeting_id: string | null
          metadata: Json | null
          processing_status: string | null
          provider: string
          reviewed_at: string | null
          reviewed_by: string | null
          storage_path: string | null
          suggested_client_id: string | null
          suggested_pod_id: string | null
          suggested_project_id: string | null
          transcript_content: Json | null
          transcript_text: string | null
          updated_at: string
        }
        Insert: {
          assignment_confidence?: number | null
          assignment_reasoning?: string | null
          assignment_status?: string | null
          created_at?: string
          download_url?: string | null
          external_meeting_id?: string | null
          file_name: string
          file_path?: string | null
          file_size?: number | null
          file_type: string
          has_embeddings?: boolean | null
          id?: string
          is_processed?: boolean | null
          meeting_id?: string | null
          metadata?: Json | null
          processing_status?: string | null
          provider?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          storage_path?: string | null
          suggested_client_id?: string | null
          suggested_pod_id?: string | null
          suggested_project_id?: string | null
          transcript_content?: Json | null
          transcript_text?: string | null
          updated_at?: string
        }
        Update: {
          assignment_confidence?: number | null
          assignment_reasoning?: string | null
          assignment_status?: string | null
          created_at?: string
          download_url?: string | null
          external_meeting_id?: string | null
          file_name?: string
          file_path?: string | null
          file_size?: number | null
          file_type?: string
          has_embeddings?: boolean | null
          id?: string
          is_processed?: boolean | null
          meeting_id?: string | null
          metadata?: Json | null
          processing_status?: string | null
          provider?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          storage_path?: string | null
          suggested_client_id?: string | null
          suggested_pod_id?: string | null
          suggested_project_id?: string | null
          transcript_content?: Json | null
          transcript_text?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_files_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_files_suggested_client_id_fkey"
            columns: ["suggested_client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_files_suggested_pod_id_fkey"
            columns: ["suggested_pod_id"]
            isOneToOne: false
            referencedRelation: "pods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_files_suggested_pod_id_fkey"
            columns: ["suggested_pod_id"]
            isOneToOne: false
            referencedRelation: "pods_with_stats"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_participants: {
        Row: {
          attended: boolean | null
          created_at: string | null
          email: string | null
          id: string
          joined_at: string | null
          left_at: string | null
          meeting_id: string
          name: string | null
          response_at: string | null
          role: string | null
          rsvp_status: string | null
          user_id: string | null
        }
        Insert: {
          attended?: boolean | null
          created_at?: string | null
          email?: string | null
          id?: string
          joined_at?: string | null
          left_at?: string | null
          meeting_id: string
          name?: string | null
          response_at?: string | null
          role?: string | null
          rsvp_status?: string | null
          user_id?: string | null
        }
        Update: {
          attended?: boolean | null
          created_at?: string | null
          email?: string | null
          id?: string
          joined_at?: string | null
          left_at?: string | null
          meeting_id?: string
          name?: string | null
          response_at?: string | null
          role?: string | null
          rsvp_status?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meeting_participants_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_series: {
        Row: {
          created_at: string | null
          default_agenda: Json | null
          description: string | null
          duration_minutes: number | null
          id: string
          is_active: boolean | null
          next_occurrence: string | null
          organizer_id: string
          recurrence_rule: string
          title: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          default_agenda?: Json | null
          description?: string | null
          duration_minutes?: number | null
          id?: string
          is_active?: boolean | null
          next_occurrence?: string | null
          organizer_id: string
          recurrence_rule: string
          title: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          default_agenda?: Json | null
          description?: string | null
          duration_minutes?: number | null
          id?: string
          is_active?: boolean | null
          next_occurrence?: string | null
          organizer_id?: string
          recurrence_rule?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      meeting_takeaways: {
        Row: {
          agenda_item_id: string | null
          assigned_to: string | null
          content: string
          created_at: string | null
          created_by: string | null
          due_date: string | null
          id: string
          is_completed: boolean | null
          meeting_id: string
          priority: string | null
          status: string | null
          takeaway_type: string
          task_id: string | null
          updated_at: string | null
        }
        Insert: {
          agenda_item_id?: string | null
          assigned_to?: string | null
          content: string
          created_at?: string | null
          created_by?: string | null
          due_date?: string | null
          id?: string
          is_completed?: boolean | null
          meeting_id: string
          priority?: string | null
          status?: string | null
          takeaway_type?: string
          task_id?: string | null
          updated_at?: string | null
        }
        Update: {
          agenda_item_id?: string | null
          assigned_to?: string | null
          content?: string
          created_at?: string | null
          created_by?: string | null
          due_date?: string | null
          id?: string
          is_completed?: boolean | null
          meeting_id?: string
          priority?: string | null
          status?: string | null
          takeaway_type?: string
          task_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meeting_takeaways_agenda_item_id_fkey"
            columns: ["agenda_item_id"]
            isOneToOne: false
            referencedRelation: "meeting_agenda_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_takeaways_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_transcripts: {
        Row: {
          content: string
          created_at: string | null
          id: string
          meeting_id: string
          speaker: string
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          meeting_id: string
          speaker: string
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          meeting_id?: string
          speaker?: string
        }
        Relationships: []
      }
      meetings: {
        Row: {
          action_items: Json | null
          action_items_extracted_at: string | null
          agenda_finalized: boolean | null
          ai_summary: string | null
          ai_summary_generated_at: string | null
          ai_summary_status: string
          categorization_data: Json | null
          client_id: string | null
          closed_at: string | null
          created_at: string
          deal_id: string | null
          description: string | null
          duration_minutes: number | null
          efficiency_score: number | null
          embedding_status: string | null
          external_id: string | null
          external_meeting_id: string | null
          external_uuid: string | null
          host_url: string | null
          id: string
          is_external: boolean | null
          is_recurring: boolean | null
          join_url: string | null
          l10_timer_state: Json | null
          location: string | null
          meeting_type: string | null
          metadata: Json | null
          notes: string | null
          notify_participants: boolean | null
          organizer_id: string
          parent_meeting_id: string | null
          pod_id: string | null
          provider: string | null
          recording_url: string | null
          recurrence_end_date: string | null
          recurrence_pattern: string | null
          scheduled_at: string | null
          series_id: string | null
          slug: string | null
          status: string | null
          summary: string | null
          timezone: string | null
          title: string
          transcript_content: string | null
          transcript_text: string | null
          updated_at: string
          zoom_id: string | null
          zoom_join_url: string | null
          zoom_meeting_id: string | null
          zoom_start_url: string | null
          zoom_uuid: string | null
        }
        Insert: {
          action_items?: Json | null
          action_items_extracted_at?: string | null
          agenda_finalized?: boolean | null
          ai_summary?: string | null
          ai_summary_generated_at?: string | null
          ai_summary_status?: string
          categorization_data?: Json | null
          client_id?: string | null
          closed_at?: string | null
          created_at?: string
          deal_id?: string | null
          description?: string | null
          duration_minutes?: number | null
          efficiency_score?: number | null
          embedding_status?: string | null
          external_id?: string | null
          external_meeting_id?: string | null
          external_uuid?: string | null
          host_url?: string | null
          id?: string
          is_external?: boolean | null
          is_recurring?: boolean | null
          join_url?: string | null
          l10_timer_state?: Json | null
          location?: string | null
          meeting_type?: string | null
          metadata?: Json | null
          notes?: string | null
          notify_participants?: boolean | null
          organizer_id: string
          parent_meeting_id?: string | null
          pod_id?: string | null
          provider?: string | null
          recording_url?: string | null
          recurrence_end_date?: string | null
          recurrence_pattern?: string | null
          scheduled_at?: string | null
          series_id?: string | null
          slug?: string | null
          status?: string | null
          summary?: string | null
          timezone?: string | null
          title: string
          transcript_content?: string | null
          transcript_text?: string | null
          updated_at?: string
          zoom_id?: string | null
          zoom_join_url?: string | null
          zoom_meeting_id?: string | null
          zoom_start_url?: string | null
          zoom_uuid?: string | null
        }
        Update: {
          action_items?: Json | null
          action_items_extracted_at?: string | null
          agenda_finalized?: boolean | null
          ai_summary?: string | null
          ai_summary_generated_at?: string | null
          ai_summary_status?: string
          categorization_data?: Json | null
          client_id?: string | null
          closed_at?: string | null
          created_at?: string
          deal_id?: string | null
          description?: string | null
          duration_minutes?: number | null
          efficiency_score?: number | null
          embedding_status?: string | null
          external_id?: string | null
          external_meeting_id?: string | null
          external_uuid?: string | null
          host_url?: string | null
          id?: string
          is_external?: boolean | null
          is_recurring?: boolean | null
          join_url?: string | null
          l10_timer_state?: Json | null
          location?: string | null
          meeting_type?: string | null
          metadata?: Json | null
          notes?: string | null
          notify_participants?: boolean | null
          organizer_id?: string
          parent_meeting_id?: string | null
          pod_id?: string | null
          provider?: string | null
          recording_url?: string | null
          recurrence_end_date?: string | null
          recurrence_pattern?: string | null
          scheduled_at?: string | null
          series_id?: string | null
          slug?: string | null
          status?: string | null
          summary?: string | null
          timezone?: string | null
          title?: string
          transcript_content?: string | null
          transcript_text?: string | null
          updated_at?: string
          zoom_id?: string | null
          zoom_join_url?: string | null
          zoom_meeting_id?: string | null
          zoom_start_url?: string | null
          zoom_uuid?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meetings_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_parent_meeting_id_fkey"
            columns: ["parent_meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_pod_id_fkey"
            columns: ["pod_id"]
            isOneToOne: false
            referencedRelation: "pods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_pod_id_fkey"
            columns: ["pod_id"]
            isOneToOne: false
            referencedRelation: "pods_with_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "meeting_series"
            referencedColumns: ["id"]
          },
        ]
      }
      mfa_enrollment_status: {
        Row: {
          created_at: string
          enrolled: boolean
          enrolled_at: string | null
          grace_period_ends_at: string | null
          last_reminded_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          enrolled?: boolean
          enrolled_at?: string | null
          grace_period_ends_at?: string | null
          last_reminded_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          enrolled?: boolean
          enrolled_at?: string | null
          grace_period_ends_at?: string | null
          last_reminded_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      mfa_policies: {
        Row: {
          allowed_factors: string[]
          created_at: string
          grace_period_days: number
          id: string
          required: boolean
          tenant_id: string
          trust_idp_mfa: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          allowed_factors?: string[]
          created_at?: string
          grace_period_days?: number
          id?: string
          required?: boolean
          tenant_id?: string
          trust_idp_mfa?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          allowed_factors?: string[]
          created_at?: string
          grace_period_days?: number
          id?: string
          required?: boolean
          tenant_id?: string
          trust_idp_mfa?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      notification_digest_queue: {
        Row: {
          created_at: string
          digest_mode: string
          event_key: string | null
          id: string
          message: string
          payload: Json
          processed_at: string | null
          scheduled_for: string
          tenant_id: string
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          digest_mode: string
          event_key?: string | null
          id?: string
          message: string
          payload?: Json
          processed_at?: string | null
          scheduled_for?: string
          tenant_id?: string
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          digest_mode?: string
          event_key?: string | null
          id?: string
          message?: string
          payload?: Json
          processed_at?: string | null
          scheduled_for?: string
          tenant_id?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_digest_queue_event_key_fkey"
            columns: ["event_key"]
            isOneToOne: false
            referencedRelation: "notification_events"
            referencedColumns: ["event_key"]
          },
          {
            foreignKeyName: "notification_digest_queue_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_digest_queue_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_event_subscriptions: {
        Row: {
          created_at: string
          department_id: string | null
          email: boolean
          event_key: string
          id: string
          in_app: boolean
          tenant_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          department_id?: string | null
          email?: boolean
          event_key: string
          id?: string
          in_app?: boolean
          tenant_id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          department_id?: string | null
          email?: boolean
          event_key?: string
          id?: string
          in_app?: boolean
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_event_subscriptions_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_event_subscriptions_event_key_fkey"
            columns: ["event_key"]
            isOneToOne: false
            referencedRelation: "notification_events"
            referencedColumns: ["event_key"]
          },
          {
            foreignKeyName: "notification_event_subscriptions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_event_subscriptions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_events: {
        Row: {
          category: string
          created_at: string
          default_channels: string[]
          default_priority: string
          default_severity: string
          description: string
          event_key: string
          is_subscribable: boolean
        }
        Insert: {
          category: string
          created_at?: string
          default_channels?: string[]
          default_priority?: string
          default_severity?: string
          description?: string
          event_key: string
          is_subscribable?: boolean
        }
        Update: {
          category?: string
          created_at?: string
          default_channels?: string[]
          default_priority?: string
          default_severity?: string
          description?: string
          event_key?: string
          is_subscribable?: boolean
        }
        Relationships: []
      }
      notification_logs: {
        Row: {
          channel: string
          created_at: string
          delivered_at: string | null
          error_message: string | null
          event_key: string | null
          id: string
          idempotency_key: string | null
          metadata: Json
          notification_id: string | null
          read_at: string | null
          retry_count: number
          sent_at: string | null
          status: string
          tenant_id: string
          user_id: string
        }
        Insert: {
          channel: string
          created_at?: string
          delivered_at?: string | null
          error_message?: string | null
          event_key?: string | null
          id?: string
          idempotency_key?: string | null
          metadata?: Json
          notification_id?: string | null
          read_at?: string | null
          retry_count?: number
          sent_at?: string | null
          status?: string
          tenant_id?: string
          user_id: string
        }
        Update: {
          channel?: string
          created_at?: string
          delivered_at?: string | null
          error_message?: string | null
          event_key?: string | null
          id?: string
          idempotency_key?: string | null
          metadata?: Json
          notification_id?: string | null
          read_at?: string | null
          retry_count?: number
          sent_at?: string | null
          status?: string
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_logs_event_key_fkey"
            columns: ["event_key"]
            isOneToOne: false
            referencedRelation: "notification_events"
            referencedColumns: ["event_key"]
          },
          {
            foreignKeyName: "notification_logs_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          created_at: string
          digest_mode: string
          email_enabled: boolean
          id: string
          in_app_enabled: boolean
          language: string
          mute_until: string | null
          tenant_id: string
          timezone: string
          updated_at: string
          user_id: string
          working_hours: Json
        }
        Insert: {
          created_at?: string
          digest_mode?: string
          email_enabled?: boolean
          id?: string
          in_app_enabled?: boolean
          language?: string
          mute_until?: string | null
          tenant_id?: string
          timezone?: string
          updated_at?: string
          user_id: string
          working_hours?: Json
        }
        Update: {
          created_at?: string
          digest_mode?: string
          email_enabled?: boolean
          id?: string
          in_app_enabled?: boolean
          language?: string
          mute_until?: string | null
          tenant_id?: string
          timezone?: string
          updated_at?: string
          user_id?: string
          working_hours?: Json
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_preferences_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_role_defaults: {
        Row: {
          created_at: string
          email: boolean
          event_key: string
          id: string
          in_app: boolean
          role_slug: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          email?: boolean
          event_key: string
          id?: string
          in_app?: boolean
          role_slug: string
          tenant_id?: string
        }
        Update: {
          created_at?: string
          email?: boolean
          event_key?: string
          id?: string
          in_app?: boolean
          role_slug?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_role_defaults_event_key_fkey"
            columns: ["event_key"]
            isOneToOne: false
            referencedRelation: "notification_events"
            referencedColumns: ["event_key"]
          },
          {
            foreignKeyName: "notification_role_defaults_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_role_defaults_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_rules: {
        Row: {
          channels: string[]
          conditions: Json
          created_at: string
          created_by: string | null
          description: string | null
          escalation: Json | null
          id: string
          is_active: boolean
          name: string
          priority_override: string | null
          sort_order: number
          target_departments: string[] | null
          target_roles: string[] | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          channels?: string[]
          conditions?: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          escalation?: Json | null
          id?: string
          is_active?: boolean
          name: string
          priority_override?: string | null
          sort_order?: number
          target_departments?: string[] | null
          target_roles?: string[] | null
          tenant_id?: string
          updated_at?: string
        }
        Update: {
          channels?: string[]
          conditions?: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          escalation?: Json | null
          id?: string
          is_active?: boolean
          name?: string
          priority_override?: string | null
          sort_order?: number
          target_departments?: string[] | null
          target_roles?: string[] | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_rules_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_rules_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_templates: {
        Row: {
          body: string
          channel: string
          created_at: string
          created_by: string | null
          event_key: string
          id: string
          is_active: boolean
          locale: string
          subject: string | null
          tenant_id: string
          updated_at: string
          version: number
        }
        Insert: {
          body: string
          channel: string
          created_at?: string
          created_by?: string | null
          event_key: string
          id?: string
          is_active?: boolean
          locale?: string
          subject?: string | null
          tenant_id?: string
          updated_at?: string
          version?: number
        }
        Update: {
          body?: string
          channel?: string
          created_at?: string
          created_by?: string | null
          event_key?: string
          id?: string
          is_active?: boolean
          locale?: string
          subject?: string | null
          tenant_id?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "notification_templates_event_key_fkey"
            columns: ["event_key"]
            isOneToOne: false
            referencedRelation: "notification_events"
            referencedColumns: ["event_key"]
          },
          {
            foreignKeyName: "notification_templates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_templates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          archived_at: string | null
          category: string | null
          created_at: string
          event_key: string | null
          expires_at: string | null
          id: string
          is_read: boolean | null
          link: string | null
          message: string
          metadata: Json | null
          priority: string | null
          read_at: string | null
          severity: string | null
          tenant_id: string | null
          title: string
          type: string | null
          user_id: string
        }
        Insert: {
          archived_at?: string | null
          category?: string | null
          created_at?: string
          event_key?: string | null
          expires_at?: string | null
          id?: string
          is_read?: boolean | null
          link?: string | null
          message: string
          metadata?: Json | null
          priority?: string | null
          read_at?: string | null
          severity?: string | null
          tenant_id?: string | null
          title: string
          type?: string | null
          user_id: string
        }
        Update: {
          archived_at?: string | null
          category?: string | null
          created_at?: string
          event_key?: string | null
          expires_at?: string | null
          id?: string
          is_read?: boolean | null
          link?: string | null
          message?: string
          metadata?: Json | null
          priority?: string | null
          read_at?: string | null
          severity?: string | null
          tenant_id?: string | null
          title?: string
          type?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_event_key_fkey"
            columns: ["event_key"]
            isOneToOne: false
            referencedRelation: "notification_events"
            referencedColumns: ["event_key"]
          },
          {
            foreignKeyName: "notifications_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      oauth_states: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          provider: string
          redirect_uri: string | null
          state: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          provider: string
          redirect_uri?: string | null
          state: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          provider?: string
          redirect_uri?: string | null
          state?: string
          user_id?: string
        }
        Relationships: []
      }
      okr_check_ins: {
        Row: {
          confidence: string | null
          created_at: string | null
          id: string
          key_result_id: string | null
          new_value: number
          notes: string | null
          okr_id: string
          previous_value: number | null
          tenant_id: string
          user_id: string
        }
        Insert: {
          confidence?: string | null
          created_at?: string | null
          id?: string
          key_result_id?: string | null
          new_value: number
          notes?: string | null
          okr_id: string
          previous_value?: number | null
          tenant_id?: string
          user_id: string
        }
        Update: {
          confidence?: string | null
          created_at?: string | null
          id?: string
          key_result_id?: string | null
          new_value?: number
          notes?: string | null
          okr_id?: string
          previous_value?: number | null
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "okr_check_ins_key_result_id_fkey"
            columns: ["key_result_id"]
            isOneToOne: false
            referencedRelation: "okr_key_results"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "okr_check_ins_okr_id_fkey"
            columns: ["okr_id"]
            isOneToOne: false
            referencedRelation: "okrs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "okr_check_ins_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "okr_check_ins_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      okr_key_results: {
        Row: {
          completed_at: string | null
          created_at: string | null
          current_value: number | null
          description: string | null
          id: string
          is_completed: boolean | null
          last_updated_at: string | null
          metric_type: string
          next_update_due: string | null
          okr_id: string
          owner_id: string | null
          sort_order: number | null
          start_value: number | null
          status: string
          target_value: number
          tenant_id: string
          title: string
          unit: string | null
          update_frequency: string | null
          updated_at: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          current_value?: number | null
          description?: string | null
          id?: string
          is_completed?: boolean | null
          last_updated_at?: string | null
          metric_type?: string
          next_update_due?: string | null
          okr_id: string
          owner_id?: string | null
          sort_order?: number | null
          start_value?: number | null
          status?: string
          target_value?: number
          tenant_id?: string
          title: string
          unit?: string | null
          update_frequency?: string | null
          updated_at?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          current_value?: number | null
          description?: string | null
          id?: string
          is_completed?: boolean | null
          last_updated_at?: string | null
          metric_type?: string
          next_update_due?: string | null
          okr_id?: string
          owner_id?: string | null
          sort_order?: number | null
          start_value?: number | null
          status?: string
          target_value?: number
          tenant_id?: string
          title?: string
          unit?: string | null
          update_frequency?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "okr_key_results_okr_id_fkey"
            columns: ["okr_id"]
            isOneToOne: false
            referencedRelation: "okrs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "okr_key_results_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "okr_key_results_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      okrs: {
        Row: {
          created_at: string | null
          created_by: string | null
          department_id: string | null
          description: string | null
          end_date: string | null
          id: string
          is_archived: boolean | null
          okr_type: string | null
          owner_id: string | null
          parent_okr_id: string | null
          pod_id: string | null
          progress: number | null
          progress_pct: number | null
          quarter: string
          rock_status: string | null
          start_date: string | null
          status: string
          tenant_id: string
          title: string
          updated_at: string | null
          updated_by: string | null
          year: number | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          department_id?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          is_archived?: boolean | null
          okr_type?: string | null
          owner_id?: string | null
          parent_okr_id?: string | null
          pod_id?: string | null
          progress?: number | null
          progress_pct?: number | null
          quarter: string
          rock_status?: string | null
          start_date?: string | null
          status?: string
          tenant_id?: string
          title: string
          updated_at?: string | null
          updated_by?: string | null
          year?: number | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          department_id?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          is_archived?: boolean | null
          okr_type?: string | null
          owner_id?: string | null
          parent_okr_id?: string | null
          pod_id?: string | null
          progress?: number | null
          progress_pct?: number | null
          quarter?: string
          rock_status?: string | null
          start_date?: string | null
          status?: string
          tenant_id?: string
          title?: string
          updated_at?: string | null
          updated_by?: string | null
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "okrs_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "okrs_parent_okr_id_fkey"
            columns: ["parent_okr_id"]
            isOneToOne: false
            referencedRelation: "okrs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "okrs_pod_id_fkey"
            columns: ["pod_id"]
            isOneToOne: false
            referencedRelation: "eos_pods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "okrs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "okrs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_progress: {
        Row: {
          completed_at: string | null
          created_at: string
          current_step: number
          id: string
          steps_completed: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          current_step?: number
          id?: string
          steps_completed?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          current_step?: number
          id?: string
          steps_completed?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      organization_integrations: {
        Row: {
          config: Json | null
          connection_message: string | null
          connection_status: string | null
          created_at: string
          enabled: boolean | null
          id: string
          last_sync_at: string | null
          last_tested_at: string | null
          oauth_tokens: Json | null
          provider_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          config?: Json | null
          connection_message?: string | null
          connection_status?: string | null
          created_at?: string
          enabled?: boolean | null
          id?: string
          last_sync_at?: string | null
          last_tested_at?: string | null
          oauth_tokens?: Json | null
          provider_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          config?: Json | null
          connection_message?: string | null
          connection_status?: string | null
          created_at?: string
          enabled?: boolean | null
          id?: string
          last_sync_at?: string | null
          last_tested_at?: string | null
          oauth_tokens?: Json | null
          provider_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_integrations_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "integration_providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_integrations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      parsed_documents: {
        Row: {
          created_at: string
          file_name: string | null
          id: string
          image_count: number | null
          mime_type: string | null
          page_count: number | null
          parse_errors: Json | null
          parse_status: string
          parse_version: string
          processed_at: string | null
          source_id: string
          source_type: string
          table_count: number | null
          updated_at: string
          word_count: number | null
        }
        Insert: {
          created_at?: string
          file_name?: string | null
          id?: string
          image_count?: number | null
          mime_type?: string | null
          page_count?: number | null
          parse_errors?: Json | null
          parse_status?: string
          parse_version?: string
          processed_at?: string | null
          source_id: string
          source_type: string
          table_count?: number | null
          updated_at?: string
          word_count?: number | null
        }
        Update: {
          created_at?: string
          file_name?: string | null
          id?: string
          image_count?: number | null
          mime_type?: string | null
          page_count?: number | null
          parse_errors?: Json | null
          parse_status?: string
          parse_version?: string
          processed_at?: string | null
          source_id?: string
          source_type?: string
          table_count?: number | null
          updated_at?: string
          word_count?: number | null
        }
        Relationships: []
      }
      password_history: {
        Row: {
          created_at: string
          id: string
          password_hash: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          password_hash: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          password_hash?: string
          user_id?: string
        }
        Relationships: []
      }
      permissions: {
        Row: {
          action: string
          category: string
          created_at: string
          description: string | null
          id: string
          is_assignable: boolean
          key: string
          name: string
          resource: string
        }
        Insert: {
          action: string
          category: string
          created_at?: string
          description?: string | null
          id?: string
          is_assignable?: boolean
          key: string
          name: string
          resource: string
        }
        Update: {
          action?: string
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          is_assignable?: boolean
          key?: string
          name?: string
          resource?: string
        }
        Relationships: []
      }
      pod_employees: {
        Row: {
          created_at: string | null
          employee_id: string | null
          has_login: boolean | null
          id: string
          is_active: boolean | null
          pod_id: string
          role: string | null
          source: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          employee_id?: string | null
          has_login?: boolean | null
          id?: string
          is_active?: boolean | null
          pod_id: string
          role?: string | null
          source?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          employee_id?: string | null
          has_login?: boolean | null
          id?: string
          is_active?: boolean | null
          pod_id?: string
          role?: string | null
          source?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pod_employees_pod_id_fkey"
            columns: ["pod_id"]
            isOneToOne: false
            referencedRelation: "pods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pod_employees_pod_id_fkey"
            columns: ["pod_id"]
            isOneToOne: false
            referencedRelation: "pods_with_stats"
            referencedColumns: ["id"]
          },
        ]
      }
      pod_members: {
        Row: {
          id: string
          joined_at: string | null
          pod_id: string
          role: string | null
          user_id: string
        }
        Insert: {
          id?: string
          joined_at?: string | null
          pod_id: string
          role?: string | null
          user_id: string
        }
        Update: {
          id?: string
          joined_at?: string | null
          pod_id?: string
          role?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pod_members_pod_id_fkey"
            columns: ["pod_id"]
            isOneToOne: false
            referencedRelation: "pods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pod_members_pod_id_fkey"
            columns: ["pod_id"]
            isOneToOne: false
            referencedRelation: "pods_with_stats"
            referencedColumns: ["id"]
          },
        ]
      }
      pod_permissions: {
        Row: {
          created_at: string | null
          id: string
          module_id: string
          pod_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          module_id: string
          pod_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          module_id?: string
          pod_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pod_permissions_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "app_modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pod_permissions_pod_id_fkey"
            columns: ["pod_id"]
            isOneToOne: false
            referencedRelation: "pods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pod_permissions_pod_id_fkey"
            columns: ["pod_id"]
            isOneToOne: false
            referencedRelation: "pods_with_stats"
            referencedColumns: ["id"]
          },
        ]
      }
      pods: {
        Row: {
          color: string | null
          created_at: string | null
          created_by: string | null
          department_id: string | null
          description: string | null
          id: string
          is_active: boolean | null
          lead_id: string | null
          name: string
          show_in_resource_projection: boolean | null
          updated_at: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          created_by?: string | null
          department_id?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          lead_id?: string | null
          name: string
          show_in_resource_projection?: boolean | null
          updated_at?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          created_by?: string | null
          department_id?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          lead_id?: string | null
          name?: string
          show_in_resource_projection?: boolean | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pods_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      process_categories: {
        Row: {
          created_at: string | null
          description: string | null
          icon: string | null
          id: string
          is_active: boolean | null
          name: string
          slug: string
          sort_order: number | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          slug: string
          sort_order?: number | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          slug?: string
          sort_order?: number | null
        }
        Relationships: []
      }
      process_documents: {
        Row: {
          category_id: string
          content: string | null
          created_at: string | null
          created_by: string | null
          file_url: string | null
          id: string
          published_at: string | null
          slug: string
          status: string | null
          tags: string[] | null
          title: string
          updated_at: string | null
          updated_by: string | null
          version: number | null
        }
        Insert: {
          category_id: string
          content?: string | null
          created_at?: string | null
          created_by?: string | null
          file_url?: string | null
          id?: string
          published_at?: string | null
          slug: string
          status?: string | null
          tags?: string[] | null
          title: string
          updated_at?: string | null
          updated_by?: string | null
          version?: number | null
        }
        Update: {
          category_id?: string
          content?: string | null
          created_at?: string | null
          created_by?: string | null
          file_url?: string | null
          id?: string
          published_at?: string | null
          slug?: string
          status?: string | null
          tags?: string[] | null
          title?: string
          updated_at?: string | null
          updated_by?: string | null
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "process_documents_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "process_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      processing_queue_history: {
        Row: {
          batch_type: string
          completed_at: string | null
          created_at: string | null
          failed_count: number | null
          id: string
          metadata: Json | null
          processed_count: number | null
          started_at: string | null
          status: string | null
          total_items: number | null
          triggered_by: string | null
        }
        Insert: {
          batch_type: string
          completed_at?: string | null
          created_at?: string | null
          failed_count?: number | null
          id?: string
          metadata?: Json | null
          processed_count?: number | null
          started_at?: string | null
          status?: string | null
          total_items?: number | null
          triggered_by?: string | null
        }
        Update: {
          batch_type?: string
          completed_at?: string | null
          created_at?: string | null
          failed_count?: number | null
          id?: string
          metadata?: Json | null
          processed_count?: number | null
          started_at?: string | null
          status?: string | null
          total_items?: number | null
          triggered_by?: string | null
        }
        Relationships: []
      }
      productivity_alerts: {
        Row: {
          alert_type: string
          created_at: string | null
          description: string | null
          dismissed_at: string | null
          employee_email: string
          id: string
          is_read: boolean | null
          severity: string | null
          title: string
          week_start: string | null
        }
        Insert: {
          alert_type: string
          created_at?: string | null
          description?: string | null
          dismissed_at?: string | null
          employee_email: string
          id?: string
          is_read?: boolean | null
          severity?: string | null
          title: string
          week_start?: string | null
        }
        Update: {
          alert_type?: string
          created_at?: string | null
          description?: string | null
          dismissed_at?: string | null
          employee_email?: string
          id?: string
          is_read?: boolean | null
          severity?: string | null
          title?: string
          week_start?: string | null
        }
        Relationships: []
      }
      productivity_records: {
        Row: {
          attendance_status: string | null
          billable_hours: number | null
          created_at: string | null
          department: string | null
          efficiency_score: number | null
          employee_email: string
          id: string
          location: string | null
          meetings_attended: number | null
          metadata: Json | null
          tasks_assigned: number | null
          tasks_completed: number | null
          total_hours: number | null
          updated_at: string | null
          utilization_pct: number | null
          week_number: number
          week_start: string
          year: number
        }
        Insert: {
          attendance_status?: string | null
          billable_hours?: number | null
          created_at?: string | null
          department?: string | null
          efficiency_score?: number | null
          employee_email: string
          id?: string
          location?: string | null
          meetings_attended?: number | null
          metadata?: Json | null
          tasks_assigned?: number | null
          tasks_completed?: number | null
          total_hours?: number | null
          updated_at?: string | null
          utilization_pct?: number | null
          week_number: number
          week_start: string
          year: number
        }
        Update: {
          attendance_status?: string | null
          billable_hours?: number | null
          created_at?: string | null
          department?: string | null
          efficiency_score?: number | null
          employee_email?: string
          id?: string
          location?: string | null
          meetings_attended?: number | null
          metadata?: Json | null
          tasks_assigned?: number | null
          tasks_completed?: number | null
          total_hours?: number | null
          updated_at?: string | null
          utilization_pct?: number | null
          week_number?: number
          week_start?: string
          year?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          deactivated_at: string | null
          deactivated_by: string | null
          email: string | null
          failed_login_count: number
          full_name: string | null
          id: string
          is_active: boolean | null
          locked_until: string | null
          metadata: Json | null
          password_expires_at: string | null
          requires_password_change: boolean
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          deactivated_at?: string | null
          deactivated_by?: string | null
          email?: string | null
          failed_login_count?: number
          full_name?: string | null
          id: string
          is_active?: boolean | null
          locked_until?: string | null
          metadata?: Json | null
          password_expires_at?: string | null
          requires_password_change?: boolean
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          deactivated_at?: string | null
          deactivated_by?: string | null
          email?: string | null
          failed_login_count?: number
          full_name?: string | null
          id?: string
          is_active?: boolean | null
          locked_until?: string | null
          metadata?: Json | null
          password_expires_at?: string | null
          requires_password_change?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_deactivated_by_fkey"
            columns: ["deactivated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      project_at_risk_flags: {
        Row: {
          created_at: string
          description: string | null
          flag_type: string
          id: string
          project_id: string
          resolved_at: string | null
          triggered_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          flag_type: string
          id?: string
          project_id: string
          resolved_at?: string | null
          triggered_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          flag_type?: string
          id?: string
          project_id?: string
          resolved_at?: string | null
          triggered_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_at_risk_flags_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_risk_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_at_risk_flags_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_backups: {
        Row: {
          backup_type: string | null
          created_at: string | null
          created_by: string | null
          id: string
          notes: string | null
          project_id: string
          snapshot: Json | null
          status: string | null
        }
        Insert: {
          backup_type?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          notes?: string | null
          project_id: string
          snapshot?: Json | null
          status?: string | null
        }
        Update: {
          backup_type?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          notes?: string | null
          project_id?: string
          snapshot?: Json | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_backups_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_risk_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_backups_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_billing: {
        Row: {
          billing_type: string | null
          created_at: string | null
          currency: string | null
          id: string
          invoiced_amount: number | null
          payment_terms: string | null
          project_id: string
          rate: number | null
          total_budget: number | null
          updated_at: string | null
        }
        Insert: {
          billing_type?: string | null
          created_at?: string | null
          currency?: string | null
          id?: string
          invoiced_amount?: number | null
          payment_terms?: string | null
          project_id: string
          rate?: number | null
          total_budget?: number | null
          updated_at?: string | null
        }
        Update: {
          billing_type?: string | null
          created_at?: string | null
          currency?: string | null
          id?: string
          invoiced_amount?: number | null
          payment_terms?: string | null
          project_id?: string
          rate?: number | null
          total_budget?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_billing_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "project_risk_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_billing_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_client_access: {
        Row: {
          access_token: string
          client_email: string
          client_name: string | null
          created_at: string | null
          created_by: string | null
          id: string
          is_active: boolean | null
          last_login_at: string | null
          login_count: number | null
          password_hash: string
          project_id: string
          project_slug: string | null
          revoked_at: string | null
          revoked_by: string | null
          updated_at: string | null
        }
        Insert: {
          access_token?: string
          client_email: string
          client_name?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          last_login_at?: string | null
          login_count?: number | null
          password_hash: string
          project_id: string
          project_slug?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          updated_at?: string | null
        }
        Update: {
          access_token?: string
          client_email?: string
          client_name?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          last_login_at?: string | null
          login_count?: number | null
          password_hash?: string
          project_id?: string
          project_slug?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_client_access_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_risk_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_client_access_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_client_comments: {
        Row: {
          comment_text: string
          created_at: string | null
          created_by: string | null
          id: string
          is_visible: boolean | null
          milestone_id: string | null
          project_id: string
          sprint_name: string | null
          updated_at: string | null
        }
        Insert: {
          comment_text: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_visible?: boolean | null
          milestone_id?: string | null
          project_id: string
          sprint_name?: string | null
          updated_at?: string | null
        }
        Update: {
          comment_text?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_visible?: boolean | null
          milestone_id?: string | null
          project_id?: string
          sprint_name?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_client_comments_milestone_id_fkey"
            columns: ["milestone_id"]
            isOneToOne: false
            referencedRelation: "project_milestones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_client_comments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_risk_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_client_comments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_comments: {
        Row: {
          content: string
          created_at: string | null
          id: string
          parent_id: string | null
          project_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          parent_id?: string | null
          project_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          parent_id?: string | null
          project_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "project_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_comments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_risk_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_comments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_favorites: {
        Row: {
          created_at: string | null
          id: string
          project_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          project_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          project_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_favorites_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_risk_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_favorites_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_files: {
        Row: {
          created_at: string | null
          file_name: string
          file_size: number | null
          file_type: string | null
          id: string
          project_id: string
          source: string | null
          storage_path: string | null
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string | null
          file_name: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          project_id: string
          source?: string | null
          storage_path?: string | null
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string | null
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          project_id?: string
          source?: string | null
          storage_path?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_files_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_risk_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_files_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_invoices: {
        Row: {
          amount: number
          created_at: string | null
          created_by: string | null
          due_date: string | null
          id: string
          invoice_number: string
          notes: string | null
          paid_at: string | null
          project_id: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          created_by?: string | null
          due_date?: string | null
          id?: string
          invoice_number: string
          notes?: string | null
          paid_at?: string | null
          project_id: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          created_by?: string | null
          due_date?: string | null
          id?: string
          invoice_number?: string
          notes?: string | null
          paid_at?: string | null
          project_id?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_invoices_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_risk_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_invoices_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_members: {
        Row: {
          id: string
          joined_at: string | null
          project_id: string
          role: string | null
          user_id: string
        }
        Insert: {
          id?: string
          joined_at?: string | null
          project_id: string
          role?: string | null
          user_id: string
        }
        Update: {
          id?: string
          joined_at?: string | null
          project_id?: string
          role?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_risk_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_milestones: {
        Row: {
          completed_at: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          due_date: string | null
          id: string
          pm_notes: string | null
          project_id: string
          sort_order: number | null
          status: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          pm_notes?: string | null
          project_id: string
          sort_order?: number | null
          status?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          pm_notes?: string | null
          project_id?: string
          sort_order?: number | null
          status?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_milestones_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_risk_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_milestones_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_risks: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_client_visible: boolean | null
          mitigation: string | null
          project_id: string
          reported_by: string | null
          severity: string | null
          status: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_client_visible?: boolean | null
          mitigation?: string | null
          project_id: string
          reported_by?: string | null
          severity?: string | null
          status?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_client_visible?: boolean | null
          mitigation?: string | null
          project_id?: string
          reported_by?: string | null
          severity?: string | null
          status?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_risks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_risk_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_risks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_statuses: {
        Row: {
          color: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          is_default: boolean | null
          name: string
          slug: string
          sort_order: number | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          name: string
          slug: string
          sort_order?: number | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          name?: string
          slug?: string
          sort_order?: number | null
        }
        Relationships: []
      }
      projects: {
        Row: {
          budget: number | null
          client_id: string | null
          created_at: string | null
          created_by: string | null
          currency: string | null
          description: string | null
          end_date: string | null
          expected_completion_date: string | null
          external_id: string | null
          external_provider: string | null
          id: string
          is_archived: boolean | null
          is_at_risk: boolean
          metadata: Json | null
          name: string
          owner_id: string | null
          owner_notified_at: string | null
          risk_flags: string[]
          slug: string
          source_deal_id: string | null
          start_date: string | null
          status_id: string | null
          updated_at: string | null
        }
        Insert: {
          budget?: number | null
          client_id?: string | null
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          description?: string | null
          end_date?: string | null
          expected_completion_date?: string | null
          external_id?: string | null
          external_provider?: string | null
          id?: string
          is_archived?: boolean | null
          is_at_risk?: boolean
          metadata?: Json | null
          name: string
          owner_id?: string | null
          owner_notified_at?: string | null
          risk_flags?: string[]
          slug: string
          source_deal_id?: string | null
          start_date?: string | null
          status_id?: string | null
          updated_at?: string | null
        }
        Update: {
          budget?: number | null
          client_id?: string | null
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          description?: string | null
          end_date?: string | null
          expected_completion_date?: string | null
          external_id?: string | null
          external_provider?: string | null
          id?: string
          is_archived?: boolean | null
          is_at_risk?: boolean
          metadata?: Json | null
          name?: string
          owner_id?: string | null
          owner_notified_at?: string | null
          risk_flags?: string[]
          slug?: string
          source_deal_id?: string | null
          start_date?: string | null
          status_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_status_id_fkey"
            columns: ["status_id"]
            isOneToOne: false
            referencedRelation: "project_statuses"
            referencedColumns: ["id"]
          },
        ]
      }
      prompt_templates: {
        Row: {
          category: string
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          slug: string
          template_content: string
          updated_at: string | null
          usage_count: number | null
        }
        Insert: {
          category?: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          slug: string
          template_content: string
          updated_at?: string | null
          usage_count?: number | null
        }
        Update: {
          category?: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          slug?: string
          template_content?: string
          updated_at?: string | null
          usage_count?: number | null
        }
        Relationships: []
      }
      role_audit_log: {
        Row: {
          action: string
          id: string
          new_state: Json | null
          old_state: Json | null
          performed_by: string | null
          target_role_id: string | null
          timestamp: string
        }
        Insert: {
          action: string
          id?: string
          new_state?: Json | null
          old_state?: Json | null
          performed_by?: string | null
          target_role_id?: string | null
          timestamp?: string
        }
        Update: {
          action?: string
          id?: string
          new_state?: Json | null
          old_state?: Json | null
          performed_by?: string | null
          target_role_id?: string | null
          timestamp?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_audit_log_target_role_id_fkey"
            columns: ["target_role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          created_at: string
          id: string | null
          permission_id: string
          role_id: string
        }
        Insert: {
          created_at?: string
          id?: string | null
          permission_id: string
          role_id: string
        }
        Update: {
          created_at?: string
          id?: string | null
          permission_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          cloned_from_id: string | null
          created_at: string
          description: string | null
          id: string
          is_system: boolean
          name: string
          slug: string | null
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          cloned_from_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_system?: boolean
          name: string
          slug?: string | null
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          cloned_from_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_system?: boolean
          name?: string
          slug?: string | null
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "roles_cloned_from_id_fkey"
            columns: ["cloned_from_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_emails: {
        Row: {
          body: string
          contact_id: string | null
          created_at: string | null
          created_by: string | null
          deal_id: string | null
          id: string
          scheduled_for: string
          sent_at: string | null
          status: string | null
          subject: string
          to_email: string
        }
        Insert: {
          body: string
          contact_id?: string | null
          created_at?: string | null
          created_by?: string | null
          deal_id?: string | null
          id?: string
          scheduled_for: string
          sent_at?: string | null
          status?: string | null
          subject: string
          to_email: string
        }
        Update: {
          body?: string
          contact_id?: string | null
          created_at?: string | null
          created_by?: string | null
          deal_id?: string | null
          id?: string
          scheduled_for?: string
          sent_at?: string | null
          status?: string | null
          subject?: string
          to_email?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_emails_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_emails_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      security_anomalies: {
        Row: {
          anomaly_type: string
          detected_at: string
          id: string
          message: string
          metadata: Json
          org_id: string | null
          severity: string
        }
        Insert: {
          anomaly_type: string
          detected_at?: string
          id?: string
          message: string
          metadata?: Json
          org_id?: string | null
          severity?: string
        }
        Update: {
          anomaly_type?: string
          detected_at?: string
          id?: string
          message?: string
          metadata?: Json
          org_id?: string | null
          severity?: string
        }
        Relationships: [
          {
            foreignKeyName: "security_anomalies_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "security_anomalies_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      security_configurations: {
        Row: {
          created_at: string
          disposable_email_blocked: boolean
          hibp_check_enabled: boolean
          id: string
          lockout_duration_minutes: number
          max_login_attempts: number
          org_id: string
          password_rotation_days: number
          smtp_check_enabled: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          disposable_email_blocked?: boolean
          hibp_check_enabled?: boolean
          id?: string
          lockout_duration_minutes?: number
          max_login_attempts?: number
          org_id: string
          password_rotation_days?: number
          smtp_check_enabled?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          disposable_email_blocked?: boolean
          hibp_check_enabled?: boolean
          id?: string
          lockout_duration_minutes?: number
          max_login_attempts?: number
          org_id?: string
          password_rotation_days?: number
          smtp_check_enabled?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "security_configurations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "security_configurations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      sendgrid_config: {
        Row: {
          api_key: string | null
          api_key_encrypted: string | null
          created_at: string | null
          enable_click_tracking: boolean | null
          enable_open_tracking: boolean | null
          from_email: string | null
          from_name: string | null
          id: string
          is_enabled: boolean | null
          updated_at: string | null
          updated_by: string | null
          webhook_secret: string | null
          webhook_url: string | null
        }
        Insert: {
          api_key?: string | null
          api_key_encrypted?: string | null
          created_at?: string | null
          enable_click_tracking?: boolean | null
          enable_open_tracking?: boolean | null
          from_email?: string | null
          from_name?: string | null
          id?: string
          is_enabled?: boolean | null
          updated_at?: string | null
          updated_by?: string | null
          webhook_secret?: string | null
          webhook_url?: string | null
        }
        Update: {
          api_key?: string | null
          api_key_encrypted?: string | null
          created_at?: string | null
          enable_click_tracking?: boolean | null
          enable_open_tracking?: boolean | null
          from_email?: string | null
          from_name?: string | null
          id?: string
          is_enabled?: boolean | null
          updated_at?: string | null
          updated_by?: string | null
          webhook_secret?: string | null
          webhook_url?: string | null
        }
        Relationships: []
      }
      signup_domain_allowlist: {
        Row: {
          created_at: string
          created_by: string | null
          domain: string
          id: string
          is_active: boolean
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          domain: string
          id?: string
          is_active?: boolean
        }
        Update: {
          created_at?: string
          created_by?: string | null
          domain?: string
          id?: string
          is_active?: boolean
        }
        Relationships: []
      }
      sso_configurations: {
        Row: {
          auto_create_users: boolean | null
          auto_provision_role: string | null
          client_id: string | null
          created_at: string | null
          display_name: string
          domain_restrictions: string[] | null
          id: string
          is_enabled: boolean | null
          is_primary: boolean | null
          metadata: Json | null
          okta_domain: string | null
          org_tenant_id: string | null
          provider_type: string
          tenant_id: string | null
          updated_at: string | null
        }
        Insert: {
          auto_create_users?: boolean | null
          auto_provision_role?: string | null
          client_id?: string | null
          created_at?: string | null
          display_name: string
          domain_restrictions?: string[] | null
          id?: string
          is_enabled?: boolean | null
          is_primary?: boolean | null
          metadata?: Json | null
          okta_domain?: string | null
          org_tenant_id?: string | null
          provider_type: string
          tenant_id?: string | null
          updated_at?: string | null
        }
        Update: {
          auto_create_users?: boolean | null
          auto_provision_role?: string | null
          client_id?: string | null
          created_at?: string | null
          display_name?: string
          domain_restrictions?: string[] | null
          id?: string
          is_enabled?: boolean | null
          is_primary?: boolean | null
          metadata?: Json | null
          okta_domain?: string | null
          org_tenant_id?: string | null
          provider_type?: string
          tenant_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sso_configurations_org_tenant_id_fkey"
            columns: ["org_tenant_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sso_configurations_org_tenant_id_fkey"
            columns: ["org_tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      sso_group_mappings: {
        Row: {
          created_at: string
          department_id: string | null
          external_group_id: string
          external_group_name: string
          id: string
          is_active: boolean
          role_id: string
          sso_config_id: string
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          department_id?: string | null
          external_group_id: string
          external_group_name: string
          id?: string
          is_active?: boolean
          role_id: string
          sso_config_id: string
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          department_id?: string | null
          external_group_id?: string
          external_group_name?: string
          id?: string
          is_active?: boolean
          role_id?: string
          sso_config_id?: string
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sso_group_mappings_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sso_group_mappings_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sso_group_mappings_sso_config_id_fkey"
            columns: ["sso_config_id"]
            isOneToOne: false
            referencedRelation: "sso_configurations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sso_group_mappings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sso_group_mappings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      storage_config: {
        Row: {
          aws_access_key_id: string | null
          aws_region: string
          aws_secret_access_key: string | null
          created_at: string
          id: string
          s3_bucket_name: string | null
          storage_type: string
          supabase_storage_bucket: string
          supabase_storage_public: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          aws_access_key_id?: string | null
          aws_region?: string
          aws_secret_access_key?: string | null
          created_at?: string
          id?: string
          s3_bucket_name?: string | null
          storage_type?: string
          supabase_storage_bucket?: string
          supabase_storage_public?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          aws_access_key_id?: string | null
          aws_region?: string
          aws_secret_access_key?: string | null
          created_at?: string
          id?: string
          s3_bucket_name?: string | null
          storage_type?: string
          supabase_storage_bucket?: string
          supabase_storage_public?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      system_settings: {
        Row: {
          category: string
          created_at: string | null
          description: string | null
          id: string
          key: string
          updated_at: string | null
          value: Json | null
        }
        Insert: {
          category: string
          created_at?: string | null
          description?: string | null
          id?: string
          key: string
          updated_at?: string | null
          value?: Json | null
        }
        Update: {
          category?: string
          created_at?: string | null
          description?: string | null
          id?: string
          key?: string
          updated_at?: string | null
          value?: Json | null
        }
        Relationships: []
      }
      task_attachments: {
        Row: {
          created_at: string | null
          file_name: string
          file_size: number | null
          file_type: string | null
          id: string
          storage_path: string
          task_id: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string | null
          file_name: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          storage_path: string
          task_id: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string | null
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          storage_path?: string
          task_id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_attachments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_categories: {
        Row: {
          color: string | null
          created_at: string | null
          description: string | null
          icon: string | null
          id: string
          is_active: boolean | null
          name: string
          parent_id: string | null
          slug: string | null
          sort_order: number | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          parent_id?: string | null
          slug?: string | null
          sort_order?: number | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          parent_id?: string | null
          slug?: string | null
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "task_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "task_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      task_category_roles: {
        Row: {
          access_level: string
          category_id: string
          created_at: string | null
          id: string
          role: string
          role_id: string | null
        }
        Insert: {
          access_level?: string
          category_id: string
          created_at?: string | null
          id?: string
          role: string
          role_id?: string | null
        }
        Update: {
          access_level?: string
          category_id?: string
          created_at?: string | null
          id?: string
          role?: string
          role_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_category_roles_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "task_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_category_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      task_comments: {
        Row: {
          content: string
          created_at: string | null
          id: string
          is_edited: boolean | null
          jira_author_email: string | null
          jira_author_name: string | null
          jira_comment_id: string | null
          parent_comment_id: string | null
          task_id: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          is_edited?: boolean | null
          jira_author_email?: string | null
          jira_author_name?: string | null
          jira_comment_id?: string | null
          parent_comment_id?: string | null
          task_id: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          is_edited?: boolean | null
          jira_author_email?: string | null
          jira_author_name?: string | null
          jira_comment_id?: string | null
          parent_comment_id?: string | null
          task_id?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_comments_parent_comment_id_fkey"
            columns: ["parent_comment_id"]
            isOneToOne: false
            referencedRelation: "task_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_comments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_contributors: {
        Row: {
          added_at: string | null
          id: string
          role: string | null
          task_id: string
          user_id: string
        }
        Insert: {
          added_at?: string | null
          id?: string
          role?: string | null
          task_id: string
          user_id: string
        }
        Update: {
          added_at?: string | null
          id?: string
          role?: string | null
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_contributors_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_stream_members: {
        Row: {
          id: string
          joined_at: string | null
          role: string | null
          stream_id: string
          user_id: string
        }
        Insert: {
          id?: string
          joined_at?: string | null
          role?: string | null
          stream_id: string
          user_id: string
        }
        Update: {
          id?: string
          joined_at?: string | null
          role?: string | null
          stream_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_stream_members_stream_id_fkey"
            columns: ["stream_id"]
            isOneToOne: false
            referencedRelation: "task_streams"
            referencedColumns: ["id"]
          },
        ]
      }
      task_streams: {
        Row: {
          color: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          is_archived: boolean | null
          name: string
          slug: string | null
          updated_at: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_archived?: boolean | null
          name: string
          slug?: string | null
          updated_at?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_archived?: boolean | null
          name?: string
          slug?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      task_time_logs: {
        Row: {
          created_at: string
          hours: number
          id: string
          metadata: Json
          note: string | null
          source: string
          started_at: string | null
          task_id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          hours: number
          id?: string
          metadata?: Json
          note?: string | null
          source?: string
          started_at?: string | null
          task_id: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          hours?: number
          id?: string
          metadata?: Json
          note?: string | null
          source?: string
          started_at?: string | null
          task_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_time_logs_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assigned_to: string | null
          category_id: string | null
          client_id: string | null
          completed_at: string | null
          created_at: string
          created_by: string
          description: string | null
          due_date: string | null
          eos_source_id: string | null
          eos_source_type: string | null
          id: string
          meeting_id: string | null
          metadata: Json | null
          parent_id: string | null
          position: number | null
          priority: string
          project_id: string | null
          slug: string | null
          status: string
          stream_id: string | null
          title: string
          updated_at: string
          work_type: string | null
        }
        Insert: {
          assigned_to?: string | null
          category_id?: string | null
          client_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          due_date?: string | null
          eos_source_id?: string | null
          eos_source_type?: string | null
          id?: string
          meeting_id?: string | null
          metadata?: Json | null
          parent_id?: string | null
          position?: number | null
          priority?: string
          project_id?: string | null
          slug?: string | null
          status?: string
          stream_id?: string | null
          title: string
          updated_at?: string
          work_type?: string | null
        }
        Update: {
          assigned_to?: string | null
          category_id?: string | null
          client_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          due_date?: string | null
          eos_source_id?: string | null
          eos_source_type?: string | null
          id?: string
          meeting_id?: string | null
          metadata?: Json | null
          parent_id?: string | null
          position?: number | null
          priority?: string
          project_id?: string | null
          slug?: string | null
          status?: string
          stream_id?: string | null
          title?: string
          updated_at?: string
          work_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tasks_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "task_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_risk_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_stream_id_fkey"
            columns: ["stream_id"]
            isOneToOne: false
            referencedRelation: "task_streams"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          created_at: string
          id: string
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      unified_documents: {
        Row: {
          chunk_count: number | null
          created_at: string | null
          drive_file_id: string | null
          embedding_model: string | null
          file_name: string | null
          file_size: number | null
          file_type: string | null
          id: string
          metadata: Json | null
          owner_id: string
          owner_type: string
          parse_version: string | null
          processing_error: string | null
          processing_status: string | null
          source_id: string | null
          storage_path: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          chunk_count?: number | null
          created_at?: string | null
          drive_file_id?: string | null
          embedding_model?: string | null
          file_name?: string | null
          file_size?: number | null
          file_type?: string | null
          id?: string
          metadata?: Json | null
          owner_id: string
          owner_type: string
          parse_version?: string | null
          processing_error?: string | null
          processing_status?: string | null
          source_id?: string | null
          storage_path?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          chunk_count?: number | null
          created_at?: string | null
          drive_file_id?: string | null
          embedding_model?: string | null
          file_name?: string | null
          file_size?: number | null
          file_type?: string | null
          id?: string
          metadata?: Json | null
          owner_id?: string
          owner_type?: string
          parse_version?: string | null
          processing_error?: string | null
          processing_status?: string | null
          source_id?: string | null
          storage_path?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      user_invites: {
        Row: {
          cancelled_at: string | null
          created_at: string | null
          department_id: string | null
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          pod_id: string | null
          role: string | null
          role_id: string | null
          status: string
          tenant_id: string | null
          token: string
          used_at: string | null
          welcome_message: string | null
        }
        Insert: {
          cancelled_at?: string | null
          created_at?: string | null
          department_id?: string | null
          email: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          pod_id?: string | null
          role?: string | null
          role_id?: string | null
          status?: string
          tenant_id?: string | null
          token?: string
          used_at?: string | null
          welcome_message?: string | null
        }
        Update: {
          cancelled_at?: string | null
          created_at?: string | null
          department_id?: string | null
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          pod_id?: string | null
          role?: string | null
          role_id?: string | null
          status?: string
          tenant_id?: string | null
          token?: string
          used_at?: string | null
          welcome_message?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_invites_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_invites_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_invites_pod_id_fkey"
            columns: ["pod_id"]
            isOneToOne: false
            referencedRelation: "pods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_invites_pod_id_fkey"
            columns: ["pod_id"]
            isOneToOne: false
            referencedRelation: "pods_with_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_invites_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_invites_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_invites_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      user_knowledge_files: {
        Row: {
          chunk_count: number | null
          created_at: string | null
          file_name: string
          file_size: number | null
          file_type: string | null
          id: string
          metadata: Json | null
          processing_status: string | null
          storage_path: string | null
          title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          chunk_count?: number | null
          created_at?: string | null
          file_name: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          metadata?: Json | null
          processing_status?: string | null
          storage_path?: string | null
          title: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          chunk_count?: number | null
          created_at?: string | null
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          metadata?: Json | null
          processing_status?: string | null
          storage_path?: string | null
          title?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_microsoft_teams: {
        Row: {
          created_at: string | null
          description: string | null
          display_name: string
          id: string
          is_archived: boolean | null
          synced_at: string | null
          team_id: string
          updated_at: string | null
          user_id: string
          visibility: string | null
          web_url: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          display_name: string
          id?: string
          is_archived?: boolean | null
          synced_at?: string | null
          team_id: string
          updated_at?: string | null
          user_id: string
          visibility?: string | null
          web_url?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          display_name?: string
          id?: string
          is_archived?: boolean | null
          synced_at?: string | null
          team_id?: string
          updated_at?: string | null
          user_id?: string
          visibility?: string | null
          web_url?: string | null
        }
        Relationships: []
      }
      user_microsoft_teams_channels: {
        Row: {
          channel_id: string
          created_at: string | null
          created_date_time: string | null
          description: string | null
          display_name: string
          email: string | null
          id: string
          is_favorite: boolean | null
          membership_type: string | null
          synced_at: string | null
          team_id: string
          updated_at: string | null
          user_id: string
          web_url: string | null
        }
        Insert: {
          channel_id: string
          created_at?: string | null
          created_date_time?: string | null
          description?: string | null
          display_name: string
          email?: string | null
          id?: string
          is_favorite?: boolean | null
          membership_type?: string | null
          synced_at?: string | null
          team_id: string
          updated_at?: string | null
          user_id: string
          web_url?: string | null
        }
        Update: {
          channel_id?: string
          created_at?: string | null
          created_date_time?: string | null
          description?: string | null
          display_name?: string
          email?: string | null
          id?: string
          is_favorite?: boolean | null
          membership_type?: string | null
          synced_at?: string | null
          team_id?: string
          updated_at?: string | null
          user_id?: string
          web_url?: string | null
        }
        Relationships: []
      }
      user_module_permissions: {
        Row: {
          granted_at: string | null
          granted_by: string | null
          id: string
          module_id: string
          user_id: string
        }
        Insert: {
          granted_at?: string | null
          granted_by?: string | null
          id?: string
          module_id: string
          user_id: string
        }
        Update: {
          granted_at?: string | null
          granted_by?: string | null
          id?: string
          module_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_module_permissions_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "app_modules"
            referencedColumns: ["id"]
          },
        ]
      }
      user_oauth_tokens: {
        Row: {
          access_token: string
          account_avatar_url: string | null
          account_email: string | null
          account_id: string | null
          account_name: string | null
          created_at: string
          error_at: string | null
          error_message: string | null
          expires_at: string | null
          id: string
          is_active: boolean | null
          last_refreshed_at: string | null
          last_used_at: string | null
          metadata: Json | null
          provider_slug: string
          refresh_token: string | null
          scopes: string[] | null
          token_type: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          account_avatar_url?: string | null
          account_email?: string | null
          account_id?: string | null
          account_name?: string | null
          created_at?: string
          error_at?: string | null
          error_message?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          last_refreshed_at?: string | null
          last_used_at?: string | null
          metadata?: Json | null
          provider_slug: string
          refresh_token?: string | null
          scopes?: string[] | null
          token_type?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          account_avatar_url?: string | null
          account_email?: string | null
          account_id?: string | null
          account_name?: string | null
          created_at?: string
          error_at?: string | null
          error_message?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          last_refreshed_at?: string | null
          last_used_at?: string | null
          metadata?: Json | null
          provider_slug?: string
          refresh_token?: string | null
          scopes?: string[] | null
          token_type?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_preferences: {
        Row: {
          agent_id: string | null
          confidence_score: number | null
          created_at: string | null
          evidence_count: number | null
          id: string
          is_active: boolean | null
          last_used_at: string | null
          learned_from: string | null
          preference_key: string
          preference_value: Json
          times_used: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          agent_id?: string | null
          confidence_score?: number | null
          created_at?: string | null
          evidence_count?: number | null
          id?: string
          is_active?: boolean | null
          last_used_at?: string | null
          learned_from?: string | null
          preference_key: string
          preference_value: Json
          times_used?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          agent_id?: string | null
          confidence_score?: number | null
          created_at?: string | null
          evidence_count?: number | null
          id?: string
          is_active?: boolean | null
          last_used_at?: string | null
          learned_from?: string | null
          preference_key?: string
          preference_value?: Json
          times_used?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_preferences_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_role_preferences: {
        Row: {
          agency_role: string | null
          ai_digest_enabled: boolean
          ai_digest_frequency: string
          created_at: string
          dashboard_layout: Json | null
          hide_completed_tasks: boolean
          id: string
          is_eos_user: boolean
          primary_pod_id: string | null
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          agency_role?: string | null
          ai_digest_enabled?: boolean
          ai_digest_frequency?: string
          created_at?: string
          dashboard_layout?: Json | null
          hide_completed_tasks?: boolean
          id?: string
          is_eos_user?: boolean
          primary_pod_id?: string | null
          role: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          agency_role?: string | null
          ai_digest_enabled?: boolean
          ai_digest_frequency?: string
          created_at?: string
          dashboard_layout?: Json | null
          hide_completed_tasks?: boolean
          id?: string
          is_eos_user?: boolean
          primary_pod_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_role_preferences_primary_pod_id_fkey"
            columns: ["primary_pod_id"]
            isOneToOne: false
            referencedRelation: "pods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_role_preferences_primary_pod_id_fkey"
            columns: ["primary_pod_id"]
            isOneToOne: false
            referencedRelation: "pods_with_stats"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          org_id: string | null
          profile_id: string | null
          role: Database["public"]["Enums"]["app_role"]
          role_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          org_id?: string | null
          profile_id?: string | null
          role: Database["public"]["Enums"]["app_role"]
          role_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          org_id?: string | null
          profile_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          role_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_space_preferences: {
        Row: {
          default_space: string
          favorites: Json
          id: string
          recent_pages: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          default_space?: string
          favorites?: Json
          id?: string
          recent_pages?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          default_space?: string
          favorites?: Json
          id?: string
          recent_pages?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      vector_search_logs: {
        Row: {
          created_at: string | null
          duration_ms: number | null
          id: string
          metadata: Json | null
          query: string
          result_count: number | null
          search_type: string | null
          top_score: number | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          duration_ms?: number | null
          id?: string
          metadata?: Json | null
          query: string
          result_count?: number | null
          search_type?: string | null
          top_score?: number | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          duration_ms?: number | null
          id?: string
          metadata?: Json | null
          query?: string
          result_count?: number | null
          search_type?: string | null
          top_score?: number | null
          user_id?: string | null
        }
        Relationships: []
      }
      zoho_account_enrichment: {
        Row: {
          deal_id: string
          id: string
          payload: Json
          updated_at: string
          zoho_account_id: string
        }
        Insert: {
          deal_id: string
          id?: string
          payload?: Json
          updated_at?: string
          zoho_account_id: string
        }
        Update: {
          deal_id?: string
          id?: string
          payload?: Json
          updated_at?: string
          zoho_account_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "zoho_account_enrichment_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: true
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      zoho_contact_enrichment: {
        Row: {
          deal_id: string
          id: string
          payload: Json
          updated_at: string
          zoho_contact_id: string
        }
        Insert: {
          deal_id: string
          id?: string
          payload?: Json
          updated_at?: string
          zoho_contact_id: string
        }
        Update: {
          deal_id?: string
          id?: string
          payload?: Json
          updated_at?: string
          zoho_contact_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "zoho_contact_enrichment_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: true
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      zoho_deal_attachments: {
        Row: {
          content_type: string | null
          created_at: string
          deal_id: string
          download_url: string | null
          file_name: string | null
          id: string
          raw: Json
          size_bytes: number | null
          synced_at: string
          zoho_attachment_id: string
        }
        Insert: {
          content_type?: string | null
          created_at?: string
          deal_id: string
          download_url?: string | null
          file_name?: string | null
          id?: string
          raw?: Json
          size_bytes?: number | null
          synced_at?: string
          zoho_attachment_id: string
        }
        Update: {
          content_type?: string | null
          created_at?: string
          deal_id?: string
          download_url?: string | null
          file_name?: string | null
          id?: string
          raw?: Json
          size_bytes?: number | null
          synced_at?: string
          zoho_attachment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "zoho_deal_attachments_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      zoho_deal_engagements: {
        Row: {
          activity_type: string | null
          content: string | null
          created_at: string
          deal_id: string
          id: string
          occurred_at: string | null
          raw: Json
          synced_at: string
          title: string | null
          zoho_module: string
          zoho_record_id: string
        }
        Insert: {
          activity_type?: string | null
          content?: string | null
          created_at?: string
          deal_id: string
          id?: string
          occurred_at?: string | null
          raw?: Json
          synced_at?: string
          title?: string | null
          zoho_module: string
          zoho_record_id: string
        }
        Update: {
          activity_type?: string | null
          content?: string | null
          created_at?: string
          deal_id?: string
          id?: string
          occurred_at?: string | null
          raw?: Json
          synced_at?: string
          title?: string | null
          zoho_module?: string
          zoho_record_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "zoho_deal_engagements_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      zoho_deal_events: {
        Row: {
          created_at: string
          deal_id: string
          end_at: string | null
          id: string
          location: string | null
          raw: Json
          start_at: string | null
          synced_at: string
          title: string | null
          zoho_event_id: string
        }
        Insert: {
          created_at?: string
          deal_id: string
          end_at?: string | null
          id?: string
          location?: string | null
          raw?: Json
          start_at?: string | null
          synced_at?: string
          title?: string | null
          zoho_event_id: string
        }
        Update: {
          created_at?: string
          deal_id?: string
          end_at?: string | null
          id?: string
          location?: string | null
          raw?: Json
          start_at?: string | null
          synced_at?: string
          title?: string | null
          zoho_event_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "zoho_deal_events_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      zoom_files: {
        Row: {
          created_at: string
          download_url: string | null
          file_name: string
          file_path: string | null
          file_size: number | null
          file_type: string
          has_embeddings: boolean | null
          id: string
          is_processed: boolean | null
          meeting_id: string
          metadata: Json | null
          processing_status: string | null
          storage_path: string | null
          transcript_content: Json | null
          transcript_text: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          download_url?: string | null
          file_name: string
          file_path?: string | null
          file_size?: number | null
          file_type: string
          has_embeddings?: boolean | null
          id?: string
          is_processed?: boolean | null
          meeting_id: string
          metadata?: Json | null
          processing_status?: string | null
          storage_path?: string | null
          transcript_content?: Json | null
          transcript_text?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          download_url?: string | null
          file_name?: string
          file_path?: string | null
          file_size?: number | null
          file_type?: string
          has_embeddings?: boolean | null
          id?: string
          is_processed?: boolean | null
          meeting_id?: string
          metadata?: Json | null
          processing_status?: string | null
          storage_path?: string | null
          transcript_content?: Json | null
          transcript_text?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "zoom_files_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      agent_learning_summary: {
        Row: {
          agent_id: string | null
          correction_count: number | null
          feedback_count: number | null
          negative_feedback: number | null
          positive_feedback: number | null
          reinforcement_count: number | null
          total_events: number | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_learning_events_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_memory_stats: {
        Row: {
          agent_id: string | null
          avg_importance: number | null
          episodic_count: number | null
          last_memory_access: string | null
          long_term_count: number | null
          semantic_count: number | null
          short_term_count: number | null
          total_accesses: number | null
          total_memories: number | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_memories_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_plan_performance: {
        Row: {
          agent_id: string | null
          avg_cost_per_plan: number | null
          avg_execution_time_ms: number | null
          avg_steps_per_plan: number | null
          avg_tokens_per_plan: number | null
          failed_plans: number | null
          successful_plans: number | null
          total_cost: number | null
          total_plans: number | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_execution_plans_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_step_performance: {
        Row: {
          action_type: string | null
          avg_execution_time_ms: number | null
          avg_retry_count: number | null
          failed_steps: number | null
          successful_steps: number | null
          total_steps: number | null
        }
        Relationships: []
      }
      contact_email_engagement: {
        Row: {
          click_rate: number | null
          contact_id: string | null
          emails_clicked: number | null
          emails_opened: number | null
          emails_sent: number | null
          last_email_clicked: string | null
          last_email_opened: string | null
          last_email_sent: string | null
          open_rate: number | null
          total_emails: number | null
        }
        Relationships: [
          {
            foreignKeyName: "email_logs_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      eos_notification_preferences_compat: {
        Row: {
          created_at: string | null
          email: boolean | null
          event_type: string | null
          id: string | null
          in_app: boolean | null
          tenant_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          email?: boolean | null
          event_type?: never
          id?: string | null
          in_app?: boolean | null
          tenant_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          email?: boolean | null
          event_type?: never
          id?: string | null
          in_app?: boolean | null
          tenant_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_event_subscriptions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_event_subscriptions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string | null
          id: string | null
          name: string | null
          slug: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string | null
          name?: string | null
          slug?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string | null
          name?: string | null
          slug?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      owner_dashboard_metrics: {
        Row: {
          active_clients: number | null
          active_team_members: number | null
          generated_at: string | null
          projects_at_risk: number | null
          projects_in_progress: number | null
          revenue_this_week: number | null
          team_utilization: number | null
        }
        Relationships: []
      }
      pm_team_capacity: {
        Row: {
          at_capacity: number | null
          available: number | null
          avg_utilization: number | null
          pod_id: string | null
          total_team_members: number | null
          week_start: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pod_members_pod_id_fkey"
            columns: ["pod_id"]
            isOneToOne: false
            referencedRelation: "pods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pod_members_pod_id_fkey"
            columns: ["pod_id"]
            isOneToOne: false
            referencedRelation: "pods_with_stats"
            referencedColumns: ["id"]
          },
        ]
      }
      pods_with_stats: {
        Row: {
          color: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          has_login_count: number | null
          hr_synced_count: number | null
          id: string | null
          is_active: boolean | null
          name: string | null
          no_login_count: number | null
          rp_members_count: number | null
          show_in_resource_projection: boolean | null
          updated_at: string | null
        }
        Relationships: []
      }
      project_risk_summary: {
        Row: {
          client_name: string | null
          end_date: string | null
          expected_completion_date: string | null
          id: string | null
          is_at_risk: boolean | null
          last_activity: string | null
          last_client_meeting: string | null
          name: string | null
          open_tasks: number | null
          risk_flags: string | null
          slug: string | null
        }
        Relationships: []
      }
      storage_config_public: {
        Row: {
          aws_region: string | null
          storage_type: string | null
          supabase_storage_bucket: string | null
          supabase_storage_public: boolean | null
          updated_at: string | null
        }
        Relationships: []
      }
      user_preference_coverage: {
        Row: {
          avg_confidence: number | null
          explicit_count: number | null
          inferred_count: number | null
          observed_count: number | null
          total_preferences: number | null
          total_usage: number | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      admin_exec_sql: { Args: { sql_content: string }; Returns: Json }
      admin_export_user_memories: { Args: { p_user_id: string }; Returns: Json }
      admin_list_user_memories: {
        Args: { p_user_id: string }
        Returns: {
          agent_id: string
          confidence_score: number
          content: string
          created_at: string
          department_name: string
          id: string
          importance_score: number
          memory_category: string
          memory_type: string
          source: string
          user_email: string
          user_id: string
        }[]
      }
      admin_list_user_sessions: {
        Args: never
        Returns: {
          created_at: string
          email: string
          full_name: string
          not_after: string
          session_id: string
          updated_at: string
          user_id: string
        }[]
      }
      admin_terminate_session: {
        Args: { p_session_id: string }
        Returns: undefined
      }
      admin_terminate_user_sessions: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      boost_memory_importance: {
        Args: { p_boost_amount?: number; p_memory_id: string }
        Returns: undefined
      }
      calculate_contact_lead_score: {
        Args: { contact_id: string }
        Returns: {
          deal_potential_score: number
          engagement_score: number
          profile_score: number
          recency_score: number
          temperature: string
          total_score: number
        }[]
      }
      check_kb_source_permission: {
        Args: { p_permission: string; p_source_id: string }
        Returns: boolean
      }
      consolidate_short_term_memories: {
        Args: { p_agent_id: string; p_days_old?: number; p_user_id: string }
        Returns: number
      }
      get_latest_contact_intent_analysis: {
        Args: { p_contact_id: string }
        Returns: {
          analyzed_at: string
          confidence: string
          days_since_activity: number
          decay_signals: Json
          id: string
          intent_status: string
          momentum_score: number
          momentum_signals: Json
          reasoning: string
          suggested_action: string
        }[]
      }
      get_latest_contact_mood_analysis: {
        Args: { p_contact_id: string }
        Returns: {
          analyzed_at: string
          confidence: string
          id: string
          key_signals: Json
          mood_label: string
          mood_score: number
          reasoning: string
          suggested_action: string
        }[]
      }
      get_or_create_sendgrid_config: {
        Args: never
        Returns: {
          api_key: string | null
          api_key_encrypted: string | null
          created_at: string | null
          enable_click_tracking: boolean | null
          enable_open_tracking: boolean | null
          from_email: string | null
          from_name: string | null
          id: string
          is_enabled: boolean | null
          updated_at: string | null
          updated_by: string | null
          webhook_secret: string | null
          webhook_url: string | null
        }
        SetofOptions: {
          from: "*"
          to: "sendgrid_config"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_or_create_storage_config: {
        Args: never
        Returns: {
          aws_access_key_id: string | null
          aws_region: string
          aws_secret_access_key: string | null
          created_at: string
          id: string
          s3_bucket_name: string | null
          storage_type: string
          supabase_storage_bucket: string
          supabase_storage_public: boolean
          updated_at: string
          updated_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "storage_config"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_relevant_memories: {
        Args: {
          p_agent_id: string
          p_limit?: number
          p_memory_types?: string[]
          p_query_embedding: string
          p_similarity_threshold?: number
          p_user_id: string
        }
        Returns: {
          content: string
          created_at: string
          importance_score: number
          memory_id: string
          memory_type: string
          similarity: number
        }[]
      }
      get_role_stats: {
        Args: never
        Returns: {
          assigned_user_count: number
          permission_count: number
          role_id: string
        }[]
      }
      get_user_modules: {
        Args: never
        Returns: {
          category: string
          icon: string
          name: string
          slug: string
        }[]
      }
      get_user_permissions: { Args: { _user_id: string }; Returns: string[] }
      get_user_tenant_id: { Args: never; Returns: string }
      has_permission: {
        Args: { _permission_key: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_template_usage: {
        Args: { template_id: string }
        Returns: undefined
      }
      is_account_locked: { Args: { p_email: string }; Returns: boolean }
      is_contact_ai_summary_expired: {
        Args: { p_contact_id: string }
        Returns: boolean
      }
      match_embeddings: {
        Args: {
          filter_entity_type?: string
          filter_user_id?: string
          match_count?: number
          match_threshold?: number
          p_user_id?: string
          query_embedding: string
        }
        Returns: {
          content: string
          entity_id: string
          entity_type: string
          id: string
          metadata: Json
          similarity: number
          unified_document_id: string
          user_id: string
        }[]
      }
      match_embeddings_admin: {
        Args: {
          filter_client_name?: string
          filter_entity_type?: string
          filter_project_manager?: string
          filter_project_name?: string
          filter_user_id?: string
          match_count?: number
          match_threshold?: number
          query_embedding: string
        }
        Returns: {
          client_name: string
          content: string
          entity_id: string
          entity_type: string
          id: string
          metadata: Json
          project_manager: string
          project_name: string
          similarity: number
          unified_document_id: string
          user_id: string
        }[]
      }
      process_sendgrid_event: {
        Args: {
          p_clicked_url?: string
          p_contact_id: string
          p_event_type: string
          p_ip_address?: string
          p_metadata?: Json
          p_sendgrid_message_id: string
          p_user_agent?: string
        }
        Returns: string
      }
      prune_short_term_memories: {
        Args: {
          p_agent_id: string
          p_days_old?: number
          p_importance_threshold?: number
          p_user_id: string
        }
        Returns: number
      }
      record_login_attempt: {
        Args: {
          p_email: string
          p_ip_address?: string
          p_was_successful?: boolean
        }
        Returns: string
      }
      refresh_contact_ai_summary: {
        Args: { p_contact_id: string }
        Returns: undefined
      }
      refresh_conversation_stats: {
        Args: { p_conversation_id: string }
        Returns: undefined
      }
      refresh_knowledge_folder_stats: {
        Args: { folder_uuid: string }
        Returns: undefined
      }
      replace_template_variables: {
        Args: { template_body: string; variables_json: Json }
        Returns: string
      }
      sync_pod_employees_from_hr: {
        Args: never
        Returns: {
          employees_synced: number
          employees_with_login: number
          employees_without_login: number
          pod_id: string
        }[]
      }
      sync_user_app_role: { Args: { _user_id: string }; Returns: undefined }
      update_plan_status_if_all_steps_done: {
        Args: { p_plan_id: string }
        Returns: undefined
      }
      user_in_department: {
        Args: { _department_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
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
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
