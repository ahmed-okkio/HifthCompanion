export interface AnnotationSet {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
}

export interface Annotation {
  id: string;
  set_id: string;
  page_number: number;
  canvas_json: any; // Using any for Fabric.js JSON object
  updated_at: string;
}

export interface Note {
  id: string;
  set_id: string;
  page_number: number;
  body: string;
  x: number | null;
  y: number | null;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Progression Tracker (M1)
// ---------------------------------------------------------------------------

export type LogRole = 'memorize' | 'revise' | 'read';
export type Polarity = 'negative' | 'positive' | 'neutral';
export type MembershipRole = 'teacher' | 'student';
export type MembershipStatus = 'active' | 'inactive' | 'blocked';

export interface LogTypeConfig {
  label: string;
  role: LogRole;
}

export interface StatusConfig {
  label: string;
  polarity: Polarity;
}

/**
 * Weekly recurrence rule stored on halaqah.schedule (M3). `weekdays` are
 * 0=Sunday..6=Saturday; `time` is local "HH:MM". null → no recurring sessions.
 */
export interface Recurrence {
  weekdays: number[];
  time: string;
}

export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused';

export interface Session {
  id: string;
  halaqah_id: string;
  scheduled_at: string;
  is_adhoc: boolean;
  canceled: boolean;
  created_at: string;
}

export interface Attendance {
  id: string;
  session_id: string;
  membership_id: string;
  status: AttendanceStatus;
  created_at: string;
  updated_at: string;
}

export interface Halaqah {
  id: string;
  teacher_id: string;
  name: string;
  invite_code: string;
  schedule: Recurrence | null;
  log_types: LogTypeConfig[];
  student_statuses: StatusConfig[];
  teacher_statuses: StatusConfig[];
  created_at: string;
}

export interface Membership {
  id: string;
  halaqah_id: string;
  user_id: string;
  role: MembershipRole;
  shared_set_id: string | null;
  status: MembershipStatus;
  joined_at: string;
}

export interface Profile {
  id: string;
  first_name: string;
  last_name: string;
}

/** A membership enriched with the member's display name (when a profile row is
 *  readable). Used by teacher-facing roster / timeline views. */
export type MemberWithProfile = Membership & {
  first_name?: string;
  last_name?: string;
};

export interface ProgressLog {
  id: string;
  membership_id: string;
  log_date: string;
  log_type: string;
  page_start: number;
  page_end: number;
  surah: number | null;
  ayah_start: number | null;
  ayah_end: number | null;
  student_status: string | null;
  student_notes: string | null;
  teacher_status: string | null;
  teacher_comment: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}
