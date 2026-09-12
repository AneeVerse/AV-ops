-- Admin-configurable brand <-> restricted-page access, replacing hardcoded
-- brand-name checks scattered across Sidebar.tsx and individual page guards.

create table if not exists public.brand_page_access (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  page_key text not null,
  created_at timestamptz not null default now(),
  unique (brand_id, page_key)
);

create index if not exists brand_page_access_brand_idx on public.brand_page_access (brand_id);

alter table public.brand_page_access enable row level security;

drop policy if exists "Authenticated users can read brand_page_access" on public.brand_page_access;
create policy "Authenticated users can read brand_page_access"
  on public.brand_page_access for select using (auth.role() = 'authenticated');

drop policy if exists "Admins can insert brand_page_access" on public.brand_page_access;
create policy "Admins can insert brand_page_access"
  on public.brand_page_access for insert with check (is_admin());

drop policy if exists "Admins can delete brand_page_access" on public.brand_page_access;
create policy "Admins can delete brand_page_access"
  on public.brand_page_access for delete using (is_admin());

-- Seed: reproduce exactly what was previously hardcoded so no brand loses
-- access it currently has. Matched against real brand names as of 2026-08-01.
insert into public.brand_page_access (brand_id, page_key)
select b.id, x.page_key
from public.brands b
join (values
  ('truckstop', 'generate-broker'),
  ('truckstop', 'map-graphics'),
  ('truckstop', 'pdf-to-ppt'),
  ('truckstop', 'carousel-v2'),
  ('abbyy',     'carousel-v2'),
  ('agency analytics', 'carousel-v2'),
  ('truckstop', 'ad-concept-generator'),
  ('dat',       'ad-concept-generator'),
  ('abbyy',     'ad-concept-generator'),
  ('truckstop', 'generate-banner'),
  ('aldoa',     'generate-banner'),
  ('truckstop', 'infographic-generator'),
  ('aldoa',     'infographic-generator')
) as x(brand_name, page_key) on lower(b.name) = x.brand_name
on conflict (brand_id, page_key) do nothing;
