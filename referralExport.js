import { consentValid } from '../lib/consent.js';
import { decryptField } from '../lib/encryption.js';

export class ConsentError extends Error {
  constructor(msg) {
    super(msg);
    this.name = 'ConsentError';
  }
}

// Builds an SBAR referral payload.
// - Blocked unless consent/ROI is valid.
// - Decryption of recipient contact data happens ONLY here, never in list/detail reads.
// `record` must be loaded WITH the encrypted prescriber fields selected (see routes).
export function buildReferralExport(record, { recipientId, referralReason } = {}) {
  if (!consentValid(record.consent)) {
    throw new ConsentError('Consent/ROI not on file or expired — export blocked');
  }

  const recipient = (record.prescribers || []).find(
    (p) => String(p._id) === String(recipientId)
  );
  const recipientName = recipient?.name ? decryptField(recipient.name) : undefined;
  const recipientContact = recipient?.secureContact ? decryptField(recipient.secureContact) : undefined;

  const activeMeds = (record.medications || []).filter((m) => m.status === 'active');
  const latest = (record.observations || [])
    .slice()
    .sort((a, b) => new Date(b.observedAt) - new Date(a.observedAt))[0];

  const background = [
    activeMeds.length
      ? 'Current medications: ' +
        activeMeds.map((m) => `${m.name}${m.doseText ? ' ' + m.doseText : ''} (${m.medicationClass})`).join('; ')
      : 'No active medications recorded.',
    (record.allergies || []).length
      ? 'Reported allergies: ' + record.allergies.map((a) => a.substance).join(', ')
      : null,
  ]
    .filter(Boolean)
    .join(' ');

  const assessment = latest
    ? [
        latest.phq9?.total != null ? `PHQ-9: ${latest.phq9.total}` : null,
        latest.gad7?.total != null ? `GAD-7: ${latest.gad7.total}` : null,
        latest.symptomTrend && latest.symptomTrend !== 'unknown' ? `Reported trend: ${latest.symptomTrend}` : null,
        latest.functionalImpairment ? `Functional impairment: ${latest.functionalImpairment}` : null,
      ]
        .filter(Boolean)
        .join('. ')
    : 'No observations recorded yet.';

  return {
    generatedAt: new Date(),
    referralReason: referralReason || '',
    recipientRef: recipient?._id,
    recipientName, // decrypted, in-memory only
    recipientContact,
    situation: referralReason || 'Referral for prescriber review of current psychotropic regimen.',
    background,
    assessment,
    recommendation: 'Requesting prescriber review.',
  };
}
