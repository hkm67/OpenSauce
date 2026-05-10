from flask import Flask, jsonify

from .db import init_db
from .routes.achievements import achievements_bp
from .routes.activities import activities_bp
from .routes.projects import projects_bp
from .routes.users import users_bp


def create_app():
    app = Flask(__name__)
    init_db()

    app.register_blueprint(users_bp)
    app.register_blueprint(projects_bp)
    app.register_blueprint(achievements_bp)
    app.register_blueprint(activities_bp)

    @app.get("/health")
    def health():
        return jsonify({"status": "ok"})

    return app


app = create_app()
