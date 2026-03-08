import json
from typing import Any

from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from langchain_anthropic import ChatAnthropic
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from pydantic import BaseModel, SecretStr

from rag.retriever import retrieve
from settings import settings

router = APIRouter()

llm = ChatAnthropic(
    model_name="claude-sonnet-4-20250514",
    api_key=SecretStr(settings.ANTHROPIC_API_KEY) if settings.ANTHROPIC_API_KEY else SecretStr(""),
    timeout=60,
    stop=None,
)

SYSTEM_PROMPT = (
    "You are KRepo Assistant, a helpful AI that answers questions about a company's "
    "internal knowledge base. Be concise and helpful. Use the provided context to answer "
    "questions. If the context doesn't contain relevant information, say so."
)


class Message(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: list[Message]


def _build_context(query: str) -> str:
    chunks = retrieve(query, top_k=10)
    if not chunks:
        return ""

    context_parts: list[str] = []
    for chunk in chunks:
        context_parts.append(f"[{chunk.source}] {chunk.title}\n{chunk.content}\nSource: {chunk.url}")
    return "\n\n---\n\n".join(context_parts)


def _to_langchain_messages(messages: list[Message]) -> list[Any]:
    last_user_msg = ""
    for msg in reversed(messages):
        if msg.role == "user":
            last_user_msg = msg.content
            break

    context = _build_context(last_user_msg)
    system_content = SYSTEM_PROMPT
    if context:
        system_content += f"\n\nRelevant context from the knowledge base:\n\n{context}"

    lc_messages: list[Any] = [SystemMessage(content=system_content)]
    for msg in messages:
        if msg.role == "user":
            lc_messages.append(HumanMessage(content=msg.content))
        elif msg.role == "assistant":
            lc_messages.append(AIMessage(content=msg.content))
    return lc_messages


@router.post("/chat")
async def chat(request: ChatRequest) -> StreamingResponse:
    lc_messages = _to_langchain_messages(request.messages)

    async def stream_response():
        async for chunk in llm.astream(lc_messages):
            text = chunk.content
            if isinstance(text, str) and text:
                yield f"0:{json.dumps(text)}\n"
        yield 'd:{"finishReason":"stop","usage":{"promptTokens":0,"completionTokens":0}}\n'

    return StreamingResponse(stream_response(), media_type="text/plain")
