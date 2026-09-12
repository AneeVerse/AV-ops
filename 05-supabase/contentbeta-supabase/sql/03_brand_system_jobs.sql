-- Versioned audit/job store for the extensible AI Brand Setup pipeline.
-- Apply this migration in the Supabase SQL editor before production rollout.

create table if not exists public.brand_system_jobs (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  requested_by uuid references auth.users(id) on delete set null,
  requested_by_email text,
  schema_version integer not null default 3,
  requested_features jsonb not null default '[]'::jsonb,
  asset_manifest jsonb not null default '[]'::jsonb,
  website_url text,
  status text not null default 'queued' check (status in ('queued', 'analyzing', 'compiling', 'review', 'complete', 'failed')),
  current_stage text,
  progress integer not null default 0 check (progress between 0 and 100),
  result jsonb,
  error text,
  n8n_execution_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists brand_system_jobs_brand_created_idx
  on public.brand_system_jobs (brand_id, created_at desc);

create index if not exists brand_system_jobs_requester_created_idx
  on public.brand_system_jobs (requested_by, created_at desc);

alter table public.brand_system_jobs enable row level security;

drop policy if exists "brand system jobs requester read" on public.brand_system_jobs;
create policy "brand system jobs requester read"
  on public.brand_system_jobs for select
  to authenticated
  using (requested_by = auth.uid());

-- Writes are performed by server routes with SUPABASE_SERVICE_ROLE_KEY.
-- Admin dashboards can receive an additional read policy when their access
-- model is finalized; keeping this narrow avoids exposing other users' inputs.

create or replace function public.touch_brand_system_job_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists brand_system_jobs_touch_updated_at on public.brand_system_jobs;
create trigger brand_system_jobs_touch_updated_at
before update on public.brand_system_jobs
for each row execute function public.touch_brand_system_job_updated_at();
