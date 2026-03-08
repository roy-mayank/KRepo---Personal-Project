from abc import ABC, abstractmethod
from collections.abc import AsyncIterator
from dataclasses import dataclass, field


@dataclass
class Document:
    """Universal unit of ingested content."""
    source: str
    source_id: str
    title: str
    content: str
    url: str
    metadata: dict[str, str] = field(default_factory=dict)


class BaseIntegration(ABC):
    """All connectors implement this interface."""

    @abstractmethod
    def fetch_documents(self) -> AsyncIterator[Document]:
        """Yield documents one at a time."""
        ...
