const supabase = require('../services/supabase');

// PATCH /payment/:deal_id
// Dummy payment — just records the payment intent and marks deal as "paid".
// Replace this with Stripe/Razorpay when ready.
async function updatePayment(req, res, next) {
  try {
    const { deal_id } = req.params;
    const { amount, currency = 'USD', payment_method = 'dummy', notes } = req.body;

    const { data: payment, error: payErr } = await supabase
      .from('payments')
      .upsert({
        deal_id,
        amount,
        currency,
        payment_method,
        notes,
        status: 'paid', // dummy — always succeeds
      }, { onConflict: 'deal_id' })
      .select()
      .single();
    if (payErr) throw payErr;

    // Advance deal to "paid"
    await supabase.from('deals').update({ status: 'paid' }).eq('id', deal_id);

    res.json({ message: 'Payment recorded (dummy)', payment });
  } catch (err) {
    next(err);
  }
}

module.exports = { updatePayment };
