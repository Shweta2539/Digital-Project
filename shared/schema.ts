import { z } from 'zod';

// ─── Enum Types ────────────────────────────────────────────────────────────────

export const ScamTypeEnum = z.enum([
  'ADVANCE_FEE_EQUIPMENT',
  'FAKE_CHECK_REFUND',
  'DATA_HARVESTING_IDENTITY_THEFT',
  'UNPAID_TASK_WORK',
  'PYRAMID_MLM_RECRUITMENT',
  'CHECK_CASHING_MONEY_LAUNDERING',
  'IMPERSONATED_BRAND_PHISHING',
  'TELEGRAM_WHATSAPP_ONLY_INTERVIEW',
]);

export const RiskLevelEnum = z.enum([
  'CRITICAL_SCAM',
  'HIGH_RISK',
  'SUSPICIOUS',
  'LOW_RISK',
]);

export const VerificationStatusEnum = z.enum([
  'VERIFIED_OFFICIAL',
  'PENDING_REVIEW',
  'UNVERIFIED_FREE_DOMAIN',
  'SUSPECTED_IMPERSONATION',
  'CONFIRMED_FRAUDULENT',
]);

export const RecruitmentChannelEnum = z.enum([
  'LinkedIn',
  'Indeed',
  'Telegram',
  'WhatsApp',
  'Cold Email',
  'SMS',
  'Job Board',
  'Other',
]);

// ─── Input Schemas ─────────────────────────────────────────────────────────────

export const scanInputSchema = z.object({
  raw_job_text: z
    .string()
    .min(10, 'Job text or offer letter content must be at least 10 characters.'),
  recruiter_email: z
    .string()
    .email('Invalid email format.')
    .or(z.literal(''))
    .optional(),
  recruiter_phone: z.string().optional(),
  company_name: z.string().optional(),
  recruitment_channel: RecruitmentChannelEnum.optional(),
});

export const scamReportSchema = z.object({
  company_claimed: z.string().min(2, 'Company name is required.'),
  scam_type: ScamTypeEnum,
  fraudulent_domain: z.string().optional(),
  scammer_email: z.string().email().or(z.literal('')).optional(),
  scammer_phone: z.string().optional(),
  payment_method_requested: z.string().optional(),
  financial_loss_amount: z.number().min(0).default(0),
  description: z
    .string()
    .min(20, 'Please provide at least 20 characters describing the scam.'),
  recruitment_channel: RecruitmentChannelEnum.optional(),
  financial_requests: z.array(z.string()).optional(),
});

export const employerVerificationSchema = z.object({
  company_name: z.string().min(2, 'Company name must be at least 2 characters.'),
  official_domain: z.string().min(4, 'Domain must be at least 4 characters.'),
  corporate_email: z.string().email('Please enter a valid corporate email.'),
  business_registration_number: z
    .string()
    .min(3, 'Registration number must be at least 3 characters.'),
  industry: z.string().optional(),
  headquarters: z.string().optional(),
});

export const domainInvestigationSchema = z.object({
  company_name: z.string().min(2),
  claimed_domain: z.string().min(4),
  reason: z.string().optional(),
});

// ─── AI Response Schema Types ──────────────────────────────────────────────────

export type ScamAnalysisResult = {
  scam_risk_score: number;
  risk_level: z.infer<typeof RiskLevelEnum>;
  scam_type: z.infer<typeof ScamTypeEnum>;
  red_flags: string[];
  domain_mismatch_detected: boolean;
  ai_analysis_summary: string;
  actionable_recommendations: string[];
};

export type ScanInput = z.infer<typeof scanInputSchema>;
export type ScamReport = z.infer<typeof scamReportSchema>;
export type EmployerVerification = z.infer<typeof employerVerificationSchema>;
export type DomainInvestigation = z.infer<typeof domainInvestigationSchema>;
export type ScamType = z.infer<typeof ScamTypeEnum>;
export type RiskLevel = z.infer<typeof RiskLevelEnum>;
export type VerificationStatus = z.infer<typeof VerificationStatusEnum>;
