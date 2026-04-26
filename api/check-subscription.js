const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();

  const { userId } = req.body;
  if (!userId) return res.json({ pro: false });

  const db = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );

  const { data } = await db
    .from('subscriptions')
    .select('status, plan, current_period_end')
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle();

  const pro = !!data;
  return res.json({ pro, plan: data?.plan || null, periodEnd: data?.current_period_end || null });
};
