-- =============================================================================
-- VeriJob AI Recruitment Scam Detection Platform
-- Migration: 001_initial_schema.sql
-- Database: Supabase Cloud PostgreSQL
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0. EXTENSIONS
-- -----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- enables fast ILIKE searches

-- -----------------------------------------------------------------------------
-- 1. CUSTOM ENUM TYPES
-- -----------------------------------------------------------------------------

DO $$ BEGIN
  CREATE TYPE scam_type_enum AS ENUM (
    'ADVANCE_FEE_EQUIPMENT',
    'FAKE_CHECK_REFUND',
    'DATA_HARVESTING_IDENTITY_THEFT',
    'UNPAID_TASK_WORK',
    'PYRAMID_MLM_RECRUITMENT',
    'CHECK_CASHING_MONEY_LAUNDERING',
    'IMPERSONATED_BRAND_PHISHING',
    'TELEGRAM_WHATSAPP_ONLY_INTERVIEW'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE risk_level_enum AS ENUM (
    'CRITICAL_SCAM',
    'HIGH_RISK',
    'SUSPICIOUS',
    'LOW_RISK'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE verification_status_enum AS ENUM (
    'VERIFIED_OFFICIAL',
    'PENDING_REVIEW',
    'UNVERIFIED_FREE_DOMAIN',
    'SUSPECTED_IMPERSONATION',
    'CONFIRMED_FRAUDULENT'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE recruitment_channel_enum AS ENUM (
    'LinkedIn',
    'Indeed',
    'Telegram',
    'WhatsApp',
    'Cold Email',
    'SMS',
    'Job Board',
    'Other'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE blacklist_indicator_type_enum AS ENUM (
    'EMAIL_DOMAIN',
    'EMAIL',
    'PHONE',
    'PAYMENT_HANDLE',
    'DOMAIN'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- -----------------------------------------------------------------------------
-- 2. TABLE: companies
--    Stores verified & unverified employer/company records.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.companies (
  id                   UUID                      PRIMARY KEY DEFAULT uuid_generate_v4(),
  name                 TEXT                      NOT NULL,
  official_domain      TEXT                      NOT NULL UNIQUE,
  verification_status  verification_status_enum  NOT NULL DEFAULT 'PENDING_REVIEW',
  trust_score          INTEGER                   NOT NULL DEFAULT 0 CHECK (trust_score BETWEEN 0 AND 100),
  industry             TEXT,
  headquarters         TEXT,
  verified_emails      TEXT[]                    NOT NULL DEFAULT '{}',
  trust_breakdown      JSONB                     NOT NULL DEFAULT '{}',
  created_at           TIMESTAMPTZ               NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ               NOT NULL DEFAULT NOW()
);

-- Indexes for companies
CREATE INDEX IF NOT EXISTS idx_companies_verification_status ON public.companies (verification_status);
CREATE INDEX IF NOT EXISTS idx_companies_trust_score        ON public.companies (trust_score DESC);
CREATE INDEX IF NOT EXISTS idx_companies_name_trgm          ON public.companies USING GIN (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_companies_domain_trgm        ON public.companies USING GIN (official_domain gin_trgm_ops);

-- Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_companies_updated_at ON public.companies;
CREATE TRIGGER trg_companies_updated_at
  BEFORE UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 3. TABLE: community_reports
--    User-submitted scam reports pending moderation.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.community_reports (
  id                        UUID               PRIMARY KEY DEFAULT uuid_generate_v4(),
  reporter_id               UUID               REFERENCES auth.users (id) ON DELETE SET NULL,
  company_claimed           TEXT               NOT NULL,
  scam_type                 scam_type_enum     NOT NULL,
  fraudulent_domain         TEXT,
  scammer_email             TEXT,
  scammer_phone             TEXT,
  payment_method_requested  TEXT,
  financial_loss_amount     NUMERIC(12, 2)     NOT NULL DEFAULT 0,
  description               TEXT               NOT NULL CHECK (char_length(description) >= 20),
  recruitment_channel       recruitment_channel_enum,
  financial_requests        TEXT[]             DEFAULT '{}',
  is_moderated              BOOLEAN            NOT NULL DEFAULT FALSE,
  upvotes                   INTEGER            NOT NULL DEFAULT 0,
  created_at                TIMESTAMPTZ        NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ        NOT NULL DEFAULT NOW()
);

-- Indexes for community_reports
CREATE INDEX IF NOT EXISTS idx_reports_is_moderated    ON public.community_reports (is_moderated);
CREATE INDEX IF NOT EXISTS idx_reports_created_at      ON public.community_reports (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_upvotes         ON public.community_reports (upvotes DESC);
CREATE INDEX IF NOT EXISTS idx_reports_scam_type       ON public.community_reports (scam_type);
CREATE INDEX IF NOT EXISTS idx_reports_reporter_id     ON public.community_reports (reporter_id);
CREATE INDEX IF NOT EXISTS idx_reports_company_trgm    ON public.community_reports USING GIN (company_claimed gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_reports_domain_trgm     ON public.community_reports USING GIN (fraudulent_domain gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_reports_email_trgm      ON public.community_reports USING GIN (scammer_email gin_trgm_ops);

DROP TRIGGER IF EXISTS trg_community_reports_updated_at ON public.community_reports;
CREATE TRIGGER trg_community_reports_updated_at
  BEFORE UPDATE ON public.community_reports
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 4. TABLE: scam_scans
--    Persisted AI scan results (anonymous or authenticated).
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.scam_scans (
  id                         UUID              PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id                    UUID              REFERENCES auth.users (id) ON DELETE SET NULL,
  raw_job_text               TEXT              NOT NULL,
  recruiter_email            TEXT,
  recruiter_phone            TEXT,
  company_name               TEXT,
  risk_score                 INTEGER           NOT NULL DEFAULT 0 CHECK (risk_score BETWEEN 0 AND 100),
  risk_level                 risk_level_enum   NOT NULL,
  scam_type                  scam_type_enum    NOT NULL,
  red_flags                  TEXT[]            NOT NULL DEFAULT '{}',
  ai_analysis_summary        TEXT              NOT NULL,
  actionable_recommendations TEXT[]            NOT NULL DEFAULT '{}',
  created_at                 TIMESTAMPTZ       NOT NULL DEFAULT NOW()
);

-- Indexes for scam_scans
CREATE INDEX IF NOT EXISTS idx_scans_user_id     ON public.scam_scans (user_id);
CREATE INDEX IF NOT EXISTS idx_scans_created_at  ON public.scam_scans (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scans_risk_level  ON public.scam_scans (risk_level);

-- -----------------------------------------------------------------------------
-- 5. TABLE: blacklisted_indicators
--    Admin-curated list of known bad actors (emails, domains, phones, etc.)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.blacklisted_indicators (
  id               UUID                          PRIMARY KEY DEFAULT uuid_generate_v4(),
  indicator_type   blacklist_indicator_type_enum NOT NULL,
  indicator_value  TEXT                          NOT NULL,
  reason           TEXT                          NOT NULL,
  added_by         UUID                          REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ                   NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_blacklisted_indicator UNIQUE (indicator_value)
);

-- Indexes for blacklisted_indicators
CREATE INDEX IF NOT EXISTS idx_blacklist_indicator_type  ON public.blacklisted_indicators (indicator_type);
CREATE INDEX IF NOT EXISTS idx_blacklist_value           ON public.blacklisted_indicators (indicator_value);

-- -----------------------------------------------------------------------------
-- 6. STORED PROCEDURE: increment_report_upvote
--    Atomic upvote counter called via supabaseAdmin.rpc('increment_report_upvote', ...)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.increment_report_upvote(report_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.community_reports
  SET upvotes = upvotes + 1
  WHERE id = report_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Report % not found', report_id;
  END IF;
END;
$$;

-- -----------------------------------------------------------------------------
-- 7. ROW LEVEL SECURITY (RLS)
-- -----------------------------------------------------------------------------

-- ── companies ──────────────────────────────────────────────────────────────────
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "companies_public_read" ON public.companies;
CREATE POLICY "companies_public_read"
  ON public.companies FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "companies_service_write" ON public.companies;
CREATE POLICY "companies_service_write"
  ON public.companies FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ── community_reports ──────────────────────────────────────────────────────────
ALTER TABLE public.community_reports ENABLE ROW LEVEL SECURITY;

-- Public: only see moderated reports
DROP POLICY IF EXISTS "reports_public_read_moderated" ON public.community_reports;
CREATE POLICY "reports_public_read_moderated"
  ON public.community_reports FOR SELECT
  USING (is_moderated = true);

-- Authenticated users: insert own reports (or anonymous)
DROP POLICY IF EXISTS "reports_authenticated_insert" ON public.community_reports;
CREATE POLICY "reports_authenticated_insert"
  ON public.community_reports FOR INSERT
  WITH CHECK (auth.uid() = reporter_id OR reporter_id IS NULL);

-- Reporters: read their own unmoderated reports
DROP POLICY IF EXISTS "reports_owner_read" ON public.community_reports;
CREATE POLICY "reports_owner_read"
  ON public.community_reports FOR SELECT
  USING (reporter_id = auth.uid());

-- Service role: full access for admin operations
DROP POLICY IF EXISTS "reports_service_role_all" ON public.community_reports;
CREATE POLICY "reports_service_role_all"
  ON public.community_reports FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ── scam_scans ─────────────────────────────────────────────────────────────────
ALTER TABLE public.scam_scans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "scans_owner_read" ON public.scam_scans;
CREATE POLICY "scans_owner_read"
  ON public.scam_scans FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "scans_service_role_all" ON public.scam_scans;
CREATE POLICY "scans_service_role_all"
  ON public.scam_scans FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ── blacklisted_indicators ─────────────────────────────────────────────────────
ALTER TABLE public.blacklisted_indicators ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "blacklist_public_read" ON public.blacklisted_indicators;
CREATE POLICY "blacklist_public_read"
  ON public.blacklisted_indicators FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "blacklist_service_write" ON public.blacklisted_indicators;
CREATE POLICY "blacklist_service_write"
  ON public.blacklisted_indicators FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- -----------------------------------------------------------------------------
-- 8. SEED DATA
-- -----------------------------------------------------------------------------

-- ── Verified & Known Companies ─────────────────────────────────────────────────
INSERT INTO public.companies (
  name, official_domain, verification_status, trust_score,
  industry, headquarters, verified_emails, trust_breakdown
) VALUES
(
  'Google LLC',
  'google.com',
  'VERIFIED_OFFICIAL',
  95,
  'Technology',
  'Mountain View, CA, USA',
  ARRAY['@google.com', '@alphabet.com'],
  '{"has_linkedin_presence": true, "business_registered": true, "score_components": {"domain_score": 30, "verification_score": 50, "email_score": 15}}'
),
(
  'Microsoft Corporation',
  'microsoft.com',
  'VERIFIED_OFFICIAL',
  94,
  'Technology',
  'Redmond, WA, USA',
  ARRAY['@microsoft.com'],
  '{"has_linkedin_presence": true, "business_registered": true, "score_components": {"domain_score": 30, "verification_score": 50, "email_score": 14}}'
),
(
  'Amazon Web Services',
  'amazon.com',
  'VERIFIED_OFFICIAL',
  92,
  'Cloud Computing',
  'Seattle, WA, USA',
  ARRAY['@amazon.com', '@aws.amazon.com'],
  '{"has_linkedin_presence": true, "business_registered": true, "score_components": {"domain_score": 30, "verification_score": 50, "email_score": 12}}'
),
(
  'Meta Platforms Inc.',
  'meta.com',
  'VERIFIED_OFFICIAL',
  91,
  'Technology',
  'Menlo Park, CA, USA',
  ARRAY['@meta.com', '@fb.com'],
  '{"has_linkedin_presence": true, "business_registered": true, "score_components": {"domain_score": 30, "verification_score": 50, "email_score": 11}}'
),
(
  'Fake Recruiter Co.',
  'fakejobs-hiring.net',
  'CONFIRMED_FRAUDULENT',
  2,
  NULL,
  NULL,
  ARRAY[]::TEXT[],
  '{"has_linkedin_presence": false, "business_registered": false, "fraud_confirmed": true}'
),
(
  'Global Staffing Solutions',
  'globalstaffingsolutions.biz',
  'SUSPECTED_IMPERSONATION',
  18,
  'Recruitment',
  'Unknown',
  ARRAY['@globalstaffingsolutions.biz'],
  '{"has_linkedin_presence": false, "free_domain": false, "suspicious_pattern": true}'
)
ON CONFLICT (official_domain) DO NOTHING;

-- ── Known Blacklisted Indicators ───────────────────────────────────────────────
INSERT INTO public.blacklisted_indicators (
  indicator_type, indicator_value, reason
) VALUES
(
  'EMAIL_DOMAIN',
  'fakejobs-hiring.net',
  'Confirmed scam operation — advance fee fraud targeting job seekers.'
),
(
  'EMAIL_DOMAIN',
  'gmail-recruiter.com',
  'Domain impersonating Gmail for phishing recruitment scams.'
),
(
  'EMAIL',
  'hr.google.careers@gmail.com',
  'Impersonating Google HR — confirmed fake recruiter using free email.'
),
(
  'PHONE',
  '+1-900-555-0199',
  'Premium rate number used in advance fee scam reported by 14 victims.'
),
(
  'PAYMENT_HANDLE',
  'zelle:fakejobs2024',
  'Payment handle linked to advance fee equipment scam ring.'
),
(
  'DOMAIN',
  'globalstaffingsolutions.biz',
  'Suspected impersonation of legitimate staffing agencies.'
),
(
  'EMAIL_DOMAIN',
  'amazon-wfh-hiring.net',
  'Fake Amazon work-from-home scam domain — advance fee equipment fraud.'
),
(
  'EMAIL',
  'amazon.recruiter2024@outlook.com',
  'Confirmed fake Amazon recruiter — fake check bounce scam.'
)
ON CONFLICT (indicator_value) DO NOTHING;

-- ── Sample Moderated Community Reports ────────────────────────────────────────
INSERT INTO public.community_reports (
  company_claimed, scam_type, fraudulent_domain, scammer_email,
  payment_method_requested, financial_loss_amount, description,
  recruitment_channel, is_moderated, upvotes
) VALUES
(
  'Google LLC',
  'IMPERSONATED_BRAND_PHISHING',
  'google-jobs-hiring.com',
  'hr.google.careers@gmail.com',
  NULL,
  0,
  'Received a job offer claiming to be from Google. The recruiter email was a Gmail address not a google.com email. The interview was conducted entirely on Telegram. They asked me to fill out a background check form on a fake domain.',
  'Telegram',
  true,
  47
),
(
  'Amazon',
  'ADVANCE_FEE_EQUIPMENT',
  'amazon-wfh-hiring.net',
  'amazon.recruiter2024@outlook.com',
  'Zelle',
  450,
  'Offered a work-from-home Amazon data entry position. After hiring me they asked me to buy a laptop and peripherals from a specific vendor and said they would reimburse me. Sent a fake check that bounced. Lost $450 total.',
  'Indeed',
  true,
  83
),
(
  'Global Staffing Solutions',
  'PYRAMID_MLM_RECRUITMENT',
  'globalstaffingsolutions.biz',
  'recruit@globalstaffingsolutions.biz',
  NULL,
  0,
  'Was contacted about a business development manager role. During the video interview they revealed it was a multi-level marketing scheme requiring purchasing a starter kit worth $299. No real employment contract was offered.',
  'LinkedIn',
  true,
  29
),
(
  'Unknown Startup',
  'DATA_HARVESTING_IDENTITY_THEFT',
  NULL,
  'jobs@quickhire-careers.com',
  NULL,
  0,
  'Applied for a remote data analyst position. The company requested my SSN, bank account details, and a photocopy of my passport before any formal offer. When I refused they became hostile and stopped responding.',
  'Cold Email',
  true,
  61
),
(
  'Tesla Motors',
  'IMPERSONATED_BRAND_PHISHING',
  'tesla-careers-apply.com',
  'hiring@tesla-careers-apply.com',
  NULL,
  0,
  'Received a WhatsApp message about a Tesla remote engineering job paying $8000/month. The domain is not tesla.com. They wanted me to pay a $150 registration fee before starting. Classic impersonation phishing.',
  'WhatsApp',
  true,
  112
)
ON CONFLICT DO NOTHING;

-- =============================================================================
-- END OF MIGRATION 001_initial_schema.sql
-- =============================================================================
