import { Router, Request, Response, NextFunction } from 'express';
import { scamReportSchema } from '../../shared/schema';
import { supabaseAdmin } from '../db';

const router = Router();

// ─── POST /api/reports/submit ───────────────────────────────────────────────────

router.post('/submit', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parseResult = scamReportSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: parseResult.error.flatten().fieldErrors,
      });
    }

    const reportData = parseResult.data;

    // Extract reporter identity from token if present
    let reporterId: string | null = null;
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const {
        data: { user },
      } = await supabaseAdmin.auth.getUser(token);
      reporterId = user?.id ?? null;
    }

    // Insert the report
    const { data: report, error } = await supabaseAdmin
      .from('community_reports')
      .insert({
        reporter_id: reporterId,
        company_claimed: reportData.company_claimed,
        scam_type: reportData.scam_type,
        fraudulent_domain: reportData.fraudulent_domain || null,
        scammer_email: reportData.scammer_email || null,
        scammer_phone: reportData.scammer_phone || null,
        payment_method_requested: reportData.payment_method_requested || null,
        financial_loss_amount: reportData.financial_loss_amount,
        description: reportData.description,
        is_moderated: false, // requires admin moderation
      })
      .select('id, created_at')
      .single();

    if (error) {
      console.error('[Report Insert Error]', error.message);
      throw error;
    }

    // Auto-flag scammer email for review if provided
    if (reportData.scammer_email) {
      const emailDomain = reportData.scammer_email.split('@')[1];
      if (emailDomain) {
        // Check if already blacklisted
        const { data: existing } = await supabaseAdmin
          .from('blacklisted_indicators')
          .select('id')
          .eq('indicator_value', emailDomain)
          .single();

        if (!existing) {
          // Add to pending review — don't auto-blacklist without admin review
          console.log(`[Pending Review] New domain flagged: ${emailDomain}`);
        }
      }
    }

    return res.status(201).json({
      message: 'Scam report submitted successfully. It will be reviewed by our security team.',
      report_id: report.id,
      created_at: report.created_at,
    });
  } catch (error) {
    next(error);
  }
});

// ─── GET /api/reports/recent ────────────────────────────────────────────────────

router.get('/recent', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));

    const { data, error } = await supabaseAdmin
      .from('community_reports')
      .select(
        'id, company_claimed, scam_type, fraudulent_domain, description, upvotes, created_at, payment_method_requested',
      )
      .eq('is_moderated', true)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    return res.status(200).json({ reports: data ?? [] });
  } catch (error) {
    next(error);
  }
});

// ─── POST /api/reports/:id/upvote ──────────────────────────────────────────────

router.post('/:id/upvote', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const { error } = await supabaseAdmin.rpc('increment_report_upvote', { report_id: id });

    if (error) {
      // Fallback: fetch current value then increment
      const { data: current, error: fetchError } = await supabaseAdmin
        .from('community_reports')
        .select('upvotes')
        .eq('id', id)
        .single();

      if (fetchError) throw fetchError;

      const { error: updateError } = await supabaseAdmin
        .from('community_reports')
        .update({ upvotes: (current?.upvotes ?? 0) + 1 })
        .eq('id', id);

      if (updateError) throw updateError;
    }

    return res.status(200).json({ message: 'Upvote recorded.' });
  } catch (error) {
    next(error);
  }
});

// ─── GET /api/reports/stats ─────────────────────────────────────────────────────

router.get('/stats', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const { count: totalReports } = await supabaseAdmin
      .from('community_reports')
      .select('id', { count: 'exact', head: true })
      .eq('is_moderated', true);

    const { data: scamTypeData } = await supabaseAdmin
      .from('community_reports')
      .select('scam_type')
      .eq('is_moderated', true);

    const scamTypeCounts: Record<string, number> = {};
    if (scamTypeData) {
      for (const row of scamTypeData) {
        scamTypeCounts[row.scam_type] = (scamTypeCounts[row.scam_type] || 0) + 1;
      }
    }

    const { data: scanStats } = await supabaseAdmin
      .from('scam_scans')
      .select('risk_level');

    const riskLevelCounts: Record<string, number> = {};
    if (scanStats) {
      for (const row of scanStats) {
        riskLevelCounts[row.risk_level] = (riskLevelCounts[row.risk_level] || 0) + 1;
      }
    }

    return res.status(200).json({
      total_reports: totalReports ?? 0,
      scam_type_breakdown: scamTypeCounts,
      scan_risk_level_breakdown: riskLevelCounts,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
