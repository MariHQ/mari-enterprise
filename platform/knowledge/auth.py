import hmac
import os
from fastapi import Header, HTTPException

def authenticated(authorization: str = Header(default="")):
    secret = os.environ.get("MARI_SERVICE_TOKEN", "")
    if not secret or not hmac.compare_digest(authorization, "Bearer " + secret):
        raise HTTPException(401, "A platform token is required")
