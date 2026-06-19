// Integration test — requires a MongoDB binary (mongodb-memory-server downloads one on first run,
// or set MONGOMS_SYSTEM_BINARY to a local mongod). Run in your env: npm test
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MedReferralRecord } from '../models/MedReferralRecord.js';
import { encryptField } from '../lib/encryption.js';
import { buildReferralExport } from '../services/referralExport.js';

let mongod;
beforeAll(async () => {
  process.env.FIELD_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});
afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

describe('record persistence', () => {
  it('computes totals via pre-save hook and hides encrypted contact by default', async () => {
    const rec = new MedReferralRecord({
      clientCode: 'ABC1',
      clinicianId: new mongoose.Types.ObjectId(),
      consent: { roiOnFile: true },
      observations: [{ phq9: { items: [1, 2, 1, 0, 2, 1, 1, 0, 1] } }],
      prescribers: [{ role: 'psychiatrist', name: encryptField('Dr. Jane Roe'), secureContact: encryptField('roe@clinic.example') }],
    });
    await rec.save();
    expect(rec.observations[0].phq9.total).toBe(9);

    const def = await MedReferralRecord.findById(rec._id);
    expect(def.prescribers[0].name).toBeUndefined(); // select:false

    const withEnc = await MedReferralRecord.findById(rec._id).select('+prescribers.name +prescribers.secureContact');
    const exp = buildReferralExport(withEnc, { recipientId: rec.prescribers[0]._id, referralReason: 'x' });
    expect(exp.recipientName).toBe('Dr. Jane Roe');
  });
});
