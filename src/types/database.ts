/**
 * Minimal, hand-maintained Supabase Database type definition.
 *
 * This is intentionally a focused subset covering only the tables and columns
 * the application actually touches. Regenerate the full file with:
 *
 *   npm run db:types
 *
 * or paste Supabase's generated types over this file when you add columns.
 */

export type AppRole = 'administrator' | 'promo_manager' | 'producer' | 'viewer';
export type PriorityLevel = 'low' | 'normal' | 'high' | 'urgent';
export type RecordStatus = 'active' | 'inactive' | 'archived';
export type ShiftStatus = 'planned' | 'in_progress' | 'done' | 'cancelled';
export type DueState = 'on_track' | 'due_soon' | 'overdue' | 'completed';

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Profile = {
  id: string;
  email: string;
  full_name: string;
  job_title: string | null;
  phone: string | null;
  avatar_url: string | null;
  role: AppRole;
  status: RecordStatus;
  notes: string | null;
  last_seen_at: string | null;
  created_at: string;
  updated_at: string;
}

export type PipelineStage = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  position: number;
  color: string;
  is_terminal: boolean;
  is_cancelled: boolean;
  created_at: string;
  updated_at: string;
}

export type Channel = {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  category: string | null;
  color: string;
  status: RecordStatus;
  sort_order: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type Program = {
  id: string;
  name: string;
  description: string | null;
  channel_id: string | null;
  responsible_id: string | null;
  image_url: string | null;
  status: RecordStatus;
  start_date: string | null;
  end_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type PromoGoal = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  color: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export type PromoType = {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export type Project = {
  id: string;
  code: string | null;
  name: string;
  description: string | null;
  manager_id: string | null;
  status: RecordStatus;
  start_date: string | null;
  end_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type ProjectMember = {
  project_id: string;
  user_id: string;
  created_at: string;
}

export type ProjectProgram = {
  project_id: string;
  program_id: string;
  created_at: string;
}

export type PromoRequest = {
  id: string;
  request_code: string | null;
  title: string;
  request_date: string;
  requested_by_id: string | null;
  requested_by_name: string | null;
  company_department: string | null;
  program_id: string | null;
  channel_id: string | null;
  project_id: string | null;
  episodes_count: number | null;
  promo_type_id: string | null;
  goal_id: string | null;
  priority: PriorityLevel;
  due_date: string | null;
  assigned_to_id: string | null;
  shift_count: number;
  production_start_date: string | null;
  production_end_date: string | null;
  call_time: string | null;
  location: string | null;
  notes: string | null;
  special_instructions: string | null;
  internal_notes: string | null;
  promo_goal: string | null;
  target_audience: string | null;
  promo_description: string | null;
  key_message: string | null;
  required_deliverables: string | null;
  duration_seconds: number | null;
  format: string | null;
  language: string | null;
  version: string | null;
  deadline: string | null;
  stage_id: string;
  stage_name: string;
  stage_position: number;
  is_completed: boolean;
  completed_at: string | null;
  status: RecordStatus;
  due_state: DueState;
  created_at: string;
  updated_at: string;
}

export type RequestParticipant = {
  id: string;
  request_id: string;
  user_id: string;
  responsibility: string | null;
  notes: string | null;
  added_by_id: string | null;
  created_at: string;
}

export type RequestShift = {
  id: string;
  request_id: string;
  shift_number: number;
  shift_date: string | null;
  start_time: string | null;
  end_time: string | null;
  assigned_to_id: string | null;
  location: string | null;
  notes: string | null;
  status: ShiftStatus;
  created_at: string;
  updated_at: string;
}

export type RequestNote = {
  id: string;
  request_id: string;
  author_id: string | null;
  body: string;
  is_internal: boolean;
  created_at: string;
}

export type Attachment = {
  id: string;
  request_id: string | null;
  project_id: string | null;
  program_id: string | null;
  storage_path: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  kind: string;
  uploaded_by_id: string | null;
  created_at: string;
}

export type ActivityLog = {
  id: number;
  entity_type: string;
  entity_id: string | null;
  action: string;
  summary: string;
  metadata: Json;
  actor_id: string | null;
  actor_name: string | null;
  created_at: string;
}

export type Notification = {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  entity_type: string | null;
  entity_id: string | null;
  read_at: string | null;
  created_at: string;
}

export type Setting = {
  key: string;
  value: Json;
  updated_by: string | null;
  updated_at: string;
}

/**
 * Row/Insert/Update triple for a table with no outbound relationships.
 *
 * Used for the reference tables, which are only ever reached through a join
 * from `promo_requests`. The tables that do have relationships spell their own
 * entry in `Tables` below.
 *
 * Two things here are load-bearing and easy to get wrong:
 *  - The `Record<string, unknown>` intersections keep `Insert`/`Update`
 *    assignable to the SDK's `GenericTable` constraint. `Partial<T>` is a
 *    mapped type and has no implicit index signature, so without the
 *    intersection the whole schema fails the `GenericSchema` check.
 *  - Every row type in this file must be a `type` alias rather than an
 *    `interface`. Interfaces have no implicit index signature either, so they
 *    are not assignable to `Record<string, unknown>`, and the failure is
 *    silent: queries resolve to `never` instead of raising a type error.
 */
/*
 * Insert/Update payload aliases.
 *
 * Modelled as `Partial<T>` rather than field-by-field shapes: for every table
 * here that is accurate, because the columns with defaults or generated values
 * (id, created_at, request_code, stage_name, due_state, shift_count) are either
 * nullable, defaulted by the database, or maintained by triggers. Server
 * Actions pass validated objects, so validation — not the type — is what
 * guarantees required fields are present on write.
 */
type ProfileInsert = Partial<Profile>;
type ProfileUpdate = Partial<Profile>;
type PipelineStageInsert = Partial<PipelineStage>;
type PipelineStageUpdate = Partial<PipelineStage>;
type ChannelInsert = Partial<Channel>;
type ChannelUpdate = Partial<Channel>;
type ProgramInsert = Partial<Program>;
type ProgramUpdate = Partial<Program>;
type PromoGoalInsert = Partial<PromoGoal>;
type PromoGoalUpdate = Partial<PromoGoal>;
type PromoTypeInsert = Partial<PromoType>;
type PromoTypeUpdate = Partial<PromoType>;
type ProjectInsert = Partial<Project>;
type ProjectUpdate = Partial<Project>;
type PromoRequestInsert = Partial<PromoRequest>;
type PromoRequestUpdate = Partial<PromoRequest>;
type RequestParticipantInsert = Partial<RequestParticipant>;
type RequestParticipantUpdate = Partial<RequestParticipant>;
type RequestShiftInsert = Partial<RequestShift>;
type RequestShiftUpdate = Partial<RequestShift>;
type RequestNoteInsert = Partial<RequestNote>;
type RequestNoteUpdate = Partial<RequestNote>;
type AttachmentInsert = Partial<Attachment>;
type AttachmentUpdate = Partial<Attachment>;
type ActivityLogInsert = Partial<ActivityLog>;
type ActivityLogUpdate = Partial<ActivityLog>;
type NotificationInsert = Partial<Notification>;
type NotificationUpdate = Partial<Notification>;
type ProjectMemberInsert = Partial<ProjectMember>;
type ProjectMemberUpdate = Partial<ProjectMember>;
type ProjectProgramInsert = Partial<ProjectProgram>;
type ProjectProgramUpdate = Partial<ProjectProgram>;
type SettingInsert = Partial<Setting>;
type SettingUpdate = Partial<Setting>;
type Table<T> = {
  Row: T;
  Insert: Partial<T> & Record<string, unknown>;
  Update: Partial<T> & Record<string, unknown>;
  Relationships: NoRelations;
};

/**
 * Relationship metadata, as the SDK defines it.
 *
 * Declared so `Database['public']` satisfies the SDK's `GenericSchema`
 * constraint. The app does not use relationship metadata for inference, so
 * every table declares an empty list.
 */
type Relationship = {
  foreignKeyName: string;
  columns: string[];
  isOneToOne?: boolean;
  referencedRelation: string;
  referencedColumns: string[];
};

/** Shorthand for a table with no outbound relationships. */
type NoRelations = [];

/**
 * All tables, with the foreign-key relationships the app joins through.
 *
 * The relationship lists are not decoration: PostgREST resolves embedded
 * resource selects (`channel:channels(...)`) against this metadata at the type
 * level. Left empty, the SDK reports "could not find the relation between
 * promo_requests and channels" and the joined column degrades to an error type
 * instead of a typed row.
 *
 * Note that `promo_requests.assigned_to_id` and `requested_by_id` both point at
 * `profiles`. The SDK matches by the constraint name when a select names the
 * relation explicitly (`assigned_to:profiles!promo_requests_assigned_to_id_fkey`),
 * which is why the app always disambiguates those two joins.
 */
type Tables = {
  profiles: Table<Profile>;
  pipeline_stages: Table<PipelineStage>;
  channels: Table<Channel>;
  promo_goals: Table<PromoGoal>;
  promo_types: Table<PromoType>;
  settings: Table<Setting>;

  programs: {
    Row: Program;
    Insert: ProgramInsert;
    Update: ProgramUpdate;
    Relationships: [
      {
        foreignKeyName: 'programs_channel_id_fkey';
        columns: ['channel_id'];
        isOneToOne: false;
        referencedRelation: 'channels';
        referencedColumns: ['id'];
      },
      {
        foreignKeyName: 'programs_responsible_id_fkey';
        columns: ['responsible_id'];
        isOneToOne: false;
        referencedRelation: 'profiles';
        referencedColumns: ['id'];
      },
    ];
  };

  projects: {
    Row: Project;
    Insert: ProjectInsert;
    Update: ProjectUpdate;
    Relationships: [
      {
        foreignKeyName: 'projects_manager_id_fkey';
        columns: ['manager_id'];
        isOneToOne: false;
        referencedRelation: 'profiles';
        referencedColumns: ['id'];
      },
    ];
  };

  project_members: {
    Row: ProjectMember;
    Insert: ProjectMemberInsert;
    Update: ProjectMemberUpdate;
    Relationships: [
      {
        foreignKeyName: 'project_members_project_id_fkey';
        columns: ['project_id'];
        isOneToOne: false;
        referencedRelation: 'projects';
        referencedColumns: ['id'];
      },
      {
        foreignKeyName: 'project_members_user_id_fkey';
        columns: ['user_id'];
        isOneToOne: false;
        referencedRelation: 'profiles';
        referencedColumns: ['id'];
      },
    ];
  };

  project_programs: {
    Row: ProjectProgram;
    Insert: ProjectProgramInsert;
    Update: ProjectProgramUpdate;
    Relationships: [
      {
        foreignKeyName: 'project_programs_project_id_fkey';
        columns: ['project_id'];
        isOneToOne: false;
        referencedRelation: 'projects';
        referencedColumns: ['id'];
      },
      {
        foreignKeyName: 'project_programs_program_id_fkey';
        columns: ['program_id'];
        isOneToOne: false;
        referencedRelation: 'programs';
        referencedColumns: ['id'];
      },
    ];
  };

  /** The hub table: every other entity hangs off a promo request. */
  promo_requests: {
    Row: PromoRequest;
    Insert: PromoRequestInsert;
    Update: PromoRequestUpdate;
    Relationships: [
      {
        foreignKeyName: 'promo_requests_channel_id_fkey';
        columns: ['channel_id'];
        isOneToOne: false;
        referencedRelation: 'channels';
        referencedColumns: ['id'];
      },
      {
        foreignKeyName: 'promo_requests_program_id_fkey';
        columns: ['program_id'];
        isOneToOne: false;
        referencedRelation: 'programs';
        referencedColumns: ['id'];
      },
      {
        foreignKeyName: 'promo_requests_project_id_fkey';
        columns: ['project_id'];
        isOneToOne: false;
        referencedRelation: 'projects';
        referencedColumns: ['id'];
      },
      {
        foreignKeyName: 'promo_requests_goal_id_fkey';
        columns: ['goal_id'];
        isOneToOne: false;
        referencedRelation: 'promo_goals';
        referencedColumns: ['id'];
      },
      {
        foreignKeyName: 'promo_requests_promo_type_id_fkey';
        columns: ['promo_type_id'];
        isOneToOne: false;
        referencedRelation: 'promo_types';
        referencedColumns: ['id'];
      },
      {
        foreignKeyName: 'promo_requests_stage_id_fkey';
        columns: ['stage_id'];
        isOneToOne: false;
        referencedRelation: 'pipeline_stages';
        referencedColumns: ['id'];
      },
      {
        foreignKeyName: 'promo_requests_assigned_to_id_fkey';
        columns: ['assigned_to_id'];
        isOneToOne: false;
        referencedRelation: 'profiles';
        referencedColumns: ['id'];
      },
      {
        foreignKeyName: 'promo_requests_requested_by_id_fkey';
        columns: ['requested_by_id'];
        isOneToOne: false;
        referencedRelation: 'profiles';
        referencedColumns: ['id'];
      },
    ];
  };

  request_participants: {
    Row: RequestParticipant;
    Insert: RequestParticipantInsert;
    Update: RequestParticipantUpdate;
    Relationships: [
      {
        foreignKeyName: 'request_participants_request_id_fkey';
        columns: ['request_id'];
        isOneToOne: false;
        referencedRelation: 'promo_requests';
        referencedColumns: ['id'];
      },
      {
        foreignKeyName: 'request_participants_user_id_fkey';
        columns: ['user_id'];
        isOneToOne: false;
        referencedRelation: 'profiles';
        referencedColumns: ['id'];
      },
    ];
  };

  request_shifts: {
    Row: RequestShift;
    Insert: RequestShiftInsert;
    Update: RequestShiftUpdate;
    Relationships: [
      {
        foreignKeyName: 'request_shifts_request_id_fkey';
        columns: ['request_id'];
        isOneToOne: false;
        referencedRelation: 'promo_requests';
        referencedColumns: ['id'];
      },
      {
        foreignKeyName: 'request_shifts_assigned_to_id_fkey';
        columns: ['assigned_to_id'];
        isOneToOne: false;
        referencedRelation: 'profiles';
        referencedColumns: ['id'];
      },
    ];
  };

  request_notes: {
    Row: RequestNote;
    Insert: RequestNoteInsert;
    Update: RequestNoteUpdate;
    Relationships: [
      {
        foreignKeyName: 'request_notes_request_id_fkey';
        columns: ['request_id'];
        isOneToOne: false;
        referencedRelation: 'promo_requests';
        referencedColumns: ['id'];
      },
      {
        foreignKeyName: 'request_notes_author_id_fkey';
        columns: ['author_id'];
        isOneToOne: false;
        referencedRelation: 'profiles';
        referencedColumns: ['id'];
      },
    ];
  };

  attachments: {
    Row: Attachment;
    Insert: AttachmentInsert;
    Update: AttachmentUpdate;
    Relationships: [
      {
        foreignKeyName: 'attachments_request_id_fkey';
        columns: ['request_id'];
        isOneToOne: false;
        referencedRelation: 'promo_requests';
        referencedColumns: ['id'];
      },
      {
        foreignKeyName: 'attachments_project_id_fkey';
        columns: ['project_id'];
        isOneToOne: false;
        referencedRelation: 'projects';
        referencedColumns: ['id'];
      },
      {
        foreignKeyName: 'attachments_program_id_fkey';
        columns: ['program_id'];
        isOneToOne: false;
        referencedRelation: 'programs';
        referencedColumns: ['id'];
      },
      {
        foreignKeyName: 'attachments_uploaded_by_id_fkey';
        columns: ['uploaded_by_id'];
        isOneToOne: false;
        referencedRelation: 'profiles';
        referencedColumns: ['id'];
      },
    ];
  };

  activity_logs: {
    Row: ActivityLog;
    Insert: ActivityLogInsert;
    Update: ActivityLogUpdate;
    Relationships: [
      {
        foreignKeyName: 'activity_logs_actor_id_fkey';
        columns: ['actor_id'];
        isOneToOne: false;
        referencedRelation: 'profiles';
        referencedColumns: ['id'];
      },
    ];
  };

  notifications: {
    Row: Notification;
    Insert: NotificationInsert;
    Update: NotificationUpdate;
    Relationships: [
      {
        foreignKeyName: 'notifications_user_id_fkey';
        columns: ['user_id'];
        isOneToOne: false;
        referencedRelation: 'profiles';
        referencedColumns: ['id'];
      },
    ];
  };
};

export type Database = {
  public: {
    Tables: Tables;
    Views: Record<string, never>;
    Functions: {
      current_profile: { Args: Record<string, never>; Returns: Profile };
      is_admin: { Args: Record<string, never>; Returns: boolean };
      can_manage: { Args: Record<string, never>; Returns: boolean };
      run_deadline_sweep: { Args: Record<string, never>; Returns: number };
      log_activity: {
        Args: {
          p_entity_type: string;
          p_entity_id: string;
          p_action: string;
          p_summary: string;
          p_metadata?: Json | null;
          p_actor_id?: string | null;
        };
        Returns: void;
      };
    };
    Enums: {
      app_role: AppRole;
      priority_level: PriorityLevel;
      record_status: RecordStatus;
      shift_status: ShiftStatus;
      notification_type: string;
      activity_action: string;
    };
    CompositeTypes: Record<string, never>;
  };
}

export type TableName = keyof Tables;
export type TableRow<T extends TableName> = Tables[T]['Row'];
export type TableInsert<T extends TableName> = Tables[T]['Insert'];
export type TableUpdate<T extends TableName> = Tables[T]['Update'];