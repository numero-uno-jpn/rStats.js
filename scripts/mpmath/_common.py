"""Shared code for the mpmath reference fixtures (test/fixtures/<name>.mpmath.json).

These fixtures hold high-precision values for functions whose R fixtures (oracle/*.R) have not been
generated yet, or where R itself is not accurate. Each case has the same layout as an R fixture case
({"args": ..., "expected": ...}); numbers are strings printed with %.17g. An optional "scale" is the
magnitude of terms that cancel in the result (for example digamma near its negative zeros): the tests
then measure the error relative to max(|expected|, scale) instead of |expected|.

Run with: python3 -I scripts/mpmath/<name>.py  (needs mpmath; writes into test/fixtures)
"""
import json
import os
import mpmath as mp

FIXTURES = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "test", "fixtures")


def num2str(v):
    if isinstance(v, bool):
        return v
    if isinstance(v, (list, tuple)):
        return [num2str(e) for e in v]
    v = mp.mpf(v) if not isinstance(v, (int, float)) else v
    if mp.isnan(v):
        return "NaN"
    if mp.isinf(v):
        return "Inf" if v > 0 else "-Inf"
    f = float(v)
    if f == float("inf"):
        return "Inf"
    if f == float("-inf"):
        return "-Inf"
    return "%.17g" % f


def write_fixture(name, cases):
    """cases: list of (args dict, expected mpf, scale mpf or None)"""
    lines = []
    for args, expected, scale in cases:
        c = {"args": {k: num2str(v) for k, v in args.items()}, "expected": num2str(expected)}
        if scale is not None:
            c["scale"] = num2str(scale)
        lines.append("    " + json.dumps(c, separators=(",", ":")))
    out = "\n".join([
        "{",
        '  "function": %s,' % json.dumps(name),
        '  "generator": %s,' % json.dumps("mpmath " + mp.__version__),
        '  "cases": [',
        ",\n".join(lines),
        "  ]",
        "}",
    ]) + "\n"
    with open(os.path.join(FIXTURES, name + ".mpmath.json"), "w") as f:
        f.write(out)
    print("%s: %d cases (mpmath %s)" % (name, len(cases), mp.__version__))
