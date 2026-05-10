from urllib.parse import urlparse, urlunparse

from flask import Flask, jsonify, redirect, request

from .config import CORS_ALLOWED_ORIGIN, SECRET_KEY
from .db import init_db
from .routes.achievements import achievements_bp
from .routes.activities import activities_bp
from .routes.oauth import oauth_bp
from .routes.projects import projects_bp
from .routes.users import users_bp


def create_app():
    app = Flask(__name__)
    app.secret_key = SECRET_KEY
    init_db()

    app.register_blueprint(oauth_bp)
    app.register_blueprint(users_bp)
    app.register_blueprint(projects_bp)
    app.register_blueprint(achievements_bp)
    app.register_blueprint(activities_bp)

    @app.after_request
    def add_cors_headers(response):
        if request.headers.get("Origin") == CORS_ALLOWED_ORIGIN:
            response.headers["Access-Control-Allow-Origin"] = CORS_ALLOWED_ORIGIN
            response.headers["Access-Control-Allow-Credentials"] = "true"
            response.headers["Vary"] = "Origin"
            response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
            response.headers["Access-Control-Allow-Methods"] = "GET, POST, DELETE, OPTIONS"
        return response

    @app.before_request
    def redirect_loopback_to_localhost():
        """Keep OAuth session + GitHub callback on one host (localhost)."""
        if request.method == "OPTIONS":
            return ("", 204)

        u = urlparse(request.url)
        if u.hostname in ("127.0.0.1", "::1"):
            port = f":{u.port}" if u.port else ""
            new_netloc = f"localhost{port}"
            return redirect(urlunparse(u._replace(netloc=new_netloc)), code=307)

    @app.get("/")
    def home():
        base = request.url_root.rstrip("/")
        return (
            "<!DOCTYPE html><html lang='en'><head><meta charset='utf-8'><title>OpenSauce API</title></head>"
            "<body><h1>OpenSauce</h1>"
            "<p>Backend API. For GitHub login (local testing), use:</p>"
            f"<p><a href='{base}/oauth/github'>Sign in with GitHub</a></p>"
            f"<p><a href='{base}/health'>GET /health</a></p>"
            "</body></html>"
        )

    @app.get("/health")
    def health():
        return jsonify({"status": "ok"})

    return app


app = create_app()
