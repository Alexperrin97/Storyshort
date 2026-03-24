export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export interface Database {
  public: {
    Tables: {
      projects: {
        Row: Project;
        Insert: Omit<Project, 'id' | 'created_at' | 'updated_at' | 'share_token'>;
        Update: Partial<Omit<Project, 'id' | 'created_at'>>;
        Relationships: [];
      };
      scenes: {
        Row: Scene;
        Insert: Omit<Scene, 'id' | 'created_at'>;
        Update: Partial<Omit<Scene, 'id' | 'created_at'>>;
        Relationships: [];
      };
      team_members: {
        Row: TeamMember;
        Insert: Omit<TeamMember, 'id' | 'created_at'>;
        Update: Partial<Omit<TeamMember, 'id' | 'created_at'>>;
        Relationships: [];
      };
      shooting_days: {
        Row: ShootingDay;
        Insert: Omit<ShootingDay, 'id' | 'created_at'>;
        Update: Partial<Omit<ShootingDay, 'id' | 'created_at'>>;
        Relationships: [];
      };
      incidents: {
        Row: Incident;
        Insert: Omit<Incident, 'id' | 'created_at'>;
        Update: Partial<Omit<Incident, 'id' | 'created_at'>>;
        Relationships: [];
      };
      rushes: {
        Row: Rush;
        Insert: Omit<Rush, 'id' | 'created_at'>;
        Update: Partial<Omit<Rush, 'id' | 'created_at'>>;
        Relationships: [];
      };
      postprod_tasks: {
        Row: PostProdTask;
        Insert: Omit<PostProdTask, 'id' | 'created_at'>;
        Update: Partial<Omit<PostProdTask, 'id' | 'created_at'>>;
        Relationships: [];
      };
      budget_lines: {
        Row: BudgetLine;
        Insert: Omit<BudgetLine, 'id' | 'created_at'>;
        Update: Partial<Omit<BudgetLine, 'id' | 'created_at'>>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

export interface Project {
  id: string;
  name: string;
  description: string | null;
  director: string | null;
  producer: string | null;
  start_date: string | null;
  end_date: string | null;
  share_token: string;
  created_at: string;
  updated_at: string;
}

export interface Scene {
  id: string;
  project_id: string;
  number: string;
  title: string | null;
  location: string | null;
  interior_exterior: 'INT' | 'EXT' | 'INT/EXT' | null;
  day_night: 'JOUR' | 'NUIT' | 'AUBE' | 'CRÉPUSCULE' | null;
  cast_list: string | null;
  synopsis: string | null;
  technical_notes: string | null;
  status: 'à tourner' | 'en cours' | 'tourné' | 'à reprendre';
  estimated_duration: number | null;
  shoot_date: string | null;
  order_index: number;
  created_at: string;
}

export interface TeamMember {
  id: string;
  project_id: string;
  name: string;
  role: string;
  department: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
  created_at: string;
}

export interface ShootingDay {
  id: string;
  project_id: string;
  date: string;
  location: string | null;
  call_time: string | null;
  wrap_time: string | null;
  general_notes: string | null;
  created_at: string;
}

export interface Incident {
  id: string;
  project_id: string;
  date: string;
  time: string | null;
  incident_type: string;
  description: string;
  impact: string | null;
  resolved: boolean;
  resolution_notes: string | null;
  created_at: string;
}

export interface Rush {
  id: string;
  project_id: string;
  date: string;
  card_name: string;
  size_gb: number | null;
  backed_up: boolean;
  backup_location: string | null;
  scenes_covered: string | null;
  codec: string | null;
  notes: string | null;
  created_at: string;
}

export interface PostProdTask {
  id: string;
  project_id: string;
  title: string;
  category: 'Montage' | 'Son' | 'Étalonnage' | 'VFX' | 'Mixage' | 'Livraison' | 'Autre';
  assignee: string | null;
  due_date: string | null;
  status: 'à faire' | 'en cours' | 'validé' | 'livré';
  notes: string | null;
  order_index: number;
  created_at: string;
}

export interface BudgetLine {
  id: string;
  project_id: string;
  department: string;
  category: string;
  description: string;
  estimated: number;
  actual: number;
  supplier: string | null;
  notes: string | null;
  created_at: string;
}

export const DEPARTMENTS = [
  'Réalisation',
  'Production',
  'Image',
  'Son',
  'Décor',
  'Costumes',
  'Maquillage',
  'Casting',
  'Post-production',
  'Technique',
  'Transport',
  'Restauration',
  'Divers',
];

export const SCENE_STATUSES = ['à tourner', 'en cours', 'tourné', 'à reprendre'] as const;
export const TASK_STATUSES = ['à faire', 'en cours', 'validé', 'livré'] as const;
export const POSTPROD_CATEGORIES = ['Montage', 'Son', 'Étalonnage', 'VFX', 'Mixage', 'Livraison', 'Autre'] as const;

export const STATUS_COLORS: Record<string, string> = {
  'à tourner': 'bg-slate-700 text-slate-200',
  'en cours': 'bg-amber-900 text-amber-200',
  'tourné': 'bg-emerald-900 text-emerald-200',
  'à reprendre': 'bg-red-900 text-red-200',
  'à faire': 'bg-slate-700 text-slate-200',
  'validé': 'bg-emerald-900 text-emerald-200',
  'livré': 'bg-blue-900 text-blue-200',
};
