import json
from typing import Any

from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from langchain_anthropic import ChatAnthropic
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage

from pydantic import SecretStr

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
    "internal knowledge base. Be concise and helpful."
)


class Message(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: list[Message]


def _to_langchain_messages(messages: list[Message]) -> list[Any]:
    lc_messages: list[Any] = [SystemMessage(content=SYSTEM_PROMPT)]
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
