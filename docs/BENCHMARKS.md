# Validation and benchmark

The selector uses official CAMELS-IND v1.0 files from Zenodo record `14999580`. It ranks gauges by published observed-flow availability, breaks ties by numeric gauge ID, then intersects observed flow with catchment-mean precipitation. Blank flow cells are rejected rather than converted to zero.

Mandleshwar (`12035`) has 96.13% published flow availability, 14,397 paired observed days, and a 13,914-day longest complete run. The checked-in replay is the most recent 365 days of that run (`2017-02-04` to `2018-02-03`).

`npm run benchmark` uses a chronological 255/110-day split. A two-parameter rainfall-memory model is calibrated only on the first segment and compared on holdout data with one-day persistence and a training-period monthly climatology.

| Holdout | NSE | KGE | Volume bias |
| --- | ---: | ---: | ---: |
| Screening model | -1.871 | 0.018 | -64.11% |
| Persistence | 0.031 | 0.516 | -0.12% |
| Monthly seasonal | -13.198 | -0.993 | 145.49% |

The model fails the requirement to beat both baselines on NSE and KGE, so forecasting is disabled. Observed-flow replay and deterministic storage planning do not depend on it. Storage tests verify budget, nonnegative state, non-worsening unmet demand, and daily and period water conservation to `0.01 m3`.
