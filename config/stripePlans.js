// Single source of truth for subscription plans.
// `amount` / `interval` / `interval_count` drive Stripe; the display fields drive the
// public pricing page (GET /api/payments/plans) so the frontend keeps no plan array.

const PLANS = {
  mini: {
    name: 'Mini Plan',
    amount: 10000, // $100.00
    currency: 'usd',
    interval: 'month',
    interval_count: 1,

    // ─── Display metadata (public) ─────────────────────────────
    order: 1,
    intervalLabel: 'monthly',
    subtitle: 'Great for small clinics starting out',
    icon: 'zap',
    popular: false,
    color: 'from-blue-500 to-cyan-500',
    btnColor: 'bg-blue-600 hover:bg-blue-700 text-white',
    features: [
      'Up to 5 Staff Accounts',
      'Basic Appointment Management',
      'Patient Records & History',
      'Email Support'
    ]
  },
  basic: {
    name: 'Basic Plan',
    amount: 20000, // $200.00
    currency: 'usd',
    interval: 'month',
    interval_count: 3,

    order: 2,
    intervalLabel: 'quarterly',
    subtitle: 'Ideal for growing veterinary hospitals',
    icon: 'sparkles',
    popular: true,
    color: 'from-emerald-500 to-teal-600',
    btnColor: 'bg-teal-600 hover:bg-teal-700 text-white shadow-lg shadow-teal-600/30',
    features: [
      'Up to 25 Staff Accounts',
      'Advanced Calendar & Scheduling',
      'Billing, Invoicing & Prescriptions',
      'Google Calendar Integration',
      '24/7 Priority Support'
    ]
  },
  advanced: {
    name: 'Advanced Plan',
    amount: 50000, // $500.00
    currency: 'usd',
    interval: 'year',
    interval_count: 1,

    order: 3,
    intervalLabel: 'yearly',
    subtitle: 'For enterprise multi-branch hospitals',
    icon: 'crown',
    popular: false,
    color: 'from-purple-600 to-indigo-600',
    btnColor: 'bg-indigo-600 hover:bg-indigo-700 text-white',
    features: [
      'Unlimited Staff & Admin Accounts',
      'Multi-Branch Hospital Management',
      'Custom Workflow & Integrations',
      'Dedicated Account Manager',
      'Full Analytics & Export Tools'
    ]
  }
};

const CURRENCY_SYMBOLS = { usd: '$', eur: '€', gbp: '£', inr: '₹' };

const formatPrice = (amount, currency = 'usd') => {
  const symbol = CURRENCY_SYMBOLS[String(currency).toLowerCase()] || '';
  const value = amount / 100;
  const text = Number.isInteger(value) ? String(value) : value.toFixed(2);
  return `${symbol}${text}`;
};

// Shape consumed by the pricing page — no Stripe internals leak out.
const getPublicPlans = () =>
  Object.entries(PLANS)
    .map(([key, plan]) => ({
      key,
      name: plan.name,
      price: formatPrice(plan.amount, plan.currency),
      amount: plan.amount,
      currency: plan.currency || 'usd',
      interval: plan.intervalLabel || plan.interval,
      intervalCount: plan.interval_count,
      subtitle: plan.subtitle || '',
      icon: plan.icon || 'sparkles',
      popular: !!plan.popular,
      color: plan.color || 'from-blue-500 to-cyan-500',
      btnColor: plan.btnColor || 'bg-blue-600 hover:bg-blue-700 text-white',
      features: plan.features || []
    }))
    .sort((a, b) => (PLANS[a.key].order || 0) - (PLANS[b.key].order || 0));

module.exports = { PLANS, getPublicPlans, formatPrice };
