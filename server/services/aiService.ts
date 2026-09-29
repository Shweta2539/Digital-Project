import { Type, Schema } from '@google/genai';
import { ai, MODEL_FAST, MODEL_REASONING, VERIJOB_SYSTEM_INSTRUCTION } from './geminiClient';
import type { ScamAnalysisResult } from '../../shared/schema';

// ─── Scam Analysis Response Schema ─────────────────────────────────────────────

const scamAnalysisSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    scam_risk_score: {
      type: Type.INTEGER,
      description: 'Risk score from 0 (fully legitimate) to 100 (confirmed scam)',
    },
    risk_level: {
      type: Type.STRING,
      enum: ['CRITICAL_SCAM', 'HIGH_RISK', 'SUSPICIOUS', 'LOW_RISK'],
    },
    scam_type: {
      type: Type.STRING,
      enum: [
        'ADVANCE_FEE_EQUIPMENT',
        'FAKE_CHECK_REFUND',
        'DATA_HARVESTING_IDENTITY_THEFT',
        'UNPAID_TASK_WORK',
        'PYRAMID_MLM_RECRUITMENT',
        'CHECK_CASHING_MONEY_LAUNDERING',
        'IMPERSONATED_BRAND_PHISHING',
        'TELEGRAM_WHATSAPP_ONLY_INTERVIEW',
      ],
    },
    red_flags: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'List of specific red flag indicators found in the text',
    },
    domain_mismatch_detected: {
      type: Type.BOOLEAN,
      description:
        'True if the recruiter email domain does not match the official company domain',
    },
    ai_analysis_summary: {
      type: Type.STRING,
      description:
        'Detailed forensic analysis of the job posting explaining why it was rated as it was',
    },
    actionable_recommendations: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'Clear, actionable steps the job seeker should take immediately',
    },
  },
  required: [
    'scam_risk_score',
    'risk_level',
    'scam_type',
    'red_flags',
    'domain_mismatch_detected',
    'ai_analysis_summary',
    'actionable_recommendations',
  ],
};

// ─── PII Redaction ─────────────────────────────────────────────────────────────

function redactPII(text: string): string {
  // Redact SSNs (XXX-XX-XXXX or XXXXXXXXX)
  let redacted = text.replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[SSN REDACTED]');
  redacted = redacted.replace(/\b\d{9}\b(?=\s*(?:ssn|social))/gi, '[SSN REDACTED]');
  // Redact bank account numbers (10-17 digit sequences)
  redacted = redacted.replace(/\b(?:account|acct|routing|aba)\s*(?:#|number|num|no)?:?\s*\d{8,17}\b/gi, '[BANK INFO REDACTED]');
  // Redact credit card numbers
  redacted = redacted.replace(/\b(?:\d{4}[\s-]){3}\d{4}\b/g, '[CARD REDACTED]');
  return redacted;
}

// ─── Job Scam Analysis ──────────────────────────────────────────────────────────

export async function parseJobScamInput(
  jobText: string,
  recruiterEmail?: string,
  companyName?: string,
): Promise<ScamAnalysisResult> {
  const sanitizedText = redactPII(jobText);

  const prompt = `Analyze this recruitment offer text and metadata for scam indicators and fraudulent tactics. Be thorough and precise.

Company Claimed: "${companyName || 'Not Provided'}"
Recruiter Email: "${recruiterEmail || 'Not Provided'}"

Content Body:
"""
${sanitizedText}
"""

Examine for: upfront payment demands, check cashing/refund requests, domain mismatches between claimed company and recruiter email, non-official interview channels (Telegram/WhatsApp only), unpaid work tests, data harvesting patterns, MLM structures, or impersonated brand names. Return a complete structured analysis.`;

  const response = await ai.models.generateContent({
    model: MODEL_FAST,
    contents: prompt,
    config: {
      systemInstruction: VERIJOB_SYSTEM_INSTRUCTION,
      responseMimeType: 'application/json',
      responseSchema: scamAnalysisSchema,
      temperature: 0.1,
    },
  });

  const rawText = response.text;
  if (!rawText) {
    throw new Error('Gemini returned empty response for scam analysis');
  }

  return JSON.parse(rawText) as ScamAnalysisResult;
}

// ─── Company Domain Investigation ──────────────────────────────────────────────

export async function investigateCompanyDomain(
  companyName: string,
  claimedDomain: string,
): Promise<{ investigationReport: string; groundingSources: unknown }> {
  const response = await ai.models.generateContent({
    model: MODEL_REASONING,
    contents: `Conduct a thorough cybersecurity and legitimacy investigation on the following:

Company Name Claimed: "${companyName}"
Domain Under Investigation: "${claimedDomain}"

Investigation scope:
1. Assess whether "${claimedDomain}" is the genuine, official domain for "${companyName}" or a lookalike/typosquatting domain.
2. Check for known phishing reports, malware associations, or blacklist entries related to this domain.
3. Evaluate domain age signals, official careers page patterns, and corporate registry alignment.
4. Identify any public scam warnings or news reports about fraudulent recruitment using this domain or company name.
5. Provide a final verdict: LEGITIMATE, SUSPICIOUS, or CONFIRMED_FRAUDULENT with supporting evidence.

Format your response as a detailed forensic investigation report with clear section headings.`,
    config: {
      tools: [{ googleSearch: {} }],
    },
  });

  return {
    investigationReport: response.text ?? 'Investigation failed to return results.',
    groundingSources: response.candidates?.[0]?.groundingMetadata ?? null,
  };
}

// ─── Company Trust Score Computation Helper ─────────────────────────────────────

export async function generateCompanyTrustInsight(
  companyName: string,
  domain: string,
  verificationStatus: string,
): Promise<string> {
  const prompt = `Provide a concise 2-3 sentence trust analysis for the company "${companyName}" with domain "${domain}". 
Verification status: ${verificationStatus}.
Focus on domain credibility signals, typical recruitment practices for this company type, and any known legitimacy indicators. Be factual and neutral.`;

  const response = await ai.models.generateContent({
    model: MODEL_FAST,
    contents: prompt,
    config: {
      systemInstruction: VERIJOB_SYSTEM_INSTRUCTION,
      temperature: 0.3,
      maxOutputTokens: 300,
    },
  });

  return response.text ?? 'Trust analysis unavailable.';
}
