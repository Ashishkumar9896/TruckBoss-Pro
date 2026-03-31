function toNumber(value) {
  return Number(value || 0);
}

function getTripExpectedAmount(trip) {
  return toNumber(trip.amount);
}

function buildSettlementMap(trips, transactions) {
  const orderedTrips = [...trips]
    .map((trip) => ({
      ...trip,
      expected_amount: getTripExpectedAmount(trip),
    }))
    .sort((a, b) => {
      const dateDiff = new Date(a.trip_date) - new Date(b.trip_date);
      if (dateDiff !== 0) return dateDiff;
      return Number(a.trip_id || 0) - Number(b.trip_id || 0);
    });

  const orderedPayments = [...transactions].sort((a, b) => {
    const dateDiff = new Date(a.payment_date) - new Date(b.payment_date);
    if (dateDiff !== 0) return dateDiff;
    return Number(a.transaction_id || 0) - Number(b.transaction_id || 0);
  });

  let paymentPool = orderedPayments.reduce((sum, payment) => sum + toNumber(payment.amount), 0);
  const settlementMap = {};

  orderedTrips.forEach((trip) => {
    const expected = toNumber(trip.expected_amount);
    const received = Math.min(paymentPool, expected);
    paymentPool = Math.max(paymentPool - expected, 0);
    const pending = Math.max(expected - received, 0);

    settlementMap[trip.trip_id] = {
      expected_amount: Number(expected.toFixed(2)),
      received_amount: Number(received.toFixed(2)),
      pending_amount: Number(pending.toFixed(2)),
      settlement_status: pending > 0 ? "Pending Settlement" : "Settled",
      pending_settlement_flag: pending > 0,
    };
  });

  return settlementMap;
}

function getOutstandingAgeBucket(days) {
  if (days === null || days === undefined) return "Settled";
  if (days <= 7) return "0-7 days";
  if (days <= 30) return "8-30 days";
  return "30+ days";
}

module.exports = {
  getTripExpectedAmount,
  buildSettlementMap,
  getOutstandingAgeBucket,
};
