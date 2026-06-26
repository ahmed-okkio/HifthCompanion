-- M4-3: Web Push subscriptions. One row per browser/device push endpoint a
-- user has opted into. The app sends notifications via web-push using the
-- stored keying material (p256dh + auth). Endpoints that return 410/404 are
-- pruned by the sender.
--
-- NOTE: live Supabase has pgcrypto OFF — use gen_random_uuid() (pgcore), NOT
-- gen_random_bytes (pgcrypto).

create table public.push_subscription (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- The push service endpoint URL; unique per subscription globally.
  endpoint text not null unique,
  -- Keying material from the browser PushSubscription (base64url).
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);

alter table public.push_subscription enable row level security;

create index push_subscription_user_idx on public.push_subscription (user_id);

-- ---------------------------------------------------------------------------
-- RLS — owner-only. A user fully manages their own subscriptions.
-- ---------------------------------------------------------------------------
create policy "User manages own push subscriptions"
  on public.push_subscription for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
