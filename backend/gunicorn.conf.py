import multiprocessing
import os


bind = f"0.0.0.0:{os.getenv('PORT', '8000')}"

# Threaded workers are more forgiving for this API because OAuth and Supabase
# calls can wait on external services while browsers may open/drop connections.
worker_class = os.getenv("GUNICORN_WORKER_CLASS", "gthread")
workers = int(os.getenv("GUNICORN_WORKERS", str(max(1, min(2, multiprocessing.cpu_count())))))
threads = int(os.getenv("GUNICORN_THREADS", "4"))

timeout = int(os.getenv("GUNICORN_TIMEOUT", "120"))
graceful_timeout = int(os.getenv("GUNICORN_GRACEFUL_TIMEOUT", "30"))
keepalive = int(os.getenv("GUNICORN_KEEPALIVE", "5"))

max_requests = int(os.getenv("GUNICORN_MAX_REQUESTS", "1000"))
max_requests_jitter = int(os.getenv("GUNICORN_MAX_REQUESTS_JITTER", "100"))

accesslog = os.getenv("GUNICORN_ACCESS_LOG", "-")
errorlog = os.getenv("GUNICORN_ERROR_LOG", "-")
loglevel = os.getenv("GUNICORN_LOG_LEVEL", "info")
