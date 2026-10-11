const sum = (values) => values.reduce((total, value) => total + value, 0);
const value = (input) => Math.max(0, Number.isFinite(Number(input)) ? Number(input) : 0);

function simulate(days, sites, demandInput) {
  const demand = value(demandInput);
  const storage = sites.map((site) => value(site.capacityM3) * 0.15);
  const initialStorage = sum(storage);
  let overflow = 0, unmet = 0, supplied = 0, daysSupply = 0, maxDailyBalanceError = 0;
  const daily = days.map((day) => {
    const inflow = value(day.flowM3), opening = sum(storage);
    let remaining = inflow, captured = 0;
    for (const { site, index } of sites.map((site, index) => ({ site, index })).sort((a, b) => Math.min(value(b.site.transferM3), value(b.site.capacityM3) - storage[b.index]) - Math.min(value(a.site.transferM3), value(a.site.capacityM3) - storage[a.index]))) {
      const accepted = Math.min(remaining, value(site.transferM3), Math.max(0, value(site.capacityM3) - storage[index]));
      storage[index] += accepted; remaining -= accepted; captured += accepted;
    }
    let remainingDemand = demand;
    for (const entry of storage.map((amount, index) => ({ amount, index })).sort((a, b) => b.amount - a.amount)) {
      const release = Math.min(storage[entry.index], remainingDemand);
      storage[entry.index] -= release; remainingDemand -= release;
    }
    const delivered = demand - remainingDemand, closing = sum(storage), error = Math.abs(opening + inflow - closing - delivered - remaining);
    overflow += remaining; unmet += remainingDemand; supplied += delivered; daysSupply += remainingDemand <= 1e-6 ? 1 : 0; maxDailyBalanceError = Math.max(maxDailyBalanceError, error);
    return { date: day.date, inflowM3: inflow, capturedM3: captured, storageM3: closing, overflowM3: remaining, suppliedM3: delivered, unmetM3: remainingDemand };
  });
  const finalStorage = sum(storage), totalInflow = sum(days.map((day) => value(day.flowM3)));
  return { daily, summary: { overflowM3: overflow, unmetM3: unmet, suppliedM3: supplied, daysSupply, finalStorageM3: finalStorage, balanceErrorM3: Math.abs(totalInflow + initialStorage - supplied - overflow - finalStorage), maxDailyBalanceErrorM3: maxDailyBalanceError } };
}

export function validateScenario(input) {
  if (!Array.isArray(input?.days) || input.days.length < 1 || input.days.length > 2000) throw new Error("days must contain 1 to 2000 records");
  if (!Array.isArray(input?.opportunities) || input.opportunities.length > 20) throw new Error("opportunities must contain at most 20 records");
  if (input.days.some((day) => !day.date || !Number.isFinite(Number(day.flowM3)) || Number(day.flowM3) < 0)) throw new Error("each day requires date and non-negative flowM3");
  if (input.opportunities.some((site) => !site.id || [site.capacityM3, site.transferM3, site.costLakh].some((item) => !Number.isFinite(Number(item)) || Number(item) < 0))) throw new Error("each opportunity requires id and non-negative capacityM3, transferM3 and costLakh");
  if (!Number.isFinite(Number(input.budgetLakh)) || !Number.isFinite(Number(input.demandM3)) || Number(input.budgetLakh) < 0 || Number(input.demandM3) < 0) throw new Error("budgetLakh and demandM3 must be non-negative numbers");
}

export function planScenario(input) {
  validateScenario(input);
  const candidates = input.opportunities.filter((site) => site.enabled !== false);
  const baseline = simulate(input.days, [], input.demandM3);
  let best, selected = [], costLakh = 0, evaluatedPortfolios = 0;
  for (let mask = 0; mask < 2 ** candidates.length; mask += 1) {
    const portfolio = candidates.filter((_, index) => (mask & (1 << index)) !== 0), cost = sum(portfolio.map((site) => value(site.costLakh)));
    if (cost > value(input.budgetLakh) + 1e-6) continue;
    evaluatedPortfolios += 1;
    const result = simulate(input.days, portfolio, input.demandM3);
    const better = !best || result.summary.unmetM3 < best.summary.unmetM3 - 1e-6 || (Math.abs(result.summary.unmetM3 - best.summary.unmetM3) <= 1e-6 && (result.summary.overflowM3 < best.summary.overflowM3 - 1e-6 || (Math.abs(result.summary.overflowM3 - best.summary.overflowM3) <= 1e-6 && cost < costLakh)));
    if (better) { best = result; selected = portfolio; costLakh = cost; }
  }
  return { modelVersion: "jalflow-storage-v2", validationStatus: "OBSERVED_REPLAY_ONLY", sourceReferences: ["CAMELS-IND v1.0, Zenodo 14999580", "Mandleshwar gauge 12035"], units: { flow: "m3/day", storage: "m3", rainfall: "mm/day", cost: "INR lakh" }, optimization: { method: "exact-enumeration", evaluatedPortfolios, selectedOpportunityIds: selected.map((site) => site.id), costLakh }, baseline: baseline.summary, planned: best.summary, daily: best.daily, invariants: { valid: best.summary.balanceErrorM3 <= 0.01 && best.summary.maxDailyBalanceErrorM3 <= 0.01 && costLakh <= value(input.budgetLakh) + 1e-6 } };
}
