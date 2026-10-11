# Data provenance

- Dataset: CAMELS-IND v1.0, Zenodo record [14999580](https://zenodo.org/records/14999580)
- Archive: `CAMELS_IND_Catchments_Streamflow_Sufficient.zip`
- Archive SHA-256: `4f2794bbef42bcd6707afb45e1e0ae8f21f4a2a17bf8c82006dce4273c82c664`
- Selected gauge: `12035`, Mandleshwar, Narmada basin
- Coordinates: 22.1683 N, 75.6608 E
- Published catchment area: 72,809 km2
- Replay: 365 consecutive observed days, `2017-02-04` through `2018-02-03`
- Flow conversion: published `m3/s` multiplied by 86,400 to produce `m3/day`

Run `node scripts/select-catchment.mjs` after extracting the official archive under `data/camels-ind/extracted`. The script requires nonblank numeric precipitation and observed flow, identifies the longest daily run, and regenerates the checked-in slice and selection manifest. CAMELS-IND model-generated streamflow is not used.
