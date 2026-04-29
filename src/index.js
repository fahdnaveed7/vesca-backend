require('dotenv').config();
const express = require('express');
const cors = require('cors');

const waitlistRoutes  = require('./routes/waitlist');
const outreachRoutes  = require('./routes/outreach');
const inboxRoutes     = require('./routes/inbox');
const dealRoutes      = require('./routes/deals');
const proposalRoutes  = require('./routes/proposals');
const paymentRoutes   = require('./routes/payments');
const errorHandler    = require('./middleware/error');

const app = express();

app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => res.json({ status: 'ok', app: 'vesca.io' }));

app.use('/waitlist',  waitlistRoutes);
app.use('/outreach',  outreachRoutes);
app.use('/inbound',   inboxRoutes);
app.use('/deals',     dealRoutes);
app.use('/proposal',  proposalRoutes);
app.use('/payment',   paymentRoutes);

app.use(errorHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Vesca backend running on port ${PORT}`));
