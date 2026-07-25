from contextlib import asynccontextmanager
from hmac import compare_digest
from typing import AsyncIterator

from fastapi import Depends, FastAPI, HTTPException, Request, status
from pydantic import BaseModel

from .config import Settings


class HealthResponse(BaseModel):
    status: str = "healthy"
    service: str = "seer-ml"
    version: str = "0.1.0"


def require_api_key(request: Request) -> None:
    authorization = request.headers.get("authorization")
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized")

    supplied_key = authorization.removeprefix("Bearer ")
    settings: Settings = request.app.state.settings
    if not compare_digest(supplied_key, settings.api_key):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized")


def create_app(settings: Settings | None = None) -> FastAPI:
    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        app.state.settings = settings or Settings.from_environment()
        yield

    app = FastAPI(title="Seer ML Service", version="0.1.0", lifespan=lifespan)

    @app.get("/health", response_model=HealthResponse, dependencies=[Depends(require_api_key)])
    async def health() -> HealthResponse:
        return HealthResponse()

    return app


app = create_app()
