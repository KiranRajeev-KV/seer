from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from hmac import compare_digest

from fastapi import (
    Depends,
    FastAPI,
    File,
    Form,
    HTTPException,
    Request,
    UploadFile,
    status,
)
from pydantic import BaseModel

from .analysis import (
    AnalysisFailure,
    RegressionAnalysisPlan,
    RegressionAnalysisResponse,
    analyze_regression_csv,
)
from .config import Settings
from .profiling import ProfileFailure, ProfileResponse, profile_csv


class HealthResponse(BaseModel):
    status: str = "healthy"
    service: str = "seer-ml"
    version: str = "0.1.0"


def require_api_key(request: Request) -> None:
    authorization = request.headers.get("authorization")
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized"
        )

    supplied_key = authorization.removeprefix("Bearer ")
    settings: Settings = request.app.state.settings
    if not compare_digest(supplied_key, settings.api_key):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized"
        )


def create_app(settings: Settings | None = None) -> FastAPI:
    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        app.state.settings = settings or Settings.from_environment()
        yield

    app = FastAPI(title="Seer ML Service", version="0.1.0", lifespan=lifespan)

    @app.get(
        "/health",
        response_model=HealthResponse,
        dependencies=[Depends(require_api_key)],
    )
    async def health() -> HealthResponse:
        return HealthResponse()

    @app.post(
        "/v1/profile",
        response_model=ProfileResponse,
        dependencies=[Depends(require_api_key)],
    )
    async def profile_dataset(
        request: Request,
        file: UploadFile = File(...),
        dataset_id: str = Form(..., min_length=1),
    ) -> ProfileResponse:
        settings: Settings = request.app.state.settings
        if file.content_type not in {
            "text/csv",
            "application/csv",
            "application/vnd.ms-excel",
        }:
            raise HTTPException(
                status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                detail="Expected a CSV file.",
            )

        raw_csv = await file.read(settings.max_csv_bytes + 1)
        try:
            return profile_csv(dataset_id, raw_csv, settings)
        except ProfileFailure as error:
            raise HTTPException(
                status_code=error.status_code, detail=error.detail
            ) from error

    @app.post(
        "/v1/analyze",
        response_model=RegressionAnalysisResponse,
        dependencies=[Depends(require_api_key)],
    )
    async def analyze_dataset(
        request: Request,
        file: UploadFile = File(...),
        plan: str = Form(...),
    ) -> RegressionAnalysisResponse:
        settings: Settings = request.app.state.settings
        if file.content_type not in {
            "text/csv",
            "application/csv",
            "application/vnd.ms-excel",
        }:
            raise HTTPException(
                status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                detail="Expected a CSV file.",
            )

        raw_csv = await file.read(settings.max_csv_bytes + 1)
        try:
            parsed_plan = RegressionAnalysisPlan.model_validate_json(plan)
            return analyze_regression_csv(raw_csv, parsed_plan, settings)
        except AnalysisFailure as error:
            raise HTTPException(
                status_code=error.status_code, detail=error.detail
            ) from error
        except ValueError as error:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Analysis plan is invalid.",
            ) from error

    return app


app = create_app()
