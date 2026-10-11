import assert from "node:assert/strict";
import test from "node:test";
import { planScenario, validateScenario } from "./planner.mjs";

const scenario = {
  days: [{ date: "2020-01-01", flowM3: 100 }, { date: "2020-01-02", flowM3: 10 }],
  opportunities: [{ id: "tank", capacityM3: 100, transferM3: 60, costLakh: 5, enabled: true }],
  budgetLakh: 5,
  demandM3: 20,
};

test("worker planner computes a constrained, balanced result", () => {
  const result = planScenario(scenario);
  assert.equal(result.invariants.valid, true);
  assert.deepEqual(result.optimization.selectedOpportunityIds, ["tank"]);
  assert.ok(result.planned.unmetM3 <= result.baseline.unmetM3);
  assert.equal(result.daily.length, 2);
});

test("worker rejects oversized or malformed jobs", () => {
  assert.throws(() => validateScenario({ ...scenario, days: [] }), /days/);
  assert.throws(() => validateScenario({ ...scenario, demandM3: -1 }), /budgetLakh/);
});
