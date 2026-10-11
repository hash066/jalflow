export type Day = { date: string; rainMm: number; flowM3: number };
export type Opportunity = {
  id: string;
  name: string;
  type: "tank" | "recharge" | "check-dam";
  capacityM3: number;
  transferM3: number;
  costLakh: number;
  enabled: boolean;
};
export type DailyResult = Day & {
  baselineStorage: number;
  plannedStorage: number;
  baselineOverflow: number;
  plannedOverflow: number;
  baselineUnmet: number;
  plannedUnmet: number;
  captured: number;
};
export type Plan = {
  days: DailyResult[];
  selected: Opportunity[];
  costLakh: number;
  baseline: { overflow: number; unmet: number; daysSupply: number };
  planned: { overflow: number; unmet: number; daysSupply: number };
  balanceError: number;
};

const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
export function choosePortfolio(items: Opportunity[], budgetLakh: number) {
  return items
    .filter((x) => x.enabled && x.costLakh <= budgetLakh)
    .sort((a, b) => b.capacityM3 / b.costLakh - a.capacityM3 / a.costLakh)
    .reduce<Opportunity[]>(
      (chosen, item) =>
        sum(chosen.map((x) => x.costLakh)) + item.costLakh <= budgetLakh
          ? [...chosen, item]
          : chosen,
      [],
    );
}

function oneScenario(
  days: Day[],
  capacity: number,
  transfer: number,
  demand: number,
) {
  let storage = capacity * 0.15,
    overflow = 0,
    unmet = 0,
    suppliedDays = 0;
  const out: {
    storage: number;
    overflow: number;
    unmet: number;
    captured: number;
  }[] = [];
  for (const day of days) {
    const inflow = Math.max(0, day.flowM3);
    const captured = Math.min(
      inflow,
      transfer,
      Math.max(0, capacity - storage),
    );
    storage += captured;
    const spill = Math.max(0, inflow - captured);
    const supplied = Math.min(storage, demand);
    storage -= supplied;
    const miss = demand - supplied;
    overflow += spill;
    unmet += miss;
    if (miss < 1e-6) suppliedDays++;
    out.push({ storage, overflow: spill, unmet: miss, captured });
  }
  return { out, overflow, unmet, daysSupply: suppliedDays };
}

export function runPlan(
  days: Day[],
  opportunities: Opportunity[],
  budgetLakh: number,
  demandM3: number,
): Plan {
  const selected = choosePortfolio(opportunities, budgetLakh);
  const capacity = sum(selected.map((x) => x.capacityM3));
  const transfer = sum(selected.map((x) => x.transferM3));
  const base = oneScenario(days, 0, 0, demandM3);
  const planned = oneScenario(days, capacity, transfer, demandM3);
  const joined = days.map((day, i) => ({
    ...day,
    baselineStorage: base.out[i].storage,
    plannedStorage: planned.out[i].storage,
    baselineOverflow: base.out[i].overflow,
    plannedOverflow: planned.out[i].overflow,
    baselineUnmet: base.out[i].unmet,
    plannedUnmet: planned.out[i].unmet,
    captured: planned.out[i].captured,
  }));
  const inflow = sum(days.map((d) => Math.max(0, d.flowM3)));
  const supplied = days.length * demandM3 - planned.unmet;
  const finalStorage = planned.out.at(-1)?.storage ?? 0;
  const initialStorage = capacity * 0.15;
  const balanceError = Math.abs(
    inflow + initialStorage - (supplied + planned.overflow + finalStorage),
  );
  return {
    days: joined,
    selected,
    costLakh: sum(selected.map((x) => x.costLakh)),
    baseline: {
      overflow: base.overflow,
      unmet: base.unmet,
      daysSupply: base.daysSupply,
    },
    planned: {
      overflow: planned.overflow,
      unmet: planned.unmet,
      daysSupply: planned.daysSupply,
    },
    balanceError,
  };
}

export function nse(obs: number[], sim: number[]) {
  const mean = sum(obs) / obs.length,
    den = sum(obs.map((x) => (x - mean) ** 2));
  return den === 0 ? NaN : 1 - sum(obs.map((x, i) => (x - sim[i]) ** 2)) / den;
}
export function kge(obs: number[], sim: number[]) {
  const mean = (x: number[]) => sum(x) / x.length;
  const sd = (x: number[]) =>
    Math.sqrt(sum(x.map((v) => (v - mean(x)) ** 2)) / x.length);
  const mo = mean(obs),
    ms = mean(sim),
    so = sd(obs),
    ss = sd(sim);
  const r =
    sum(obs.map((v, i) => (v - mo) * (sim[i] - ms))) /
    (obs.length * so * ss || 1);
  return 1 - Math.sqrt((r - 1) ** 2 + (ss / so - 1) ** 2 + (ms / mo - 1) ** 2);
}
