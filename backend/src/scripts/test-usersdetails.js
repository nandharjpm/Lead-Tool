import axios from 'axios';

const API = process.env.API_URL || 'http://localhost:5000';

async function run() {
  try {
    console.log('Creating a user details document...');
    const createRes = await axios.post(`${API}/api/usersdetails`, {
      firstName: 'Vikki',
      lastName: 'Tester',
      email: 'vikki.tester@example.com',
      company: 'Example Co',
      title: 'QA',
      phone: '+1-555-0000',
      notes: 'Created by test script',
    }, { timeout: 5000 });

    console.log('Create response:', createRes.data);
    const id = createRes.data?.data?._id;

    if (!id) throw new Error('No id returned from create');

    console.log('Fetching created document...');
    const getRes = await axios.get(`${API}/api/usersdetails/${id}`);
    console.log('Get response:', getRes.data);

    console.log('Listing documents (q=Vikki)...');
    const listRes = await axios.get(`${API}/api/usersdetails`, { params: { q: 'Vikki', limit: 5 } });
    console.log('List response total:', listRes.data.total);

    console.log('Updating document (notes)...');
    const updateRes = await axios.put(`${API}/api/usersdetails/${id}`, { notes: 'Updated by test' });
    console.log('Update response:', updateRes.data);

    console.log('Deleting document...');
    const delRes = await axios.delete(`${API}/api/usersdetails/${id}`);
    console.log('Delete response:', delRes.data);

    console.log('\nAll user details tests completed successfully.');
  } catch (err) {
    console.error('User details test failed:', err.message || err);
    if (err.response) console.error('Response data:', err.response.data);
    process.exit(1);
  }
}

if (require.main === module) run();
