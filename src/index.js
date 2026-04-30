require('dotenv').config();
const express = require('express');
const cors = require('cors');

const waitlistRoutes   = require('./routes/waitlist');
const marketingRoutes  = require('./routes/marketing');
const profileRoutes   = require('./routes/profile');
const outreachRoutes  = require('./routes/outreach');
const inboxRoutes     = require('./routes/inbox');
const dealRoutes      = require('./routes/deals');
const proposalRoutes  = require('./routes/proposals');
const paymentRoutes   = require('./routes/payments');
const errorHandler    = require('./middleware/error');
const auth            = require('./middleware/auth');

const app = express();

app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => res.json({ status: 'ok', app: 'vesca.io', v: '288c2e2', routes: ['profile','outreach','inbound','deals','proposal','payment','marketing'] }));

app.use('/waitlist',   waitlistRoutes);
app.use('/marketing',  marketingRoutes);
app.use('/profile',   auth, profileRoutes);
app.use('/outreach',  auth, outreachRoutes);
app.use('/inbound',   auth, inboxRoutes);
app.use('/deals',     auth, dealRoutes);
app.use('/proposal',  auth, proposalRoutes);
app.use('/payment',   auth, paymentRoutes);

app.use(errorHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Vesca backend running on port ${PORT}`));
// railway redeploy Wed Apr 29 20:00:36 CDT 2026
