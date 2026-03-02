from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Optional, Sequence

from ...responses.jobs import JobItem


@dataclass
class ProviderResult:
    provider: str
    jobs: list[JobItem]
    error: Optional[str] = None


class JobProvider(ABC):
    name: str

    @abstractmethod
    async def search(self, query: str, limit: int = 50, where: Optional[str] = None) -> ProviderResult:
        raise NotImplementedError


def dedupe_jobs(items: Sequence[JobItem]) -> list[JobItem]:
    # Dedup key: apply_url/job_url + title + company
    seen: set[str] = set()
    out: list[JobItem] = []
    for j in items:
        key = f"{(j.apply_url or j.job_url or '').strip().lower()}|{j.title.strip().lower()}|{j.company.strip().lower()}"
        if key in seen:
            continue
        seen.add(key)
        out.append(j)
    return out