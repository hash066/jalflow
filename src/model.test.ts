import { describe, expect, it } from "vitest";
import { optimizePortfolio, runPlan, type Day, type Opportunity } from "./model";

const days: Day[] = [
  { date: "2020-01-01", rainMm: 4, flowM3: 100 },
  { date: "2020-01-02", rainMm: 0, flowM3: 10 },
  { date: "2020-01-03", rainMm: 0, flowM3: 0 },
];
const opportunities: Opportunity[] = [
  { id: "a", name: "A", type: "tank", capacityM3: 100, transferM3: 60, costLakh: 5, enabled: true },
  { id: "b", name: "B", type: "recharge", capacityM3: 200, transferM3: 50, costLakh: 20, enabled: true },
];

describe("storage planner", () => {
  it("respects budget and excludes disabled opportunities", () => {
    const result = optimizePortfolio(days, [...opportunities, { ...opportunities[1], id: "disabled", costLakh: 1, enabled: false }], 10, 20);
    expect(result.costLakh).toBeLessThanOrEqual(10);
    expect(result.selected.map((item) => item.id)).not.toContain("disabled");
  });

  it("preserves daily and whole-period water balance", () => {
    const plan = runPlan(days, opportunities, 10, 20);
    expect(plan.balanceError).toBeLessThan(1e-6);
    expect(plan.maxDailyBalanceError).toBeLessThan(1e-6);
    expect(plan.validation.valid).toBe(true);
  });

  it("never worsens unmet demand", () => {
    const plan = runPlan(days, opportunities, 10, 20);
    expect(plan.planned.unmet).toBeLessThanOrEqual(plan.baseline.unmet);
  });

  it("uses the replay objective instead of a capacity-per-cost shortcut", () => {
    const choices: Opportunity[] = [
      { id: "cheap", name: "Cheap", type: "tank", capacityM3: 60, transferM3: 10, costLakh: 4, enabled: true },
      { id: "effective", name: "Effective", type: "tank", capacityM3: 90, transferM3: 90, costLakh: 7, enabled: true },
    ];
    const result = optimizePortfolio([{ date: "2020-01-01", rainMm: 0, flowM3: 100 }], choices, 7, 70);
    expect(result.selected.map((item) => item.id)).toEqual(["effective"]);
    expect(result.evaluatedPortfolios).toBe(3);
  });
});
