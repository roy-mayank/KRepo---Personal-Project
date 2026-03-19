from typing import Dict, Type

from .base import BaseIntegration

# registry mapping short names to integration classes.  New connectors should
# import here and register themselves, or add an entry manually.
#
# Example:
#     from .jira import JiraIntegration
#     INTEGRATIONS["jira"] = JiraIntegration
#
# Each integration must subclass BaseIntegration and implement
# `async def fetch_documents(self) -> AsyncIterator[Document]`.
from .github import GitHubIntegration  # noqa: E402

INTEGRATIONS: Dict[str, Type[BaseIntegration]] = {
    "github": GitHubIntegration,
}


def register(name: str, cls: Type[BaseIntegration]) -> None:
    """Register a new integration class under the given name."""
    if name in INTEGRATIONS:
        raise ValueError(f"integration '{name}' is already registered")
    INTEGRATIONS[name] = cls


def get_integration(name: str) -> Type[BaseIntegration] | None:
    return INTEGRATIONS.get(name)


def available() -> Dict[str, str]:
    """Return a mapping of registered integration names to a short description.

    Each class may define a class attribute ``DESCRIPTION``; otherwise we fall
    back to the class name.
    """
    out: Dict[str, str] = {}
    for name, cls in INTEGRATIONS.items():
        desc = getattr(cls, "DESCRIPTION", cls.__name__)
        out[name] = desc
    return out
