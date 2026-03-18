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


@router.post("/tasks")
async def create_task(task: TaskCreate) -> dict:
    tasks = _load_tasks()
    new_task = {
        "id": str(uuid.uuid4()),
        **task.model_dump(),
    }
    tasks.append(new_task)
    _save_tasks(tasks)
    return new_task


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
