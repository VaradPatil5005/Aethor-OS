# SpillGuard Repro local deliverables

Prepared during 16–17 October 2026. Nothing in this directory has been uploaded or published.

- `20261017-release-replication/`: integrity-checked results/source snapshot from the final native CUDA negative control, sanitized replay traces and replication instructions. The source is frozen at that run. Model weights and runtime binaries are excluded.
- `20261017-analysis/`: separate summaries of the second model's guarded/inconclusive smoke and the final CUDA negative control.
- `20261017-fixture-comparison/`: all six reducer plumbing demonstrations, prominently labeled software fixtures. These are not GPU experimental results.
- `20261016-analysis/`: earlier valid Qwen2.5, calibration and CUDA groups; purposes and invalid denominators remain separate.
- Earlier replication/comparison directories are retained as checkpoints; they do not supersede the release directory.
- `evidence-desk-final.jpg`: final browser proof showing the measured report and relative-time sanitized replay.

The operating guide is `docs/SPILLGUARD_RESEARCH_GUIDE.md`. The phase-by-phase status is `docs/SPILLGUARD_EXECUTION.md`. The full empirical project remains gated because no valid severe application failure has been reproduced before host-memory limits. Interview/faculty/IP documents are prepared, with zero invented approvals or responses.
