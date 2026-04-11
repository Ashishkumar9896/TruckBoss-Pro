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
 * Core settlement engine that calculates trip-level financial standing.
 * It prioritizes direct payment linkage while allowing excess funds to flow into 
 * a general customer pool, which is then used to cover outstanding balances for 
 * other trips in chronological order.
 * 
 * @param {Array} trips - List of trip records for the customer.
 * @param {Array} transactions - List of customer payments and receipts.
 * @returns {Object} A map of trip IDs to their calculated settlement metadata.
 */
function buildSettlementMap(trips, transactions) {
  const directPaymentsByTripId = {};
  let generalPool = 0;

  // Distribute payments between direct trip links and the general credit pool.
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

  // Sort trips chronologically by date and ID to ensure fair and accurate settlement.
  const sortedTrips = [...(trips || [])].sort((a, b) => {
    const dateA = new Date(a.trip_date).getTime();
    const dateB = new Date(b.trip_date).getTime();
    if (dateA !== dateB) return dateA - dateB;
    return (a.trip_id || 0) - (b.trip_id || 0);
  });

  sortedTrips.forEach((trip) => {
    const expected = getTripExpectedAmount(trip);
    const directReceived = toNumber(directPaymentsByTripId[trip.trip_id]);
    
    // Step 1: Apply direct payments tied specifically to this trip ID.
    let received = Math.min(expected, directReceived);
    
    // Step 2: Track excess funds from direct payments and redirect them to the general pool.
    const excess = Math.max(0, directReceived - expected);
    generalPool += excess;

    // Step 3: Attempt to cover any remaining balance using available funds from the general pool.
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
