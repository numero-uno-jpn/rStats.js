"""Reference values for erf and erfc (see _common.py). R has no erf; these are extras."""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import random
import mpmath as mp
from _common import write_fixture

mp.mp.dps = 60
xs = [0, 1e-300, 1e-100, 1e-20, 1e-10, 1e-5, 1e-3, 0.01, 0.1, 0.25, 0.4769362762044699, 0.5, 0.75, 1, 1.5, 2,
      2.5, 3, 4, 5, 6, 8, 10, 15, 20, 26, 26.5, 27, 27.2, 30, 1e3]
rng = random.Random(20261023)
xs += [float("%.8g" % rng.uniform(0, 6)) for _ in range(150)] + [float("%.8g" % 10 ** rng.uniform(-8, 0)) for _ in range(50)]
xs += [-x for x in xs if x > 0]
write_fixture("erf", [({"x": x}, mp.erf(mp.mpf(x)), None) for x in xs])
write_fixture("erfc", [({"x": x}, mp.erfc(mp.mpf(x)), None) for x in xs])
