"""Train and evaluate risk classifiers on the synthetic attendance dataset.

Loads ml/data/attendance_dataset.csv, stratified 80/20 train/test split
(random_state 42), trains Logistic Regression, Random Forest and KNN
(k=5) — StandardScaler pipeline for LR and KNN, plain for RF — evaluates
each on the test set, selects the best by macro F1, saves it to
ml/models/best_model.pkl, and writes the REAL measured metrics to
ml/evaluation.json and ml/EVALUATION.md. No numbers are invented:
every metric comes from this run.
"""

import json
import os
from datetime import datetime, timezone

import joblib
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (accuracy_score, confusion_matrix, f1_score,
                             precision_score, recall_score)
from sklearn.model_selection import train_test_split
from sklearn.neighbors import KNeighborsClassifier
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_PATH = os.path.join(BASE_DIR, "data", "attendance_dataset.csv")
MODEL_PATH = os.path.join(BASE_DIR, "models", "best_model.pkl")
EVAL_JSON_PATH = os.path.join(BASE_DIR, "evaluation.json")
EVAL_MD_PATH = os.path.join(BASE_DIR, "EVALUATION.md")

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

LABEL_RULE = (
    "HIGH RISK if current_percentage < 65 OR "
    "(current_percentage < 75 AND attendance_trend < -3); "
    "WARNING if current_percentage < 75 OR "
    "(current_percentage < 85 AND attendance_trend < -5); "
    "else SAFE. ~5% of labels flipped at random (seed 42) so classes "
    "are not perfectly separable."
)


def evaluate(model, X_test, y_test):
    preds = model.predict(X_test)
    cm = confusion_matrix(y_test, preds, labels=LABELS).tolist()
    return {
        "accuracy": round(float(accuracy_score(y_test, preds)), 4),
        "precision": round(float(precision_score(
            y_test, preds, average="macro", zero_division=0)), 4),
        "recall": round(float(recall_score(
            y_test, preds, average="macro", zero_division=0)), 4),
        "f1": round(float(f1_score(
            y_test, preds, average="macro", zero_division=0)), 4),
        "confusion_matrix": cm,
    }


def main() -> None:
    df = pd.read_csv(DATA_PATH)
    X = df[FEATURES]
    y = df["risk_label"]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.20, random_state=42, stratify=y
    )

    models = {
        "logistic_regression": Pipeline([
            ("scaler", StandardScaler()),
            ("clf", LogisticRegression(max_iter=1000, random_state=42)),
        ]),
        "random_forest": RandomForestClassifier(
            n_estimators=200, random_state=42),
        "knn_k5": Pipeline([
            ("scaler", StandardScaler()),
            ("clf", KNeighborsClassifier(n_neighbors=5)),
        ]),
    }

    results = {}
    fitted = {}
    for name, model in models.items():
        model.fit(X_train, y_train)
        fitted[name] = model
        results[name] = evaluate(model, X_test, y_test)
        m = results[name]
        print(f"{name}: accuracy={m['accuracy']} precision={m['precision']} "
              f"recall={m['recall']} f1={m['f1']}")

    best_name = max(results, key=lambda n: results[n]["f1"])
    best_f1 = results[best_name]["f1"]
    print(f"Best model: {best_name} (macro F1 = {best_f1})")

    os.makedirs(os.path.dirname(MODEL_PATH), exist_ok=True)
    joblib.dump(fitted[best_name], MODEL_PATH)
    print(f"Saved best model to {MODEL_PATH}")

    evaluation = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "dataset_rows": int(len(df)),
        "train_rows": int(len(X_train)),
        "test_rows": int(len(X_test)),
        "label_rule": LABEL_RULE,
        "models": results,
        "best_model": best_name,
        "best_f1": best_f1,
    }
    with open(EVAL_JSON_PATH, "w") as f:
        json.dump(evaluation, f, indent=2)
    print(f"Wrote {EVAL_JSON_PATH}")

    # Human-readable report of the same numbers.
    lines = [
        "# Smart Attendance — Model Evaluation",
        "",
        "> Data is SYNTHETIC — generated from stated rules + noise "
        "(see `generate_dataset.py`), NOT real student data.",
        "",
        f"- Generated at (UTC): {evaluation['generated_at']}",
        f"- Dataset rows: {evaluation['dataset_rows']}",
        f"- Train rows: {evaluation['train_rows']} | "
        f"Test rows: {evaluation['test_rows']} (stratified 80/20 split, "
        "random_state 42)",
        "",
        "## Label rule",
        "",
        LABEL_RULE,
        "",
        "## Results (test set, macro-averaged precision / recall / F1)",
        "",
        "| Model | Accuracy | Precision | Recall | F1 |",
        "|---|---|---|---|---|",
    ]
    for name, m in results.items():
        lines.append(
            f"| {name} | {m['accuracy']} | {m['precision']} | "
            f"{m['recall']} | {m['f1']} |")
    lines += [
        "",
        f"**Best model: {best_name} (macro F1 = {best_f1})** — saved to "
        "`ml/models/best_model.pkl`.",
        "",
        "## Confusion matrices (rows = actual, columns = predicted; "
        "order: SAFE, WARNING, HIGH RISK)",
        "",
    ]
    for name, m in results.items():
        lines.append(f"### {name}")
        lines.append("")
        lines.append("| Actual \\ Predicted | SAFE | WARNING | HIGH RISK |")
        lines.append("|---|---|---|---|")
        for label, row in zip(LABELS, m["confusion_matrix"]):
            lines.append(
                f"| {label} | {row[0]} | {row[1]} | {row[2]} |")
        lines.append("")
    lines += [
        "## Note",
        "",
        "All numbers above are REAL measurements from the training run "
        "that produced this file — nothing was invented. The dataset is "
        "synthetic, so these scores describe performance on simulated "
        "data, not on real students.",
        "",
    ]
    with open(EVAL_MD_PATH, "w") as f:
        f.write("\n".join(lines))
    print(f"Wrote {EVAL_MD_PATH}")


if __name__ == "__main__":
    main()
