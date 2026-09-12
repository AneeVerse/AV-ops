-- UI Walkthrough Generator: upload up to 10 screenshots, recreate as an
-- animated canvas walkthrough (cursor/typing overlay on the real screenshot
-- images), reusing the same generated_posts history surface as motion
-- infographics. Apply this migration in the Supabase SQL editor.

create table if not exists public.ui_walkthrough_jobs (
  id text primary key,                 -- client-generated, e.g. `uiw_${Date.now()}_${brandId}`
  brand_id uuid not null references public.brands(id) on delete cascade,
  screens jsonb not null default '[]'::jsonb,   -- [{storagePath, order, narration}]
  stitched_code text,                  -- final drawFrame(...) source once generated
  total_frames integer,
  canvas_width integer,
  canvas_height integer,
  status text not null default 'pending' check (status in ('pending', 'analyzing', 'stitching', 'done', 'error')),
  error_message text,
  created_by uuid references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now()
);

create index if not exists ui_walkthrough_jobs_brand_created_idx
  on public.ui_walkthrough_jobs (brand_id, created_at desc);

alter table public.ui_walkthrough_jobs enable row level security;

drop policy if exists "ui walkthrough jobs admin full access" on public.ui_walkthrough_jobs;
create policy "ui walkthrough jobs admin full access"
  on public.ui_walkthrough_jobs for all
  to authenticated
  using (is_admin())
  with check (is_admin());

drop policy if exists "ui walkthrough jobs brand read" on public.ui_walkthrough_jobs;
create policy "ui walkthrough jobs brand read"
  on public.ui_walkthrough_jobs for select
  to authenticated
  using (brand_id::text = my_brand_id());

-- Inserts/updates are performed by app/api/ui-walkthrough/generate/route.ts using
-- SUPABASE_SERVICE_ROLE_KEY, bypassing RLS — no write policy needed for regular users.

alter table public.generated_posts add column if not exists is_ui_walkthrough boolean default false;
alter table public.generated_posts add column if not exists total_frames integer;
alter table public.generated_posts add column if not exists canvas_width integer;
alter table public.generated_posts add column if not exists canvas_height integer;
