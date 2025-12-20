import axios from 'axios';

const API = process.env.API_URL || 'http://localhost:5000';

async function run() {
  try {
    console.log('Triggering /api/check-emails to create a persisted EmailVerification...');

    const payload = {
      emails: ['noone@example.com'],
      fingerprintId: 'test-fp-api'
    };

    let resp;
    try {
      resp = await axios.post(`${API}/api/check-emails`, payload, { timeout: 20000 });
      console.log('check-emails response:', resp.data?.success ? 'OK' : 'NO');
    } catch (err) {
      if (err.response) {
        console.log('check-emails response status:', err.response.status);
      } else {
        console.log('check-emails request error:', err.message);
      }
    }

    // Give server a moment to persist
    await new Promise(r => setTimeout(r, 1000));

    console.log('Querying /api/emailverifications?fingerprintId=test-fp-api');
    const list = await axios.get(`${API}/api/emailverifications`, { params: { fingerprintId: 'test-fp-api', limit: 10 } });
    console.log('Found:', list.data.total);

    if (list.data.total === 0) {
      console.error('No persisted EmailVerification found - check server logs');
      process.exit(1);
    }

    console.log('Test passed - persisted verification found.');

  } catch (err) {
    console.error('API persist test failed:', err.message || err);
    if (err.response) console.error('Response:', err.response.data);
    process.exit(1);
  }
}

if (require.main === module) run();
