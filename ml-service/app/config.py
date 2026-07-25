from dataclasses import dataclass
import os


@dataclass(frozen=True)
class Settings:
    api_key: str

    @classmethod
    def from_environment(cls) -> "Settings":
        api_key = os.environ.get("ML_SERVICE_API_KEY")
        if not api_key:
            raise RuntimeError("ML_SERVICE_API_KEY must be configured.")
        return cls(api_key=api_key)
