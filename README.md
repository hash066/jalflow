# JALFLOW

JALFLOW is a catchment-scale decision workbench for comparing hypothetical storage and recharge portfolios against observed river flow. It combines a verified CAMELS-IND replay, exact budget-constrained portfolio search, explicit daily water accounting, and an honest model-performance gate.

## What is real

- 365 consecutive, nonblank observed-flow days from CAMELS-IND gauge `12035` (Mandleshwar), paired with catchment-mean precipitation.
- Exact enumeration of every enabled portfolio (up to 20 opportunities), minimizing unmet demand, then overflow, then cost.
- Per-site capacity and daily transfer constraints, plus daily and whole-period water-balance checks.
- An AWS Lambda worker that validates the submitted scenario and performs the planning computation asynchronously.
- Chronological 70/30 runoff-model benchmark against persistence and monthly-seasonal baselines.

Forecasting is disabled because the screening model fails the held-out gate. Infrastructure remains hypothetical; the app does not claim inundation extent, aquifer recovery, design approval, or nationwide coverage.

```powershell
npm ci
npm test
npm run benchmark
npm run build
npm run dev
```

See [data provenance](docs/DATA.md), [benchmark notes](docs/BENCHMARKS.md), and [AWS deployment](docs/DEPLOYMENT.md).
