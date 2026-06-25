# PRD: Quranic Student Progression Tracker

**Status:** Draft · **Date:** 2026-06-25 · **Owner:** Ahmed Hamad
**Source:** `E:\Downloads\quran_progression_tracker_feature_request.md` + grilling session
**Host app:** HifthCompanion (Next.js 16, React 19, Supabase, Tailwind 4)

---

## 1. Summary

Add a teacher↔student Hifz progression tracker **as a module inside the existing
HifthCompanion annotator** (not a separate app). Students log daily Quran work
(new memorization, revision, reading) in <3 taps; teachers review, grade, and
monitor their circles (*halaqat*) from a dashboard. Reuses existing auth, the
Mushaf page domain (1–604), Surah data, the reader, and RTL plans.

Replaces paper logs / WhatsApp tracking with a structured, low-friction
accountability loop.

## 2. Problem

1. **Inefficient tracking** — teachers can't keep precise per-student records over time.
2. **No accountability loop** — students lack a low-friction way to report home revision.
3. **Fragmented feedback** — scattered across verbal, paper, chat.

## 3. Personas

- **Teacher** (Sheikh/Imam/Ustadha) — manages one or more halaqat; needs glanceable
  dashboard, quick check-off, minimal technical literacy.
- **Student** — child→adult; needs ultra-simple daily logging; mobile-first.

## 4. Settled Decisions (from grilling)

| # | Decision | Choice |
|---|----------|--------|
| Integration | Relationship to annotator | **One app / new module.** Reuse auth, page domain, reader, Surah data, RTL. |
| Roles | Assignment | **Per-membership role.** No global role column. User is teacher in halaqat they create, student in those they join. Same account does both. |
| Multi-class | Student in many halaqat | **Yes.** Each log tagged to a halaqah; student picks class per submission (default = last-used to cut friction). |
| Log unit | Canonical unit | **Page-primary** (`page_start`/`page_end`, required) **+ optional** `surah`/`ayah_start`/`ayah_end` refinement. Surah/juz derived from page map. |
| Log types | Sabaq/Sabqi/Manzil | **Teacher-configurable per halaqah**, seeded with 3 standard defaults on creation. Dashboard handles variable columns. |
| Status | Self-status + teacher grade | **Two fields, both configurable per halaqah** (`student_statuses[]`, `teacher_statuses[]`), seeded defaults. Plus optional teacher comment text. |
| Linkage | Connect to annotator | **Linked in v1.** Logs reference a page within the student's shared Set; teacher views the annotated page from dashboard. |
| Read scope | Teacher access to student data | **Student designates one shared Set per membership** (`membership.shared_set_id`); teacher of that halaqah reads that whole Set. Logs reference pages within it. |
| Join | Mechanism | **Invite code/link (auto-join) AND teacher in-app invite.** No approval gate; teacher curates roster via remove/block. Code rotatable. |
| Notifications | v1 channels | **In-app only** (badges/counts: student streak-at-risk, teacher pending count). Email digest + PWA push deferred. |
| Analytics | v1 depth | **Full** — streak, calendar heatmap, cumulative pages/juz, weakest-surah, Mushaf coverage map. |
| i18n | v1 | **EN + AR with RTL** from start. i18n framework + `dir=rtl` + language switcher. |
| Platform | v1 | **Responsive web + PWA** (installable, offline shell). No app store. Native deferred. |
| Log edits | Editing/backdating | Student edits/deletes own log **until teacher reviews** (locked after). `log_date` editable, defaults today. **Streak counts by `log_date`.** |
| Attendance | v1 | **Full sessions** — halaqah has sessions; attendance per session per student. |
| Sessions | Scheduling | **Recurring weekly rule** auto-generates sessions; teacher adds/cancels ad-hoc ones. |
| Minors | Accounts | **Email required for all** (kids use parent email). Uses current Supabase email auth. |
| Offboarding | Membership ends | **Archive** — membership → inactive; logs retained read-only; teacher Set-access revoked immediately; student keeps own data; reversible. |
| Phasing | Delivery | **Phased milestones** (see §9). |

## 5. Data Model (high-level)

Existing: `annotation_sets`, `annotations`, `notes` (owner-only RLS).

New tables:

- **`halaqah`** — `id, teacher_id (creator), name, invite_code, schedule (weekly recurrence rule jsonb), created_at`.
- **`halaqah_config`** (or columns on halaqah):
  - `log_types[]` — each `{label (single free-text), role: memorize|revise|read}`. Seeded defaults.
  - `student_statuses[]` — each `{label, polarity: negative|positive|neutral}`. Seeded defaults.
  - `teacher_statuses[]` — each `{label, polarity: negative|positive|neutral}`. Seeded defaults.
  - Labels are single free-text in the teacher's language (no per-locale label; app chrome still EN/AR).
- **`membership`** — `id, halaqah_id, user_id, role (teacher|student), shared_set_id (nullable → annotation_sets), status (active|inactive), joined_at`.
- **`progress_log`** — `id, membership_id (→ student+halaqah), log_date, log_type, page_start, page_end, surah?, ayah_start?, ayah_end?, student_status, student_notes?, teacher_status?, teacher_comment?, reviewed_at?, created_at, updated_at`.
- **`session`** — `id, halaqah_id, scheduled_at, is_adhoc, canceled`.
- **`attendance`** — `id, session_id, membership_id, present (bool/status)`.

**RLS — security-critical:**
- Owner-only preserved for self.
- Teacher of a halaqah may **read** `annotation_sets`/`annotations`/`notes`
  WHERE the set is the `shared_set_id` of an **active** membership in **their** halaqah.
- Teacher may read/grade `progress_log` for active memberships in their halaqat
  (write limited to `teacher_status`/`teacher_comment`/`reviewed_at`).
- Inactive membership → teacher read access drops immediately.

## 6. Functional Requirements

### 6.1 Auth & roles
- Reuse Supabase email auth. Role is per-membership, not global.
- Teacher creates halaqah → unique invite code/link (**rotatable; no expiry/max-uses** in v1).
- Join: enter code → instant student membership. Teacher can also invite **existing users by email** (no account provisioning; unregistered people sign up + use code). No approval gate; teacher can remove/block. Blocked user can't rejoin.

### 6.2 Student — daily logging (≤3 taps)
- Pick halaqah (default last-used), log type (from halaqah config), page range (counter/picker), optional ayah refinement, self-status, optional note.
- Optionally attach the relevant page (within shared Set) for teacher to view annotated.
- `log_date` defaults today, editable for catch-up.
- Edit/delete own log until reviewed; locked after.
- Streak counter (consecutive `log_date` days).

### 6.3 Teacher — dashboard
- **Roster**: active students, sorted by recent submission / pending reviews; pending badge.
- **Daily feed**: timeline of today's submissions; quick grade (set `teacher_status` + comment) + check-off.
- **Student profile**: historical timeline, cumulative pages/juz, heatmap, past feedback; view attached annotated pages.
- Roster management: remove/block, rotate code, in-app invite.

### 6.4 Sessions & attendance
- Halaqah weekly recurrence auto-generates sessions; teacher adds/cancels ad-hoc.
- Teacher marks attendance per student per session; feeds analytics.

### 6.5 Analytics (v1 full)
- Per student: streak, calendar consistency heatmap, cumulative pages + juz.
- **Weakest-surah**: score = (negative `teacher_status` count / total graded) per surah; only graded logs count; "negative" = status polarity flag in halaqah config.
- **Mushaf coverage map**: pages from `role=memorize` logs paint coverage; `role=revise` logs drive a recency/freshness layer; `role=read` excluded.
- Teacher sees per-student and roll-up.

### 6.6 Localization
- EN + AR, full RTL, language switcher. All new strings translated; log-type/status labels stored per-locale.

### 6.7 PWA
- Manifest, installable, offline app shell (read cache). Offline writes/sync = future.

## 7. Non-functional / UX
- **Extreme simplicity**: counters, dropdowns, sliders over free text. Student log ≤3 taps.
- **Mobile-first** student flows; teacher dashboard works on desktop + tablet.
- Accessible to non-technical and young users.

## 8. Data Dependencies (gap — action needed)
Have: `src/data/surahFirstPages.json` (surah→start page; page→surah derivable).
**Missing, required for committed features:**
- **Juz boundaries by page** → cumulative juz totals, juz-based logging.
- **Ayah-per-page map** → ayah-level logging precision + coverage map.
- **Ayah counts per surah** → weakest-surah aggregation, ranges.
Source these (e.g., QuranHub / known datasets) before M1 ayah features and M2 analytics.

## 9. Tickets

Ordered by milestone. **DATA** ticket is a *dependency gate*, not a priority — sequence it right before M2 (and before any ayah/juz feature pulls it in). M1 ships on existing data.

**Board state (2026-06-26):** M1, DATA, M1-7b, M2 ✅ shipped to `master`. Next up: M3 (sessions & attendance). Caveat: tracker UI has unit + component-test coverage only; full teacher↔student e2e blocked by single-user mock client (see §14).

### M1 — Core loop (no new data files) ✅ DONE
- **M1-1** DB: `halaqah`, `membership` tables + RLS (owner-only preserved).
- **M1-2** DB: `halaqah_config` (log_types/statuses w/ role+polarity flags) + seeded defaults on halaqah create.
- **M1-3** DB: `progress_log` table + RLS (student write own / teacher grade own halaqat).
- **M1-4** Cross-user RLS: teacher reads `annotation_sets`/`annotations`/`notes` via active `membership.shared_set_id`. **Security-critical — review.**
- **M1-5** Teacher: create halaqah, invite code (rotatable), in-app invite by existing email, roster + remove/block.
- **M1-6** Student: join via code; pick/designate shared Set per membership.
- **M1-7** Student: daily log form (≤3 taps) — page range, log type, self-status, note, date (default today), attach page.
- **M1-8** Student: edit/delete own log until reviewed; streak counter (by `log_date`).
- **M1-9** Teacher: roster view + daily submission feed + grade (teacher_status/comment) + check-off.
- **M1-10** Teacher: student profile timeline + view attached annotated page.
- **M1-11** i18n framework + `dir=rtl` + EN/AR app chrome + language switcher.
- **M1-12** Offboarding: membership → inactive revokes teacher Set access; logs retained.

### DATA — Quran reference data (gate before M2 + ayah features) ✅ DONE
Sourced from alquran.cloud `/v1/meta` (Hafs/Madani); cross-checked 0 mismatches vs existing `surahFirstPages.json`. Files in `src/data/`, helpers in `src/lib/quran.ts`.
- **DATA-1** ✅ Juz boundaries by page (`juzStartPages.json`) → `getJuzStartPage`, `getJuzForPage`.
- **DATA-2** ✅ Ayah-per-page map (`pageFirstAyah.json`) → `getAyahsOnPage`, `getPageForAyah`, `globalAyahIndex`.
- **DATA-3** ✅ Ayah counts per surah (`ayahCountsBySurah.json`, sums 6236) → `getAyahCount`. Bonus: `surahNames.json` (en/ar) + `getSurahName`.
- **M1-7b** ✅ Optional ayah-range refinement in log form (`StudentHalaqah.tsx`); surah auto-derived from page, ayah pickers bounded to ayahs on the range.

### M2 — Analytics (depends DATA) ✅ DONE
Logic in `src/lib/analytics.ts` (unit-tested); per-student UI `StudentAnalytics.tsx`; roll-up in `TeacherHalaqah.tsx`.
- **M2-1** ✅ Calendar consistency heatmap.
- **M2-2** ✅ Cumulative pages + juz totals.
- **M2-3** ✅ Weakest-surah (negative teacher_status ratio over graded logs).
- **M2-4** ✅ Mushaf coverage map (memorize paints; revise = recency; read excluded).
- **M2-5** ✅ Teacher roll-up (per-student pages/juz/pending in roster).

### M3 — Sessions & attendance
- **M3-1** DB: `session` + recurrence rule on halaqah; auto-generate sessions.
- **M3-2** Teacher add/cancel ad-hoc sessions.
- **M3-3** DB: `attendance` + RLS; mark per student per session.
- **M3-4** Attendance feeds analytics.

### M4 — Engagement & polish
- **M4-1** PWA manifest + installable + offline app shell.
- **M4-2** In-app notification badges (student streak-at-risk, teacher pending count).
- **M4-3** (later) email digest / PWA push.

## 10. Phasing (summary)

- **M1 — Core loop:** roles, halaqah + invite/join, configurable log types & statuses, page-primary logging (+optional ayah), student edit/streak, teacher roster + daily feed + grading, shared-Set link + cross-user RLS, EN/AR RTL. *(Needs juz/ayah data for ayah refinement.)*
- **M2 — Analytics suite:** streak (carried), heatmap, pages/juz totals, weakest-surah, coverage map.
- **M3 — Sessions & attendance:** recurrence engine, sessions, attendance, attendance analytics.
- **M4 — Engagement & polish:** PWA install/offline shell, in-app notification badges → later email digest / PWA push.

## 11. Success Metrics
- **DAU**: % registered students completing a daily log.
- **Teacher engagement**: avg review/check-off time per session.
- **Retention**: % halaqat active over 3 months.

## 12. Resolved (was Open Questions)
1. **In-app invite** → existing users by email only; unregistered sign up + use code.
2. **Weakest-surah** → teacher status only, weighted by negative-polarity ratio over graded logs.
3. **Coverage map** → `role=memorize` logs paint coverage; `role=revise` = recency layer; `role=read` excluded.
4. **Config labels** → single free-text in teacher's language (no per-locale label); app chrome stays EN/AR.
5. **Invite-code safety** → rotate + remove/block only; no expiry/max-uses/rate-limit in v1.
6. **Logs vs sessions** → fully independent (no `session_id` on logs); joined only by date on timeline.

## 13. Remaining Open Questions
- None blocking. Confirm seeded-default labels & polarity/role mappings at build time (e.g., Sabaq→memorize, Re-do→negative).

## 14. Known Gaps / Test Debt (2026-06-26)
- **Tracker e2e gap.** Full teacher↔student-analytics flow not e2e-reachable: server components read the mock client via the process global (not browser localStorage, so Playwright can't seed data), and the single mock user can't be both teacher and student. Analytics covered by unit (`analytics.test.ts`) + component-render (`StudentAnalytics.test.tsx`) instead. To unblock real e2e: add a multi-user mock + a server-reachable seed path.
- **Teacher shared-set WRITE migration** (`20260625000005_teacher_shared_set_write.sql`) still **not pushed to remote** (needs per-push consent). Teacher edits of a student's set won't persist until `npx supabase db push`.
- **Pre-existing red (not tracker):** `NotesPanel.test.tsx` (9 fail — constructs a real `@supabase/ssr` client at import, no URL/key in test env); tsc errors in `AnnotationToolbar.test.tsx` + `e2e/features.spec.ts`.
- **Mock client** (`src/lib/supabase/mock.ts`) does not implement analytics-specific query paths; fine because analytics compute client-side from logs it already serves.
