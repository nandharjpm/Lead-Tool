import mongoose from 'mongoose';

const FingerprintSchema = new mongoose.Schema({
  fingerprint: { type: String, required: true, unique: true },
  credits: { type: Number, default: 3 }, // anonymous default
  linkedUserId: { type: String, default: null },
  hits: { type: Number, default: 0 },
  ip: String,
  userAgent: String,
  createdAt: { type: Date, default: Date.now },
  lastSeen: { type: Date, default: Date.now }
});

export default mongoose.models.Fingerprint || mongoose.model('Fingerprint', FingerprintSchema);
