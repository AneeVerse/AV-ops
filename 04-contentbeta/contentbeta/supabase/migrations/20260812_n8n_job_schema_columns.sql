-- Columns written by n8n job Save nodes that were missing on partial VPS DBs.
-- Safe to re-run.

alter table public.infographic_jobs add column if not exists brand_name text;
alter table public.infographic_jobs add column if not exists design_explanation text;

alter table public.blog_jobs add column if not exists brand_name text;

alter table public.infographics add column if not exists remotion_code text;
alter table public.infographics add column if not exists theme text;
