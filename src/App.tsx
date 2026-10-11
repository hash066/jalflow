import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity as Waveform,
  AlertTriangle,
  Check,
  CloudRain,
  Database,
  Download,
  IndianRupee,
  Layers,
  MapPin,
  Play,
  RefreshCw,
  SlidersHorizontal,
  Warehouse,
} from "lucide-react";
import { catchment, observed } from "./sample";
import { runPlan, type Opportunity } from "./model";
const initial: Opportunity[] = [
  {
    id: "tank-01",
    name: "Village balancing tank network",
    type: "tank",
    capacityM3: 18000000,
    transferM3: 2400000,
    costLakh: 9.5,
    enabled: true,
  },
  {
    id: "recharge-01",
    name: "Recharge trench cluster",
    type: "recharge",
    capacityM3: 12000000,
    transferM3: 1600000,
    costLakh: 6.2,
    enabled: true,
  },
  {
    id: "dam-01",
    name: "Check-dam rehabilitation",
    type: "check-dam",
    capacityM3: 26000000,
    transferM3: 3200000,
    costLakh: 14.8,
    enabled: false,
  },
];
const fmt = (n: number) =>
  new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(n);
export default function App() {
  const [budget, setBudget] = useState(18);
  const [demand, setDemand] = useState(800000);
  const [ops, setOps] = useState(initial);
  const [day, setDay] = useState(120);
  const plan = useMemo(
    () => runPlan(observed, ops, budget, demand),
    [ops, budget, demand],
  );
  const current = plan.days[Math.min(day, plan.days.length - 1)];
  const toggle = (id: string) =>
    setOps((v) =>
      v.map((x) => (x.id === id ? { ...x, enabled: !x.enabled } : x)),
    );
  const updateOpportunity = (id: string, field: "capacityM3" | "transferM3" | "costLakh", value: number) =>
    setOps((items) => items.map((item) => item.id === id ? { ...item, [field]: Math.max(0, value) } : item));
  const download = () => {
    const csv = [
      "date,rain_mm,observed_flow_m3,planned_storage_m3,overflow_m3,unmet_m3",
      ...plan.days.map((x) =>
        [
          x.date,
          x.rainMm,
          x.flowM3,
          x.plannedStorage,
          x.plannedOverflow,
          x.plannedUnmet,
        ].join(","),
      ),
    ].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = "jalflow-plan.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  };
  return (
    <main>
      <header>
        <div className="brand">
          <span>JF</span>
          <div>
            <b>JALFLOW</b>
            <small>watershed storage planner</small>
          </div>
        </div>
        <nav>
          <button className="active">PLANNER</button>
          <button>DATA</button>
          <button>VALIDATION</button>
        </nav>
        <div className="source">
          <Database />
          <span>
            <b>CAMELS-IND</b>
            <small>observed series</small>
          </span>
        </div>
      </header>
      <div className="workspace">
        <aside className="controls">
          <span className="eyebrow">PLANNING SCENARIO</span>
          <h1>Allocate seasonal flow</h1>
          <div className="notice">
            <Layers />
            <div>
              <b>Hypothetical infrastructure</b>
              <small>
                Planning comparison, not an approved works programme.
              </small>
            </div>
          </div>
          <label>
            Annual capital budget <output>Rs {budget.toFixed(1)} lakh</output>
            <input
              type="range"
              min="4"
              max="35"
              step=".5"
              value={budget}
              onChange={(e) => setBudget(+e.target.value)}
            />
          </label>
          <label>
            Daily demand <output>{fmt(demand)} m3</output>
            <input
              type="range"
              min="200000"
              max="2400000"
              step="50000"
              value={demand}
              onChange={(e) => setDemand(+e.target.value)}
            />
          </label>
          <div className="section-title">
            <SlidersHorizontal />
            OPPORTUNITIES
          </div>
          {ops.map((o) => (
            <div key={o.id} className={"opportunity " + (o.enabled ? "enabled" : "")}>
              <button className="op-toggle" onClick={() => toggle(o.id)} aria-pressed={o.enabled}>
                <span className="check">{o.enabled && <Check />}</span>
                <span><b>{o.name}</b><small>{o.type}</small></span>
              </button>
              <div className="op-fields">
                <label>Capacity m3<input aria-label={`${o.name} capacity`} type="number" min="0" step="100000" value={o.capacityM3} onChange={(event) => updateOpportunity(o.id, "capacityM3", +event.target.value)} /></label>
                <label>Transfer/day<input aria-label={`${o.name} daily transfer`} type="number" min="0" step="100000" value={o.transferM3} onChange={(event) => updateOpportunity(o.id, "transferM3", +event.target.value)} /></label>
                <label>Cost lakh<input aria-label={`${o.name} cost`} type="number" min="0" step="0.1" value={o.costLakh} onChange={(event) => updateOpportunity(o.id, "costLakh", +event.target.value)} /></label>
              </div>
            </div>
          ))}
          <div className="cost">
            <IndianRupee />
            <span>
              <small>SELECTED PORTFOLIO</small>
              <strong>{plan.costLakh.toFixed(1)} lakh</strong>
            </span>
          </div>
          <div className="optimizer-note">
            <Check />
            <span><b>EXACT PORTFOLIO SEARCH</b><small>{plan.evaluatedPortfolios} feasible combinations evaluated; unmet demand, overflow, then cost.</small></span>
          </div>
        </aside>
        <section className="map-panel">
          <div className="map-title">
            <div>
              <span className="eyebrow">SELECTED BY RECORD COMPLETENESS</span>
              <h2>{catchment.name}</h2>
              <p>
                {catchment.id} / {fmt(catchment.areaKm2)} km2 /{" "}
                {catchment.period}
              </p>
            </div>
            <button onClick={() => setDay(120)} title="Reset view">
              <RefreshCw />
            </button>
          </div>
          <div className="map">
            <svg
              viewBox="0 0 700 430"
              role="img"
              aria-label="Selected watershed and storage opportunities"
            >
              <defs>
                <pattern
                  id="grid"
                  width="28"
                  height="28"
                  patternUnits="userSpaceOnUse"
                >
                  <path
                    d="M 28 0 L 0 0 0 28"
                    fill="none"
                    stroke="#c4d0cc"
                    strokeWidth=".7"
                  />
                </pattern>
              </defs>
              <rect width="700" height="430" fill="url(#grid)" />
              <path
                className="basin"
                d="M130 78 L225 36 362 54 485 105 575 196 538 315 436 382 289 372 162 311 93 201Z"
              />
              <path
                className="river"
                d="M238 62 C260 122 350 130 327 188 S391 266 502 339"
              />
              <path
                className="tributary"
                d="M154 142 C220 151 258 169 327 188 M454 103 C418 151 369 156 327 188 M196 299 C260 270 329 265 383 267"
              />
              {[
                { x: 318, y: 181, label: "Balancing tank", on: ops[0].enabled },
                {
                  x: 402,
                  y: 265,
                  label: "Recharge cluster",
                  on: ops[1].enabled,
                },
                { x: 493, y: 332, label: "Check dam", on: ops[2].enabled },
              ].map((n) => (
                <g
                  key={n.label}
                  className={"site " + (n.on ? "on" : "")}
                  transform={`translate(${n.x} ${n.y})`}
                >
                  <circle r="11" />
                  <MapPin x={-7} y={-7} width={14} />
                  <text x="16" y="4">
                    {n.label}
                  </text>
                </g>
              ))}
              <g className="gauge" transform="translate(511 344)">
                <circle r="8" />
                <text x="14" y="4">
                  Observed gauge
                </text>
              </g>
            </svg>
            <div className="rain">
              <CloudRain />
              <span>
                <small>{current.date}</small>
                <b>{current.rainMm.toFixed(1)} mm</b>
              </span>
            </div>
            <div className="legend">
              <i /> catchment <span /> river network
            </div>
          </div>
          <div className="scrubber">
            <button aria-label="Run timeline">
              <Play />
            </button>
            <input
              type="range"
              min="0"
              max={plan.days.length - 1}
              value={day}
              onChange={(e) => setDay(+e.target.value)}
            />
            <output>DAY {day + 1}</output>
          </div>
        </section>
        <aside className="results">
          <div className="result-head">
            <span className="eyebrow">SCENARIO RESULT</span>
            <button onClick={download}>
              <Download /> CSV
            </button>
          </div>
          <h2>Storage performance</h2>
          <div className="forecast-gate">
            <AlertTriangle />
            <span><b>FORECASTING GATED OFF</b><small>Held-out model NSE -1.871 vs persistence 0.031. This view replays observations only.</small></span>
          </div>
          <div className="kpis">
            <div>
              <small>OVERFLOW AVOIDED</small>
              <strong>
                {fmt(
                  Math.max(0, plan.baseline.overflow - plan.planned.overflow),
                )}
              </strong>
              <span>m3 in replay</span>
            </div>
            <div>
              <small>DAYS SUPPLIED</small>
              <strong>{plan.planned.daysSupply}</strong>
              <span>of {plan.days.length}</span>
            </div>
          </div>
          <div className="chart-title">
            <Warehouse />
            Stored volume
          </div>
          <div className="chart">
            <ResponsiveContainer width="100%" height={175}>
              <AreaChart data={plan.days}>
                <defs>
                  <linearGradient id="storage" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#248b77" stopOpacity=".7" />
                    <stop offset="1" stopColor="#248b77" stopOpacity=".05" />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#e0e4e1" vertical={false} />
                <XAxis dataKey="date" hide />
                <YAxis tick={{ fontSize: 8 }} width={45} />
                <Tooltip />
                <Area
                  dataKey="plannedStorage"
                  stroke="#16705f"
                  fill="url(#storage)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="chart-title">
            <Waveform />
            Observed inflow and unmet demand
          </div>
          <div className="chart">
            <ResponsiveContainer width="100%" height={150}>
              <LineChart data={plan.days}>
                <XAxis dataKey="date" hide />
                <YAxis tick={{ fontSize: 8 }} width={45} />
                <Tooltip />
                <Line dataKey="flowM3" stroke="#3b6b83" dot={false} />
                <Line dataKey="plannedUnmet" stroke="#d0644e" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div
            className={"balance " + (plan.validation.valid ? "ok" : "bad")}
          >
            {plan.validation.valid ? <Check /> : <AlertTriangle />}
            <span>
              <b>
                WATER BALANCE {plan.validation.valid ? "VALID" : "CHECK"}
              </b>
              <small>
                Period {plan.balanceError.toFixed(4)} m3 / max daily {plan.maxDailyBalanceError.toFixed(4)} m3
              </small>
            </span>
          </div>
          <p className="limits">
            Observed streamflow is separated from model-generated series.
            Infrastructure is hypothetical. No inundation extent, aquifer
            recovery percentage, or nationwide applicability is claimed.
          </p>
        </aside>
      </div>
    </main>
  );
}
