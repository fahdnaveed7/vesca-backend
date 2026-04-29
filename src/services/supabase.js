const { createClient } = require('@supabase/supabase-js');

// Single shared client using service role key (bypasses RLS for backend operations)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

module.exports = supabase;
