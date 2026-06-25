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

const MOCK_USER_ID = '52345ff6-3348-40d5-b6d8-1234567890ab';

// Global server-side DB
const globalForDb = global as unknown as {
  mockSets?: MockSet[];
  mockAnnotations?: MockAnnotation[];
  mockNotes?: MockNote[];
  mockHalaqah?: any[];
  mockMembership?: any[];
  mockProgressLog?: any[];
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
if (!globalForDb.mockHalaqah) globalForDb.mockHalaqah = [];
if (!globalForDb.mockMembership) globalForDb.mockMembership = [];
if (!globalForDb.mockProgressLog) globalForDb.mockProgressLog = [];

// Seeded config defaults mirroring the halaqah migration.
const SEED_LOG_TYPES = [
  { label: 'Sabaq', role: 'memorize' },
  { label: 'Sabqi', role: 'revise' },
  { label: 'Manzil', role: 'revise' },
];
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
  halaqah: 'mock_supabase_halaqah',
  membership: 'mock_supabase_membership',
  progress_log: 'mock_supabase_progress_log',
};
const TRACKER_GLOBAL: Record<string, 'mockHalaqah' | 'mockMembership' | 'mockProgressLog'> = {
  halaqah: 'mockHalaqah',
  membership: 'mockMembership',
  progress_log: 'mockProgressLog',
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
  private filters: { field: string; value: any }[] = [];
  private inFilters: { field: string; values: any[] }[] = [];
  private selectColumns = '';
  private orderField: string | null = null;
  private orderAscending = true;
  private isSingle = false;
  private isMaybeSingle = false;
  
  private op: 'select' | 'insert' | 'update' | 'delete' | 'upsert' = 'select';
  private opValues: any = null;

  constructor(table: string) {
    this.table = table;
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
          user_id: '52345ff6-3348-40d5-b6d8-1234567890ab',
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
    } else if (this.table === 'halaqah' || this.table === 'membership' || this.table === 'progress_log') {
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

    if (this.op === 'insert') {
      const now = new Date().toISOString();
      let row: any = { id: rid(), ...this.opValues };
      if (table === 'halaqah') {
        row = {
          invite_code: rid().slice(0, 12),
          teacher_id: MOCK_USER_ID,
          schedule: null,
          log_types: SEED_LOG_TYPES,
          student_statuses: SEED_STUDENT_STATUSES,
          teacher_statuses: SEED_TEACHER_STATUSES,
          created_at: now,
          ...row,
        };
      } else if (table === 'membership') {
        row = {
          user_id: MOCK_USER_ID,
          role: 'student',
          shared_set_id: null,
          status: 'active',
          joined_at: now,
          ...row,
        };
      } else {
        row = { log_date: now.slice(0, 10), created_at: now, updated_at: now, reviewed_at: null, ...row };
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
    // Embed: membership.select('*, halaqah:halaqah_id(*)')
    if (table === 'membership' && this.selectColumns.includes('halaqah')) {
      const halaqat = trackerGet('halaqah');
      result = result.map((m: any) => ({
        ...m,
        halaqah: halaqat.find((h: any) => h.id === m.halaqah_id) ?? null,
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

  constructor(authenticated: boolean) {
    this.authenticated = authenticated;
  }

  auth = {
    getUser: async () => {
      if (!this.authenticated) {
        return { data: { user: null }, error: null };
      }
      return {
        data: {
          user: {
            id: '52345ff6-3348-40d5-b6d8-1234567890ab',
            email: 'test@example.com',
          },
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
          session: {
            user: {
              id: '52345ff6-3348-40d5-b6d8-1234567890ab',
              email: 'test@example.com',
            },
          },
        },
        error: null,
      };
    },
  };

  from(table: string) {
    return new MockQueryBuilder(table);
  }

  async rpc(fn: string, args?: Record<string, any>) {
    if (fn === 'user_id_by_email') {
      // Mock: only the seeded test user resolves.
      const email = (args?._email ?? '').toLowerCase();
      return { data: email === 'test@example.com' ? MOCK_USER_ID : null, error: null };
    }
    return { data: null, error: null };
  }
}
