"""ML endpoint tests.

The model is not trained yet in this repo (no ml/evaluation.json), so
these tests assert the rule-based fallback behaves correctly — and they
must NOT fail if the model is trained later: when evaluation.json does
exist, they check its contents instead of the fallback.
"""

from pathlib import Path

from backend.app import ml_predict

EVAL = Path(__file__).resolve().parent.parent / "ml" / "evaluation.json"


def _add_subjects(client, headers, rows):
    for name, total, attended in rows:
        r = client.post("/api/attendance/manual", headers=headers, json={
            "subject_name": name, "total_classes": total,
            "attended": attended})
        assert r.status_code == 201, r.text


def _model_trained() -> bool:
    """True only when a trained model + its evaluation file both exist."""
    pkl = Path(__file__).resolve().parent.parent / "ml" / "models" / "best_model.pkl"
    return EVAL.exists() and pkl.exists()


def test_predict_rule_based_safe(client, make_user):
    headers, _ = make_user()
    _add_subjects(client, headers, [("Maths", 100, 85)])
    r = client.get("/api/ml/predict", headers=headers)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["features"]["current_percentage"] == 85.0
    # Single snapshot: previous == current, trend is 0 (stated in note).
    assert body["features"]["previous_percentage"] == 85.0
    assert body["features"]["attendance_trend"] == 0
    assert "recommendation" in body and body["recommendation"]
    assert body["risk"] in ("SAFE", "WARNING", "HIGH RISK", "NO DATA")
    if _model_trained():
        assert body["model_used"] == ml_predict.best_model_name(
            ml_predict.load_evaluation())
    else:
        assert body["model_used"] == "rule-based"
        assert body["risk"] == "SAFE"
        assert body["probabilities"] is None


def test_predict_rule_based_warning_and_high_risk(client, make_user):
    headers, _ = make_user()
    _add_subjects(client, headers, [("Maths", 100, 70)])
    body = client.get("/api/ml/predict", headers=headers).json()
    if not _model_trained():
        assert body["risk"] == "WARNING"
        assert body["model_used"] == "rule-based"
    else:
        # Trained model: exact class may differ from the rule bands, but
        # it must be a valid risk label from the named model.
        assert body["risk"] in ("SAFE", "WARNING", "HIGH RISK")
        assert body["model_used"] != "rule-based"

    headers2, _ = make_user()
    _add_subjects(client, headers2, [("Maths", 100, 50)])
    body = client.get("/api/ml/predict", headers=headers2).json()
    if not _model_trained():
        assert body["risk"] == "HIGH RISK"


def test_predict_no_data(client, make_user):
    headers, _ = make_user()
    body = client.get("/api/ml/predict", headers=headers).json()
    if not _model_trained():
        assert body["risk"] == "NO DATA"
        assert body["features"]["current_percentage"] == 0
    else:
        # With a trained model and no data, the prediction still returns
        # a valid risk label (model sees 0% attendance).
        assert body["risk"] in ("SAFE", "WARNING", "HIGH RISK", "NO DATA")


def test_compare_not_trained_yet(client, make_user):
    headers, _ = make_user()
    r = client.get("/api/ml/compare", headers=headers)
    assert r.status_code == 200, r.text
    body = r.json()
    if EVAL.exists():
        # Trained: metrics must come from the file, with real numbers.
        assert body["models"], "evaluation.json exists but no models listed"
        for m in body["models"]:
            assert "model" in m or "name" in m
    else:
        assert body["models"] == []
        assert body["note"] == "not trained yet"


def test_compare_reads_evaluation_file_when_present():
    # Loader behaviour: None + "not trained yet" while the file is
    # absent; real file contents (never invented metrics) when present.
    if not EVAL.exists():
        assert ml_predict.load_evaluation() is None
        assert ml_predict.compare_models() == {
            "models": [], "note": "not trained yet"}
    else:
        evaluation = ml_predict.load_evaluation()
        assert isinstance(evaluation, dict)
        assert "models" in evaluation
        assert isinstance(ml_predict.best_model_name(evaluation), str)
        compared = ml_predict.compare_models()
        assert len(compared["models"]) >= 1
