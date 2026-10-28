"""Conservative experimental labels. Counter correlation alone never proves a culprit."""


def diagnose(report, signature=None, controls=None):
    controls = controls or {}
    stages = [s for trial in report.get("trials", []) for s in trial["stages"]]
    errors = [e for s in stages for e in s["errors"]]
    if any("host memory" in e or "host commit" in e for e in errors):
        return {"label": "insufficient evidence", "reason": "host resource guard invalidated the experiment"}
    if report["verdict"]["outcome"] != "FAIL":
        return {"label": "insufficient evidence", "reason": "no validated slowdown witness"}
    if signature is None:
        return {"label": "insufficient evidence", "reason": "missing phase/counter observations"}
    if signature.counter_disagreement:
        return {"label": "counter disagreement", "reason": "measurement sources disagree under declared threshold"}
    memory = controls.get("memory_holder")
    compute = controls.get("arithmetic_control")
    direct = controls.get("independent_residency_validation")
    if memory == "FAIL" and compute == "FAIL":
        return {"label": "mixed cause", "reason": "both memory and arithmetic-load interventions reproduce slowdown; power/bandwidth confounders remain"}
    if memory == "FAIL" and compute == "PASS" and direct is True:
        return {"label": "supported residency contribution", "reason": "memory intervention, negative arithmetic control, recovery and independent residency validation supplied"}
    return {"label": "insufficient evidence", "reason": "a counter proxy and slowdown do not independently validate residency causation",
            "proxy_kind": signature.kind}
