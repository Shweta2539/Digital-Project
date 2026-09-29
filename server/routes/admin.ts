import { Router, Request, Response, NextFunction } from 'express';
import { domainInvestigationSchema, employerVerificationSchema } from '../../shared/schema';
import { supabaseAdmin } from '../db';
import { investigateCompanyDomain, generateCompanyTrustInsight } from '../services/aiService';
import { computeTrustScore } from '../services/trustScoreEngine';
import type { VerificationStatus } from '../../shared/schema';

const router = Router();

// ─── Admin Role Guard Middleware ────────────────────────────────────────────────

async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  const token = authHeader.split(' ')[1];
  const {
    data: { user },
    error,
  } = await supabaseAdmin.auth.getUser(token);

  if (error || !user) {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }

  // Check admin role in user metadata
  const role = user.user_metadata?.role || user.app_metadata?.role;
  if (role !== 'SECURITY_ADMIN') {
    return res.status(403).json({ error: 'SECURITY_ADMIN role required for this endpoint.' });
  }

  (req as any).adminUser = user;
  next();
}

// ─── POST /api/admin/investigate-domain ─────────────────────────────────────────

router.post(
  '/investigate-domain',
  requireAdmin,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parseResult = domainInvestigationSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({
          error: 'Validation failed',
          details: parseResult.error.flatten().fieldErrors,
        });
      }

      const { company_name, claimed_domain } = parseResult.data;

      let investigationResult;
      try {
        investigationResult = await investigateCompanyDomain(company_name, claimed_domain);
      } catch (aiError: any) {
        console.error('[Admin Investigation Error]', aiError.message);
        return res.status(503).json({
          error: 'AI investigation service temporarily unavailable.',
          code: 'AI_SERVICE_ERROR',
        });
      }

      return res.status(200).json({
        company_name,
        claimed_domain,
        investigation_report: investigationResult.investigationReport,
        grounding_sources: investigationResult.groundingSources,
        investigated_at: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  },
);

// ─── GET /api/admin/moderation/pending ─────────────────────────────────────────

router.get(
  '/moderation/pending',
  requireAdmin,
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const { data, error } = await supabaseAdmin
        .from('community_reports')
        .select('*')
        .eq('is_moderated', false)
        .order('created_at', { ascending: true })
        .limit(100);

      if (error) throw error;

      return res.status(200).json({ pending_reports: data ?? [] });
    } catch (error) {
      next(error);
    }
  },
);

// ─── PATCH /api/admin/moderation/:id ───────────────────────────────────────────

router.patch(
  '/moderation/:id',
  requireAdmin,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { action } = req.body; // 'approve' | 'reject'

      if (!['approve', 'reject'].includes(action)) {
        return res.status(400).json({ error: "Action must be 'approve' or 'reject'." });
      }

      if (action === 'approve') {
        const { error } = await supabaseAdmin
          .from('community_reports')
          .update({ is_moderated: true })
          .eq('id', id);

        if (error) throw error;
        return res.status(200).json({ message: 'Report approved and published.' });
      } else {
        const { error } = await supabaseAdmin
          .from('community_reports')
          .delete()
          .eq('id', id);

        if (error) throw error;
        return res.status(200).json({ message: 'Report rejected and removed.' });
      }
    } catch (error) {
      next(error);
    }
  },
);

// ─── POST /api/admin/blacklist ──────────────────────────────────────────────────

router.post(
  '/blacklist',
  requireAdmin,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { indicator_type, indicator_value, reason } = req.body;

      if (!indicator_type || !indicator_value || !reason) {
        return res.status(400).json({
          error: 'indicator_type, indicator_value, and reason are all required.',
        });
      }

      const validTypes = ['EMAIL_DOMAIN', 'EMAIL', 'PHONE', 'PAYMENT_HANDLE', 'DOMAIN'];
      if (!validTypes.includes(indicator_type)) {
        return res.status(400).json({
          error: `indicator_type must be one of: ${validTypes.join(', ')}`,
        });
      }

      const adminUser = (req as any).adminUser;
      const { data, error } = await supabaseAdmin
        .from('blacklisted_indicators')
        .insert({
          indicator_type,
          indicator_value,
          reason,
          added_by: adminUser.id,
        })
        .select('id')
        .single();

      if (error) {
        if (error.code === '23505') {
          return res.status(409).json({ error: 'This indicator is already blacklisted.' });
        }
        throw error;
      }

      return res.status(201).json({
        message: 'Indicator added to blacklist successfully.',
        blacklist_id: data.id,
      });
    } catch (error) {
      next(error);
    }
  },
);

// ─── PATCH /api/admin/companies/:id/status ──────────────────────────────────────

router.patch(
  '/companies/:id/status',
  requireAdmin,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { verification_status } = req.body;

      const validStatuses: VerificationStatus[] = [
        'VERIFIED_OFFICIAL',
        'PENDING_REVIEW',
        'UNVERIFIED_FREE_DOMAIN',
        'SUSPECTED_IMPERSONATION',
        'CONFIRMED_FRAUDULENT',
      ];

      if (!validStatuses.includes(verification_status)) {
        return res.status(400).json({
          error: `verification_status must be one of: ${validStatuses.join(', ')}`,
        });
      }

      // Fetch current company data
      const { data: company, error: fetchError } = await supabaseAdmin
        .from('companies')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchError || !company) {
        return res.status(404).json({ error: 'Company not found.' });
      }

      // Recompute trust score with new status
      const newTrustScore = computeTrustScore({
        official_domain: company.official_domain,
        verification_status: verification_status as VerificationStatus,
        verified_emails: company.verified_emails ?? [],
        community_report_count: 0,
        trust_breakdown: company.trust_breakdown ?? {},
      });

      const { error: updateError } = await supabaseAdmin
        .from('companies')
        .update({
          verification_status,
          trust_score: newTrustScore.total_score,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (updateError) throw updateError;

      return res.status(200).json({
        message: `Company verification status updated to ${verification_status}.`,
        new_trust_score: newTrustScore.total_score,
      });
    } catch (error) {
      next(error);
    }
  },
);

// ─── POST /api/employer/verify ──────────────────────────────────────────────────

router.post('/employer/verify', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parseResult = employerVerificationSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: parseResult.error.flatten().fieldErrors,
      });
    }

    const { company_name, official_domain, corporate_email, business_registration_number, industry, headquarters } =
      parseResult.data;

    // Verify email domain matches claimed official domain
    const emailDomain = corporate_email.split('@')[1];
    if (emailDomain !== official_domain && !emailDomain?.endsWith(`.${official_domain}`)) {
      return res.status(400).json({
        error: `Corporate email domain "${emailDomain}" does not match the claimed official domain "${official_domain}". Please use a company email address.`,
      });
    }

    // Check if company already exists
    const { data: existingCompany } = await supabaseAdmin
      .from('companies')
      .select('id, verification_status')
      .eq('official_domain', official_domain)
      .single();

    if (existingCompany) {
      if (existingCompany.verification_status === 'VERIFIED_OFFICIAL') {
        return res.status(409).json({
          error: 'This company domain is already verified. Please contact support to update your listing.',
        });
      }

      // Update existing company to PENDING_REVIEW
      await supabaseAdmin
        .from('companies')
        .update({
          name: company_name,
          verification_status: 'PENDING_REVIEW',
          industry: industry || null,
          headquarters: headquarters || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingCompany.id);

      return res.status(200).json({
        message: 'Verification request submitted. Your company listing has been updated to PENDING_REVIEW status.',
        company_id: existingCompany.id,
      });
    }

    // Compute initial trust score
    const initialTrust = computeTrustScore({
      official_domain,
      verification_status: 'PENDING_REVIEW',
      verified_emails: [`@${official_domain}`],
      community_report_count: 0,
      trust_breakdown: { has_linkedin_presence: false },
    });

    // Create new company record
    const { data: newCompany, error: insertError } = await supabaseAdmin
      .from('companies')
      .insert({
        name: company_name,
        official_domain,
        verification_status: 'PENDING_REVIEW',
        trust_score: initialTrust.total_score,
        industry: industry || null,
        headquarters: headquarters || null,
        verified_emails: [`@${official_domain}`],
        trust_breakdown: {
          business_registration_number,
          corporate_email,
          score_components: initialTrust.components,
        },
      })
      .select('id')
      .single();

    if (insertError) throw insertError;

    return res.status(201).json({
      message:
        'Employer verification request submitted successfully. Our team will review your credentials within 2-3 business days.',
      company_id: newCompany.id,
      status: 'PENDING_REVIEW',
    });
  } catch (error) {
    next(error);
  }
});

export default router;
