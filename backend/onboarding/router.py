import json
import uuid
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

router = APIRouter(prefix="/onboarding")

TASKS_FILE = Path("./.onboarding_tasks.json")


def _load_tasks() -> list[dict]:
    if TASKS_FILE.exists():
        with open(TASKS_FILE) as f:
            return json.load(f)
    return []


def _save_tasks(tasks: list[dict]):
    with open(TASKS_FILE, "w") as f:
        json.dump(tasks, f, indent=2)


class TaskCreate(BaseModel):
    title: str
    description: str
    required_skills: list[str] = Field(default_factory=list)
    assignee_name: Optional[str] = None
    created_by: Optional[str] = None


async def _generate_learning_path(task: dict) -> dict | None:
    """Call Claude Haiku to generate a skill-tree learning path for a task.

    Returns a dict like {"nodes": [...]} or None on failure.
    """
    try:
        import anthropic

        from settings import settings

        if not settings.ANTHROPIC_API_KEY:
            return None

        client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
        skills_str = ", ".join(task.get("required_skills") or []) or "not specified"

        prompt = (
            "Create a skill-tree learning path for this onboarding task.\n\n"
            f"Task: {task['title']}\n"
            f"Description: {task['description']}\n"
            f"Required skills: {skills_str}\n"
            f"Assignee: {task.get('assignee_name') or 'the new employee'}\n\n"
            "Return ONLY a JSON object — no markdown fences, no explanation:\n"
            '{"nodes":[{"id":"snake_id","title":"3-6 word title","description":'
            '"1-2 sentence explanation of what is learned","prerequisites":[],"xp":50}]}\n\n'
            "Rules:\n"
            "- 6-10 nodes total\n"
            "- Valid DAG: prerequisites must reference existing node ids, no cycles\n"
            "- Root nodes: prerequisites=[]\n"
            "- Complexity increases with depth (foundational → advanced)\n"
            "- Each node is a concrete learnable unit grounded in the task context\n"
            "- XP should reflect difficulty: easy=25, medium=50, hard=100"
        )

        msg = await client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=1024,
            messages=[{"role": "user", "content": prompt}],
        )

        text = msg.content[0].text.strip()
        # Strip markdown code fences if the model wraps anyway
        if text.startswith("```"):
            lines = text.splitlines()
            inner = lines[1:-1] if lines[-1].strip() == "```" else lines[1:]
            text = "\n".join(inner)

        return json.loads(text.strip())

    except Exception as exc:
        print(f"[onboarding] learning path generation failed: {exc}")
        return None


@router.post("/tasks")
async def create_task(task: TaskCreate) -> dict:
    tasks = _load_tasks()
    new_task = {
        "id": str(uuid.uuid4()),
        **task.model_dump(),
        "learning_path": None,
    }

    # Generate path synchronously — Haiku takes ~1-3 s
    path = await _generate_learning_path(new_task)
    new_task["learning_path"] = path

    tasks.append(new_task)
    _save_tasks(tasks)
    return new_task


@router.post("/tasks/{task_id}/generate-path")
async def regenerate_path(task_id: str) -> dict:
    """Re-generate the learning path for an existing task."""
    tasks = _load_tasks()
    for i, t in enumerate(tasks):
        if t["id"] == task_id:
            path = await _generate_learning_path(t)
            if path is None:
                raise HTTPException(status_code=500, detail="Path generation failed")
            tasks[i]["learning_path"] = path
            _save_tasks(tasks)
            return tasks[i]
    raise HTTPException(status_code=404, detail="Task not found")


@router.get("/tasks")
async def list_tasks() -> list[dict]:
    return _load_tasks()


@router.get("/tasks/{task_id}")
async def get_task(task_id: str) -> dict:
    tasks = _load_tasks()
    for t in tasks:
        if t["id"] == task_id:
            return t
    raise HTTPException(status_code=404, detail="Task not found")


@router.delete("/tasks/{task_id}")
async def delete_task(task_id: str) -> dict:
    tasks = _load_tasks()
    remaining = [t for t in tasks if t["id"] != task_id]
    if len(remaining) == len(tasks):
        raise HTTPException(status_code=404, detail="Task not found")
    _save_tasks(remaining)
    return {"deleted": task_id}
