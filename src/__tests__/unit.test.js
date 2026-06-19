import { describe, it, expect, beforeAll } from 'vitest';
import { encryptField, decryptField } from '../lib/encryption.js';
import { computeObservationTotals, computeClassModuleTotals } from '../lib/scoring.js';
import { consentValid } from '../lib/consent.js';
import { buildReferralExport, ConsentError } from '../services/referralExport.js';
import { MedReferralRecord } from '../models/MedReferralRecord.js';

beforeAll(() => {
  // 32-byte test key (base64). Never use a hardcoded key outside tests.
  process.env.FIELD_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');
});

describe('field encryption', () => {
  it('round-trips a value', () => {
    const blob = encryptField('Dr. Jane Roe');
    expect(blob).toHaveProperty('ciphertext');
    expect(blob.ciphertext).not.toContain('Jane');
    expect(decryptField(blob)).toBe('Dr. Jane Roe');
  });
  it('returns undefined for empty input', () => {
    expect(encryptField('')).toBeUndefined();
    expect(encryptField(null)).toBeUndefined();
  });
  it('detects tampering (GCM auth)', () => {
    const blob = encryptField('secret');
    blob.ciphertext = Buffer.from('tampered').toString('base64');
    expect(() => decryptField(blob)).toThrow();
  });
});

describe('scoring (totals only)', () => {
  it('computes observation totals', () => {
    const o = computeObservationTotals({
      phq9: { items: [1, 2, 1, 0, 2, 1, 1, 0, 1] },
      gad7: { items: [1, 1, 2, 1, 0, 1, 1] },
      pcl5: { items: Array(20).fill(1) },
    });
    expect(o.phq9.total).toBe(9);
    expect(o.gad7.total).toBe(7);
    expect(o.pcl5.total).toBe(20);
  });
  it('computes class-module totals', () => {
    const cm = computeClassModuleTotals({
      gass: { items: [{ score: 2 }, { score: 3 }] },
      sds: { items: [1, 2, 3, 0, 1] },
      asrs: { items: [4, 4, 2] },
    });
    expect(cm.gass.total).toBe(5);
    expect(cm.sds.total).toBe(7);
    expect(cm.asrs.total).toBe(10);
  });
});

describe('consent gate', () => {
  it('valid when ROI on file and not expired', () => {
    expect(consentValid({ roiOnFile: true })).toBe(true);
  });
  it('invalid when no ROI', () => {
    expect(consentValid({ roiOnFile: false })).toBe(false);
    expect(consentValid(undefined)).toBe(false);
  });
  it('invalid when expired', () => {
    expect(consentValid({ roiOnFile: true, expiresAt: new Date('2020-01-01') })).toBe(false);
  });
});

describe('referral export', () => {
  const baseRecord = () => ({
    consent: { roiOnFile: true },
    medications: [{ name: 'Sertraline', doseText: '50 mg', medicationClass: 'antidepressant', status: 'active' }],
    allergies: [{ substance: 'penicillin' }],
    observations: [{ observedAt: new Date(), phq9: { total: 9 }, gad7: { total: 7 }, symptomTrend: 'improving', functionalImpairment: 'mild' }],
    prescribers: [{ _id: 'p1', name: encryptField('Dr. Jane Roe'), secureContact: encryptField('roe@clinic.example') }],
  });

  it('blocks without consent', () => {
    const rec = baseRecord();
    rec.consent.roiOnFile = false;
    expect(() => buildReferralExport(rec, { recipientId: 'p1' })).toThrow(ConsentError);
  });

  it('decrypts recipient ONLY in export and builds SBAR', () => {
    const exp = buildReferralExport(baseRecord(), { recipientId: 'p1', referralReason: 'Review sedation' });
    expect(exp.recipientName).toBe('Dr. Jane Roe');
    expect(exp.background).toContain('Sertraline');
    expect(exp.background).toContain('penicillin');
    expect(exp.assessment).toContain('PHQ-9: 9');
    expect(exp.recommendation).toBe('Requesting prescriber review.');
  });
});

describe('no-verdict guarantee', () => {
  it('schema has no dosing/verdict fields', () => {
    const paths = Object.keys(MedReferralRecord.schema.paths).join(' ');
    expect(paths).not.toMatch(/dosageStatus|mgPerKg|dailyDoseMg|medicationLoadFlag|weightKg/);
  });
});
