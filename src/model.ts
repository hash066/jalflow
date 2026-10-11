export type Day = { date: string; rainMm: number; flowM3: number };
export type Opportunity = { id: string; name: string; type: "tank" | "recharge" | "check-dam"; capacityM3: number; transferM3: number; costLakh: number; enabled: boolean };
export type DailyResult = Day & { baselineStorage: number; plannedStorage: number; baselineOverflow: number; plannedOverflow: number; baselineUnmet: number; plannedUnmet: number; captured: number };
type ScenarioSummary = { overflow: number; unmet: number; daysSupply: number; supplied: number; finalStorage: number };
type Scenario = ScenarioSummary & { out: Array<{ storage: number; overflow: number; unmet: number; captured: number; supplied: number; balanceError: number }>; maxDailyBalanceError: number; balanceError: number };
export type Plan = {
  days: DailyResult[];
  selected: Opportunity[];
  costLakh: number;
  baseline: ScenarioSummary;
  planned: ScenarioSummary;
  balanceError: number;
  maxDailyBalanceError: number;
  evaluatedPortfolios: number;
  optimizationMethod: "exact-enumeration";
  validation: { valid: boolean; messages: string[] };
};

const EPSILON = 1e-6;
const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);
const nonNegative = (value: number) => Math.max(0, Number.isFinite(value) ? value : 0);

function runScenario(days: Day[], sites: Opportunity[], demandM3: number): Scenario {
  const demand = nonNegative(demandM3);
  const storage = sites.map((site) => nonNegative(site.capacityM3) * 0.15);
  const initialStorage = sum(storage);
  let overflow = 0;
  let unmet = 0;
  let supplied = 0;
  let daysSupply = 0;
  let maxDailyBalanceError = 0;

  const out = days.map((day) => {
    const inflow = nonNegative(day.flowM3);
    const openingStorage = sum(storage);
    let remainingInflow = inflow;
    let captured = 0;
    const captureOrder = sites.map((site, index) => ({ site, index })).sort((a, b) => {
      const aRoom = Math.max(0, nonNegative(a.site.capacityM3) - storage[a.index]);
      const bRoom = Math.max(0, nonNegative(b.site.capacityM3) - storage[b.index]);
      return Math.min(nonNegative(b.site.transferM3), bRoom) - Math.min(nonNegative(a.site.transferM3), aRoom);
    });
    for (const { site, index } of captureOrder) {
      const room = Math.max(0, nonNegative(site.capacityM3) - storage[index]);
      const accepted = Math.min(remainingInflow, nonNegative(site.transferM3), room);
      storage[index] += accepted;
      captured += accepted;
      remainingInflow -= accepted;
    }
    const spill = remainingInflow;
    let remainingDemand = demand;
    const releaseOrder = storage.map((amount, index) => ({ amount, index })).sort((a, b) => b.amount - a.amount);
    for (const { index } of releaseOrder) {
      const release = Math.min(storage[index], remainingDemand);
      storage[index] -= release;
      remainingDemand -= release;
      if (remainingDemand <= EPSILON) break;
    }
    const delivered = demand - remainingDemand;
    const closingStorage = sum(storage);
    const dailyError = Math.abs(openingStorage + inflow - (closingStorage + delivered + spill));
    maxDailyBalanceError = Math.max(maxDailyBalanceError, dailyError);
    overflow += spill;
    unmet += remainingDemand;
    supplied += delivered;
    if (remainingDemand <= EPSILON) daysSupply += 1;
    return { storage: closingStorage, overflow: spill, unmet: remainingDemand, captured, supplied: delivered, balanceError: dailyError };
  });
  const finalStorage = sum(storage);
  const inflow = sum(days.map((day) => nonNegative(day.flowM3)));
  return { out, overflow, unmet, supplied, daysSupply, finalStorage, maxDailyBalanceError, balanceError: Math.abs(inflow + initialStorage - (supplied + overflow + finalStorage)) };
}

function isBetter(candidate: Scenario, candidateCost: number, incumbent: Scenario | undefined, incumbentCost: number) {
  if (!incumbent) return true;
  if (Math.abs(candidate.unmet - incumbent.unmet) > EPSILON) return candidate.unmet < incumbent.unmet;
  if (Math.abs(candidate.overflow - incumbent.overflow) > EPSILON) return candidate.overflow < incumbent.overflow;
  return candidateCost < incumbentCost - EPSILON;
}

export function optimizePortfolio(days: Day[], opportunities: Opportunity[], budgetLakh: number, demandM3: number) {
  const candidates = opportunities.filter((item) => item.enabled).slice(0, 20);
  const budget = nonNegative(budgetLakh);
  let selected: Opportunity[] = [];
  let scenario: Scenario | undefined;
  let costLakh = 0;
  let evaluatedPortfolios = 0;
  for (let mask = 0; mask < 2 ** candidates.length; mask += 1) {
    const portfolio = candidates.filter((_, index) => (mask & (1 << index)) !== 0);
    const cost = sum(portfolio.map((item) => nonNegative(item.costLakh)));
    if (cost > budget + EPSILON) continue;
    evaluatedPortfolios += 1;
    const result = runScenario(days, portfolio, demandM3);
    if (isBetter(result, cost, scenario, costLakh)) {
      selected = portfolio;
      scenario = result;
      costLakh = cost;
    }
  }
  return { selected, scenario: scenario ?? runScenario(days, [], demandM3), costLakh, evaluatedPortfolios };
}

export function choosePortfolio(items: Opportunity[], budgetLakh: number, days: Day[] = [], demandM3 = 0) {
  return optimizePortfolio(days, items, budgetLakh, demandM3).selected;
}

export function runPlan(days: Day[], opportunities: Opportunity[], budgetLakh: number, demandM3: number): Plan {
  const baseline = runScenario(days, [], demandM3);
  const optimized = optimizePortfolio(days, opportunities, budgetLakh, demandM3);
  const planned = optimized.scenario;
  const joined = days.map((day, index) => ({ ...day, baselineStorage: baseline.out[index].storage, plannedStorage: planned.out[index].storage, baselineOverflow: baseline.out[index].overflow, plannedOverflow: planned.out[index].overflow, baselineUnmet: baseline.out[index].unmet, plannedUnmet: planned.out[index].unmet, captured: planned.out[index].captured }));
  const messages: string[] = [];
  if (optimized.costLakh > nonNegative(budgetLakh) + EPSILON) messages.push("Portfolio exceeds budget.");
  if (planned.maxDailyBalanceError > 0.01 || planned.balanceError > 0.01) messages.push("Water balance residual exceeds 0.01 m3.");
  if (planned.unmet > baseline.unmet + EPSILON) messages.push("Intervention worsens unmet demand.");
  if (planned.out.some((day) => day.storage < -EPSILON || day.captured < -EPSILON)) messages.push("Negative storage or capture detected.");
  return { days: joined, selected: optimized.selected, costLakh: optimized.costLakh, baseline, planned, balanceError: planned.balanceError, maxDailyBalanceError: planned.maxDailyBalanceError, evaluatedPortfolios: optimized.evaluatedPortfolios, optimizationMethod: "exact-enumeration", validation: { valid: messages.length === 0, messages } };
}

export function nse(obs: number[], sim: number[]) {
  const mean = sum(obs) / obs.length;
  const denominator = sum(obs.map((value) => (value - mean) ** 2));
  return denominator === 0 ? Number.NaN : 1 - sum(obs.map((value, index) => (value - sim[index]) ** 2)) / denominator;
}

export function kge(obs: number[], sim: number[]) {
  const mean = (values: number[]) => sum(values) / values.length;
  const sd = (values: number[]) => Math.sqrt(sum(values.map((value) => (value - mean(values)) ** 2)) / values.length);
  const observedMean = mean(obs), simulatedMean = mean(sim), observedSd = sd(obs), simulatedSd = sd(sim);
  const correlation = sum(obs.map((value, index) => (value - observedMean) * (sim[index] - simulatedMean))) / (obs.length * observedSd * simulatedSd || 1);
  return 1 - Math.sqrt((correlation - 1) ** 2 + (simulatedSd / observedSd - 1) ** 2 + (simulatedMean / observedMean - 1) ** 2);
}
