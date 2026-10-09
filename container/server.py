"""Stateless login and authenticated mounting for explicitly configured Mari apps."""
import base64
import hashlib
import hmac
import json
import os
from pathlib import Path
import secrets
import time
from urllib.parse import unquote, urlsplit

import httpx
from authlib.integrations.starlette_client import OAuth, OAuthError
from authlib.jose.errors import JoseError
from joserfc.errors import JoseError as JWTError
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, RedirectResponse, Response
from pydantic import BaseModel, Field
from starlette.middleware.sessions import SessionMiddleware

from .config import load_config

MAX_BODY = 8 * 1024 * 1024


def grant_for(app, user, project):
    secret = os.getenv(app.grant_secret_env, '')
    if len(secret) < 32:
        raise HTTPException(503, 'Application authentication is not configured')
    now = int(time.time())
    claims = {'aud': app.id, 'sub': user['sub'], 'name': user['name'], 'project': project,
              'iat': now, 'exp': now + 180, 'iss': 'mari-container'}
    body = base64.urlsafe_b64encode(json.dumps(claims, separators=(',', ':')).encode()).decode().rstrip('=')
    return body + '.' + hmac.new(secret.encode(), body.encode(), hashlib.sha256).hexdigest()


def create_app(configuration=None, transport=None):
    config = configuration or load_config()
    app = FastAPI(title='Mari container')
    app.state.config = config
    public_origin = os.getenv('MARI_PUBLIC_ORIGIN', 'http://127.0.0.1:8088').rstrip('/')
    secure = public_origin.startswith('https://')
    session_secret = os.getenv('MARI_SESSION_SECRET')
    if not session_secret and secure:
        raise ValueError('Set MARI_SESSION_SECRET for HTTPS deployments')
    if session_secret and len(session_secret) < 32:
        raise ValueError('MARI_SESSION_SECRET must contain at least 32 characters')
    app.add_middleware(SessionMiddleware, secret_key=session_secret or secrets.token_urlsafe(48),
                       session_cookie='mari_container', same_site='lax', https_only=secure, max_age=28800)
    oauth = OAuth()
    oidc = config.auth.oidc
    issuer = os.getenv(oidc.issuer_env, '').rstrip('/')
    client_id = os.getenv(oidc.client_id_env, '')
    client_secret = os.getenv(oidc.client_secret_env, '')
    oidc_ready = oidc.enabled and bool(issuer and client_id and client_secret)
    if oidc_ready:
        if urlsplit(issuer).scheme != 'https' and urlsplit(issuer).hostname not in ('127.0.0.1', 'localhost'):
            raise ValueError('OIDC issuer must use HTTPS (except loopback development)')
        oauth.register('oidc', client_id=client_id, client_secret=client_secret,
                       server_metadata_url=issuer+'/.well-known/openid-configuration',
                       client_kwargs={'scope': 'openid profile email', 'code_challenge_method': 'S256'})
    app.state.oauth = oauth
    applications = {a.id: a for a in config.apps if a.enabled}

    def authenticated(request):
        user = request.session.get('user')
        if not user or request.session.get('expires', 0) <= time.time():
            request.session.clear()
            raise HTTPException(401, 'Sign in to Mari')
        return user

    def csrf(request):
        if request.headers.get('x-mari-csrf') != '1' or request.headers.get('origin', public_origin) != public_origin:
            raise HTTPException(403, 'Cross-origin request refused')

    def establish(request, subject, name, provider):
        request.session.clear()
        request.session.update(user={'sub': subject, 'name': name, 'provider': provider}, expires=int(time.time())+28800)

    @app.middleware('http')
    async def headers(request, call_next):
        response = await call_next(request)
        response.headers['Cache-Control'] = 'no-store'
        response.headers['X-Content-Type-Options'] = 'nosniff'
        response.headers['Referrer-Policy'] = 'same-origin'
        response.headers['Content-Security-Policy'] = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; connect-src 'self'; frame-src 'self'; frame-ancestors 'self'; base-uri 'self'; form-action 'self'"
        return response

    @app.get('/healthz')
    def health():
        return {'service': 'mari-container'}

    @app.get('/auth/config')
    def auth_config():
        return {'title': config.title, 'local': config.auth.local.enabled,
                'oidc': oidc_ready, 'oidcLabel': oidc.label}

    class Credentials(BaseModel):
        username: str = Field(min_length=1, max_length=200)
        password: str = Field(min_length=1, max_length=1024)

    @app.post('/auth/login')
    def login(body: Credentials, request: Request):
        csrf(request)
        local = config.auth.local
        password = os.getenv(local.password_env, 'demo')
        # Fixed-length comparisons avoid different username/password comparisons.
        expected = hashlib.sha256((local.username+'\0'+password).encode()).digest()
        supplied = hashlib.sha256((body.username+'\0'+body.password).encode()).digest()
        if not local.enabled or not hmac.compare_digest(expected, supplied):
            raise HTTPException(401, 'Username or password is incorrect')
        establish(request, 'local:'+local.username, local.username, 'local')
        return {'ok': True}

    @app.post('/auth/logout')
    def logout(request: Request):
        csrf(request)
        request.session.clear()
        return {'ok': True}

    @app.get('/auth/me')
    def me(request: Request):
        user = authenticated(request)
        project = {'id': config.project, 'slug': 'mari', 'name': config.title, 'role': 'member', 'capabilities': ['read','write']}
        return {'user': {**user, 'id': user['sub'], 'email': '', 'role': 'member', 'initials': user['name'][:2].upper(), 'tint': 0},
                'project': config.project, 'title': config.title, 'projects': [project], 'activeProject': project,
                'bypassEnabled': False, 'registrationEnabled': False}

    @app.get('/auth/oidc/login')
    async def oidc_login(request: Request):
        if not oidc_ready:
            raise HTTPException(503, 'OpenID Connect is not configured')
        request.session.clear()
        return await oauth.oidc.authorize_redirect(request, public_origin+'/auth/oidc/callback')

    @app.get('/auth/oidc/callback')
    async def oidc_callback(request: Request):
        if not oidc_ready:
            raise HTTPException(503, 'OpenID Connect is not configured')
        try:
            token = await oauth.oidc.authorize_access_token(request)
            # Authlib verifies signature, issuer, audience, expiry, nonce, state and PKCE.
            info = token.get('userinfo')
            if not token.get('id_token') or not info or not info.get('sub') or info.get('iss') != issuer:
                raise ValueError('Missing verified identity')
            establish(request, issuer+'#'+info['sub'], str(info.get('name') or info.get('preferred_username') or info['sub'])[:200], 'oidc')
        except (OAuthError, JoseError, JWTError, httpx.HTTPError, ValueError, KeyError):
            request.session.clear()
            return RedirectResponse('/?auth_error=oidc', status_code=303)
        return RedirectResponse('/', status_code=303)

    @app.get('/api/apps')
    def apps(request: Request):
        authenticated(request)
        return {'apps': [a.public() for a in applications.values()]}

    @app.api_route('/apps/{app_id}/{path:path}', methods=['GET','HEAD','POST','PUT','PATCH','DELETE'])
    async def proxy(app_id: str, path: str, request: Request):
        user = authenticated(request)
        item = applications.get(app_id)
        if item is None:
            raise HTTPException(404, 'Unknown application')
        if request.method not in item.methods:
            raise HTTPException(405, 'Application method is not configured')
        if request.method not in ('GET', 'HEAD'):
            csrf(request)
        decoded = path
        for _ in range(3):
            decoded = unquote(decoded)
        if decoded.startswith('/') or '\\' in decoded or any(p in ('.', '..') for p in decoded.split('/')) or '%' in decoded or '?' in decoded or '#' in decoded:
            raise HTTPException(400, 'Invalid application path')
        body = bytearray()
        async for chunk in request.stream():
            body.extend(chunk)
            if len(body) > MAX_BODY:
                raise HTTPException(413, 'Request is too large')
        forwarded = {'Authorization': 'Bearer '+grant_for(item, user, config.project)}
        for key in ('accept', 'content-type', 'idempotency-key'):
            if key in request.headers:
                forwarded[key] = request.headers[key]
        # Never forward cookies, caller-supplied identity, OAuth tokens, or redirects.
        try:
            async with httpx.AsyncClient(transport=transport, timeout=120, follow_redirects=False) as client:
                async with client.stream(request.method, item.endpoint()+'/'+path,
                                         params=request.query_params, headers=forwarded, content=bytes(body)) as upstream:
                    if 300 <= upstream.status_code < 400:
                        raise HTTPException(502, 'Application returned an unsupported redirect')
                    content = bytearray()
                    async for chunk in upstream.aiter_bytes():
                        content.extend(chunk)
                        if len(content) > MAX_BODY:
                            raise HTTPException(502, 'Application response is too large')
                    return Response(bytes(content), status_code=upstream.status_code,
                                    headers={'Content-Type': upstream.headers.get('content-type', 'application/octet-stream')})
        except httpx.RequestError:
            raise HTTPException(503, 'Application is unavailable. Try again shortly.') from None

    static = Path(os.getenv('MARI_CONTAINER_STATIC', os.getenv('MARI_STATIC_DIR', Path(__file__).parent/'web/dist'))).resolve()

    @app.get('/{path:path}', include_in_schema=False)
    def web(path: str):
        if path.startswith(('api/', 'auth/', 'apps/')):
            raise HTTPException(404, 'Not found')
        target = (static/path).resolve()
        if not target.is_relative_to(static) or not target.is_file():
            target = static/'index.html'
        if not target.is_file():
            raise HTTPException(503, 'Build the container web application first')
        return FileResponse(target)
    return app


app = create_app()
