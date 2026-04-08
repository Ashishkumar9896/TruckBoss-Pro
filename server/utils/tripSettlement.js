function toNumber(value) {
  return Number(value || 0);
}

function getTripExpectedAmount(trip) {
  return toNumber(trip.amount);
}

function extractLinkedTripId(notes) {
  const text = String(notes || "").trim();
  const match = text.match(/^(?:partial\s+)?trip payment received for trip #(\d+)/i);
  return match ? Number(match[1]) : null;
}

/**
 * Intelligent settlement logic that prioritizes direct payments while allowing
 * excess funds to flow into a general customer pool to cover other trips.
 */
function buildSettlementMap(trips, transactions) {
  const directPaymentsByTripId = {};
  let generalPool = 0;

  (transactions || []).forEach((tx) => {
    const linkedTripId = extractLinkedTripId(tx.notes);
    const amt = toNumber(tx.amount);
    if (linkedTripId) {
      directPaymentsByTripId[linkedTripId] = (directPaymentsByTripId[linkedTripId] || 0) + amt;
    } else {
      generalPool += amt;
    }
  });

  const settlementMap = {};

  // Trips must be sorted by date and ID to ensure chronological settlement
  const sortedTrips = [...(trips || [])].sort((a, b) => {
    const dateA = new Date(a.trip_date).getTime();
    const dateB = new Date(b.trip_date).getTime();
    if (dateA !== dateB) return dateA - dateB;
    return (a.trip_id || 0) - (b.trip_id || 0);
  });

  sortedTrips.forEach((trip) => {
    const expected = getTripExpectedAmount(trip);
    const directReceived = toNumber(directPaymentsByTripId[trip.trip_id]);
    
    // 1. Apply direct payment first
    let received = Math.min(expected, directReceived);
    
    // 2. Add excess direct payment to the general pool (no money vanishes!)
    const excess = Math.max(0, directReceived - expected);
    generalPool += excess;

    // 3. Cover remaining balance from the general pool
    const remainingNeeded = Math.max(0, expected - received);
    if (remainingNeeded > 0) {
      const fromPool = Math.min(remainingNeeded, generalPool);
      received += fromPool;
      generalPool -= fromPool;
    }

    const nextPending = Math.max(expected - received, 0);

    settlementMap[trip.trip_id] = {
      expected_amount: Number(expected.toFixed(2)),
      received_amount: Number(received.toFixed(2)),
      pending_amount: Number(nextPending.toFixed(2)),
      settlement_status: nextPending <= 0.0001 ? "Settled" : "Pending Settlement",
      pending_settlement_flag: nextPending > 0.0001,
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
  extractLinkedTripId
};
