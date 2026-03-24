import asyncio


class AsyncRateLimiter:
    """Semaphore-based token-bucket rate limiter.

    Usage:
        limiter = AsyncRateLimiter(rate=3, period=1.0)  # 3 requests per second
        await limiter.acquire()
        # ... make request ...
    """

    def __init__(self, rate: int = 3, period: float = 1.0):
        self._semaphore = asyncio.Semaphore(rate)
        self._period = period

    async def acquire(self) -> None:
        await self._semaphore.acquire()
        loop = asyncio.get_running_loop()
        loop.call_later(self._period, self._semaphore.release)
