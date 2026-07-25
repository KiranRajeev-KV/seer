from __future__ import annotations

import io
from dataclasses import dataclass
from typing import Any, Literal
from uuid import uuid4

import numpy as np
import pandas as pd
from pandas.errors import EmptyDataError, ParserError
from pydantic import BaseModel, ConfigDict, Field
from sklearn.compose import ColumnTransformer
from sklearn.dummy import DummyRegressor
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.model_selection import train_test_split

from .config import Settings
from .profiling import ProfileFailure, _validate_header


Scalar = str | int | float | bool


class PreprocessingPlan(BaseModel):
    model_config = ConfigDict(extra="forbid")

    numeric: list[str]
    categorical: list[str]
    numericImputer: Literal["median"]
    numericScaler: Literal["standard"]
    categoricalImputer: Literal["most_frequent"]
    categoricalEncoder: Literal["one_hot"]


class SplitPlan(BaseModel):
    model_config = ConfigDict(extra="forbid")

    trainingPercent: Literal[80]
    testPercent: Literal[20]
    randomState: Literal[42]


class RegressionAnalysisPlan(BaseModel):
    """The signed plan has already been verified by the MCP service."""

    # The MCP-side signed plan has display-only fields in addition to the
    # execution fields below; ignore those while still validating every input
    # this service consumes.
    model_config = ConfigDict(extra="ignore")

    datasetId: str = Field(min_length=1)
    question: str = Field(min_length=1)
    targetColumn: str = Field(min_length=1)
    featureColumns: list[str] = Field(min_length=1)
    taskType: Literal["regression"]
    predictionRows: list[dict[str, Scalar]] = Field(min_length=1, max_length=10)
    preprocessing: PreprocessingPlan
    warnings: list[str] = Field(default_factory=list)
    split: SplitPlan


class MetricValues(BaseModel):
    mae: float
    rmse: float
    r2: float


class Improvement(BaseModel):
    maeAbsolute: float
    maePercent: float
    rmseAbsolute: float
    rmsePercent: float
    r2Absolute: float


class RegressionMetrics(BaseModel):
    model: MetricValues
    baseline: MetricValues
    improvement: Improvement


class PredictionCoverage(BaseModel):
    outsideNumericRanges: list[str]
    unseenCategoricalValues: list[str]


class RegressionPrediction(BaseModel):
    input: dict[str, Scalar]
    estimatedValue: float
    coverage: PredictionCoverage


class ActualVsPredictedPoint(BaseModel):
    actual: float
    predicted: float


class ResidualVsPredictedPoint(BaseModel):
    predicted: float
    residual: float


class RegressionCharts(BaseModel):
    actualVsPredicted: list[ActualVsPredictedPoint]
    residualVsPredicted: list[ResidualVsPredictedPoint]


class DatasetCoverage(BaseModel):
    trainingRows: int
    testRows: int
    numericRanges: dict[str, dict[str, float]]
    categoricalValues: dict[str, list[str]]


class RegressionAnalysisResponse(BaseModel):
    analysisId: str
    taskType: Literal["regression"]
    model: dict[str, str]
    baseline: dict[str, str]
    quality: Literal["useful_signal", "weak_signal", "no_demonstrated_signal"]
    metrics: RegressionMetrics
    predictions: list[RegressionPrediction]
    charts: RegressionCharts
    datasetCoverage: DatasetCoverage
    warnings: list[str]
    explanationFacts: dict[str, str | int | float | bool]


@dataclass(frozen=True)
class AnalysisFailure(Exception):
    status_code: int
    detail: str


def analyze_regression_csv(raw_csv: bytes, plan: RegressionAnalysisPlan, settings: Settings) -> RegressionAnalysisResponse:
    dataframe = _read_and_validate_csv(raw_csv, settings)
    _validate_plan_against_dataframe(plan, dataframe)

    target = pd.to_numeric(dataframe[plan.targetColumn], errors="raise").astype(float)
    usable = dataframe.loc[target.notna()].copy()
    usable_target = target.loc[target.notna()]
    if len(usable) < 20:
        raise AnalysisFailure(422, "At least 20 rows with a target value are required for regression.")
    if usable_target.nunique() < 5:
        raise AnalysisFailure(422, "Regression requires a target with at least five distinct values.")

    features = usable.loc[:, plan.featureColumns].copy()
    for name in plan.preprocessing.numeric:
        features[name] = pd.to_numeric(features[name], errors="raise")

    x_train, x_test, y_train, y_test = train_test_split(
        features,
        usable_target,
        test_size=0.2,
        random_state=42,
    )
    preprocessor = ColumnTransformer(
        transformers=[
            ("numeric", Pipeline([("imputer", SimpleImputer(strategy="median")), ("scaler", StandardScaler())]), plan.preprocessing.numeric),
            ("categorical", Pipeline([("imputer", SimpleImputer(strategy="most_frequent")), ("encoder", OneHotEncoder(handle_unknown="ignore"))]), plan.preprocessing.categorical),
        ],
        remainder="drop",
    )
    model = Pipeline([("preprocessor", preprocessor), ("regressor", LinearRegression())])
    baseline = DummyRegressor(strategy="mean")
    model.fit(x_train, y_train)
    baseline.fit(x_train, y_train)

    model_predictions = model.predict(x_test)
    baseline_predictions = baseline.predict(x_test)
    model_metrics = _metrics(y_test, model_predictions)
    baseline_metrics = _metrics(y_test, baseline_predictions)
    improvement = _improvement(model_metrics, baseline_metrics)
    quality = _quality(improvement.maePercent)

    prediction_frame = pd.DataFrame(plan.predictionRows, columns=plan.featureColumns)
    for name in plan.preprocessing.numeric:
        prediction_frame[name] = pd.to_numeric(prediction_frame[name], errors="raise")
    estimates = model.predict(prediction_frame)
    coverage = _dataset_coverage(x_train, x_test, plan.preprocessing)
    predictions = [
        RegressionPrediction(
            input=row,
            estimatedValue=float(estimate),
            coverage=_prediction_coverage(row, coverage),
        )
        for row, estimate in zip(plan.predictionRows, estimates, strict=True)
    ]

    warnings = list(dict.fromkeys([
        *plan.warnings,
        *(_prediction_warnings(predictions)),
        *_quality_warnings(quality, model_metrics),
        "Predictions are estimates based on historical dataset patterns; they are not guarantees.",
    ]))
    return RegressionAnalysisResponse(
        analysisId=str(uuid4()),
        taskType="regression",
        model={"name": "LinearRegression"},
        baseline={"name": "DummyRegressor (mean)"},
        quality=quality,
        metrics=RegressionMetrics(model=model_metrics, baseline=baseline_metrics, improvement=improvement),
        predictions=predictions,
        charts=RegressionCharts(
            actualVsPredicted=[ActualVsPredictedPoint(actual=float(actual), predicted=float(predicted)) for actual, predicted in zip(y_test, model_predictions, strict=True)],
            residualVsPredicted=[ResidualVsPredictedPoint(predicted=float(predicted), residual=float(actual - predicted)) for actual, predicted in zip(y_test, model_predictions, strict=True)],
        ),
        datasetCoverage=coverage,
        warnings=warnings,
        explanationFacts={"targetColumn": plan.targetColumn, "usableRows": int(len(usable)), "droppedMissingTargetRows": int(len(dataframe) - len(usable))},
    )


def _read_and_validate_csv(raw_csv: bytes, settings: Settings) -> pd.DataFrame:
    if len(raw_csv) > settings.max_csv_bytes:
        raise AnalysisFailure(413, "CSV exceeds the configured file-size limit.")
    try:
        _validate_header(raw_csv)
        dataframe = pd.read_csv(io.BytesIO(raw_csv))
    except ProfileFailure as error:
        raise AnalysisFailure(error.status_code, error.detail) from error
    except (EmptyDataError, ParserError, UnicodeDecodeError) as error:
        raise AnalysisFailure(422, "CSV could not be parsed.") from error
    if dataframe.empty:
        raise AnalysisFailure(422, "CSV must contain at least one data row.")
    if len(dataframe.columns) > settings.max_csv_columns:
        raise AnalysisFailure(422, "CSV exceeds the configured column limit.")
    if len(dataframe.index) > settings.max_csv_rows:
        raise AnalysisFailure(422, "CSV exceeds the configured row limit.")
    return dataframe


def _validate_plan_against_dataframe(plan: RegressionAnalysisPlan, dataframe: pd.DataFrame) -> None:
    columns = set(dataframe.columns.astype(str))
    if plan.targetColumn not in columns:
        raise AnalysisFailure(422, "The analysis target is not present in this CSV.")
    if len(set(plan.featureColumns)) != len(plan.featureColumns) or plan.targetColumn in plan.featureColumns:
        raise AnalysisFailure(422, "The analysis plan has invalid feature columns.")
    if any(feature not in columns for feature in plan.featureColumns):
        raise AnalysisFailure(422, "An analysis feature is not present in this CSV.")
    declared = plan.preprocessing.numeric + plan.preprocessing.categorical
    if len(set(declared)) != len(declared) or set(declared) != set(plan.featureColumns):
        raise AnalysisFailure(422, "The analysis preprocessing does not match the selected features.")
    if any(set(row) != set(plan.featureColumns) for row in plan.predictionRows):
        raise AnalysisFailure(422, "Prediction inputs do not match the selected features.")
    try:
        pd.to_numeric(dataframe[plan.targetColumn].dropna(), errors="raise")
        for name in plan.preprocessing.numeric:
            pd.to_numeric(dataframe[name].dropna(), errors="raise")
    except (TypeError, ValueError) as error:
        raise AnalysisFailure(422, "The CSV no longer matches the approved numeric analysis plan.") from error


def _metrics(actual: pd.Series, predicted: np.ndarray) -> MetricValues:
    return MetricValues(
        mae=float(mean_absolute_error(actual, predicted)),
        rmse=float(mean_squared_error(actual, predicted) ** 0.5),
        r2=float(r2_score(actual, predicted)),
    )


def _improvement(model: MetricValues, baseline: MetricValues) -> Improvement:
    return Improvement(
        maeAbsolute=float(baseline.mae - model.mae),
        maePercent=_percentage_change(baseline.mae, model.mae),
        rmseAbsolute=float(baseline.rmse - model.rmse),
        rmsePercent=_percentage_change(baseline.rmse, model.rmse),
        r2Absolute=float(model.r2 - baseline.r2),
    )


def _percentage_change(baseline: float, model: float) -> float:
    return 0.0 if baseline == 0 else float((baseline - model) / baseline * 100)


def _quality(mae_improvement_percent: float) -> Literal["useful_signal", "weak_signal", "no_demonstrated_signal"]:
    if mae_improvement_percent >= 10:
        return "useful_signal"
    if mae_improvement_percent > 0:
        return "weak_signal"
    return "no_demonstrated_signal"


def _dataset_coverage(training: pd.DataFrame, testing: pd.DataFrame, preprocessing: PreprocessingPlan) -> DatasetCoverage:
    numeric_ranges = {
        name: {"min": float(training[name].min()), "max": float(training[name].max())}
        for name in preprocessing.numeric
    }
    categorical_values = {
        name: sorted(str(value) for value in training[name].dropna().astype(str).unique())
        for name in preprocessing.categorical
    }
    return DatasetCoverage(
        trainingRows=int(len(training)),
        testRows=int(len(testing)),
        numericRanges=numeric_ranges,
        categoricalValues=categorical_values,
    )


def _prediction_coverage(row: dict[str, Scalar], coverage: DatasetCoverage) -> PredictionCoverage:
    outside = [
        name for name, bounds in coverage.numericRanges.items()
        if float(row[name]) < bounds["min"] or float(row[name]) > bounds["max"]
    ]
    unseen = [
        name for name, known in coverage.categoricalValues.items()
        if str(row[name]) not in known
    ]
    return PredictionCoverage(outsideNumericRanges=outside, unseenCategoricalValues=unseen)


def _prediction_warnings(predictions: list[RegressionPrediction]) -> list[str]:
    warnings: list[str] = []
    for index, prediction in enumerate(predictions, start=1):
        if prediction.coverage.outsideNumericRanges:
            warnings.append(f"Prediction row {index} is outside the training range for {', '.join(prediction.coverage.outsideNumericRanges)}.")
        if prediction.coverage.unseenCategoricalValues:
            warnings.append(f"Prediction row {index} contains unseen training categories for {', '.join(prediction.coverage.unseenCategoricalValues)}.")
    return warnings


def _quality_warnings(quality: str, metrics: MetricValues) -> list[str]:
    warnings: list[str] = []
    if quality == "no_demonstrated_signal":
        warnings.append("The model did not outperform the training-mean baseline on MAE.")
    if metrics.r2 < 0:
        warnings.append("Negative R² means the model performed worse than predicting the training mean on this test split.")
    return warnings
