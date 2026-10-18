-- agenda_item: the owning student may read their OPEN items (read-only).
-- Done items stay teacher-only; no insert/update/delete grant for students.
create policy "Agenda student read open"
  on public.agenda_item for select
  using (done_at is null and public.owns_membership(membership_id));
