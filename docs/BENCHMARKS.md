# Validation and benchmark

The selector uses official CAMELS-IND v1.0 files from Zenodo record 14999580. It ranks catchments by complete overlapping observed-flow and precipitation availability, then breaks ties by numeric gauge ID. Mandleshwar (`12035`) is selected at 96.13% observed-flow availability; precipitation is complete in the shared forcing period.

`npm run benchmark` applies a chronological 70/30 split to the published 180-day demo slice. A deliberately small rainfall-memory model is compared with persistence and seasonal baselines using NSE, KGE, and volume bias. Forecasting stays out of the product when the held-out NSE does not beat both baselines. Observed-flow replay and storage allocation remain available.
