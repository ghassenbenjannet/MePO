from fastapi import APIRouter

from app.api.routes_ai import router as ai_router
from app.api.routes_documents import router as documents_router
from app.api.routes_imports import router as imports_router
from app.api.routes_projects import router as projects_router
from app.api.routes_spaces import router as spaces_router
from app.api.routes_tickets import router as tickets_router
from app.api.routes_topics import router as topics_router

api_router = APIRouter()
api_router.include_router(projects_router, prefix="/projects", tags=["projects"])
api_router.include_router(spaces_router, prefix="/spaces", tags=["spaces"])
api_router.include_router(topics_router, prefix="/topics", tags=["topics"])
api_router.include_router(tickets_router, prefix="/tickets", tags=["tickets"])
api_router.include_router(documents_router, prefix="/documents", tags=["documents"])
api_router.include_router(ai_router, prefix="/ai", tags=["ai"])
api_router.include_router(imports_router, prefix="/imports", tags=["imports"])
