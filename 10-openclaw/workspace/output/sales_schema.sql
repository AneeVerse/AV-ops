BEGIN;

CREATE TABLE IF NOT EXISTS sales_leads (
  id BIGSERIAL PRIMARY KEY,
  company_name TEXT NOT NULL,
  website TEXT,
  niche TEXT,
  contact_person TEXT,
  contact_role TEXT,
  email TEXT,
  phone TEXT,
  city TEXT,
  country TEXT,
  source TEXT,
  source_details TEXT,
  pain_point TEXT,
  opportunity_note TEXT,
  offer_interest TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  priority TEXT NOT NULL DEFAULT 'medium',
  owner TEXT,
  next_action TEXT,
  next_action_due_at TIMESTAMPTZ,
  last_contacted_at TIMESTAMPTZ,
  last_replied_at TIMESTAMPTZ,
  meeting_booked_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  lost_reason TEXT,
  tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sales_leads_status_idx ON sales_leads(status);
CREATE INDEX IF NOT EXISTS sales_leads_owner_idx ON sales_leads(owner);
CREATE INDEX IF NOT EXISTS sales_leads_next_action_due_at_idx ON sales_leads(next_action_due_at);
CREATE INDEX IF NOT EXISTS sales_leads_company_name_idx ON sales_leads(company_name);

CREATE TABLE IF NOT EXISTS sales_pipeline_events (
  id BIGSERIAL PRIMARY KEY,
  lead_id BIGINT NOT NULL REFERENCES sales_leads(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status TEXT NOT NULL,
  event_type TEXT NOT NULL DEFAULT 'stage_change',
  note TEXT,
  actor TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sales_pipeline_events_lead_id_idx ON sales_pipeline_events(lead_id);
CREATE INDEX IF NOT EXISTS sales_pipeline_events_created_at_idx ON sales_pipeline_events(created_at);

CREATE TABLE IF NOT EXISTS sales_followups (
  id BIGSERIAL PRIMARY KEY,
  lead_id BIGINT NOT NULL REFERENCES sales_leads(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  detail TEXT,
  channel TEXT,
  due_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending',
  outcome TEXT,
  owner TEXT,
  completed_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sales_followups_lead_id_idx ON sales_followups(lead_id);
CREATE INDEX IF NOT EXISTS sales_followups_status_idx ON sales_followups(status);
CREATE INDEX IF NOT EXISTS sales_followups_due_at_idx ON sales_followups(due_at);

CREATE TABLE IF NOT EXISTS sales_templates (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  niche TEXT,
  subject TEXT,
  body TEXT NOT NULL,
  call_script TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  owner TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sales_templates_type_idx ON sales_templates(type);
CREATE INDEX IF NOT EXISTS sales_templates_status_idx ON sales_templates(status);

CREATE TABLE IF NOT EXISTS sales_activity_logs (
  id BIGSERIAL PRIMARY KEY,
  lead_id BIGINT REFERENCES sales_leads(id) ON DELETE SET NULL,
  activity_type TEXT NOT NULL,
  channel TEXT,
  subject TEXT,
  content TEXT,
  outcome TEXT,
  owner TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sales_activity_logs_lead_id_idx ON sales_activity_logs(lead_id);
CREATE INDEX IF NOT EXISTS sales_activity_logs_activity_type_idx ON sales_activity_logs(activity_type);
CREATE INDEX IF NOT EXISTS sales_activity_logs_created_at_idx ON sales_activity_logs(created_at);

CREATE OR REPLACE FUNCTION set_sales_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sales_leads_updated_at ON sales_leads;
CREATE TRIGGER trg_sales_leads_updated_at
BEFORE UPDATE ON sales_leads
FOR EACH ROW
EXECUTE FUNCTION set_sales_updated_at();

DROP TRIGGER IF EXISTS trg_sales_followups_updated_at ON sales_followups;
CREATE TRIGGER trg_sales_followups_updated_at
BEFORE UPDATE ON sales_followups
FOR EACH ROW
EXECUTE FUNCTION set_sales_updated_at();

DROP TRIGGER IF EXISTS trg_sales_templates_updated_at ON sales_templates;
CREATE TRIGGER trg_sales_templates_updated_at
BEFORE UPDATE ON sales_templates
FOR EACH ROW
EXECUTE FUNCTION set_sales_updated_at();

COMMIT;
