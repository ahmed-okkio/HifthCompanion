-- Create annotation_sets table
create table public.annotation_sets (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null default auth.uid(),
  name text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.annotation_sets enable row level security;

-- Policy: Users can only see their own sets
create policy "Users can view own annotation sets"
  on public.annotation_sets for select
  using (auth.uid() = user_id);

-- Policy: Users can insert their own sets
create policy "Users can insert own annotation sets"
  on public.annotation_sets for insert
  with check (auth.uid() = user_id);

-- Policy: Users can update their own sets
create policy "Users can update own annotation sets"
  on public.annotation_sets for update
  using (auth.uid() = user_id);

-- Policy: Users can delete their own sets
create policy "Users can delete own annotation sets"
  on public.annotation_sets for delete
  using (auth.uid() = user_id);
