// Consent / ROI gate. Export generation is blocked unless this returns true.
export function consentValid(consent, now = new Date()) {
  if (!consent || consent.roiOnFile !== true) return false;
  if (consent.expiresAt && new Date(consent.expiresAt) <= now) return false;
  return true;
}
