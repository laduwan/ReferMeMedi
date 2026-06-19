// STUB auth for the standalone test environment.
// Swap for JWT verification (independent) or shared CounselorReady auth before any real use.
import mongoose from 'mongoose';

const STUB_ID = process.env.STUB_CLINICIAN_ID || '000000000000000000000001';

export function protect(req, _res, next) {
  req.user = { _id: new mongoose.Types.ObjectId(STUB_ID), role: 'clinician' };
  next();
}
