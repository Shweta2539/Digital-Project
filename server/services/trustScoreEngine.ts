import type { VerificationStatus } from '../../shared/schema';

// ─── Trust Score Component Weights ─────────────────────────────────────────────

const WEIGHTS = {
  verificationStatus: 35,   // 0-35 pts
  domainAge: 20,             // 0-20 pts
  communityReports: 25,      // 0-25 pts (negative)
  emailConsistency: 10,      // 0-10 pts
  linkedinPresence: 10,      // 0-10 pts
};

// ─── Verification Status Base Score ────────────────────────────────────────────

function getVerificationScore(status: VerificationStatus): number {
  switch (status) {
    case 'VERIFIED_OFFICIAL':
      return 35;
    case 'PENDING_REVIEW':
      return 18;
    case 'UNVERIFIED_FREE_DOMAIN':
      return 8;
    case 'SUSPECTED_IMPERSONATION':
      return 2;
    case 'CONFIRMED_FRAUDULENT':
      return 0;
    default:
      return 8;
  }
}

// ─── Domain Age Score ──────────────────────────────────────────────────────────

function getDomainAgeScore(domain: string): number {
  // Free email domains get 0 points
  const freeEmailDomains = [
    'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com',
    'protonmail.com', 'icloud.com', 'aol.com', 'mail.com',
    'zoho.com', 'yandex.com',
  ];
  
  if (freeEmailDomains.some((d) => domain.toLowerCase().endsWith(d))) {
    return 0;
  }
  
  // Domains with suspicious patterns
  const suspiciousPatterns = [
    /-hr-/, /-careers-/, /-jobs-/, /-recruit-/, /careers-dept/, /job-offer/,
    /-hiring/, /hiring-/, /-apply/, /apply-/,
  ];
  
  if (suspiciousPatterns.some((p) => p.test(domain.toLowerCase()))) {
    return 3;
  }
  
  // Generic business domain — moderate score (we can't check real WHOIS without API)
  return 14;
}

// ─── Community Reports Penalty ─────────────────────────────────────────────────

function getCommunityPenalty(reportCount: number): number {
  // Each verified community report deducts points from the 25-pt pool
  if (reportCount === 0) return 25;
  if (reportCount === 1) return 18;
  if (reportCount === 2) return 10;
  if (reportCount <= 5) return 3;
  return 0;
}

// ─── Email Consistency Score ───────────────────────────────────────────────────

function getEmailConsistencyScore(
  officialDomain: string,
  verifiedEmails: string[],
): number {
  if (!verifiedEmails || verifiedEmails.length === 0) return 5;
  
  const allMatch = verifiedEmails.every((email) =>
    email.endsWith(`@${officialDomain}`) || email === `@${officialDomain}`,
  );
  
  return allMatch ? 10 : 2;
}

// ─── LinkedIn Presence Score ────────────────────────────────────────────────────

function getLinkedinScore(trustBreakdown: Record<string, unknown>): number {
  return (trustBreakdown?.has_linkedin_presence as boolean) ? 10 : 4;
}

// ─── Main Trust Score Engine ────────────────────────────────────────────────────

export interface TrustScoreInput {
  official_domain: string;
  verification_status: VerificationStatus;
  verified_emails: string[];
  community_report_count: number;
  trust_breakdown: Record<string, unknown>;
}

export interface TrustScoreOutput {
  total_score: number;
  components: {
    verification_status_score: number;
    domain_age_score: number;
    community_penalty: number;
    email_consistency_score: number;
    linkedin_score: number;
  };
  risk_label: string;
  risk_color: string;
}

export function computeTrustScore(input: TrustScoreInput): TrustScoreOutput {
  const verificationScore = getVerificationScore(input.verification_status);
  const domainAgeScore = getDomainAgeScore(input.official_domain);
  const communityPenalty = getCommunityPenalty(input.community_report_count);
  const emailConsistencyScore = getEmailConsistencyScore(
    input.official_domain,
    input.verified_emails,
  );
  const linkedinScore = getLinkedinScore(input.trust_breakdown);

  const totalScore = Math.max(
    0,
    Math.min(
      100,
      verificationScore + domainAgeScore + communityPenalty + emailConsistencyScore + linkedinScore,
    ),
  );

  let risk_label: string;
  let risk_color: string;

  if (totalScore >= 80) {
    risk_label = 'TRUSTED';
    risk_color = '#10b981';
  } else if (totalScore >= 60) {
    risk_label = 'MODERATE';
    risk_color = '#f59e0b';
  } else if (totalScore >= 40) {
    risk_label = 'CAUTION';
    risk_color = '#f97316';
  } else {
    risk_label = 'HIGH_RISK';
    risk_color = '#ef4444';
  }

  return {
    total_score: totalScore,
    components: {
      verification_status_score: verificationScore,
      domain_age_score: domainAgeScore,
      community_penalty: communityPenalty,
      email_consistency_score: emailConsistencyScore,
      linkedin_score: linkedinScore,
    },
    risk_label,
    risk_color,
  };
}
