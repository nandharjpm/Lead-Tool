import mongoose from 'mongoose';

const EmailSearchSchema = new mongoose.Schema({
  fingerprintId: { type: String, default: null, index: true },
  queriedBy: { type: String, default: null }, // optional user id
  firstName: String,
  lastName: String,
  domain: String,
  cleanDomain: String,
  hunterResponse: mongoose.Schema.Types.Mixed,
  results: [{
    email: String,
    status: String,
    confidence: Number,
    creditsRemaining: Number
  }],
  creditsUsed: { type: Number, default: 1 },
  ip: String,
  userAgent: String,
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.models.EmailSearch || mongoose.model('EmailSearch', EmailSearchSchema);
