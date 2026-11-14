// Vercel entry. Vercel serves everything in public/ itself; every other address goes to the Express app.
import { createApp } from '../server/index.js';

export default createApp();
