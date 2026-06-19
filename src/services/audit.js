import { AuditEvent } from '../models/AuditEvent.js';

export function logAudit({ recordId, actorId, action, entity, changedFields = [] }) {
  return AuditEvent.create({ recordId, actorId, action, entity, changedFields });
}
