import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../../.env') });

import EmailSearch from '../models/EmailSearch.js';
import EmailVerification from '../models/EmailVerification.js';

async function run() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/lead-tool';
  await mongoose.connect(uri);
  console.log('Connected to DB');

  try {
    const search = await EmailSearch.create({
      fingerprintId: 'test-fp-1',
      firstName: 'Test',
      lastName: 'User',
      domain: 'example.com',
      cleanDomain: 'example.com',
      hunterResponse: { mock: true },
      results: [{ email: 'alice@example.com', status: 'valid', confidence: 90, creditsRemaining: 2 }],
      creditsUsed: 1,
    });

    console.log('Created EmailSearch:', search._id.toString());

    const ver = await EmailVerification.create({
      fingerprintId: 'test-fp-1',
      emails: ['alice@example.com'],
      results: [{ email: 'alice@example.com', status: 'valid', confidence: 90 }]
    });

    console.log('Created EmailVerification:', ver._id.toString());

    const gotSearch = await EmailSearch.findById(search._id).lean();
    const gotVer = await EmailVerification.findById(ver._id).lean();

    console.log('Fetched EmailSearch:', gotSearch ? 'OK' : 'MISSING');
    console.log('Fetched EmailVerification:', gotVer ? 'OK' : 'MISSING');

    // Cleanup
    await EmailSearch.findByIdAndDelete(search._id);
    await EmailVerification.findByIdAndDelete(ver._id);

    console.log('Cleanup done');

  } catch (err) {
    console.error('Test persist failed:', err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected');
  }
}

if (require.main === module) run();
