const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');

const sb = () => createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();

  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature feil:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  const db = sb();

  switch (event.type) {

    case 'checkout.session.completed': {
      const session = event.data.object;
      const email = session.customer_details?.email || session.customer_email;
      const customerId = session.customer;
      const subscriptionId = session.subscription;

      if (!email) break;

      // Finn bruker via email
      const { data: users } = await db.auth.admin.listUsers();
      const user = users?.users?.find(u => u.email === email);
      if (!user) break;

      // Hent subscription-detaljer
      let periodEnd = null;
      let plan = 'monthly';
      if (subscriptionId) {
        try {
          const sub = await stripe.subscriptions.retrieve(subscriptionId);
          periodEnd = new Date(sub.current_period_end * 1000).toISOString();
          // Detect plan from price
          const priceId = sub.items.data[0]?.price?.id;
          if (priceId === process.env.STRIPE_PRICE_YEARLY) plan = 'yearly';
        } catch(e) {}
      }

      // Upsert subscription
      await db.from('subscriptions').upsert({
        user_id: user.id,
        stripe_customer_id: customerId,
        stripe_subscription_id: subscriptionId,
        status: 'active',
        plan: plan,
        current_period_end: periodEnd,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' });

      console.log(`✅ Pro aktivert for ${email}`);
      break;
    }

    case 'customer.subscription.updated': {
      const sub = event.data.object;
      const customerId = sub.customer;
      const status = sub.status === 'active' ? 'active' : 'inactive';
      const periodEnd = new Date(sub.current_period_end * 1000).toISOString();

      await db.from('subscriptions')
        .update({ status, current_period_end: periodEnd, updated_at: new Date().toISOString() })
        .eq('stripe_customer_id', customerId);

      console.log(`🔄 Abonnement oppdatert for customer ${customerId}: ${status}`);
      break;
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object;
      const customerId = sub.customer;

      await db.from('subscriptions')
        .update({ status: 'inactive', updated_at: new Date().toISOString() })
        .eq('stripe_customer_id', customerId);

      console.log(`❌ Abonnement kansellert for customer ${customerId}`);
      break;
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object;
      const customerId = invoice.customer;

      await db.from('subscriptions')
        .update({ status: 'past_due', updated_at: new Date().toISOString() })
        .eq('stripe_customer_id', customerId);

      console.log(`⚠️ Betaling feilet for customer ${customerId}`);
      break;
    }
  }

  res.json({ received: true });
};
