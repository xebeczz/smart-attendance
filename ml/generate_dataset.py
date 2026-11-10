# SYNTHETIC DATASET — NOT real student data.
#
# This file generates a SYNTHETIC but realistic attendance dataset from
# stated rules + random noise (numpy, seed 42). No real student records
# were used, collected, or copied. Every row is simulated.
#
# Generation rules (seed 42 for reproducibility):
#   - current_percentage:   uniform 50-100 (%)
#   - attendance_trend:     uniform -10 to +10 (percentage-point change
#                            vs previous period: current - previous)
#   - previous_percentage:  current - trend, clipped to 50-100
#   - total_classes:        integer 20-120
#   - classes_attended:     round(total_classes * current_percentage / 100)
#   - absence_frequency:    (1 - current_percentage / 100) + small
#                            Gaussian noise, clipped to 0-0.5
#   - historical_risk:      2 if previous_percentage < 65,
#                            1 if previous_percentage < 75, else 0
#
# LABEL RULE (risk_label):
#   - HIGH RISK if current_percentage < 65
#              OR (current_percentage < 75 AND attendance_trend < -3)
#   - WARNING   if current_percentage < 75
#              OR (current_percentage < 85 AND attendance_trend < -5)
#   - SAFE      otherwise
#
# Noise: ~5% of labels are flipped at random (seed 42) so the classes
# are NOT perfectly separable by the rule, mimicking real-world messiness.

"""Generate the synthetic attendance dataset (800 rows)."""

import os

import numpy as np
import pandas as pd

SEED = 42
N_ROWS = 800
OUT_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                        "data", "attendance_dataset.csv")


def label_rule(current: float, trend: float) -> str:
    """Risk label from the stated rule (no noise)."""
    if current < 65 or (current < 75 and trend < -3):
        return "HIGH RISK"
    if current < 75 or (current < 85 and trend < -5):
        return "WARNING"
    return "SAFE"


def main() -> None:
    rng = np.random.default_rng(SEED)

    current = rng.uniform(50, 100, N_ROWS).round(2)
    trend = rng.uniform(-10, 10, N_ROWS).round(2)
    previous = np.clip(current - trend, 50, 100).round(2)
    total_classes = rng.integers(20, 121, N_ROWS)
    classes_attended = np.clip(
        np.round(total_classes * current / 100), 0, total_classes
    ).astype(int)
    # Absence frequency tracks (1 - current%) with small Gaussian noise.
    absence = np.clip(
        (1 - current / 100) + rng.normal(0, 0.03, N_ROWS), 0, 0.5
    ).round(3)
    historical_risk = np.where(
        previous < 65, 2, np.where(previous < 75, 1, 0)
    ).astype(int)

    labels = np.array([label_rule(c, t) for c, t in zip(current, trend)])

    # Flip ~5% of labels at random so classes are not perfectly separable.
    flip_mask = rng.random(N_ROWS) < 0.05
    classes = np.array(["SAFE", "WARNING", "HIGH RISK"])
    for i in np.where(flip_mask)[0]:
        choices = [c for c in classes if c != labels[i]]
        labels[i] = rng.choice(choices)
    n_flipped = int(flip_mask.sum())

    df = pd.DataFrame({
        "current_percentage": current,
        "previous_percentage": previous,
        "total_classes": total_classes,
        "classes_attended": classes_attended,
        "absence_frequency": absence,
        "attendance_trend": trend,
        "historical_risk": historical_risk,
        "risk_label": labels,
    })

    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    df.to_csv(OUT_PATH, index=False)

    print(f"Wrote {len(df)} rows to {OUT_PATH}")
    print(f"Labels flipped (5% noise): {n_flipped}")
    print(df["risk_label"].value_counts().to_string())


if __name__ == "__main__":
    main()
