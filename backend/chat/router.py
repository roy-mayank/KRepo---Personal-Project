import json
from typing import Any, List, Optional, Tuple

from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from langchain_anthropic import ChatAnthropic
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from pydantic import BaseModel, SecretStr

from ..rag.retriever import retrieve
from ..settings import settings

router = APIRouter()

# Type-safe API Key handling
api_key_val = settings.ANTHROPIC_API_KEY if settings.ANTHROPIC_API_KEY else ""

llm = ChatAnthropic(
    model_name="claude-sonnet-4-20250514",
    api_key=SecretStr(api_key_val),
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
    mode: Optional[str] = None
    level: Optional[str] = None


def _build_context(query: str) -> Tuple[str, List[Any]]:
    chunks = retrieve(query, top_k=10)
    if not chunks:
        return "", []

    context_parts: list[str] = []
    for chunk in chunks:
        # Basedpyright fix: Ensure attributes exist and are strings before joining
        source = str(chunk.source) if chunk.source else "unknown"
        title = str(chunk.title) if chunk.title else "Untitled"
        context_parts.append(f"[{source}] {title}\n{chunk.content}\nSource: {chunk.url}")
    return "\n\n---\n\n".join(context_parts), chunks


def _to_langchain_messages(
    messages: list[Message], mode: Optional[str], level: Optional[str]
) -> Tuple[list[Any], List[Any]]:
    last_user_msg = ""
    for msg in reversed(messages):
        if msg.role == "user":
            last_user_msg = msg.content
            break

    context_text, chunks = _build_context(last_user_msg)
    system_content = SYSTEM_PROMPT

    if mode == "onboarding":
        # Removed trailing whitespace from the end of the lines
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
      { "id": "unique_id", "title": "Node Title", "prerequisites": ["other_id"], "xp": 100 }
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


@router.post("/chat")
async def chat(request: ChatRequest) -> StreamingResponse:
    lc_messages, chunks = _to_langchain_messages(request.messages, request.mode, request.level)

    async def stream_response():
        async for chunk in llm.astream(lc_messages):
            text = chunk.content
            if isinstance(text, str) and text:
                yield f"0:{json.dumps(text)}\n"

        if chunks:
            citations = []
            for c in chunks:
                citations.append(
                    {
                        "source": c.source,
                        "title": c.title,
                        "url": c.url,
                        "score": getattr(c, "score", None),
                    }
                )
            yield f"c:{json.dumps(citations)}\n"

        yield 'd:{"finishReason":"stop","usage":{"promptTokens":0,"completionTokens":0}}\n'

    return StreamingResponse(stream_response(), media_type="text/plain")
