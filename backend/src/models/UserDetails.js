import mongoose from 'mongoose';

const UserDetailsSchema = new mongoose.Schema({
  firstName: { type: String, trim: true },
  lastName: { type: String, trim: true },
  email: { type: String, trim: true, lowercase: true, index: true },
  company: { type: String, trim: true },
  title: { type: String, trim: true },
  phone: { type: String, trim: true },
  notes: { type: String, default: '' },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  createdByFingerprint: { type: String, default: null },
  linkedUserId: { type: String, default: null },
}, {
  timestamps: true
});

// Add a simple text index for basic search
UserDetailsSchema.index({ firstName: 'text', lastName: 'text', company: 'text', title: 'text', email: 'text' });

export default mongoose.models.UserDetails || mongoose.model('UserDetails', UserDetailsSchema);
