import { Router, Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../db';
import { computeTrustScore } from '../services/trustScoreEngine';
import type { VerificationStatus } from '../../shared/schema';

const router = Router();

// ─── GET /api/companies ─────────────────────────────────────────────────────────

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
    const offset = (page - 1) * limit;
    const search = (req.query.search as string) || '';
    const minTrust = parseInt(req.query.min_trust as string) || 0;
    const status = (req.query.verification_status as string) || '';

    let query = supabaseAdmin
      .from('companies')
      .select('id, name, official_domain, verification_status, trust_score, industry, headquarters, created_at', {
        count: 'exact',
      });

    if (search) {
      query = query.or(`name.ilike.%${search}%,official_domain.ilike.%${search}%`);
    }

    if (minTrust > 0) {
      query = query.gte('trust_score', minTrust);
    }

    if (status) {
      query = query.eq('verification_status', status);
    }

    const { data, error, count } = await query
      .order('trust_score', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    return res.status(200).json({
      companies: data ?? [],
      total: count ?? 0,
      page,
      limit,
      total_pages: Math.ceil((count ?? 0) / limit),
    });
  } catch (error) {
    next(error);
  }
});

// ─── GET /api/companies/:id ────────────────────────────────────────────────────

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    // Fetch company
    const { data: company, error } = await supabaseAdmin
      .from('companies')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !company) {
      return res.status(404).json({ error: 'Company not found.' });
    }

    // Fetch community reports count for this company
    const { count: reportCount } = await supabaseAdmin
      .from('community_reports')
      .select('id', { count: 'exact', head: true })
      .ilike('company_claimed', `%${company.name}%`);

    // Fetch recent community reports
    const { data: communityReports } = await supabaseAdmin
      .from('community_reports')
      .select('id, scam_type, description, created_at, upvotes')
      .ilike('company_claimed', `%${company.name}%`)
      .eq('is_moderated', true)
      .order('upvotes', { ascending: false })
      .limit(5);

    // Recompute trust score with live data
    const trustScoreOutput = computeTrustScore({
      official_domain: company.official_domain,
      verification_status: company.verification_status as VerificationStatus,
      verified_emails: company.verified_emails ?? [],
      community_report_count: reportCount ?? 0,
      trust_breakdown: company.trust_breakdown ?? {},
    });

    // Update trust score if it changed significantly
    if (Math.abs(trustScoreOutput.total_score - company.trust_score) > 5) {
      await supabaseAdmin
        .from('companies')
        .update({
          trust_score: trustScoreOutput.total_score,
          trust_breakdown: {
            ...company.trust_breakdown,
            score_components: trustScoreOutput.components,
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);
    }

    return res.status(200).json({
      company: {
        ...company,
        trust_score: trustScoreOutput.total_score,
        trust_breakdown: {
          ...company.trust_breakdown,
          score_components: trustScoreOutput.components,
          risk_label: trustScoreOutput.risk_label,
          risk_color: trustScoreOutput.risk_color,
        },
      },
      community_report_count: reportCount ?? 0,
      recent_community_reports: communityReports ?? [],
    });
  } catch (error) {
    next(error);
  }
});

// ─── GET /api/companies/stats/overview ─────────────────────────────────────────

router.get('/stats/overview', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const { count: totalCompanies } = await supabaseAdmin
      .from('companies')
      .select('id', { count: 'exact', head: true });

    const { count: verifiedCount } = await supabaseAdmin
      .from('companies')
      .select('id', { count: 'exact', head: true })
      .eq('verification_status', 'VERIFIED_OFFICIAL');

    const { count: fraudulentCount } = await supabaseAdmin
      .from('companies')
      .select('id', { count: 'exact', head: true })
      .eq('verification_status', 'CONFIRMED_FRAUDULENT');

    const { data: avgData } = await supabaseAdmin
      .from('companies')
      .select('trust_score');

    const avgTrust =
      avgData && avgData.length > 0
        ? Math.round(avgData.reduce((sum, c) => sum + c.trust_score, 0) / avgData.length)
        : 0;

    return res.status(200).json({
      total_companies: totalCompanies ?? 0,
      verified_companies: verifiedCount ?? 0,
      confirmed_fraudulent: fraudulentCount ?? 0,
      average_trust_score: avgTrust,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
