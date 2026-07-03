export interface AnnotationSet {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
  is_default?: boolean;
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

export type LogRole = 'memorize' | 'revise';
export type Polarity = 'negative' | 'positive' | 'neutral';
export type MembershipRole = 'teacher' | 'student';
export type MembershipStatus = 'pending' | 'active' | 'inactive' | 'blocked';

/** Fixed homework / log type enum (D7). Drives the hardcoded type→role map (D8). */
export type LogType = 'memorization' | 'general_revision' | 'targeted_revision';

export interface LogTypeConfig {
  label: string;
  role: LogRole;
}

export interface StatusConfig {
  label: string;
  polarity: Polarity;
}

/**
 * Weekly recurrence rule stored on membership.schedule (D4). `weekdays` are
 * 0=Sunday..6=Saturday; `time` is local "HH:MM". null → no recurring sessions.
 */
export interface Recurrence {
  weekdays: number[];
  time: string;
}

export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused';

export interface Session {
  id: string;
  membership_id: string;
  scheduled_at: string;
  is_adhoc: boolean;
  canceled: boolean;
  // Attendance collapsed onto the row (attendance table dropped, D3). null = unmarked.
  attendance_status: AttendanceStatus | null;
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

export interface Circle {
  id: string;
  teacher_id: string;
  name: string;
  invite_code: string;
  student_statuses: StatusConfig[];
  teacher_statuses: StatusConfig[];
  created_at: string;
  // ponytail: schedule/log_types columns are dropped at the DB (D4/D7); kept as
  // optional here so analytics.ts (M6) still compiles until its rework lands.
  schedule?: Recurrence | null;
  log_types?: LogTypeConfig[];
}

export interface Membership {
  id: string;
  circle_id: string;
  user_id: string;
  role: MembershipRole;
  status: MembershipStatus;
  // Per-student weekly recurrence (D4). null → no recurring lesson slot.
  schedule: Recurrence | null;
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
  // Open self-submission (null) vs a submission linked to a prescription (D6).
  homework_id: string | null;
  log_date: string;
  log_type: LogType;
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

/** A homework prescription for one student (D6/D9). Status is derived, not stored. */
export interface Homework {
  id: string;
  membership_id: string;
  prescribed_by: string;
  group_id: string | null; // rows from one multi-surah prescribe share this (A1); null = legacy solo row
  type: LogType;
  deadline: string | null; // date (local end-of-day)
  page_start: number;
  page_end: number;
  surah: number | null;
  ayah_start: number | null;
  ayah_end: number | null;
  instructions: string | null;
  created_at: string;
}

/** One post in a per-student teacher↔student thread (D11). */
export interface MembershipNote {
  id: string;
  membership_id: string;
  author_id: string;
  body: string;
  created_at: string;
}
