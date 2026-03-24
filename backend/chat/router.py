import uuid
from typing import Any, List, Optional, Tuple

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from langchain_anthropic import ChatAnthropic
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from langfuse.langchain import CallbackHandler as LangfuseHandler
from pydantic import BaseModel, SecretStr
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from auth.dependencies import get_current_user
from auth.models import User
from chat.models import ChatMessage, Conversation
from db import get_db
from rag.retriever import retrieve
from settings import settings

router = APIRouter()

_llm: ChatAnthropic | None = None


def _get_llm() -> ChatAnthropic:
    global _llm
    if _llm is None:
        if not settings.ANTHROPIC_API_KEY:
            raise HTTPException(status_code=503, detail="ANTHROPIC_API_KEY not configured")
        _llm = ChatAnthropic(
            model_name="claude-sonnet-4-20250514",
            api_key=SecretStr(settings.ANTHROPIC_API_KEY),
            timeout=60,
            stop=None,
        )
    return _llm


SYSTEM_PROMPT = (
    "You are KRepo Assistant, a helpful AI that answers questions about a company's "
    "internal knowledge base. Be concise and helpful. Use the provided context to answer "
    "questions. If the context doesn't contain relevant information, say so."
)


# ── Request / Response schemas ────────────────────────────────────────────────


class MessageIn(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: list[MessageIn]
    conversation_id: str | None = None
    mode: Optional[str] = None
    level: Optional[str] = None
    task_context: Optional[dict] = None


class ConversationOut(BaseModel):
    id: str
    title: str
    created_at: str
    updated_at: str

    class Config:
        from_attributes = True


class MessageOut(BaseModel):
    id: str
    role: str
    content: str
    created_at: str

    class Config:
        from_attributes = True


class ConversationDetail(BaseModel):
    id: str
    title: str
    messages: list[MessageOut]


# ── RAG helpers ───────────────────────────────────────────────────────────────


async def _build_context(query: str, tenant_id: str, db: AsyncSession) -> Tuple[str, List[Any]]:
    chunks = await retrieve(db, query, tenant_id=tenant_id, top_k=10)
    if not chunks:
        return "", []

    context_parts: list[str] = []
    for chunk in chunks:
        source = str(chunk.source) if chunk.source else "unknown"
        title = str(chunk.title) if chunk.title else "Untitled"
        context_parts.append(f"[{source}] {title}\n{chunk.content}\nSource: {chunk.url}")
    return "\n\n---\n\n".join(context_parts), chunks


async def _to_langchain_messages(
    messages: list[MessageIn],
    mode: Optional[str],
    level: Optional[str],
    tenant_id: str,
    db: AsyncSession,
    task_context: Optional[dict] = None,
) -> Tuple[list[Any], List[Any]]:
    last_user_msg = ""
    for msg in reversed(messages):
        if msg.role == "user":
            last_user_msg = msg.content
            break

    context_text, chunks = await _build_context(last_user_msg, tenant_id, db)
    system_content = SYSTEM_PROMPT

    if mode == "onboarding":
        if task_context:
            title = task_context.get("title", "")
            description = task_context.get("description", "")
            skills = ", ".join(task_context.get("required_skills", []))
            assignee = task_context.get("assignee_name", "the employee")
            system_content += f"""
### EMPLOYEE ONBOARDING MODE
You are assessing {assignee} for the following assigned task:
- Title: {title}
- Description: {description}
- Required Skills: {skills}

Your job:
1. When the employee begins their assessment, respond ONLY with JSON identifying the key concepts
   they need to master for this specific task. Ground concepts in the knowledge base context below.
2. When they provide ratings for those concepts, respond ONLY with a personalized learning_path DAG
   targeting their knowledge gaps.

JSON for Step 1:
{{
  "concepts": [
    {{ "name": "Concept Name", "level_question": "How familiar are you with X? (0-10)" }}
  ],
  "learning_path": {{ "nodes": [] }}
}}

JSON for Step 2:
{{
  "learning_path": {{
    "nodes": [
      {{
        "id": "unique_id",
        "title": "Topic Title",
        "description": "What the employee will learn here",
        "prerequisites": ["other_id"],
        "xp": 0
      }}
    ]
  }}
}}

STRICT RULES:
- Output valid JSON only. No prose or filler text.
- The graph must be a Directed Acyclic Graph (DAG).
- For concepts rated >=7 by the employee, start them at advanced nodes (skip foundational ones).
- For concepts rated <4, include foundational nodes before advanced ones.
- Keep nodes focused and actionable — each node should represent a learnable unit from the docs."""
        else:
            system_content += """
### ONBOARDING MODE INSTRUCTIONS
You are operating in onboarding mode.
1. If the user describes a task, respond ONLY with a JSON object identifying key concepts.
2. If the user provides 'ratings' for those concepts, respond ONLY with a JSON 'learning_path' DAG.

JSON Structure for Step 1:
{
  "concepts": [
    { "name": "Concept Name", "level_question": "Question about knowledge (0-10)?" }
  ],
  "learning_path": { "nodes": [] }
}

JSON Structure for Step 2 (The Graph):
{
  "learning_path": {
    "nodes": [
      {
        "id": "unique_id",
        "title": "Node Title",
        "description": "What to learn",
        "prerequisites": ["other_id"],
        "xp": 0
      }
    ]
  }
}

STRICT RULES:
- Output valid JSON only. No conversational filler.
- The graph must be a Directed Acyclic Graph (DAG).
- Use 0 for XP initially unless the user has high ratings."""

    if context_text:
        system_content += f"\n\nRelevant context from the knowledge base:\n\n{context_text}"

    lc_messages: list[Any] = [SystemMessage(content=system_content)]

    for msg in messages:
        if msg.role == "user":
            lc_messages.append(HumanMessage(content=msg.content))
        elif msg.role == "assistant":
            lc_messages.append(AIMessage(content=msg.content))

    return lc_messages, chunks


# ── Endpoints ─────────────────────────────────────────────────────────────────


@router.get("/conversations", response_model=list[ConversationOut])
async def list_conversations(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[ConversationOut]:
    result = await db.execute(
        select(Conversation)
        .where(
            Conversation.tenant_id == current_user.tenant_id,
            Conversation.user_id == current_user.id,
        )
        .order_by(Conversation.updated_at.desc())
    )
    convos = result.scalars().all()
    return [
        ConversationOut(
            id=str(c.id),
            title=c.title,
            created_at=c.created_at.isoformat(),
            updated_at=c.updated_at.isoformat(),
        )
        for c in convos
    ]


@router.get("/conversations/{conversation_id}", response_model=ConversationDetail)
async def get_conversation(
    conversation_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ConversationDetail:
    result = await db.execute(
        select(Conversation)
        .options(selectinload(Conversation.messages))
        .where(
            Conversation.id == uuid.UUID(conversation_id),
            Conversation.tenant_id == current_user.tenant_id,
            Conversation.user_id == current_user.id,
        )
    )
    convo = result.scalar_one_or_none()
    if not convo:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return ConversationDetail(
        id=str(convo.id),
        title=convo.title,
        messages=[
            MessageOut(
                id=str(m.id),
                role=m.role,
                content=m.content,
                created_at=m.created_at.isoformat(),
            )
            for m in convo.messages
        ],
    )


@router.delete("/conversations/{conversation_id}")
async def delete_conversation(
    conversation_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    result = await db.execute(
        select(Conversation).where(
            Conversation.id == uuid.UUID(conversation_id),
            Conversation.tenant_id == current_user.tenant_id,
            Conversation.user_id == current_user.id,
        )
    )
    convo = result.scalar_one_or_none()
    if not convo:
        raise HTTPException(status_code=404, detail="Conversation not found")
    await db.delete(convo)
    await db.commit()
    return {"status": "deleted"}


@router.post("/chat")
async def chat(
    request: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> StreamingResponse:
    tenant_id = str(current_user.tenant_id)

    # Resolve or create conversation
    convo: Conversation | None = None
    if request.conversation_id:
        result = await db.execute(
            select(Conversation).where(
                Conversation.id == uuid.UUID(request.conversation_id),
                Conversation.tenant_id == current_user.tenant_id,
                Conversation.user_id == current_user.id,
            )
        )
        convo = result.scalar_one_or_none()
        if not convo:
            raise HTTPException(status_code=404, detail="Conversation not found")

    if convo is None:
        # Auto-title from first user message
        first_user_msg = next((m.content for m in request.messages if m.role == "user"), "New chat")
        title = first_user_msg[:100].strip() or "New chat"
        convo = Conversation(
            tenant_id=current_user.tenant_id,
            user_id=current_user.id,
            title=title,
        )
        db.add(convo)
        await db.flush()  # populate convo.id

    # Save the user message(s) that aren't already persisted
    last_user_msg = request.messages[-1] if request.messages else None
    if last_user_msg and last_user_msg.role == "user":
        db.add(
            ChatMessage(
                conversation_id=convo.id,
                role="user",
                content=last_user_msg.content,
            )
        )

    # Commit so the streaming generator's separate session can see the conversation
    await db.commit()

    conversation_id = convo.id

    lc_messages, _chunks = await _to_langchain_messages(
        request.messages, request.mode, request.level, tenant_id, db, request.task_context
    )

    llm = _get_llm()

    # Langfuse tracing config
    langfuse_config: dict[str, Any] = {}
    if settings.LANGFUSE_PUBLIC_KEY:
        langfuse_config = {
            "callbacks": [LangfuseHandler()],
            "metadata": {
                "langfuse_user_id": str(current_user.id),
                "langfuse_session_id": str(conversation_id),
                "langfuse_tags": [request.mode or "chat", f"tenant:{tenant_id}"],
            },
        }

    async def stream_response():
        full_content = ""

        async for chunk in llm.astream(lc_messages, config=langfuse_config):
            text = chunk.content
            if isinstance(text, str) and text:
                full_content += text
                yield text

        # Save assistant message after stream completes
        async with _session_factory() as session:
            session.add(
                ChatMessage(
                    conversation_id=conversation_id,
                    role="assistant",
                    content=full_content,
                )
            )
            await session.commit()

    # Return conversation_id in a header so the frontend can track it
    return StreamingResponse(
        stream_response(),
        media_type="text/plain",
        headers={"X-Conversation-Id": str(conversation_id)},
    )


# Import session factory for use inside the streaming generator
from db import _session_factory  # noqa: E402
