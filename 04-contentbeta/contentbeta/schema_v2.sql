-- ============================================================
-- ContentBeta V2 Schema
-- Supabase project: https://dhmjgwwqlttndjamrisv.supabase.co
-- ============================================================

-- Brands
create table brands (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now()
);

-- Brand Profiles (style prompt + logo — replaces brand_assets)
create table brand_profiles (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid references brands(id) on delete cascade unique,
  style_prompt text,           -- admin-written brand description for AI
  logo_url text,               -- public URL used for Cloudinary overlay
  logo_storage_path text,      -- storage path for deletion
  updated_at timestamptz default now(),
  created_at timestamptz default now()
);

-- Reference Categories (global or brand-specific)
create table reference_categories (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  is_global boolean default true,
  brand_id uuid references brands(id) on delete cascade,
  created_at timestamptz default now()
);

-- Reference Layouts (text prompts — replaces reference_images)
create table reference_layouts (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references reference_categories(id) on delete cascade,
  name text not null,
  prompt text not null,
  created_at timestamptz default now()
);

-- Users
create table users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  password_hash text,
  role text default 'user',   -- 'admin' | 'user'
  brand_id uuid references brands(id),
  tokens integer default 10,
  created_at timestamptz default now()
);

-- Generated Posts
create table generated_posts (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid references brands(id),
  reference_layout_id uuid references reference_layouts(id),
  reference_category_id uuid references reference_categories(id),
  headline text,
  cta text,
  output_url text,
  created_at timestamptz default now()
);

-- Ad Angles (global — not brand-specific)
create table ad_angles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  created_at timestamptz default now()
);

-- Ad Angle Images
create table ad_angle_images (
  id uuid primary key default gen_random_uuid(),
  angle_id uuid references ad_angles(id) on delete cascade,
  image_url text not null,
  storage_path text not null,
  created_at timestamptz default now()
);

-- PPT Jobs (PDF → PowerPoint generation)
create table ppt_jobs (
  id text primary key,                      -- jobId from frontend
  brand_id uuid references brands(id),
  brand_name text,
  presentation_title text,
  theme jsonb,                              -- { primaryColor, accentColor, darkColor }
  slides jsonb,                             -- array of slide objects
  slide_count integer default 0,
  error_message text,
  created_by uuid references auth.users(id) default auth.uid(),
  created_at timestamptz default now()
);

-- Add to generated_posts (run manually):
-- alter table generated_posts add column if not exists is_ppt boolean default false;
-- alter table generated_posts add column if not exists is_illustration boolean;

-- Illustration Layouts (brand-specific prompts for the Illustrations feature)
create table illustration_layouts (
  id         uuid        primary key default gen_random_uuid(),
  brand_id   uuid        not null references brands(id) on delete cascade,
  name       text        not null,
  prompt     text        not null,
  created_at timestamptz not null default now()
);

alter table illustration_layouts enable row level security;

drop policy if exists "Authenticated users can read illustration_layouts" on illustration_layouts;
drop policy if exists "Admins can modify illustration_layouts" on illustration_layouts;
create policy "Authenticated users can read illustration_layouts"
  on illustration_layouts for select using (auth.role() = 'authenticated');
create policy "Admins can modify illustration_layouts"
  on illustration_layouts for all using (is_admin()) with check (is_admin());

-- ============================================================
-- Storage buckets (create via Supabase dashboard > Storage)
-- 1. brand-logos       (public)
-- 2. generated-posts   (public)
-- 3. ad-angle-images   (public)
-- ============================================================

-- ============================================================
-- Seed: Reference Categories (Alpha / Beta / Gamma per brand)
-- Run after creating your brands:
--
-- insert into reference_categories (label, is_global, brand_id)
-- values ('Alpha', false, '<brand_id>'),
--        ('Beta',  false, '<brand_id>'),
--        ('Gamma', false, '<brand_id>');
--
-- Global categories (shared across all brands):
-- insert into reference_categories (label, is_global) values ('Standard', true);
-- ============================================================
