"""Shared HTTP, grant authentication, and static hosting for Mari screen apps."""
import base64
import hashlib
import hmac
import json
import os
from pathlib import Path
import time

from fastapi import APIRouter, Depends, FastAPI, Header, HTTPException, Request
from fastapi.responses import FileResponse
from pydantic import BaseModel, ConfigDict, Field


class Manifest(BaseModel):
    name: str = Field(pattern=r'^[a-z][a-z0-9-]{0,47}$')
    runtime: str = 'serverless'


def validate_grant(authorization, audience):
    try:
        if not authorization.startswith('Bearer '): raise ValueError()
        body, signature = authorization[7:].split('.')
        secret = os.environ['MARI_APP_GRANT_SECRET']
        if len(secret) < 32: raise ValueError()
        expected = hmac.new(secret.encode(), body.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(signature, expected): raise ValueError()
        claims = json.loads(base64.urlsafe_b64decode(body+'='*(-len(body)%4)))
        now = time.time()
        if (claims['iss'] != 'mari-container' or claims['aud'] != audience
                or claims['project'] != os.getenv('MARI_KNOWLEDGE_PROJECT_ID', '1')
                or not isinstance(claims['sub'], str) or not claims['sub']
                or not isinstance(claims['exp'], (int,float))
                or not now < claims['exp'] <= now+300):
            raise ValueError()
        return claims
    except (KeyError, ValueError, TypeError, AttributeError):
        raise HTTPException(401, 'Open this application from Mari to sign in') from None


def authenticated(request: Request, authorization: str = Header(default='')):
    """Identity is available as a dependency and in request.state.identity."""
    claims = validate_grant(authorization, request.app.state.manifest.name)
    request.state.identity = claims
    return claims


def create_app(manifest: Manifest, router: APIRouter, static_dir, api_prefix='/api'):
    app = FastAPI(title='Mari '+manifest.name, docs_url=None, redoc_url=None, openapi_url=None)
    app.state.manifest = manifest
    # Every screen API is protected by default, including future routes.
    app.include_router(router, prefix=api_prefix, dependencies=[Depends(authenticated)])

    @app.get('/healthz')
    def health():
        return {'app': manifest.name, 'runtime': manifest.runtime}

    @app.middleware('http')
    async def response_headers(request, call_next):
        response = await call_next(request)
        response.headers['X-Content-Type-Options'] = 'nosniff'
        response.headers['Cache-Control'] = 'no-store'
        response.headers['Content-Security-Policy'] = "frame-ancestors 'self'"
        return response

    static = Path(os.getenv('MARI_STATIC_DIR', static_dir)).resolve()

    @app.get('/{path:path}', include_in_schema=False)
    def web(path: str):
        if path == 'api' or path.startswith('api/'):
            raise HTTPException(404, 'Unknown API route')
        target = (static/path).resolve()
        if not target.is_relative_to(static):
            raise HTTPException(404, 'Not found')
        if not target.is_file():
            # Browser history routes fall back to the SPA, missing assets do not.
            if Path(path).suffix: raise HTTPException(404, 'Asset not found')
            target = static/'index.html'
        if not target.is_file(): raise HTTPException(503, 'Application web build is missing')
        return FileResponse(target)
    return app
