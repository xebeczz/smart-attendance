"""ML prediction for the API.

Loads the trained best model from ``ml/evaluation.json`` +
``ml/models/best_model.pkl`` when they exist. When they do not (the model
has not been trained yet), falls back to a transparent rule-based risk
using the same bands as the attendance summary — and says so in
``model_used``. Metrics are never invented: they are only reported when
read verbatim from ``evaluation.json``.

Feature note: the backend only has a single attendance snapshot, so
``previous_percentage`` is set equal to ``current_percentage`` and
``attendance_trend`` is 0. That assumption is stated in the response.
"""

import json
import os
from pathlib import Path

from .attendance import percentage, risk_status

# Project root = parent of backend/
_PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
EVAL_PATH = _PROJECT_ROOT / "ml" / "evaluation.json"
MODEL_PATH = _PROJECT_ROOT / "ml" / "models" / "best_model.pkl"

FEATURE_KEYS = [
    "current_percentage",
    "previous_percentage",
    "total_classes",
    "classes_attended",
    "absence_frequency",
    "attendance_trend",
    "historical_risk",
]


def load_evaluation() -> dict | None:
    """Return the parsed evaluation.json, or None if it does not exist
    (or is unreadable). Only values actually in that file are reported."""
    try:
        with open(EVAL_PATH, encoding="utf-8") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError, OSError):
        return None


def best_model_name(evaluation: dict | None) -> str | None:
    """Best-model name straight from evaluation.json, if present."""
    if not evaluation:
        return None
    # ml/train.py records it under "best_model" (string) or "best" (dict).
    name = evaluation.get("best_model") or evaluation.get("best_model_name")
    if isinstance(name, str):
        return name
    best = evaluation.get("best")
    if isinstance(best, dict):
        return best.get("model") or best.get("name")
    models = evaluation.get("models")
    if isinstance(models, list) and models:
        first = models[0]
        if isinstance(first, dict):
            return first.get("model") or first.get("name")
    return None


def build_features(summary: dict) -> dict:
    """Features from a summary payload. Single snapshot only, so the
    previous percentage equals the current one and the trend is 0."""
    total = summary["total_conducted"]
    attended = summary["total_attended"]
    current = summary["overall_percentage"]
    return {
        "current_percentage": current,
        "previous_percentage": current,  # single snapshot: no history yet
        "total_classes": total,
        "classes_attended": attended,
        # Fraction of conducted classes missed (0 when no data).
        "absence_frequency": round((total - attended) / total, 4) if total > 0 else 0.0,
        "attendance_trend": 0,  # single snapshot: no trend measurable
        "historical_risk": 1 if current < 75 else 0,
    }


def _recommendation(risk: str) -> str:
    if risk == "SAFE":
        return ("You are above the 75% requirement. Keep attending regularly"
                " to stay safe.")
    if risk == "WARNING":
        return ("You are between 65% and 75%. Attend the next few classes"
                " without missing any to get back above 75%.")
    if risk == "HIGH RISK":
        return ("You are below 65%. Attend every upcoming class and speak"
                " to your faculty about catching up — missing more classes"
                " will make recovery much harder.")
    return "Add your attendance data first to get a prediction."


def predict(summary: dict) -> dict:
    """Predict risk for one student from their summary.

    Returns {risk, model_used, features, recommendation, probabilities,
    note}. ``probabilities`` is null for the rule-based fallback.
    """
    features = build_features(summary)
    evaluation = load_evaluation()
    model_name = best_model_name(evaluation)

    # --- Try the trained model, if both files exist -------------------
    if model_name and MODEL_PATH.exists():
        try:
            # The model was saved with joblib (numpy arrays inside), so
            # plain pickle.load fails on it — use joblib first.
            try:
                import joblib

                model = joblib.load(MODEL_PATH)
            except Exception:
                import pickle

                with open(MODEL_PATH, "rb") as f:
                    model = pickle.load(f)
            row = [[features[k] for k in FEATURE_KEYS]]
            probabilities = None
            if hasattr(model, "predict_proba"):
                probs = model.predict_proba(row)[0]
                classes = list(getattr(model, "classes_", []))
                if classes:
                    # Self-describing: {risk_label: probability}.
                    probabilities = {str(c): round(float(p), 4)
                                     for c, p in zip(classes, probs)}
                else:
                    probabilities = [round(float(p), 4) for p in probs]
            pred = model.predict(row)[0]
            # Trained labels are "SAFE" / "WARNING" / "HIGH RISK" (strings)
            # or 0/1/2 in that order.
            if isinstance(pred, str):
                risk = pred
            else:
                risk = ["SAFE", "WARNING", "HIGH RISK"][int(pred)]
            return {
                "risk": risk,
                "model_used": model_name,
                "features": features,
                "recommendation": _recommendation(risk),
                "probabilities": probabilities,
                "note": None,
            }
        except Exception:
            # A broken model file must not break the endpoint — fall
            # through to the rule-based prediction below.
            pass

    # --- Rule-based fallback (no trained model available) -------------
    has_data = summary["total_conducted"] > 0
    risk = risk_status(features["current_percentage"], has_data)
    return {
        "risk": risk,
        "model_used": "rule-based",
        "features": features,
        "recommendation": _recommendation(risk),
        "probabilities": None,
        "note": ("No trained model found (ml/evaluation.json /"
                 " ml/models/best_model.pkl missing), so this is a"
                 " rule-based estimate. previous_percentage equals"
                 " current_percentage and trend is 0 because only a"
                 " single attendance snapshot is available."),
    }


def compare_models() -> dict:
    """Model comparison straight from evaluation.json, or a not-trained
    note. Never invents metrics."""
    evaluation = load_evaluation()
    if not evaluation:
        return {"models": [], "note": "not trained yet"}
    models = evaluation.get("models")
    if isinstance(models, list):
        return {"models": models, "best_model": best_model_name(evaluation)}
    if isinstance(models, dict):
        # ml/train.py shape: {"models": {"random_forest": {metrics...}}}.
        flat = [{"model": name, **(m if isinstance(m, dict) else {})}
                for name, m in models.items()]
        return {"models": flat, "best_model": best_model_name(evaluation)}
    return {"models": [], "note": "not trained yet"}
