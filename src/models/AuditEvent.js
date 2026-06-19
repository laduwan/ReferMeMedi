import mongoose from 'mongoose';
const { Schema } = mongoose;

const AuditEventSchema = new Schema({
  recordId: { type: Schema.Types.ObjectId, ref: 'MedReferralRecord', index: true },
  actorId: { type: Schema.Types.ObjectId },
  action: { type: String, enum: ['create', 'update', 'delete', 'export', 'access'] },
  entity: { type: String },
  changedFields: [{ type: String }],
  at: { type: Date, default: Date.now },
});

export const AuditEvent =
  mongoose.models.AuditEvent || mongoose.model('AuditEvent', AuditEventSchema);
