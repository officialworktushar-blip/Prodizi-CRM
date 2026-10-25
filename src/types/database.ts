export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string;
          email: string | null;
          phone: string | null;
          role: Database["public"]["Enums"]["user_role"];
          designation: string | null;
          position: string | null;
          dedicated_work: string | null;
          manager_id: string | null;
          avatar_url: string | null;
          joined_on: string | null;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id: string;
          full_name: string;
          email?: string | null;
          phone?: string | null;
          role?: Database["public"]["Enums"]["user_role"];
          designation?: string | null;
          position?: string | null;
          dedicated_work?: string | null;
          manager_id?: string | null;
          avatar_url?: string | null;
          joined_on?: string | null;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string;
          email?: string | null;
          phone?: string | null;
          role?: Database["public"]["Enums"]["user_role"];
          designation?: string | null;
          position?: string | null;
          dedicated_work?: string | null;
          manager_id?: string | null;
          avatar_url?: string | null;
          joined_on?: string | null;
          is_active?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      salary_config: {
        Row: {
          user_id: string;
          base_salary: number;
          sales_incentive_percent: number;
        };
        Insert: {
          user_id: string;
          base_salary: number;
          sales_incentive_percent: number;
        };
        Update: {
          user_id?: string;
          base_salary?: number;
          sales_incentive_percent?: number;
        };
        Relationships: [];
      };
      salary_payouts: {
        Row: {
          id: string;
          user_id: string;
          month: string;
          bonus: number;
          deduction: number;
          status: string;
          paid_on: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          month: string;
          bonus?: number;
          deduction?: number;
          status?: string;
          paid_on?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          month?: string;
          bonus?: number;
          deduction?: number;
          status?: string;
          paid_on?: string | null;
        };
        Relationships: [];
      };
      tasks: {
        Row: {
          id: string;
          title: string;
          description: string | null;
          task_type: Database["public"]["Enums"]["task_type"];
          status: Database["public"]["Enums"]["task_status"];
          assigned_to: string;
          created_by: string | null;
          lead_id: string | null;
          due_date: string | null;
          incentive_amount: number;
          completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          description?: string | null;
          task_type: Database["public"]["Enums"]["task_type"];
          status?: Database["public"]["Enums"]["task_status"];
          assigned_to: string;
          created_by?: string | null;
          lead_id?: string | null;
          due_date?: string | null;
          incentive_amount?: number;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          description?: string | null;
          task_type?: Database["public"]["Enums"]["task_type"];
          status?: Database["public"]["Enums"]["task_status"];
          assigned_to?: string;
          created_by?: string | null;
          lead_id?: string | null;
          due_date?: string | null;
          incentive_amount?: number;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      leads: {
        Row: {
          id: string;
          client_name: string;
          company: string | null;
          phone: string | null;
          email: string | null;
          kind: Database["public"]["Enums"]["lead_kind"];
          item_name: string | null;
          frequency: Database["public"]["Enums"]["lead_frequency"];
          status: Database["public"]["Enums"]["lead_status"];
          source: string | null;
          expected_value: number | null;
          assigned_to: string | null;
          created_by: string | null;
          next_follow_up: string | null;
          notes: string | null;
          import_batch_id: string | null;
          created_at: string;
          updated_at: string;
          assigned_by: string | null;
          assigned_at: string | null;
        };
        Insert: {
          id?: string;
          client_name: string;
          company?: string | null;
          phone?: string | null;
          email?: string | null;
          kind: Database["public"]["Enums"]["lead_kind"];
          item_name?: string | null;
          frequency: Database["public"]["Enums"]["lead_frequency"];
          status?: Database["public"]["Enums"]["lead_status"];
          source?: string | null;
          expected_value?: number | null;
          assigned_to?: string | null;
          created_by?: string | null;
          next_follow_up?: string | null;
          notes?: string | null;
          import_batch_id?: string | null;
          created_at?: string;
          updated_at?: string;
          assigned_by?: string | null;
          assigned_at?: string | null;
        };
        Update: {
          id?: string;
          client_name?: string;
          company?: string | null;
          phone?: string | null;
          email?: string | null;
          kind?: Database["public"]["Enums"]["lead_kind"];
          item_name?: string | null;
          frequency?: Database["public"]["Enums"]["lead_frequency"];
          status?: Database["public"]["Enums"]["lead_status"];
          source?: string | null;
          expected_value?: number | null;
          assigned_to?: string | null;
          created_by?: string | null;
          next_follow_up?: string | null;
          notes?: string | null;
          import_batch_id?: string | null;
          created_at?: string;
          updated_at?: string;
          assigned_by?: string | null;
          assigned_at?: string | null;
        };
        Relationships: [];
      };
      lead_activity: {
        Row: {
          id: string;
          lead_id: string;
          actor_id: string | null;
          action: string;
          detail: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          lead_id: string;
          actor_id?: string | null;
          action: string;
          detail?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          lead_id?: string;
          actor_id?: string | null;
          action?: string;
          detail?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      lead_import_batches: {
        Row: {
          id: string;
          file_name: string | null;
          row_count: number | null;
          imported_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          file_name?: string | null;
          row_count?: number | null;
          imported_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          file_name?: string | null;
          row_count?: number | null;
          imported_by?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      sales: {
        Row: {
          id: string;
          lead_id: string | null;
          client_name: string;
          service_sold: string | null;
          sale_date: string;
          total_amount: number;
          received_amount: number;
          remaining_amount: number | null;
          payment_status: Database["public"]["Enums"]["payment_status"];
          is_upgrade: boolean;
          upgrade_from_sale_id: string | null;
          sold_by: string | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          lead_id?: string | null;
          client_name: string;
          service_sold?: string | null;
          sale_date: string;
          total_amount: number;
          received_amount?: number;
          remaining_amount?: number | null;
          payment_status?: Database["public"]["Enums"]["payment_status"];
          is_upgrade?: boolean;
          upgrade_from_sale_id?: string | null;
          sold_by?: string | null;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          lead_id?: string | null;
          client_name?: string;
          service_sold?: string | null;
          sale_date?: string;
          total_amount?: number;
          received_amount?: number;
          remaining_amount?: number | null;
          payment_status?: Database["public"]["Enums"]["payment_status"];
          is_upgrade?: boolean;
          upgrade_from_sale_id?: string | null;
          sold_by?: string | null;
          notes?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      payments: {
        Row: {
          id: string;
          sale_id: string;
          amount: number;
          paid_on: string;
          mode: string | null;
          note: string | null;
          added_by: string | null;
        };
        Insert: {
          id?: string;
          sale_id: string;
          amount: number;
          paid_on?: string;
          mode?: string | null;
          note?: string | null;
          added_by?: string | null;
        };
        Update: {
          id?: string;
          sale_id?: string;
          amount?: number;
          paid_on?: string;
          mode?: string | null;
          note?: string | null;
          added_by?: string | null;
        };
        Relationships: [];
      };
      incentives: {
        Row: {
          id: string;
          user_id: string;
          source: Database["public"]["Enums"]["incentive_source"];
          task_id: string | null;
          sale_id: string | null;
          amount: number;
          month: string;
          note: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          source: Database["public"]["Enums"]["incentive_source"];
          task_id?: string | null;
          sale_id?: string | null;
          amount: number;
          month: string;
          note?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          source?: Database["public"]["Enums"]["incentive_source"];
          task_id?: string | null;
          sale_id?: string | null;
          amount?: number;
          month?: string;
          note?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      targets: {
        Row: {
          id: string;
          user_id: string;
          month: string;
          target_amount: number;
        };
        Insert: {
          id?: string;
          user_id: string;
          month: string;
          target_amount: number;
        };
        Update: {
          id?: string;
          user_id?: string;
          month?: string;
          target_amount?: number;
        };
        Relationships: [];
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          body: string | null;
          link: string | null;
          is_read: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          body?: string | null;
          link?: string | null;
          is_read?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          body?: string | null;
          link?: string | null;
          is_read?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      assignee_workload: {
        Row: {
          user_id: string | null;
          full_name: string | null;
          role: Database["public"]["Enums"]["user_role"] | null;
          designation: string | null;
          position: string | null;
          dedicated_work: string | null;
          manager_id: string | null;
          open_leads: number | null;
          ongoing_leads: number | null;
          confirmed_this_month: number | null;
          performance_pct: number | null;
          tasks_pending: number | null;
        };
        Relationships: [];
      };
      member_stats: {
        Row: {
          user_id: string | null;
          full_name: string | null;
          role: Database["public"]["Enums"]["user_role"] | null;
          designation: string | null;
          position: string | null;
          dedicated_work: string | null;
          avatar_url: string | null;
          tasks_completed: number | null;
          tasks_pending: number | null;
          tasks_total: number | null;
          performance_pct: number | null;
        };
        Relationships: [];
      };
      target_progress: {
        Row: {
          user_id: string | null;
          month: string | null;
          target_amount: number | null;
          achieved: number | null;
          pct: number | null;
          stage: string | null;
        };
        Relationships: [];
      };
      salary_monthly: {
        Row: {
          user_id: string | null;
          full_name: string | null;
          role: Database["public"]["Enums"]["user_role"] | null;
          month: string | null;
          base_salary: number | null;
          task_incentive: number | null;
          sales_incentive: number | null;
          manual_incentive: number | null;
          bonus: number | null;
          deduction: number | null;
          total_salary: number | null;
          payout_status: string | null;
          target_amount: number | null;
          achieved: number | null;
          target_pct: number | null;
          target_stage: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      in_my_tree: {
        Args: { target: string };
        Returns: boolean;
      };
      my_tree_ids: {
        Args: Record<PropertyKey, never>;
        Returns: string[];
      };
      is_admin: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      is_owner: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
    };
    Enums: {
      user_role: "owner" | "manager" | "employee" | "intern";
      lead_kind: "product" | "service";
      lead_frequency: "daily" | "weekly";
      lead_status:
        "upcoming" | "pending" | "ongoing" | "confirmed" | "cancelled";
      task_type: "daily" | "weekly" | "one_time";
      task_status: "todo" | "in_progress" | "completed" | "cancelled";
      payment_status: "pending" | "partial" | "paid";
      incentive_source: "task" | "sale" | "manual";
    };
    CompositeTypes: Record<string, never>;
  };
};

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (Database["public"]["Tables"] & Database["public"]["Views"])
    | { schema: keyof Database },
  TableName extends (PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
      Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (Database["public"]["Tables"] &
        Database["public"]["Views"])
    ? (Database["public"]["Tables"] &
        Database["public"]["Views"])[PublicTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  PublicTableNameOrOptions extends
    keyof Database["public"]["Tables"] | { schema: keyof Database },
  TableName extends (PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof Database["public"]["Tables"]
    ? Database["public"]["Tables"][PublicTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  PublicTableNameOrOptions extends
    keyof Database["public"]["Tables"] | { schema: keyof Database },
  TableName extends (PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof Database["public"]["Tables"]
    ? Database["public"]["Tables"][PublicTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  PublicEnumNameOrOptions extends
    keyof Database["public"]["Enums"] | { schema: keyof Database },
  EnumName extends (PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof Database["public"]["Enums"]
    ? Database["public"]["Enums"][PublicEnumNameOrOptions]
    : never;

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Task = Database["public"]["Tables"]["tasks"]["Row"];
export type Lead = Database["public"]["Tables"]["leads"]["Row"];
export type LeadActivity = Database["public"]["Tables"]["lead_activity"]["Row"];
export type LeadImportBatch =
  Database["public"]["Tables"]["lead_import_batches"]["Row"];
export type Sale = Database["public"]["Tables"]["sales"]["Row"];
export type Payment = Database["public"]["Tables"]["payments"]["Row"];
export type Incentive = Database["public"]["Tables"]["incentives"]["Row"];
export type Target = Database["public"]["Tables"]["targets"]["Row"];
export type SalaryConfig = Database["public"]["Tables"]["salary_config"]["Row"];
export type SalaryPayout =
  Database["public"]["Tables"]["salary_payouts"]["Row"];
export type Notification = Database["public"]["Tables"]["notifications"]["Row"];
export type AssigneeWorkload =
  Database["public"]["Views"]["assignee_workload"]["Row"];
export type MemberStats = Database["public"]["Views"]["member_stats"]["Row"];
export type TargetProgress =
  Database["public"]["Views"]["target_progress"]["Row"];
export type SalaryMonthly =
  Database["public"]["Views"]["salary_monthly"]["Row"];
