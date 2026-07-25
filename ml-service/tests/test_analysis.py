from app.analysis import AnalysisFailure, RegressionAnalysisPlan, analyze_regression_csv
from app.config import Settings
from app.main import create_app
from fastapi.testclient import TestClient
import json
import pytest


def make_plan(prediction_rows: list[dict[str, str | int | float | bool]] | None = None) -> RegressionAnalysisPlan:
    return RegressionAnalysisPlan.model_validate({
        "datasetId": "employee-compensation",
        "question": "Estimate salary",
        "targetColumn": "annual_salary",
        "featureColumns": ["years_experience", "department"],
        "taskType": "regression",
        "predictionRows": prediction_rows or [{"years_experience": 10, "department": "engineering"}],
        "preprocessing": {"numeric": ["years_experience"], "categorical": ["department"], "numericImputer": "median", "numericScaler": "standard", "categoricalImputer": "most_frequent", "categoricalEncoder": "one_hot"},
        "warnings": [],
        "split": {"trainingPercent": 80, "testPercent": 20, "randomState": 42},
    })


def regression_csv() -> bytes:
    rows = ["years_experience,department,annual_salary"]
    for index in range(40):
        department = "engineering" if index % 2 else "sales"
        salary = 50000 + index * 3100 + (9000 if department == "engineering" else 0)
        rows.append(f"{index + 1},{department},{salary}")
    return ("\n".join(rows) + "\n").encode()


def settings() -> Settings:
    return Settings(api_key="test-secret")


def test_mixed_feature_regression_returns_metrics_predictions_and_diagnostics() -> None:
    result = analyze_regression_csv(regression_csv(), make_plan(), settings())

    assert result.taskType == "regression"
    assert result.model["name"] == "LinearRegression"
    assert result.baseline["name"] == "DummyRegressor (mean)"
    assert result.datasetCoverage.trainingRows == 32
    assert result.datasetCoverage.testRows == 8
    assert len(result.charts.actualVsPredicted) == 8
    assert len(result.charts.residualVsPredicted) == 8
    assert result.metrics.model.mae < result.metrics.baseline.mae
    assert result.predictions[0].estimatedValue > 0


def test_unseen_categories_and_extrapolation_are_disclosed() -> None:
    result = analyze_regression_csv(
        regression_csv(),
        make_plan([{"years_experience": 200, "department": "research"}]),
        settings(),
    )

    coverage = result.predictions[0].coverage
    assert coverage.outsideNumericRanges == ["years_experience"]
    assert coverage.unseenCategoricalValues == ["department"]
    assert any("outside the training range" in warning for warning in result.warnings)
    assert any("unseen training categories" in warning for warning in result.warnings)


def test_missing_targets_are_excluded_after_the_plan_is_validated() -> None:
    csv = regression_csv().decode().replace("3,sales,56200", "3,sales,")
    result = analyze_regression_csv(csv.encode(), make_plan(), settings())

    assert result.explanationFacts["droppedMissingTargetRows"] == 1
    assert result.explanationFacts["usableRows"] == 39


def test_missing_numeric_and_categorical_features_are_imputed_from_training_data() -> None:
    csv = regression_csv().decode()
    csv = csv.replace("4,engineering,68300", ",engineering,68300")
    csv = csv.replace("5,sales,62400", "5,,62400")

    result = analyze_regression_csv(csv.encode(), make_plan(), settings())

    assert result.datasetCoverage.trainingRows == 32
    assert len(result.charts.actualVsPredicted) == 8


def test_constant_regression_targets_are_rejected() -> None:
    csv = "years_experience,department,annual_salary\n" + "\n".join(
        f"{index},engineering,100000" for index in range(1, 25)
    )

    with pytest.raises(AnalysisFailure, match="five distinct values"):
        analyze_regression_csv(csv.encode(), make_plan(), settings())


def test_analyze_endpoint_accepts_the_full_signed_plan_shape() -> None:
    full_plan = make_plan().model_dump()
    full_plan.update({
        "rows": {"dataset": 40, "missingTarget": 0, "usable": 40},
        "excludedColumns": [],
        "assumptions": [],
    })
    with TestClient(create_app(settings())) as client:
        response = client.post(
            "/v1/analyze",
            headers={"Authorization": "Bearer test-secret"},
            files={"file": ("employee-compensation.csv", regression_csv(), "text/csv")},
            data={"plan": json.dumps(full_plan)},
        )

    assert response.status_code == 200
    assert response.json()["taskType"] == "regression"
