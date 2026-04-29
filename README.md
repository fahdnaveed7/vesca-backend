# Vesca.io — Backend

Deal Operating System for creators. Built with Node.js + Express + Supabase + Claude + Resend.

---

## Quick Start

```bash
cd vesca.io
npm install
cp .env.example .env   # fill in your keys
npm run dev
```

Server starts on `http://localhost:3000`.

---

## .env keys you need

| Key | Where to get it |
|-----|----------------|
| `SUPABASE_URL` | Supabase project → Settings → API |
| `SUPABASE_SERVICE_KEY` | Supabase project → Settings → API → service_role |
| `ANTHROPIC_API_KEY` | console.anthropic.com |
| `RESEND_API_KEY` | resend.com → API Keys |
| `RESEND_FROM` | verified sender email in Resend |

---

## Database setup

1. Open your Supabase project → SQL Editor
2. Paste and run the contents of `schema.sql`

---

## API Reference

### Health
```
GET /health
```

### Outreach
```
POST /outreach/generate      { brand, niche, pitch }
POST /outreach/send          { user_id, brand, niche, pitch, to_email }
```

### Inbox
```
POST /inbound/email          { user_id, from_email, from_name, subject, email_text }
```

### Deals
```
GET  /deals?user_id=xxx      list all deals (filter by ?status=contacted)
POST /deals                  { user_id, brand_name, notes?, status? }
PATCH /deals/:id/status      { status }
```

### Proposals
```
POST /proposal/generate      { deal_id, deliverables, price, timeline }
POST /proposal/pdf           { proposal_id }   → returns PDF file
POST /proposal/send          { proposal_id, to_email }
```

### Payments (dummy)
```
PATCH /payment/:deal_id      { amount, currency?, payment_method?, notes? }
```

---

## Folder structure

```
vesca.io/
  src/
    index.js              ← Express app entry
    routes/               ← One file per resource
    controllers/          ← Business logic
    services/
      supabase.js         ← Shared DB client
      claude.js           ← Claude API wrapper
      resend.js           ← Email sending
      pdf.js              ← Puppeteer PDF
    prompts/
      index.js            ← All Claude prompt templates
    middleware/
      error.js            ← Central error handler
  schema.sql              ← Run once in Supabase
  .env.example
  package.json
```

---

## Deal pipeline statuses

```
new → contacted → replied → negotiating → won → paid
```

---

## Connecting a Lovable frontend

Point all API calls to `http://localhost:3000` (dev) or your deployed URL (prod).
No auth middleware is in place for MVP — add Supabase JWT verification when ready.
