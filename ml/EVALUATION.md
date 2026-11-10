# Smart Attendance — Model Evaluation

> Data is SYNTHETIC — generated from stated rules + noise (see `generate_dataset.py`), NOT real student data.

- Generated at (UTC): 2026-11-10T08:55:24.304258+00:00
- Dataset rows: 800
- Train rows: 640 | Test rows: 160 (stratified 80/20 split, random_state 42)

## Label rule

HIGH RISK if current_percentage < 65 OR (current_percentage < 75 AND attendance_trend < -3); WARNING if current_percentage < 75 OR (current_percentage < 85 AND attendance_trend < -5); else SAFE. ~5% of labels flipped at random (seed 42) so classes are not perfectly separable.

## Results (test set, macro-averaged precision / recall / F1)

| Model | Accuracy | Precision | Recall | F1 |
|---|---|---|---|---|
| logistic_regression | 0.8375 | 0.8124 | 0.7538 | 0.7592 |
| random_forest | 0.95 | 0.9405 | 0.9412 | 0.9407 |
| knn_k5 | 0.8375 | 0.8102 | 0.7758 | 0.7851 |

**Best model: random_forest (macro F1 = 0.9407)** — saved to `ml/models/best_model.pkl`.

## Confusion matrices (rows = actual, columns = predicted; order: SAFE, WARNING, HIGH RISK)

### logistic_regression

| Actual \ Predicted | SAFE | WARNING | HIGH RISK |
|---|---|---|---|
| SAFE | 64 | 2 | 3 |
| WARNING | 5 | 11 | 14 |
| HIGH RISK | 0 | 2 | 59 |

### random_forest

| Actual \ Predicted | SAFE | WARNING | HIGH RISK |
|---|---|---|---|
| SAFE | 66 | 1 | 2 |
| WARNING | 1 | 27 | 2 |
| HIGH RISK | 0 | 2 | 59 |

### knn_k5

| Actual \ Predicted | SAFE | WARNING | HIGH RISK |
|---|---|---|---|
| SAFE | 65 | 0 | 4 |
| WARNING | 2 | 15 | 13 |
| HIGH RISK | 1 | 6 | 54 |

## Note

All numbers above are REAL measurements from the training run that produced this file — nothing was invented. The dataset is synthetic, so these scores describe performance on simulated data, not on real students.
