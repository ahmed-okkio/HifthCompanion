-- Teacher-credited hifth: when a teacher approves a memorization submission,
-- the log's ayah range is folded into the student's persistent user_hifth
-- profile. RLS gives teachers no direct write to user_hifth, so this
-- security-definer RPC is the only teacher-write path — guarded by the same
-- teaches_user() active-membership check as the teacher-read policy.
--
-- Ranges are appended raw (jsonb concat). Overlap/dup normalization happens on
-- the owner's next save (saveMemorization) and stat readers dedup by set, so an
-- un-merged append never double-counts.
-- ponytail: append-only, no in-SQL merge. Add a normalize step here only if the
-- raw array grows unbounded in practice.

create or replace function public.teacher_add_hifth(_student uuid, _ranges jsonb)
  returns void language plpgsql security definer
  set search_path = public
as $$
begin
  if not public.teaches_user(_student) then
    raise exception 'not authorized to credit this student';
  end if;

  insert into public.user_hifth (user_id, memorized_ranges, updated_at)
    values (_student, _ranges, now())
  on conflict (user_id) do update
    set memorized_ranges = public.user_hifth.memorized_ranges || excluded.memorized_ranges,
        updated_at = now();
end;
$$;

grant execute on function public.teacher_add_hifth(uuid, jsonb) to authenticated;
