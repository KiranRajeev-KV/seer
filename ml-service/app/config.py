from dataclasses import dataclass
import os


@dataclass(frozen=True)
class Settings:
    api_key: str
    max_csv_bytes: int = 5 * 1024 * 1024
    max_csv_rows: int = 20_000
    max_csv_columns: int = 50
    max_categorical_values: int = 50
    sample_rows: int = 10

    @classmethod
    def from_environment(cls) -> "Settings":
        api_key = os.environ.get("ML_SERVICE_API_KEY")
        if not api_key:
            raise RuntimeError("ML_SERVICE_API_KEY must be configured.")
        return cls(
            api_key=api_key,
            max_csv_bytes=_positive_int("ML_PROFILE_MAX_CSV_BYTES", 5 * 1024 * 1024),
            max_csv_rows=_positive_int("ML_PROFILE_MAX_CSV_ROWS", 20_000),
            max_csv_columns=_positive_int("ML_PROFILE_MAX_CSV_COLUMNS", 50),
            max_categorical_values=_positive_int("ML_PROFILE_MAX_CATEGORICAL_VALUES", 50),
            sample_rows=_positive_int("ML_PROFILE_SAMPLE_ROWS", 10),
        )


def _positive_int(name: str, default: int) -> int:
    raw_value = os.environ.get(name)
    if raw_value is None:
        return default

    try:
        value = int(raw_value)
    except ValueError as error:
        raise RuntimeError(f"{name} must be a positive integer.") from error

    if value <= 0:
        raise RuntimeError(f"{name} must be a positive integer.")
    return value
