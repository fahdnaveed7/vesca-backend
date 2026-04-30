require('dotenv').config();
const express    = require('express');
const cors       = require('cors');
const helmet     = require('helmet');
const rateLimit  = require('express-rate-limit');

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

// ── Security headers ──────────────────────────────────────
app.use(helmet());

// ── CORS — only allow the real frontend ──────────────────
const ALLOWED_ORIGINS = [
  'https://getvesca.com',
  'https://www.getvesca.com',
  ...(process.env.NODE_ENV !== 'production' ? ['http://localhost:3000', 'http://localhost:5500', 'null'] : []),
];
app.use(cors({
  origin: (origin, cb) => {
    // allow curl / server-to-server calls (no origin header)
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-cron-secret'],
}));

app.use(express.json({ limit: '64kb' }));

// ── Rate limiters ─────────────────────────────────────────
// Waitlist: 5 signups per IP per hour
const waitlistLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { error: 'Too many signups from this IP, try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// AI endpoints: 20 calls per IP per hour (prevents OpenAI bill abuse)
const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  message: { error: 'Rate limit reached. Please wait before generating more content.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// General API: 200 req per IP per 15 min
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { error: 'Too many requests, slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(generalLimiter);

// ── Admin guard (cron secret) ─────────────────────────────
function requireCronSecret(req, res, next) {
  if (req.headers['x-cron-secret'] !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// Waitlist POST is rate-limited; GET requires cron secret (admin only)
app.post('/waitlist',  waitlistLimiter, require('./controllers/waitlist').joinWaitlist);
app.get('/waitlist',   requireCronSecret, require('./controllers/waitlist').getWaitlist);

app.use('/marketing',  marketingRoutes);
app.use('/profile',   auth, profileRoutes);
app.use('/outreach',  auth, aiLimiter, outreachRoutes);
app.use('/inbound',   auth, aiLimiter, inboxRoutes);
app.use('/deals',     auth, dealRoutes);
app.use('/proposal',  auth, aiLimiter, proposalRoutes);
app.use('/payment',   auth, paymentRoutes);

app.use(errorHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Vesca backend running on port ${PORT}`));
// railway redeploy Wed Apr 29 20:00:36 CDT 2026
