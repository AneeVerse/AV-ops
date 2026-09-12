-- ============================================================
-- ContentBeta — COMPLETE public schema (reverse-engineered)
-- Generated from codebase .from() / insert / update / select usage
-- + schema_v2.sql + rls_policies.sql + existing migrations.
--
-- Safe to re-run: CREATE TABLE IF NOT EXISTS / ADD COLUMN IF NOT EXISTS.
-- Does NOT include RLS policies (see rls_policies.sql).
-- ============================================================

create extension if not exists "pgcrypto";

-- ── 1. Core identity ─────────────────────────────────────────────────────────

create table if not exists public.brands (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.admins (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  created_at timestamptz not null default now()
);

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  password_hash text,                          -- legacy; auth is via supabase auth
  role text not null default 'user',           -- 'admin' | 'user' (app filters role='user')
  brand_id uuid references public.brands(id) on delete set null,
  tokens integer not null default 10,
  created_at timestamptz not null default now()
);

-- Helper functions (needed by RLS). Create AFTER admins/users exist.
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (select 1 from public.admins where email = auth.email());
$$;

create or replace function public.my_brand_id()
returns text
language sql
security definer
stable
set search_path = public
as $$
  select brand_id::text from public.users where email = auth.email() limit 1;
$$;

-- ── 2. Brand profile + page access ───────────────────────────────────────────

create table if not exists public.brand_profiles (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null unique references public.brands(id) on delete cascade,
  style_prompt text,
  brand_scrap text,
  logo_url text,
  logo_storage_path text,
  -- Infographic
  infographic_md text,
  infographic_logo_light_url text,
  infographic_logo_dark_url text,
  infographic_font_heading text,
  infographic_font_heading_url text,
  infographic_font_body text,
  infographic_font_body_url text,
  -- PPT
  ppt_md text,
  ppt_font_heading text,
  ppt_font_heading_url text,
  ppt_font_body text,
  ppt_font_body_url text,
  ppt_enabled_templates jsonb,                 -- string[] | null (null = all enabled)
  -- Banner / blog workflow prompts
  banner_bg_prompt text,
  blog_plan_prompt text,
  blog_canvas_prompt text,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.brand_page_access (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  page_key text not null,
  created_at timestamptz not null default now(),
  unique (brand_id, page_key)
);

create index if not exists brand_page_access_brand_idx
  on public.brand_page_access (brand_id);

-- ── 3. Static post references (categories + layout prompts) ──────────────────

create table if not exists public.reference_categories (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  is_global boolean default false,
  brand_id uuid references public.brands(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.reference_layouts (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.reference_categories(id) on delete cascade,
  name text not null,
  prompt text not null,
  created_at timestamptz not null default now()
);

-- ── 4. Overlay / editable social templates ───────────────────────────────────

create table if not exists public.overlay_templates (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  name text not null,
  bg_prompt text,
  puppeteer_config jsonb,
  created_at timestamptz not null default now()
);

create index if not exists overlay_templates_brand_idx
  on public.overlay_templates (brand_id);

-- ── 5. Carousel layouts + per-slide prompts ──────────────────────────────────

create table if not exists public.carousel_layouts (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.carousel_slide_prompts (
  id uuid primary key default gen_random_uuid(),
  layout_id uuid not null references public.carousel_layouts(id) on delete cascade,
  slide_index integer not null,
  prompt text not null default '',
  puppeteer_config jsonb,
  created_at timestamptz not null default now(),
  unique (layout_id, slide_index)
);

-- Written by n8n webhooks; polled by carousel-v2 / blog-to-carousel
create table if not exists public.carousel_jobs (
  id text primary key,                         -- client job id e.g. v2_img_<ts>_<brandId>
  brand_id uuid references public.brands(id) on delete set null,
  layout_id uuid references public.carousel_layouts(id) on delete set null,
  logo_url text,
  slides jsonb,                                -- slide copy / metadata from n8n
  image_urls text[],                           -- raw background image URLs
  status text,
  error_message text,
  created_at timestamptz not null default now()
);

-- ── 6. Infographic layouts + jobs ────────────────────────────────────────────

create table if not exists public.infographic_layouts (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  name text not null,
  description text,
  image_url text,
  logo_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.infographic_jobs (
  id text primary key,                         -- client job id
  brand_id uuid references public.brands(id) on delete set null,
  js_code text,                                -- drawGraphic(...) source
  layout_ref_used text,
  brand_name text,
  design_explanation text,
  status text,
  error_message text,
  created_at timestamptz not null default now()
);

-- ── 7. Blog JSON layout groups + slots + jobs ────────────────────────────────

create table if not exists public.blog_layout_groups (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  name text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.blog_layout_slots (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.blog_layout_groups(id) on delete cascade,
  slot_index integer not null,
  name text not null,
  description text,
  layout_json text,                            -- JSON string of canvas layout
  created_at timestamptz not null default now(),
  unique (group_id, slot_index)
);

create table if not exists public.blog_jobs (
  id text primary key,                         -- e.g. blog_<ts>_<brandId>
  brand_id uuid references public.brands(id) on delete set null,
  js_codes jsonb,                              -- array of { slideNumber, jsCode, ... }
  brand_name text,
  status text,
  error_message text,
  created_at timestamptz not null default now()
);

-- Legacy table referenced by rls_policies.sql but unused in current TS.
-- Minimal stub so RLS apply does not fail.
create table if not exists public.blog_layouts (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid references public.brands(id) on delete cascade,
  name text,
  prompt text,
  is_active boolean default true,
  created_at timestamptz not null default now()
);

-- ── 8. Banner templates ──────────────────────────────────────────────────────

create table if not exists public.banner_templates (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  size_key text not null,                      -- e.g. billboard, leaderboard, mediumrect
  config jsonb not null default '{}'::jsonb,   -- BannerSizeTemplate
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (brand_id, size_key)
);

-- ── 9. PPT layouts / templates / prompts / jobs ──────────────────────────────

create table if not exists public.ppt_layouts (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  name text not null,
  description text,
  image_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.ppt_slide_templates (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  template_name text not null,                 -- matches PPT_SLIDE_TEMPLATES.name / '_plan_system'
  prompt_text text,
  layout_config text,                          -- JSON string (or jsonb in some envs; app accepts both)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (brand_id, template_name)
);

create table if not exists public.ppt_system_prompts (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,                   -- e.g. image_style, plan, etc.
  content text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ppt_jobs (
  id text primary key,                         -- jobId from frontend
  brand_id uuid references public.brands(id) on delete set null,
  brand_name text,
  presentation_title text,
  theme jsonb,                                 -- { primaryColor, accentColor, darkColor }
  slides jsonb,                                -- array of slide objects
  slide_count integer default 0,
  error_message text,
  created_by uuid references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now()
);

-- ── 10. Ad angles / concepts ─────────────────────────────────────────────────

create table if not exists public.ad_angles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  prompt text,
  puppeteer_config jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.ad_angle_images (
  id uuid primary key default gen_random_uuid(),
  angle_id uuid not null references public.ad_angles(id) on delete cascade,
  image_url text not null,
  storage_path text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.ad_concepts (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid references public.brands(id) on delete set null,
  ad_angle_id uuid references public.ad_angles(id) on delete set null,
  output_url text,
  created_at timestamptz not null default now()
);

-- ── 11. Broker prompts (global; UI currently shared, not brand-scoped) ───────

create table if not exists public.broker_prompts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  prompt text not null,
  reference_image_urls text[],
  created_at timestamptz not null default now()
);

-- ── 12. Illustration layouts ─────────────────────────────────────────────────

create table if not exists public.illustration_layouts (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  name text not null,
  prompt text not null,
  created_at timestamptz not null default now()
);

-- ── 13. Brand system (AI setup) jobs ─────────────────────────────────────────

create table if not exists public.brand_system_jobs (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  requested_by uuid references auth.users(id) on delete set null,
  requested_by_email text,
  schema_version integer not null default 3,
  requested_features jsonb not null default '[]'::jsonb,
  asset_manifest jsonb not null default '[]'::jsonb,
  website_url text,
  status text not null default 'queued'
    check (status in ('queued', 'analyzing', 'compiling', 'review', 'complete', 'failed')),
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

-- ── 14. UI walkthrough jobs ──────────────────────────────────────────────────

create table if not exists public.ui_walkthrough_jobs (
  id text primary key,                         -- e.g. uiw_<ts>_<brandId>
  brand_id uuid not null references public.brands(id) on delete cascade,
  screens jsonb not null default '[]'::jsonb,
  stitched_code text,
  total_frames integer,
  canvas_width integer,
  canvas_height integer,
  status text not null default 'pending'
    check (status in ('pending', 'analyzing', 'stitching', 'done', 'error')),
  error_message text,
  created_by uuid references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now()
);

create index if not exists ui_walkthrough_jobs_brand_created_idx
  on public.ui_walkthrough_jobs (brand_id, created_at desc);

-- ── 15. Generated posts (unified history) ────────────────────────────────────

create table if not exists public.generated_posts (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid references public.brands(id) on delete set null,
  -- Legacy static-post FKs (n8n / older flows may still set these)
  reference_layout_id uuid references public.reference_layouts(id) on delete set null,
  reference_category_id uuid references public.reference_categories(id) on delete set null,
  headline text,
  cta text,
  output_url text,
  created_by_email text,
  -- Type flags (nullable booleans; history filters with .eq / .is null)
  is_broker boolean,
  is_carousel boolean,
  is_ad_concept boolean,
  is_editable_social boolean,
  is_infographic boolean,
  is_banner boolean,
  is_blog boolean,
  is_ppt boolean,
  is_map_graphic boolean,
  is_illustration boolean,
  is_ui_walkthrough boolean,
  -- Feature payloads
  render_params jsonb,
  remotion_code text,                          -- infographic / ui-walkthrough canvas code
  animated_url text,                           -- recorded video/gif URL
  infographic_theme text,                      -- 'light' | 'dark'
  carousel_session_id text,
  total_frames integer,
  canvas_width integer,
  canvas_height integer,
  created_at timestamptz not null default now()
);

create index if not exists generated_posts_brand_created_idx
  on public.generated_posts (brand_id, created_at desc);

create index if not exists generated_posts_carousel_session_idx
  on public.generated_posts (carousel_session_id)
  where carousel_session_id is not null;

-- ── 16. Legacy: infographics (RLS only; unused in current app code) ──────────

create table if not exists public.infographics (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid references public.brands(id) on delete cascade,
  title text,
  js_code text,
  remotion_code text,
  theme text,
  output_url text,
  created_at timestamptz not null default now()
);

-- ── 17. Idempotent column upgrades (for DBs that already have partial schema) ─

alter table public.brand_profiles add column if not exists brand_scrap text;
alter table public.brand_profiles add column if not exists infographic_md text;
alter table public.brand_profiles add column if not exists infographic_logo_light_url text;
alter table public.brand_profiles add column if not exists infographic_logo_dark_url text;
alter table public.brand_profiles add column if not exists infographic_font_heading text;
alter table public.brand_profiles add column if not exists infographic_font_heading_url text;
alter table public.brand_profiles add column if not exists infographic_font_body text;
alter table public.brand_profiles add column if not exists infographic_font_body_url text;
alter table public.brand_profiles add column if not exists ppt_md text;
alter table public.brand_profiles add column if not exists ppt_font_heading text;
alter table public.brand_profiles add column if not exists ppt_font_heading_url text;
alter table public.brand_profiles add column if not exists ppt_font_body text;
alter table public.brand_profiles add column if not exists ppt_font_body_url text;
alter table public.brand_profiles add column if not exists ppt_enabled_templates jsonb;
alter table public.brand_profiles add column if not exists banner_bg_prompt text;
alter table public.brand_profiles add column if not exists blog_plan_prompt text;
alter table public.brand_profiles add column if not exists blog_canvas_prompt text;

alter table public.ad_angles add column if not exists prompt text;
alter table public.ad_angles add column if not exists puppeteer_config jsonb;

alter table public.generated_posts add column if not exists created_by_email text;
alter table public.generated_posts add column if not exists is_broker boolean;
alter table public.generated_posts add column if not exists is_carousel boolean;
alter table public.generated_posts add column if not exists is_ad_concept boolean;
alter table public.generated_posts add column if not exists is_editable_social boolean;
alter table public.generated_posts add column if not exists is_infographic boolean;
alter table public.generated_posts add column if not exists is_banner boolean;
alter table public.generated_posts add column if not exists is_blog boolean;
alter table public.generated_posts add column if not exists is_ppt boolean;
alter table public.generated_posts add column if not exists is_map_graphic boolean;
alter table public.generated_posts add column if not exists is_illustration boolean;
alter table public.generated_posts add column if not exists is_ui_walkthrough boolean;
alter table public.generated_posts add column if not exists render_params jsonb;
alter table public.generated_posts add column if not exists remotion_code text;
alter table public.generated_posts add column if not exists animated_url text;
alter table public.generated_posts add column if not exists infographic_theme text;
alter table public.generated_posts add column if not exists carousel_session_id text;
alter table public.generated_posts add column if not exists total_frames integer;
alter table public.generated_posts add column if not exists canvas_width integer;
alter table public.generated_posts add column if not exists canvas_height integer;

alter table public.carousel_slide_prompts add column if not exists puppeteer_config jsonb;
alter table public.broker_prompts add column if not exists reference_image_urls text[];

alter table public.infographic_jobs add column if not exists brand_name text;
alter table public.infographic_jobs add column if not exists design_explanation text;
alter table public.blog_jobs add column if not exists brand_name text;
alter table public.infographics add column if not exists remotion_code text;
alter table public.infographics add column if not exists theme text;

-- ── 18. Storage buckets (create via dashboard or storage API) ────────────────
-- Required PUBLIC buckets:
--   1. brand-logos              — brand logos + custom fonts for overlays
--   2. generated-posts          — outputs, fonts, layout refs, PDFs, walkthrough assets
--   3. ad-angle-images          — ad angle reference / element images
--   4. broker-reference-images  — broker prompt reference images
--
-- Example (run with service role / dashboard):
--   insert into storage.buckets (id, name, public)
--   values
--     ('brand-logos', 'brand-logos', true),
--     ('generated-posts', 'generated-posts', true),
--     ('ad-angle-images', 'ad-angle-images', true),
--     ('broker-reference-images', 'broker-reference-images', true)
--   on conflict (id) do nothing;
