import dotenv from 'dotenv';
dotenv.config();
import { createApp } from './app.js';
import { connectDb } from './config/db.js';

const PORT = process.env.PORT || 5000;

(async () => {
  await connectDb();
  createApp().listen(PORT, () => console.log(`med-referral listening on ${PORT}`));
})().catch((err) => {
  console.error('Boot failed:', err.message);
  process.exit(1);
});
