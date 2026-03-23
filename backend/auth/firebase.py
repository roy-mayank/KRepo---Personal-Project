import base64
import json

import firebase_admin
from firebase_admin import auth as firebase_auth
from firebase_admin import credentials

from settings import settings

_app = None


def init_firebase() -> None:
    global _app
    if _app is not None:
        return
    raw = base64.b64decode(settings.FIREBASE_SERVICE_ACCOUNT)
    service_account_info = json.loads(raw)
    cred = credentials.Certificate(service_account_info)
    _app = firebase_admin.initialize_app(cred)


def verify_firebase_token(id_token: str) -> dict:
    """Verify a Firebase ID token. Returns decoded token claims including 'uid'."""
    return firebase_auth.verify_id_token(id_token)
