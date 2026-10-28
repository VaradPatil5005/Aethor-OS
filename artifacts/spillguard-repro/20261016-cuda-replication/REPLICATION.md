# Local replication package

No publication has occurred. Review before sharing.

Model binaries and runtime dependencies are excluded. Install requirements in source/agent/requirements.txt with an appropriate local Python environment and the documented Windows/NVIDIA driver setup. The source snapshot records the experiment implementation, when present.

For a redacted prompt, provide the exact original UTF-8 text locally and check its SHA-256. Replace only that placeholder in recipe-template.json, validate it with SpillGuard Repro, then run into a new directory. A substituted prompt is a different experiment.

Report/trace identity fields are scrubbed with a field allowlist. Timestamps are relative, process labels are pseudonyms, and raw events/logs are omitted. This reduces identifying data; it is not a formal privacy guarantee. Do not use this package as an independent residency oracle.
