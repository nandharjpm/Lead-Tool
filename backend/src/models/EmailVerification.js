import mongoose from 'mongoose';

const EmailVerificationSchema = new mongoose.Schema({
  fingerprintId: { type: String, default: null },
  requestedBy: { type: String, default: null },
  emails: [String],
  results: [mongoose.Schema.Types.Mixed],
  ip: String,
  userAgent: String,
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.models.EmailVerification || mongoose.model('EmailVerification', EmailVerificationSchema);
