from __future__ import annotations

import asyncio
import random
from typing import Callable, TypeVar, Awaitable, Optional

T = TypeVar("T")


async def with_retries(
    fn: Callable[[], Awaitable[T]],
    *,
    tries: int = 4,
    base_delay_s: float = 2.0,
    max_delay_s: float = 20.0,
    jitter_ratio: float = 0.25,
    on_retry: Optional[Callable[[int, Exception, float], None]] = None,
) -> T:
    attempt = 1
    delay = base_delay_s

    while True:
        try:
            return await fn()
        except Exception as e:
            if attempt >= tries:
                raise
            jitter = delay * random.uniform(-jitter_ratio, jitter_ratio)
            sleep_s = min(max_delay_s, max(0.0, delay + jitter))
            if on_retry:
                on_retry(attempt, e, sleep_s)
            await asyncio.sleep(sleep_s)
            attempt += 1
            delay *= 2