import fs from "node:fs";
import { performance } from "node:perf_hooks";

const rows = fs.readFileSync(new URL("../data/camels-ind/mandleshwar-sample.csv", import.meta.url), "utf8").trim().split(/\r?\n/).slice(1).map((line) => {
  const [date, rain, flowCms] = line.split(",");
  return { date, rain: Number(rain), flow: Number(flowCms) };
});
if (rows.some((row) => !row.date || !Number.isFinite(row.rain) || !Number.isFinite(row.flow))) throw new Error("Benchmark contains missing or non-numeric observations.");
const cut = Math.floor(rows.length * 0.7), train = rows.slice(0, cut), test = rows.slice(cut);
const mean = (values) => values.reduce((total, value) => total + value, 0) / values.length;
const sd = (values) => Math.sqrt(mean(values.map((value) => (value - mean(values)) ** 2)));
const nse = (observed, simulated) => 1 - observed.reduce((total, value, index) => total + (value - simulated[index]) ** 2, 0) / observed.reduce((total, value) => total + (value - mean(observed)) ** 2, 0);
const kge = (observed, simulated) => {
  const observedMean = mean(observed), simulatedMean = mean(simulated), observedSd = sd(observed), simulatedSd = sd(simulated);
  const correlation = mean(observed.map((value, index) => (value - observedMean) * (simulated[index] - simulatedMean))) / (observedSd * simulatedSd || 1);
  return 1 - Math.sqrt((correlation - 1) ** 2 + (simulatedSd / observedSd - 1) ** 2 + (simulatedMean / observedMean - 1) ** 2);
};
const metrics = (observed, simulated) => ({ nse: Number(nse(observed, simulated).toFixed(3)), kge: Number(kge(observed, simulated).toFixed(3)), volumeBiasPercent: Number(((simulated.reduce((a, b) => a + b, 0) / observed.reduce((a, b) => a + b, 0) - 1) * 100).toFixed(2)) });
const simulate = (series, initial, a, b) => { let previous = initial; return series.map((row) => (previous = Math.max(0, b * previous + a * row.rain))); };

const started = performance.now();
let best = { score: -Infinity, a: 0, b: 0 };
for (let a = 0; a <= 120; a += 2) for (let b = 0.5; b <= 0.99; b += 0.01) {
  const simulated = simulate(train, train[0].flow, a, b);
  const score = nse(train.map((row) => row.flow), simulated);
  if (score > best.score) best = { score, a, b: Number(b.toFixed(2)) };
}
const observed = test.map((row) => row.flow);
const model = simulate(test, train.at(-1).flow, best.a, best.b);
const persistence = test.map((_, index) => index === 0 ? train.at(-1).flow : test[index - 1].flow);
const monthlyMeans = Object.fromEntries(Array.from({ length: 12 }, (_, month) => {
  const values = train.filter((row) => new Date(`${row.date}T00:00:00Z`).getUTCMonth() === month).map((row) => row.flow);
  return [month, values.length ? mean(values) : mean(train.map((row) => row.flow))];
}));
const seasonal = test.map((row) => monthlyMeans[new Date(`${row.date}T00:00:00Z`).getUTCMonth()]);
const holdout = { model: metrics(observed, model), persistence: metrics(observed, persistence), seasonalMonthly: metrics(observed, seasonal) };
const forecastEnabled = holdout.model.nse > Math.max(holdout.persistence.nse, holdout.seasonalMonthly.nse) && holdout.model.kge > Math.max(holdout.persistence.kge, holdout.seasonalMonthly.kge);
const result = {
  source: "CAMELS-IND v1.0 observed streamflow and catchment-mean precipitation, Mandleshwar 12035",
  sourceRecord: "https://zenodo.org/records/14999580",
  dataWindow: `${rows[0].date} to ${rows.at(-1).date}`,
  integrity: { rows: rows.length, missingRows: 0, blankFlowsCoercedToZero: false },
  split: `chronological ${cut}/${rows.length - cut} days`,
  model: "two-parameter rainfall-memory screening model (flow in m3/s)",
  parameters: { trainingNse: Number(best.score.toFixed(3)), a: best.a, b: best.b },
  holdout,
  forecastEnabled,
  runtimeMs: Number((performance.now() - started).toFixed(1)),
  decision: forecastEnabled ? "Forecasting passed the predeclared NSE and KGE baseline gate." : "Forecasting is excluded because the model did not beat both persistence and monthly-seasonal baselines on held-out NSE and KGE.",
};
fs.writeFileSync(new URL("report.json", import.meta.url), JSON.stringify(result, null, 2));
console.table(holdout);
console.log(result.decision);
