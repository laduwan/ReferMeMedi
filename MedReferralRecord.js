import mongoose from 'mongoose';
import { computeObservationTotals, computeClassModuleTotals } from '../lib/scoring.js';

const { Schema } = mongoose;

// Encrypted blob stored at rest for sensitive contact fields. select:false => not loaded by default.
const EncBlob = new Schema(
  { iv: String, authTag: String, ciphertext: String },
  { _id: false }
);

const ConsentSchema = new Schema(
  {
    roiOnFile: { type: Boolean, default: false },
    consentDate: Date,
    authorizedRecipients: [{ type: EncBlob, select: false }],
    disclosureScope: { type: String, trim: true },
    expiresAt: Date,
    documentRef: { type: String, trim: true },
  },
  { _id: false }
);

const AllergySchema = new Schema(
  {
    substance: { type: String, required: true, trim: true },
    reactionReported: { type: String, trim: true },
    source: {
      type: String,
      enum: ['client_self_report', 'prescriber_records', 'other'],
      default: 'client_self_report',
    },
  },
  { _id: true }
);

const MedicationSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    genericName: { type: String, trim: true },
    medicationClass: {
      type: String,
      required: true,
      enum: ['antidepressant', 'antipsychotic', 'mood_stabilizer', 'anxiolytic_hypnotic', 'stimulant_adhd', 'other'],
    },
    doseText: { type: String, trim: true }, // free text — never parsed into mg/kg
    frequency: {
      type: String,
      enum: ['once_daily', 'twice_daily', 'three_times_daily', 'four_times_daily', 'as_needed', 'other'],
      default: 'once_daily',
    },
    route: {
      type: String,
      enum: ['oral', 'sublingual', 'injectable_im', 'injectable_iv', 'patch', 'other'],
      default: 'oral',
    },
    startDate: Date,
    status: { type: String, enum: ['active', 'discontinued', 'on_hold'], default: 'active' },
    discontinuedAt: Date,
    targetSymptoms: [{ type: String, trim: true }],
    prescriberRef: { type: Schema.Types.ObjectId },
    source: {
      type: String,
      enum: ['client_self_report', 'medication_bottle', 'prescriber_records', 'pharmacy', 'other'],
      default: 'client_self_report',
    },
    reconciledAt: Date,
    clientReportedAdherence: {
      type: String,
      enum: ['as_prescribed', 'missed_some', 'stopped', 'unknown'],
      default: 'unknown',
    },
  },
  { _id: true }
);

const ObservationSchema = new Schema(
  {
    observedAt: { type: Date, default: Date.now },
    enteredBy: { type: String, enum: ['clinician', 'client_self_report'], default: 'clinician' },
    phq9: { items: [{ type: Number, min: 0, max: 3 }], total: Number },
    gad7: { items: [{ type: Number, min: 0, max: 3 }], total: Number },
    pcl5: { items: [{ type: Number, min: 0, max: 4 }], total: Number },
    cssrs: {
      ideationLevel: { type: Number, min: 0, max: 5 },
      behaviorPresent: { type: Boolean, default: false },
      positiveScreen: { type: Boolean, default: false },
      notes: { type: String, trim: true },
      protocolPrompted: { type: Boolean, default: false },
      clinicianActionTaken: {
        type: String,
        enum: ['safety_plan_reviewed', 'referred_for_evaluation', 'contacted_crisis_services', 'prescriber_notified', 'other', 'none_documented'],
      },
      actionNotes: { type: String, trim: true },
      actionedAt: Date,
    },
    prise: [
      {
        domain: {
          type: String,
          enum: ['gastrointestinal', 'nervous_system', 'cardiac', 'eyes_ears', 'skin', 'genitourinary', 'sleep', 'sexual_function', 'other'],
        },
        rating: { type: Number, min: 0, max: 2 },
      },
    ],
    functionalImpairment: { type: String, enum: ['none', 'mild', 'moderate', 'marked', 'severe'] },
    prnUseNotes: { type: String, trim: true },
    symptomTrend: { type: String, enum: ['improving', 'stable', 'worsening', 'unknown'], default: 'unknown' },
    clinicianNotes: { type: String, trim: true },
  },
  { _id: true }
);

const ClassModuleSchema = new Schema(
  {
    medicationRef: { type: Schema.Types.ObjectId, required: true },
    medicationClass: { type: String, required: true },
    recordedAt: { type: Date, default: Date.now },
    enteredBy: { type: String, enum: ['clinician', 'client_self_report'], default: 'clinician' },
    fibser: { frequency: Number, intensity: Number, burden: Number },
    gass: { items: [{ id: String, score: Number, distressing: Boolean }], total: Number },
    aimsFlagForPrescriber: { type: Boolean, default: false },
    moodStabilizerLabDeferred: { type: Boolean, default: true },
    sds: { items: [{ type: Number, min: 0, max: 3 }], total: Number },
    sedationNotes: { type: String, trim: true },
    asrs: { items: [{ type: Number, min: 0, max: 4 }], total: Number },
    barkleyStimSideEffects: [{ symptom: String, severity: { type: Number, min: 0, max: 9 } }],
  },
  { _id: true }
);

const PrescriberSchema = new Schema(
  {
    // contact fields encrypted at rest + select:false => decrypted only in the export service
    name: { type: EncBlob, select: false },
    role: { type: String, enum: ['psychiatrist', 'pcp', 'np', 'pa', 'neurologist', 'other'] },
    practice: { type: EncBlob, select: false },
    phone: { type: EncBlob, select: false },
    fax: { type: EncBlob, select: false },
    secureContact: { type: EncBlob, select: false },
  },
  { _id: true }
);

const PharmacySchema = new Schema(
  {
    name: { type: EncBlob, select: false },
    phone: { type: EncBlob, select: false },
    fax: { type: EncBlob, select: false },
  },
  { _id: false }
);

const InstrumentScheduleSchema = new Schema(
  {
    instrument: { type: String, enum: ['phq9', 'gad7', 'pcl5', 'cssrs', 'fibser', 'gass', 'sds', 'asrs'] },
    cadenceDays: { type: Number, default: 14 },
    nextDueAt: Date,
  },
  { _id: true }
);

const ReferralExportSchema = new Schema(
  {
    generatedAt: { type: Date, default: Date.now },
    referralReason: { type: String, trim: true },
    recipientRef: { type: Schema.Types.ObjectId },
    situation: { type: String, trim: true },
    background: { type: String, trim: true },
    assessment: { type: String, trim: true },
    recommendation: { type: String, trim: true, default: 'Requesting prescriber review.' },
    clinicianEdited: { type: Boolean, default: false },
  },
  { _id: true }
);

const MedReferralRecordSchema = new Schema(
  {
    clientCode: { type: String, required: true, trim: true, uppercase: true },
    clinicianId: { type: Schema.Types.ObjectId, required: true }, // ref:'User' once auth model is chosen
    consent: ConsentSchema,
    allergies: [AllergySchema],
    medications: [MedicationSchema],
    observations: [ObservationSchema],
    classModules: [ClassModuleSchema],
    prescribers: [PrescriberSchema],
    pharmacy: PharmacySchema,
    instrumentSchedule: [InstrumentScheduleSchema],
    referralExports: [ReferralExportSchema],
    lastReconciledAt: Date,
    scheduledDeletionAt: Date,
    isArchived: { type: Boolean, default: false },
  },
  { timestamps: true }
);

MedReferralRecordSchema.index({ clinicianId: 1, clientCode: 1 }, { unique: true });
MedReferralRecordSchema.index({ clinicianId: 1, isArchived: 1 });

// Pre-save: compute instrument totals ONLY. No verdicts, ever.
MedReferralRecordSchema.pre('save', function (next) {
  (this.observations || []).forEach((o) => computeObservationTotals(o));
  (this.classModules || []).forEach((cm) => computeClassModuleTotals(cm));
  next();
});

export const MedReferralRecord =
  mongoose.models.MedReferralRecord || mongoose.model('MedReferralRecord', MedReferralRecordSchema);
