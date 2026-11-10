"""Predict attendance risk for one student using the trained best model.

Usage (CLI):
    python ml/predict.py --current 68 --previous 72 --total 60 \\
        --attended 41 --absence 0.32 --trend -4 --historical 1

If ml/models/best_model.pkl is missing, falls back to the rule-based
label (model="rule-based") so prediction still works.
"""

import argparse
import json
import os

import joblib
import pandas as pd

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, "models", "best_model.pkl")
EVAL_PATH = os.path.join(BASE_DIR, "evaluation.json")

FEATURES = [
    "current_percentage",
    "previous_percentage",
    "total_classes",
    "classes_attended",
    "absence_frequency",
    "attendance_trend",
    "historical_risk",
]
LABELS = ["SAFE", "WARNING", "HIGH RISK"]


def rule_based_risk(current: float, trend: float) -> str:
    """Label rule from generate_dataset.py (no noise)."""
    if current < 65 or (current < 75 and trend < -3):
        return "HIGH RISK"
    if current < 75 or (current < 85 and trend < -5):
        return "WARNING"
    return "SAFE"


def predict_risk(features: dict) -> dict:
    """Predict risk for one student.

    features: dict with keys current_percentage, previous_percentage,
    total_classes, classes_attended, absence_frequency,
    attendance_trend, historical_risk.
    Returns {risk, model, probabilities}.
    """
    row = pd.DataFrame([[features[k] for k in FEATURES]], columns=FEATURES)

    if os.path.exists(MODEL_PATH):
        model = joblib.load(MODEL_PATH)
        risk = str(model.predict(row)[0])
        model_name = "rule-based"
        if os.path.exists(EVAL_PATH):
            with open(EVAL_PATH) as f:
                model_name = json.load(f).get("best_model", "best_model")
        probabilities = {}
        if hasattr(model, "predict_proba"):
            probs = model.predict_proba(row)[0]
            classes = list(model.classes_)
            probabilities = {
                str(c): round(float(p), 4)
                for c, p in zip(classes, probs)
            }
        return {"risk": risk, "model": model_name,
                "probabilities": probabilities}

    # Fallback: rule-based prediction when no trained model exists.
    risk = rule_based_risk(
        float(features["current_percentage"]),
        float(features["attendance_trend"]))
    probabilities = {label: (1.0 if label == risk else 0.0)
                     for label in LABELS}
    return {"risk": risk, "model": "rule-based",
            "probabilities": probabilities}


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Predict attendance risk for one student.")
    parser.add_argument("--current", type=float, required=True,
                        help="current attendance percentage (50-100)")
    parser.add_argument("--previous", type=float, required=True,
                        help="previous attendance percentage (50-100)")
    parser.add_argument("--total", type=int, required=True,
                        help="total classes")
    parser.add_argument("--attended", type=int, required=True,
                        help="classes attended")
    parser.add_argument("--absence", type=float, required=True,
                        help="absence frequency (0-0.5)")
    parser.add_argument("--trend", type=float, required=True,
                        help="attendance trend in percentage points (-10 to +10)")
    parser.add_argument("--historical", type=int, required=True,
                        help="historical risk: 0 safe, 1 warning, 2 high-risk")
    args = parser.parse_args()

    features = {
        "current_percentage": args.current,
        "previous_percentage": args.previous,
        "total_classes": args.total,
        "classes_attended": args.attended,
        "absence_frequency": args.absence,
        "attendance_trend": args.trend,
        "historical_risk": args.historical,
    }
    print(json.dumps(predict_risk(features), indent=2))


if __name__ == "__main__":
    main()
