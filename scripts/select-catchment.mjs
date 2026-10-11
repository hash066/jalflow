import fs from "node:fs";

const root = new URL("../", import.meta.url);
const read = (path) => fs.readFileSync(new URL(path, root), "utf8").trimEnd().split(/\r?\n/).map((row) => row.split(","));
const isValue = (value) => typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value));
const dateKey = (row) => `${row[0]}-${row[1]}-${row[2]}`;
const isoDate = (row) => `${row[0]}-${row[1].padStart(2, "0")}-${row[2].padStart(2, "0")}`;

const names = read("data/camels-ind/extracted/attributes_csv/camels_ind_name.csv");
const nameHeader = names.shift();
const nameCol = Object.fromEntries(nameHeader.map((value, index) => [value, index]));
names.sort((a, b) => Number(b[nameCol.flow_availability]) - Number(a[nameCol.flow_availability]) || Number(a[nameCol.gauge_id]) - Number(b[nameCol.gauge_id]));
const best = names[0];
const id = best[nameCol.gauge_id];

const topo = read("data/camels-ind/extracted/attributes_csv/camels_ind_topo.csv");
const topoHeader = topo.shift();
const topoCol = Object.fromEntries(topoHeader.map((value, index) => [value, index]));
const topoRow = topo.find((row) => row[topoCol.gauge_id] === id);

const forcing = read(`data/camels-ind/extracted/catchment_mean_forcings/${id}.csv`);
const forcingHeader = forcing.shift();
const forcingCol = Object.fromEntries(forcingHeader.map((value, index) => [value, index]));
const rain = new Map(forcing.filter((row) => isValue(row[forcingCol["prcp(mm/day)"]])).map((row) => [dateKey(row), Number(row[forcingCol["prcp(mm/day)"]])]));

const flows = read("data/camels-ind/extracted/streamflow_timeseries/streamflow_observed.csv");
const flowHeader = flows.shift();
const flowColumn = flowHeader.indexOf(id);
const paired = flows
  .filter((row) => rain.has(dateKey(row)) && isValue(row[flowColumn]))
  .map((row) => ({ date: isoDate(row), rainMm: rain.get(dateKey(row)), flowCms: Number(row[flowColumn]) }));

let longest = [];
let current = [];
for (const row of paired) {
  const consecutive = current.length === 0 || new Date(row.date).getTime() - new Date(current.at(-1).date).getTime() === 86_400_000;
  current = consecutive ? [...current, row] : [row];
  if (current.length > longest.length) longest = [...current];
}
if (longest.length < 365) throw new Error(`No complete 365-day observed overlap for ${id}. Longest is ${longest.length} days.`);
const sourceWindow = longest.slice(-365);
const sample = sourceWindow.map((row) => ({ ...row, flowM3: Math.round(row.flowCms * 86_400) }));
const catchment = {
  id,
  name: best[nameCol.cwc_site_name],
  basin: best[nameCol.river_basin],
  lat: Number(topoRow[topoCol.cwc_lat]),
  lon: Number(topoRow[topoCol.cwc_lon]),
  areaKm2: Number(topoRow[topoCol.cwc_area]),
  source: "CAMELS-IND v1.0, Zenodo record 14999580",
  period: `${sample[0].date} to ${sample.at(-1).date}`,
  flowAvailability: Number(best[nameCol.flow_availability]),
};
const generated = `import type { Day } from "./model";\nexport const catchment = ${JSON.stringify(catchment)} as const;\nexport const observed: Day[] = ${JSON.stringify(sample.map(({ date, rainMm, flowM3 }) => ({ date, rainMm, flowM3 })))};\n`;
fs.writeFileSync(new URL("src/sample.ts", root), generated);
fs.writeFileSync(new URL("data/camels-ind/selection.json", root), JSON.stringify({
  method: "Highest published observed-flow availability with complete precipitation overlap; ties broken by numeric catchment ID. Blank flow cells are excluded, never coerced to zero.",
  catchment,
  pairedObservedDays: paired.length,
  longestCompleteRunDays: longest.length,
  replayDays: sample.length,
  sourceArchiveSha256: "4f2794bbef42bcd6707afb45e1e0ae8f21f4a2a17bf8c82006dce4273c82c664",
}, null, 2));
fs.writeFileSync(new URL("data/camels-ind/mandleshwar-sample.csv", root), ["date,rain_mm,observed_flow_cms,observed_flow_m3_day", ...sample.map((row) => `${row.date},${row.rainMm},${row.flowCms},${row.flowM3}`)].join("\n"));
console.log({ catchment, pairedObservedDays: paired.length, longestCompleteRunDays: longest.length, replayDays: sample.length });
