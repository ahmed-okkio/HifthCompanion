-- Progression Tracker M1-10 (teacher canvas editing) — SECURITY-SENSITIVE.
-- The teacher may WRITE annotations/notes inside a student's shared set (same
-- gate as read: active membership in a halaqah the teacher owns). The set row
-- itself stays owner-only — teacher cannot rename/delete the set, only its
-- annotation/note content. Wider blast radius than read-only; chosen explicitly.

-- annotations: teacher insert/update/delete within the shared set.
create policy "Teacher writes shared set annotations (insert)"
  on public.annotations for insert
  with check (public.teacher_can_read_set(set_id));

create policy "Teacher writes shared set annotations (update)"
  on public.annotations for update
  using (public.teacher_can_read_set(set_id))
  with check (public.teacher_can_read_set(set_id));

create policy "Teacher writes shared set annotations (delete)"
  on public.annotations for delete
  using (public.teacher_can_read_set(set_id));

-- notes: teacher insert/update/delete within the shared set.
create policy "Teacher writes shared set notes (insert)"
  on public.notes for insert
  with check (public.teacher_can_read_set(set_id));

create policy "Teacher writes shared set notes (update)"
  on public.notes for update
  using (public.teacher_can_read_set(set_id))
  with check (public.teacher_can_read_set(set_id));

create policy "Teacher writes shared set notes (delete)"
  on public.notes for delete
  using (public.teacher_can_read_set(set_id));
