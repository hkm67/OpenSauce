from flask import jsonify


def error(message, status=400):
    return jsonify({"error": message}), status


def require_fields(data, fields):
    missing = [field for field in fields if not data.get(field)]
    if missing:
        return f"Missing required field(s): {', '.join(missing)}"
    return None
