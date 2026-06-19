import express from 'express';
import { MedReferralRecord } from '../models/MedReferralRecord.js';
import { protect } from '../middleware/auth.js';
import { logAudit } from '../services/audit.js';
import { encryptField } from '../lib/encryption.js';
import { buildReferralExport, ConsentError } from '../services/referralExport.js';

const router = express.Router();
router.use(protect);

const ENC_PRESCRIBER_FIELDS = ['name', 'practice', 'phone', 'fax', 'secureContact'];

// Create a record
router.post('/', async (req, res) => {
  try {
    const record = new MedReferralRecord({
      clientCode: req.body.clientCode,
      clinicianId: req.user._id,
      consent: req.body.consent,
      allergies: req.body.allergies,
    });
    await record.save();
    await logAudit({ recordId: record._id, actorId: req.user._id, action: 'create', entity: 'record' });
    res.status(201).json({ success: true, data: record });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Add a medication
router.post('/:id/medications', async (req, res) => {
  const record = await MedReferralRecord.findOne({ _id: req.params.id, clinicianId: req.user._id });
  if (!record) return res.status(404).json({ success: false, error: 'not found' });
  record.medications.push(req.body);
  await record.save();
  await logAudit({ recordId: record._id, actorId: req.user._id, action: 'update', entity: 'medication' });
  res.status(201).json({ success: true, data: record.medications.at(-1) });
});

// Add an observation (totals computed by pre-save hook)
router.post('/:id/observations', async (req, res) => {
  const record = await MedReferralRecord.findOne({ _id: req.params.id, clinicianId: req.user._id });
  if (!record) return res.status(404).json({ success: false, error: 'not found' });
  record.observations.push(req.body);
  await record.save();
  await logAudit({ recordId: record._id, actorId: req.user._id, action: 'update', entity: 'observation' });
  res.status(201).json({ success: true, data: record.observations.at(-1) });
});

// Add a prescriber (contact fields encrypted before save)
router.post('/:id/prescribers', async (req, res) => {
  const record = await MedReferralRecord.findOne({ _id: req.params.id, clinicianId: req.user._id });
  if (!record) return res.status(404).json({ success: false, error: 'not found' });
  const p = { role: req.body.role };
  for (const f of ENC_PRESCRIBER_FIELDS) {
    if (req.body[f]) p[f] = encryptField(req.body[f]);
  }
  record.prescribers.push(p);
  await record.save();
  await logAudit({ recordId: record._id, actorId: req.user._id, action: 'update', entity: 'prescriber' });
  res.status(201).json({ success: true, data: { _id: record.prescribers.at(-1)._id, role: p.role } });
});

// Score trend for one instrument — deltas only, no verdicts
router.get('/:id/trends', async (req, res) => {
  const record = await MedReferralRecord.findOne({ _id: req.params.id, clinicianId: req.user._id });
  if (!record) return res.status(404).json({ success: false, error: 'not found' });
  const inst = req.query.instrument;
  const series = (record.observations || [])
    .filter((o) => o[inst]?.total != null)
    .map((o) => ({ observedAt: o.observedAt, total: o[inst].total }))
    .sort((a, b) => new Date(a.observedAt) - new Date(b.observedAt));
  res.json({ success: true, instrument: inst, data: series });
});

// Generate a referral export (consent-gated; re-loads encrypted fields just for this)
router.post('/:id/exports', async (req, res) => {
  const selectEnc = ENC_PRESCRIBER_FIELDS.map((f) => `+prescribers.${f}`).join(' ');
  const record = await MedReferralRecord.findOne({ _id: req.params.id, clinicianId: req.user._id }).select(selectEnc);
  if (!record) return res.status(404).json({ success: false, error: 'not found' });
  try {
    const payload = buildReferralExport(record, {
      recipientId: req.body.recipientId,
      referralReason: req.body.referralReason,
    });
    // Persist the export WITHOUT the decrypted contact fields
    const { recipientName, recipientContact, ...persisted } = payload;
    record.referralExports.push(persisted);
    await record.save();
    await logAudit({ recordId: record._id, actorId: req.user._id, action: 'export', entity: 'referralExport' });
    res.status(201).json({ success: true, data: payload }); // payload (in-memory) carries decrypted recipient for rendering
  } catch (err) {
    if (err instanceof ConsentError) return res.status(409).json({ success: false, error: err.message });
    res.status(400).json({ success: false, error: err.message });
  }
});

export default router;
