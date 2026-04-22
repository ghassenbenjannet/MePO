from fastapi import APIRouter

from app.api.routes_audit import router as audit_router
from app.api.routes_chat import router as chat_router
from app.api.routes_ai_actions import router as ai_actions_router
from app.api.routes_ai_conversations import router as ai_conversations_router
from app.api.routes_auth import router as auth_router
from app.api.routes_comments import router as comments_router
from app.api.routes_documents import router as documents_router
from app.api.routes_imports import router as imports_router
from app.api.routes_knowledge import router as knowledge_router
from app.api.routes_memberships import router as memberships_router
from app.api.routes_projects import router as projects_router
from app.api.routes_spaces import router as spaces_router
from app.api.routes_skills import router as skills_router
from app.api.routes_tickets import router as tickets_router
from app.api.routes_topics import router as topics_router
from app.api.routes_users import router as users_router

api_router = APIRouter()
api_router.include_router(auth_router, prefix="/auth", tags=["auth"])
api_router.include_router(users_router, prefix="/users", tags=["users"])
api_router.include_router(memberships_router, prefix="/memberships", tags=["memberships"])
api_router.include_router(audit_router, prefix="/audit", tags=["audit"])
api_router.include_router(comments_router, prefix="/comments", tags=["comments"])
api_router.include_router(projects_router, prefix="/projects", tags=["projects"])
api_router.include_router(spaces_router, prefix="/spaces", tags=["spaces"])
api_router.include_router(skills_router, tags=["skills"])
api_router.include_router(knowledge_router, tags=["knowledge"])
api_router.include_router(topics_router, prefix="/topics", tags=["topics"])
api_router.include_router(tickets_router, prefix="/tickets", tags=["tickets"])
api_router.include_router(documents_router, tags=["documents"])
api_router.include_router(chat_router, prefix="/ai", tags=["chat"])
api_router.include_router(ai_actions_router, prefix="/ai", tags=["ai"])
api_router.include_router(ai_conversations_router, prefix="/ai", tags=["ai"])
api_router.include_router(imports_router, prefix="/imports", tags=["imports"])
