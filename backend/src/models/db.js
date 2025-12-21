import mongoose from 'mongoose';

console.log('MONGO_URI IN DB:', process.env.MONGO_URI); // should print the URI

mongoose.connect("mongodb://127.0.0.1:27017/leadtool")
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => {
    console.error('❌ MongoDB error:', err.message);
    process.exit(1);
  });
