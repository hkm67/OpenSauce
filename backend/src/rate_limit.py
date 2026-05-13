from collections import defaultdict, deque
from functools import wraps
from time import monotonic

from flask import g, jsonify, request

from .config import (
    RATE_LIMIT_API_REQUESTS,
    RATE_LIMIT_API_WINDOW_SECONDS,
    RATE_LIMIT_AUTH_REQUESTS,
    RATE_LIMIT_AUTH_WINDOW_SECONDS,
    RATE_LIMIT_ENABLED,
    RATE_LIMIT_EXPENSIVE_REQUESTS,
    RATE_LIMIT_EXPENSIVE_WINDOW_SECONDS,
)


_BUCKETS = defaultdict(deque)


LIMITS = {
    "auth": (RATE_LIMIT_AUTH_REQUESTS, RATE_LIMIT_AUTH_WINDOW_SECONDS),
    "api": (RATE_LIMIT_API_REQUESTS, RATE_LIMIT_API_WINDOW_SECONDS),
    "expensive": (RATE_LIMIT_EXPENSIVE_REQUESTS, RATE_LIMIT_EXPENSIVE_WINDOW_SECONDS),
}


def _client_key(scope):
    user = getattr(g, "current_user", None)
    if user and user.get("id"):
        identity = f"user:{user['id']}"
    else:
        identity = f"ip:{request.headers.get('X-Forwarded-For', request.remote_addr or 'unknown').split(',')[0].strip()}"
    return (scope, identity)


def rate_limit(scope):
    limit, window_seconds = LIMITS[scope]

    def decorator(handler):
        @wraps(handler)
        def wrapper(*args, **kwargs):
            if not RATE_LIMIT_ENABLED or limit <= 0 or window_seconds <= 0:
                return handler(*args, **kwargs)

            now = monotonic()
            bucket = _BUCKETS[_client_key(scope)]
            while bucket and bucket[0] <= now - window_seconds:
                bucket.popleft()

            if len(bucket) >= limit:
                response = jsonify({"error": "Rate limit exceeded"})
                response.status_code = 429
                response.headers["Retry-After"] = str(max(1, int(window_seconds - (now - bucket[0]))))
                return response

            bucket.append(now)
            return handler(*args, **kwargs)

        return wrapper

    return decorator


def clear_rate_limits():
    _BUCKETS.clear()
