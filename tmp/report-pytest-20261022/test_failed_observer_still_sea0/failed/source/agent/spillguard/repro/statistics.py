"""Block-level uncertainty. Exact binomial intervals; no token pseudo-replication.

Repeated decision looks use Bonferroni correction for the *declared* maximum
number of looks. Coverage assumes independent Bernoulli blocks under a stationary
condition. Neither the interval nor software makes that assumption true on hardware.
"""
import math


def binomial_interval(successes: int, trials: int, alpha: float = 0.05):
    if type(successes) is not int or type(trials) is not int or not 0 <= successes <= trials <= 200 or trials == 0:
        raise ValueError("require 0 <= successes <= trials <= 200 and at least one block")
    if not 0 < alpha < 1:
        raise ValueError("alpha must be between zero and one")
    def tail(p, start, end):
        return sum(math.comb(trials, k) * p**k * (1 - p)**(trials - k) for k in range(start, end + 1))
    def solve(fn, increasing):
        lo, hi = 0.0, 1.0
        for _ in range(70):
            mid = (lo + hi) / 2
            if (fn(mid) < alpha / 2) == increasing:
                lo = mid
            else:
                hi = mid
        return (lo + hi) / 2
    lower = 0.0 if successes == 0 else solve(lambda p: tail(p, successes, trials), True)
    upper = 1.0 if successes == trials else solve(lambda p: tail(p, 0, successes), False)
    return lower, upper


def trial_decision(outcomes, *, max_looks=1, alpha=0.05, threshold=0.5):
    if type(max_looks) is not int or not 1 <= max_looks <= 10 or not 0 < threshold < 1:
        raise ValueError("invalid declared look budget or reproduction threshold")
    n, k = len(outcomes), outcomes.count("FAIL")
    invalid = outcomes.count("INCONCLUSIVE")
    if any(o not in ("FAIL", "PASS", "INCONCLUSIVE") for o in outcomes):
        raise ValueError("unknown outcome")
    if not n or invalid:
        return {"outcome": "INCONCLUSIVE", "k": k, "n": n, "invalid": invalid, "interval": None,
                "reason": "invalid or missing blocks cannot certify a failure or non-failure"}
    lo, hi = binomial_interval(k, n, alpha / max_looks)
    decision = "FAIL" if lo > threshold else "PASS" if hi < threshold else "INCONCLUSIVE"
    return {"outcome": decision, "k": k, "n": n, "invalid": 0, "interval": [lo, hi],
            "alpha_per_look": alpha / max_looks, "max_looks": max_looks, "threshold": threshold,
            "assumption": "independent stationary whole blocks; not token intervals"}
