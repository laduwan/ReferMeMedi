// Render-shell smoke test: node src/scripts/smokeTest.js
// Exercises the full path against the configured MONGODB_URI (use a TEST database).
import dotenv from 'dotenv';
dotenv.config();
import mongoose from 'mongoose';
import { connectDb } from '../config/db.js';
import { MedReferralRecord } from '../models/MedReferralRecord.js';
import { encryptField } from '../lib/encryption.js';
import { buildReferralExport } from '../services/referralExport.js';

(async () => {
  await connectDb();
  const clinicianId = new mongoose.Types.ObjectId();
  const code = 'SMOKE-' + Date.now();

  const rec = new MedReferralRecord({
    clientCode: code,
    clinicianId,
    consent: { roiOnFile: true, consentDate: new Date() },
    medications: [{ name: 'Sertraline', medicationClass: 'antidepressant', doseText: '50 mg', status: 'active' }],
    observations: [{ phq9: { items: [1, 2, 1, 0, 2, 1, 1, 0, 1] }, gad7: { items: [1, 1, 2, 1, 0, 1, 1] }, symptomTrend: 'improving' }],
    prescribers: [{ role: 'psychiatrist', name: encryptField('Dr. Jane Roe'), secureContact: encryptField('roe@clinic.example') }],
  });
  await rec.save();

  const phq = rec.observations[0].phq9.total;
  const reloaded = await MedReferralRecord.findById(rec._id); // default select
  const hiddenByDefault = reloaded.prescribers[0].name === undefined;

  const withEnc = await MedReferralRecord.findById(rec._id).select('+prescribers.name +prescribers.secureContact');
  const exp = buildReferralExport(withEnc, { recipientId: rec.prescribers[0]._id, referralReason: 'Review sedation' });

  console.log('PHQ-9 total (hook):', phq, '(expected 9)');
  console.log('Prescriber name hidden on default read:', hiddenByDefault, '(expected true)');
  console.log('Export recipient (decrypted in export only):', exp.recipientName, '(expected Dr. Jane Roe)');
  console.log('Export recommendation:', exp.recommendation);

  await MedReferralRecord.deleteOne({ _id: rec._id });
  await mongoose.disconnect();
  console.log('SMOKE OK');
})().catch((e) => { console.error('SMOKE FAIL:', e); process.exit(1); });
