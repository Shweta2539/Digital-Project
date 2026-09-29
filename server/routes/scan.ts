import { Router, Request, Response, NextFunction } from 'express';
import { scanInputSchema } from '../../shared/schema';
import { parseJobScamInput } from '../services/aiService';
import { supabaseAdmin } from '../db';
import { ZodError } from 'zod';

const router = Router();

// ─── POST /api/scan/analyze ─────────────────────────────────────────────────────

router.post('/analyze', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // 1. Validate input
    const parseResult = scanInputSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: parseResult.error.flatten().fieldErrors,
      });
    }

    const { raw_job_text, recruiter_email, recruiter_phone, company_name } = parseResult.data;

    // 2. Run AI scam analysis
    let aiResult;
    try {
      aiResult = await parseJobScamInput(raw_job_text, recruiter_email, company_name);
    } catch (aiError: any) {
      console.error('[AI Service Error]', aiError.message);
      return res.status(503).json({
        error: 'AI analysis service temporarily unavailable. Please try again.',
        code: 'AI_SERVICE_ERROR',
      });
    }

    // 3. Cross-reference blacklisted indicators
    const indicatorsToCheck: string[] = [];
    if (recruiter_email) indicatorsToCheck.push(recruiter_email);
    if (recruiter_phone) indicatorsToCheck.push(recruiter_phone);
    if (recruiter_email) {
      const domain = recruiter_email.split('@')[1];
      if (domain) indicatorsToCheck.push(domain);
    }

    let blacklistMatches: { indicator_value: string; reason: string; indicator_type: string }[] = [];
    if (indicatorsToCheck.length > 0) {
      const { data: blacklistData, error: blacklistError } = await supabaseAdmin
        .from('blacklisted_indicators')
        .select('indicator_value, indicator_type, reason')
        .in('indicator_value', indicatorsToCheck);

      if (!blacklistError && blacklistData) {
        blacklistMatches = blacklistData;
        // Boost risk score if blacklisted
        if (blacklistMatches.length > 0) {
          aiResult.scam_risk_score = Math.min(100, aiResult.scam_risk_score + 20);
          aiResult.red_flags = [
            ...aiResult.red_flags,
            ...blacklistMatches.map((m) => `BLACKLISTED: ${m.indicator_type} "${m.indicator_value}" — ${m.reason}`),
          ];
          if (aiResult.scam_risk_score >= 90) aiResult.risk_level = 'CRITICAL_SCAM';
          else if (aiResult.scam_risk_score >= 70) aiResult.risk_level = 'HIGH_RISK';
        }
      }
    }

    // 4. Check community reports for matching domains/emails
    let communityMatches: { company_claimed: string; scam_type: string; description: string }[] = [];
    const emailDomain = recruiter_email?.split('@')[1];
    if (emailDomain || recruiter_email) {
      const { data: communityData } = await supabaseAdmin
        .from('community_reports')
        .select('company_claimed, scam_type, description')
        .eq('is_moderated', true)
        .or(
          [
            emailDomain ? `fraudulent_domain.ilike.%${emailDomain}%` : null,
            recruiter_email ? `scammer_email.ilike.%${recruiter_email}%` : null,
            company_name ? `company_claimed.ilike.%${company_name}%` : null,
          ]
            .filter(Boolean)
            .join(','),
        )
        .limit(5);

      if (communityData) communityMatches = communityData;
    }

    // 5. Persist scan result (anonymous if no auth header)
    let userId: string | null = null;
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const { data: { user } } = await supabaseAdmin.auth.getUser(token);
      userId = user?.id ?? null;
    }

    const { data: scanRecord, error: insertError } = await supabaseAdmin
      .from('scam_scans')
      .insert({
        user_id: userId,
        raw_job_text: raw_job_text.substring(0, 5000), // cap at 5k chars for storage
        recruiter_email: recruiter_email || null,
        recruiter_phone: recruiter_phone || null,
        company_name: company_name || null,
        risk_score: aiResult.scam_risk_score,
        risk_level: aiResult.risk_level,
        scam_type: aiResult.scam_type,
        red_flags: aiResult.red_flags,
        ai_analysis_summary: aiResult.ai_analysis_summary,
        actionable_recommendations: aiResult.actionable_recommendations,
      })
      .select('id')
      .single();

    if (insertError) {
      console.error('[DB Insert Error]', insertError.message);
      // Non-fatal — still return results even if DB save fails
    }

    // 6. Return enriched result
    return res.status(200).json({
      scan_id: scanRecord?.id ?? null,
      analysis: aiResult,
      blacklist_matches: blacklistMatches,
      community_matches: communityMatches,
    });
  } catch (error: any) {
    console.error('[Scan Route Error]', error);
    next(error);
  }
});

// ─── GET /api/scan/history ──────────────────────────────────────────────────────

router.get('/history', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required to view scan history.' });
    }

    const token = authHeader.split(' ')[1];
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return res.status(401).json({ error: 'Invalid or expired token.' });
    }

    const { data, error } = await supabaseAdmin
      .from('scam_scans')
      .select('id, company_name, risk_score, risk_level, scam_type, created_at, red_flags')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;

    return res.status(200).json({ scans: data });
  } catch (error) {
    next(error);
  }
});

export default router;
