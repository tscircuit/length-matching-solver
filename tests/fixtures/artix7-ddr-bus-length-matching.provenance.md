# Artix-7 DDR matching capture

Unchanged `LengthMatchingSolver` constructor input captured from Pipeline10's
DDR29 sample014. It contains all 16 routed signals, 32 immutable fanout traces,
601 pad obstacles, 18 layers and 14 bus skew constraints. The dataset is a
spacious DDR subset, not a full original-board layout or an electrical timing
qualification.

- Dataset: `ShiboSoftwareDev/dataset-srj29-ddr3-bga-pairs` at
  `585c3abd4c6ce4be52bbc430b1d5e6dcc9b4ea30`, `samples/sample014.json`.
- Source design: `LZajmi/Artix-7-FPGA-Dev-Board` at
  `487da39802928ca3259d1c44efa1a5037408195f`, `FPGA_dev_board.kicad_pcb`.
- Autorouter: `21db3e8b4a27422a3e807bae82b43bb5e4db92ce`, effort 1;
  tiny-hypergraph `f953f0d84d2013accd3d4ce6bb5a1b7b77a6357f`;
  fanout-solver 0.0.29; length-matching-solver `5861dc1`.
- Gzip SHA-256:
  `1baedce88ecea665ff6722c179fd6b22d0b1134c9fe74d951a232399b3aac5c1`.

The baseline spends the 1.5 mm skew tolerance independently on two DQ13
segments, commits their insufficient capacity, and fails with 2.032086 mm
remaining. The snapshot includes immutable fanout copper and reports measured
skew directly from the returned route state.
