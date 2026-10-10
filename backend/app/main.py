from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.health import router as health_router
from app.api.auth import router as auth_router
from app.api.markets import router as markets_router
from app.core.config import get_settings
from app.db import initialize_database
from app.seed import seed_demo_data

settings = get_settings()

@asynccontextmanager
async def lifespan(_: FastAPI):
    initialize_database()
    seed_demo_data()
    yield


app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    description="Backend foundation for Shelf Space Spy.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router, prefix="/api")
app.include_router(auth_router, prefix="/api")
app.include_router(markets_router, prefix="/api")
