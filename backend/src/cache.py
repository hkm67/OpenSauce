import copy
import time
from collections import OrderedDict
from threading import Lock

from .config import APP_CACHE_MAX_ITEMS, APP_CACHE_TTL_SECONDS


_CACHE = OrderedDict()
_LOCK = Lock()
_MISSING = object()


def cache_get(key, default=None):
    if APP_CACHE_TTL_SECONDS <= 0:
        return default

    with _LOCK:
        entry = _CACHE.get(key, _MISSING)
        if entry is _MISSING:
            return default

        expires_at, value = entry
        if expires_at <= time.monotonic():
            _CACHE.pop(key, None)
            return default

        _CACHE.move_to_end(key)
        return copy.deepcopy(value)


def cache_set(key, value):
    if APP_CACHE_TTL_SECONDS <= 0 or APP_CACHE_MAX_ITEMS <= 0:
        return value

    with _LOCK:
        _CACHE[key] = (time.monotonic() + APP_CACHE_TTL_SECONDS, copy.deepcopy(value))
        _CACHE.move_to_end(key)
        while len(_CACHE) > APP_CACHE_MAX_ITEMS:
            _CACHE.popitem(last=False)
    return value


def cache_delete_prefix(prefix):
    with _LOCK:
        for key in list(_CACHE):
            if isinstance(key, tuple) and key[: len(prefix)] == prefix:
                _CACHE.pop(key, None)


def cache_clear():
    with _LOCK:
        _CACHE.clear()
