const IS_SERVER = typeof window === 'undefined';

interface MockSet {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
}

interface MockAnnotation {
  id: string;
  set_id: string;
  page_number: number;
  canvas_json: any;
  updated_at: string;
}

interface MockNote {
  id: string;
  set_id: string;
  page_number: number;
  body: string;
  x: number | null;
  y: number | null;
  created_at: string;
  updated_at: string;
}

export const MOCK_USER_ID = '52345ff6-3348-40d5-b6d8-1234567890ab';

// Global server-side DB
const globalForDb = global as unknown as {
  mockSets?: MockSet[];
  mockAnnotations?: MockAnnotation[];
  mockNotes?: MockNote[];
  mockCircle?: any[];
  mockMembership?: any[];
  mockProgressLog?: any[];
  mockSession?: any[];
  mockHomework?: any[];
  mockMembershipNote?: any[];
};

if (!globalForDb.mockSets) {
  globalForDb.mockSets = [];
}
if (!globalForDb.mockAnnotations) {
  globalForDb.mockAnnotations = [];
}
if (!globalForDb.mockNotes) {
  globalForDb.mockNotes = [];
}
if (!globalForDb.mockCircle) globalForDb.mockCircle = [];
if (!globalForDb.mockMembership) globalForDb.mockMembership = [];
if (!globalForDb.mockProgressLog) globalForDb.mockProgressLog = [];
if (!globalForDb.mockSession) globalForDb.mockSession = [];
if (!globalForDb.mockHomework) globalForDb.mockHomework = [];
if (!globalForDb.mockMembershipNote) globalForDb.mockMembershipNote = [];

// Seeded config defaults mirroring the circle migration.
const SEED_STUDENT_STATUSES = [
  { label: 'Done', polarity: 'positive' },
  { label: 'Partial', polarity: 'neutral' },
  { label: 'Struggled', polarity: 'negative' },
];
const SEED_TEACHER_STATUSES = [
  { label: 'Excellent', polarity: 'positive' },
  { label: 'Good', polarity: 'positive' },
  { label: 'Needs work', polarity: 'negative' },
];

// Generic localStorage/global accessors for the tracker tables.
const TRACKER_STORAGE: Record<string, string> = {
  circle: 'mock_supabase_circle',
  membership: 'mock_supabase_membership',
  progress_log: 'mock_supabase_progress_log',
  session: 'mock_supabase_session',
  homework: 'mock_supabase_homework',
  membership_note: 'mock_supabase_membership_note',
};
const TRACKER_GLOBAL: Record<string, 'mockCircle' | 'mockMembership' | 'mockProgressLog' | 'mockSession' | 'mockHomework' | 'mockMembershipNote'> = {
  circle: 'mockCircle',
  membership: 'mockMembership',
  progress_log: 'mockProgressLog',
  session: 'mockSession',
  homework: 'mockHomework',
  membership_note: 'mockMembershipNote',
};
function trackerGet(table: string): any[] {
  if (IS_SERVER) return (globalForDb as any)[TRACKER_GLOBAL[table]]!;
  try { const v = localStorage.getItem(TRACKER_STORAGE[table]); return v ? JSON.parse(v) : []; } catch { return []; }
}
function trackerSave(table: string, rows: any[]) {
  if (IS_SERVER) (globalForDb as any)[TRACKER_GLOBAL[table]] = rows;
  else { try { localStorage.setItem(TRACKER_STORAGE[table], JSON.stringify(rows)); } catch {} }
}
function rid() { return Math.random().toString(36).substring(2, 11); }

// LocalStorage key helper
const STORAGE_KEY_SETS = 'mock_supabase_sets';
const STORAGE_KEY_ANNOTATIONS = 'mock_supabase_annotations';
const STORAGE_KEY_NOTES = 'mock_supabase_notes';

function getNotes(): MockNote[] {
  if (IS_SERVER) return globalForDb.mockNotes!;
  try {
    const val = localStorage.getItem(STORAGE_KEY_NOTES);
    return val ? JSON.parse(val) : [];
  } catch { return []; }
}

function saveNotes(notes: MockNote[]) {
  if (IS_SERVER) { globalForDb.mockNotes = notes; }
  else { try { localStorage.setItem(STORAGE_KEY_NOTES, JSON.stringify(notes)); } catch {} }
}

function getSets(): MockSet[] {
  if (IS_SERVER) {
    return globalForDb.mockSets!;
  }
  try {
    const val = localStorage.getItem(STORAGE_KEY_SETS);
    return val ? JSON.parse(val) : [];
  } catch {
    return [];
  }
}

function saveSets(sets: MockSet[]) {
  if (IS_SERVER) {
    globalForDb.mockSets = sets;
  } else {
    try {
      localStorage.setItem(STORAGE_KEY_SETS, JSON.stringify(sets));
    } catch {}
  }
}

function getAnnotations(): MockAnnotation[] {
  if (IS_SERVER) {
    return globalForDb.mockAnnotations!;
  }
  try {
    const val = localStorage.getItem(STORAGE_KEY_ANNOTATIONS);
    return val ? JSON.parse(val) : [];
  } catch {
    return [];
  }
}

function saveAnnotations(annos: MockAnnotation[]) {
  if (IS_SERVER) {
    globalForDb.mockAnnotations = annos;
  } else {
    try {
      localStorage.setItem(STORAGE_KEY_ANNOTATIONS, JSON.stringify(annos));
    } catch {}
  }
}

class MockQueryBuilder {
  private table: string;
  private userId: string;
  private filters: { field: string; value: any }[] = [];
  private inFilters: { field: string; values: any[] }[] = [];
  private selectColumns = '';
  private orderField: string | null = null;
  private orderAscending = true;
  private isSingle = false;
  private isMaybeSingle = false;

  private op: 'select' | 'insert' | 'update' | 'delete' | 'upsert' = 'select';
  private opValues: any = null;

  constructor(table: string, userId: string = MOCK_USER_ID) {
    this.table = table;
    this.userId = userId;
  }

  select(columns?: string) {
    // select is default op
    this.selectColumns = columns ?? '';
    return this;
  }

  eq(field: string, value: any) {
    this.filters.push({ field, value });
    return this;
  }

  in(field: string, values: any[]) {
    this.inFilters.push({ field, values });
    return this;
  }

  order(field: string, options?: { ascending?: boolean }) {
    this.orderField = field;
    this.orderAscending = options?.ascending ?? true;
    return this;
  }

  single() {
    this.isSingle = true;
    return this;
  }

  maybeSingle() {
    this.isMaybeSingle = true;
    return this;
  }

  insert(values: any) {
    this.op = 'insert';
    this.opValues = values;
    return this;
  }

  update(values: any) {
    this.op = 'update';
    this.opValues = values;
    return this;
  }

  delete() {
    this.op = 'delete';
    return this;
  }

  upsert(values: any, options?: { onConflict?: string }) {
    this.op = 'upsert';
    this.opValues = values;
    return this;
  }

  private applyFilters(items: any[]) {
    let result = [...items];
    for (const filter of this.filters) {
      result = result.filter(item => item[filter.field] == filter.value);
    }
    for (const f of this.inFilters) {
      result = result.filter(item => f.values.includes(item[f.field]));
    }
    return result;
  }

  async execute() {
    if (this.table === 'annotation_sets') {
      if (this.op === 'insert') {
        const sets = getSets();
        const newSet = {
          id: Math.random().toString(36).substring(2, 9),
          user_id: this.userId,
          name: this.opValues?.name ?? '',
          created_at: new Date().toISOString(),
          ...this.opValues,
        };
        sets.push(newSet);
        saveSets(sets);
        return newSet;
      }
      
      if (this.op === 'update') {
        const sets = getSets();
        const filtered = this.applyFilters(sets);
        for (const item of filtered) {
          Object.assign(item, this.opValues);
        }
        saveSets(sets);
        return filtered;
      }

      if (this.op === 'delete') {
        const sets = getSets();
        const filtered = this.applyFilters(sets);
        const idsToDelete = new Set(filtered.map(item => item.id));
        const remaining = sets.filter(item => !idsToDelete.has(item.id));
        saveSets(remaining);
        return filtered;
      }

      // Default: select
      let sets = getSets();
      sets = this.applyFilters(sets);
      if (this.orderField) {
        sets.sort((a: any, b: any) => {
          const valA = a[this.orderField!];
          const valB = b[this.orderField!];
          if (valA < valB) return this.orderAscending ? -1 : 1;
          if (valA > valB) return this.orderAscending ? 1 : -1;
          return 0;
        });
      }
      if (this.isSingle) {
        return sets[0] ?? null;
      }
      return sets;
    } else if (this.table === 'annotations') {
      if (this.op === 'upsert') {
        const annos = getAnnotations();
        const setId = this.opValues.set_id;
        const pageNum = this.opValues.page_number;
        const existingIdx = annos.findIndex(a => a.set_id === setId && a.page_number === pageNum);
        let updatedOrCreated;
        if (existingIdx > -1) {
          annos[existingIdx] = {
            ...annos[existingIdx],
            ...this.opValues,
            updated_at: new Date().toISOString(),
          };
          updatedOrCreated = annos[existingIdx];
        } else {
          updatedOrCreated = {
            id: Math.random().toString(36).substring(2, 9),
            ...this.opValues,
            updated_at: new Date().toISOString(),
          };
          annos.push(updatedOrCreated);
        }
        saveAnnotations(annos);
        return updatedOrCreated;
      }

      // Default: select
      let annos = getAnnotations();
      annos = this.applyFilters(annos);
      if (this.isSingle || this.isMaybeSingle) {
        return annos[0] ?? null;
      }
      return annos;
    } else if (this.table === 'notes') {
      if (this.op === 'insert') {
        const notes = getNotes();
        const newNote = {
          id: Math.random().toString(36).substring(2, 9),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          ...this.opValues,
        };
        notes.push(newNote);
        saveNotes(notes);
        return newNote;
      }
      if (this.op === 'update') {
        const notes = getNotes();
        const filtered = this.applyFilters(notes);
        for (const n of filtered) Object.assign(n, this.opValues);
        saveNotes(notes);
        return filtered[0] ?? null;
      }
      if (this.op === 'delete') {
        const notes = getNotes();
        const filtered = this.applyFilters(notes);
        const ids = new Set(filtered.map((n: any) => n.id));
        saveNotes(notes.filter((n: any) => !ids.has(n.id)));
        return null;
      }
      // select
      let notes = getNotes();
      notes = this.applyFilters(notes) as MockNote[];
      if (this.orderField) {
        notes.sort((a: any, b: any) => {
          if (a[this.orderField!] < b[this.orderField!]) return this.orderAscending ? -1 : 1;
          if (a[this.orderField!] > b[this.orderField!]) return this.orderAscending ? 1 : -1;
          return 0;
        });
      }
      if (this.isSingle) return notes[0] ?? null;
      return notes;
    } else if (this.table in TRACKER_GLOBAL) {
      return this.executeTracker();
    }
    return [];
  }

  private sortRows(rows: any[]) {
    if (!this.orderField) return rows;
    return rows.sort((a: any, b: any) => {
      if (a[this.orderField!] < b[this.orderField!]) return this.orderAscending ? -1 : 1;
      if (a[this.orderField!] > b[this.orderField!]) return this.orderAscending ? 1 : -1;
      return 0;
    });
  }

  private executeTracker() {
    const table = this.table;
    const rows = trackerGet(table);

    if (this.op === 'insert' || this.op === 'upsert') {
      const now = new Date().toISOString();
      // upsert: replace existing row matching the conflict keys, else insert.
      const rowsToWrite = Array.isArray(this.opValues) ? this.opValues : [this.opValues];
      if (this.op === 'upsert') {
        // Only caller is generateSessions: onConflict (membership_id, scheduled_at).
        const written: any[] = [];
        for (const v of rowsToWrite) {
          const idx = rows.findIndex(
            (r: any) => r.membership_id === v.membership_id && r.scheduled_at === v.scheduled_at,
          );
          if (idx >= 0) {
            Object.assign(rows[idx], v);
            written.push(rows[idx]);
          } else {
            const r = { id: rid(), is_adhoc: false, canceled: false, attendance_status: null, created_at: now, ...v };
            rows.push(r);
            written.push(r);
          }
        }
        trackerSave(table, rows);
        return written.length === 1 ? written[0] : written;
      }
      if (Array.isArray(this.opValues)) {
        const inserted = rowsToWrite.map((v: any) => {
          const r = { id: rid(), created_at: now, ...v };
          rows.push(r);
          return r;
        });
        trackerSave(table, rows);
        return inserted;
      }
      let row: any = { id: rid(), ...this.opValues };
      if (table === 'circle') {
        row = {
          invite_code: rid().slice(0, 12),
          teacher_id: this.userId,
          student_statuses: SEED_STUDENT_STATUSES,
          teacher_statuses: SEED_TEACHER_STATUSES,
          created_at: now,
          ...row,
        };
      } else if (table === 'membership') {
        row = {
          user_id: this.userId,
          role: 'student',
          status: 'active',
          schedule: null,
          joined_at: now,
          ...row,
        };
      } else if (table === 'session') {
        row = { is_adhoc: false, canceled: false, attendance_status: null, created_at: now, ...row };
      } else if (table === 'homework') {
        row = { prescribed_by: this.userId, deadline: null, created_at: now, ...row };
      } else if (table === 'membership_note') {
        row = { author_id: this.userId, created_at: now, ...row };
      } else {
        // progress_log
        row = { homework_id: null, log_date: now.slice(0, 10), created_at: now, updated_at: now, reviewed_at: null, ...row };
      }
      rows.push(row);
      trackerSave(table, rows);
      return row;
    }

    if (this.op === 'update') {
      const filtered = this.applyFilters(rows);
      for (const r of filtered) Object.assign(r, this.opValues);
      trackerSave(table, rows);
      return filtered[0] ?? null;
    }

    if (this.op === 'delete') {
      const filtered = this.applyFilters(rows);
      const ids = new Set(filtered.map((r: any) => r.id));
      trackerSave(table, rows.filter((r: any) => !ids.has(r.id)));
      return null;
    }

    // select
    let result = this.sortRows(this.applyFilters(rows));
    // Embed: membership.select('*, circle:circle_id(*)') is the "my memberships"
    // landing query — RLS scopes it to the current user. Mirror that here when no
    // explicit circle_id filter is present (teacher roster reads keep that filter).
    if (
      table === 'membership' &&
      this.selectColumns.includes('circle') &&
      !this.filters.some((f) => f.field === 'circle_id')
    ) {
      result = result.filter((m: any) => m.user_id === this.userId);
    }
    if (table === 'membership' && this.selectColumns.includes('circle')) {
      const circles = trackerGet('circle');
      result = result.map((m: any) => ({
        ...m,
        circle: circles.find((h: any) => h.id === m.circle_id) ?? null,
      }));
    }
    if (this.isSingle || this.isMaybeSingle) return result[0] ?? null;
    return result;
  }

  then(onfulfilled: (value: any) => any, onrejected?: (reason: any) => any) {
    this.execute()
      .then(data => onfulfilled({ data, error: null }))
      .catch(err => {
        if (onrejected) onrejected(err);
        else onfulfilled({ data: null, error: err });
      });
  }
}

export class MockSupabaseClient {
  private authenticated = false;
  private userId: string;

  constructor(authenticated: boolean, userId: string = MOCK_USER_ID) {
    this.authenticated = authenticated;
    this.userId = userId;
  }

  auth = {
    getUser: async () => {
      if (!this.authenticated) {
        return { data: { user: null }, error: null };
      }
      return {
        data: {
          user: { id: this.userId, email: emailForUser(this.userId) },
        },
        error: null,
      };
    },
    getSession: async () => {
      if (!this.authenticated) {
        return { data: { session: null }, error: null };
      }
      return {
        data: {
          session: { user: { id: this.userId, email: emailForUser(this.userId) } },
        },
        error: null,
      };
    },
  };

  from(table: string) {
    return new MockQueryBuilder(table, this.userId);
  }

  async rpc(fn: string, args?: Record<string, any>) {
    if (fn === 'user_id_by_email') {
      // Mock: resolve any known e2e identity by email (teacher/student fixtures).
      const email = (args?._email ?? '').toLowerCase();
      return { data: userIdForEmail(email), error: null };
    }
    if (fn === 'account_by_email') {
      const email = (args?._email ?? '').toLowerCase();
      const id = userIdForEmail(email);
      return { data: id ? [{ id, first_name: null, last_name: null }] : [], error: null };
    }
    if (fn === 'accounts_by_email_prefix') {
      const prefix = (args?._prefix ?? '').toLowerCase();
      const data = prefix.length >= 3
        ? Object.entries(E2E_USERS)
            .filter(([email]) => email.startsWith(prefix))
            .slice(0, 5)
            .map(([email, id]) => ({ id, email, first_name: null, last_name: null }))
        : [];
      return { data, error: null };
    }
    return { data: null, error: null };
  }
}

// --- E2E multi-user fixtures -------------------------------------------------
// Deterministic teacher/student identities so a two-actor flow can be exercised.
// Test-only: reached only when the mock client is active (E2E env gate upstream).
export const E2E_USERS: Record<string, string> = {
  'teacher@example.com': MOCK_USER_ID,
  'student@example.com': '6a1b2c3d-4e5f-6789-abcd-0123456789ef',
  'test@example.com': MOCK_USER_ID,
};
function userIdForEmail(email: string): string | null {
  return E2E_USERS[email.toLowerCase()] ?? null;
}
function emailForUser(userId: string): string {
  for (const [email, id] of Object.entries(E2E_USERS)) {
    if (id === userId) return email;
  }
  return 'test@example.com';
}

// --- Test-only server-store seed/reset --------------------------------------
// The server reads tracker tables from a process global. Playwright runs in the
// browser and cannot touch that global, so a test-only route handler POSTs here
// to seed/reset deterministic fixtures. Guarded upstream by the E2E env gate.
export function __resetMockStore() {
  globalForDb.mockSets = [];
  globalForDb.mockAnnotations = [];
  globalForDb.mockNotes = [];
  globalForDb.mockCircle = [];
  globalForDb.mockMembership = [];
  globalForDb.mockProgressLog = [];
  globalForDb.mockSession = [];
  globalForDb.mockHomework = [];
  globalForDb.mockMembershipNote = [];
}

export function __seedMockStore(payload: Partial<{
  circle: any[];
  membership: any[];
  progress_log: any[];
  session: any[];
  homework: any[];
  membership_note: any[];
}>) {
  if (payload.circle) globalForDb.mockCircle!.push(...payload.circle);
  if (payload.membership) globalForDb.mockMembership!.push(...payload.membership);
  if (payload.progress_log) globalForDb.mockProgressLog!.push(...payload.progress_log);
  if (payload.session) globalForDb.mockSession!.push(...payload.session);
  if (payload.homework) globalForDb.mockHomework!.push(...payload.homework);
  if (payload.membership_note) globalForDb.mockMembershipNote!.push(...payload.membership_note);
}
