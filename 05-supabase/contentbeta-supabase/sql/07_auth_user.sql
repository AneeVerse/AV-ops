-- Migrate cloud auth user (post-GoTrue migrations schema)
BEGIN;

INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  recovery_token,
  email_change_token_new,
  email_change,
  is_super_admin,
  is_sso_user,
  is_anonymous
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  '8531f446-f984-467f-a7ee-e1a373988950',
  'authenticated',
  'authenticated',
  'studio.aneeverse@gmail.com',
  '$2a$10$oaJT6tryq03/PgBD5Rd5iengvKu1AUhKJYgMC0xhPUOukmj0l1.wq',
  '2026-08-08 12:52:07.794279+00',
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"role":"admin","email_verified":true}'::jsonb,
  '2026-08-08 12:52:07.77254+00',
  '2026-08-08 14:53:03.402636+00',
  '',
  '',
  '',
  '',
  false,
  false,
  false
) ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  encrypted_password = EXCLUDED.encrypted_password,
  email_confirmed_at = EXCLUDED.email_confirmed_at,
  raw_app_meta_data = EXCLUDED.raw_app_meta_data,
  raw_user_meta_data = EXCLUDED.raw_user_meta_data,
  updated_at = EXCLUDED.updated_at;

INSERT INTO auth.identities (
  id,
  user_id,
  identity_data,
  provider,
  provider_id,
  last_sign_in_at,
  created_at,
  updated_at
) VALUES (
  'c91f87fe-37ff-4319-aabc-1e55d9338415',
  '8531f446-f984-467f-a7ee-e1a373988950',
  '{"sub":"8531f446-f984-467f-a7ee-e1a373988950","email":"studio.aneeverse@gmail.com","email_verified":true,"phone_verified":false}'::jsonb,
  'email',
  '8531f446-f984-467f-a7ee-e1a373988950',
  '2026-08-08 12:52:07.785386+00',
  '2026-08-08 12:52:07.785486+00',
  '2026-08-08 12:52:07.785486+00'
) ON CONFLICT (provider, provider_id) DO UPDATE SET
  user_id = EXCLUDED.user_id,
  identity_data = EXCLUDED.identity_data,
  updated_at = now();

COMMIT;

-- Ensure API roles can use public schema
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
