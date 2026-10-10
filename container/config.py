"""Only this file-backed configuration determines which applications exist."""
import json
import os
from pathlib import Path
from typing import Literal
from urllib.parse import urlsplit
from pydantic import BaseModel, ConfigDict, Field, model_validator


class Strict(BaseModel):
    model_config = ConfigDict(extra='forbid')


class LocalAuth(Strict):
    enabled: bool = True
    username: str = 'demo'
    password_env: str = 'MARI_LOCAL_PASSWORD'


class OIDC(Strict):
    enabled: bool = True
    label: str = 'Single sign-on'
    issuer_env: str = 'MARI_OIDC_ISSUER'
    client_id_env: str = 'MARI_OIDC_CLIENT_ID'
    client_secret_env: str = 'MARI_OIDC_CLIENT_SECRET'


class Auth(Strict):
    local: LocalAuth = Field(default_factory=LocalAuth)
    oidc: OIDC = Field(default_factory=OIDC)


class SubstrateBinding(Strict):
    actor: str = Field(pattern=r'^[a-z0-9][a-z0-9-]*/[a-z0-9][a-z0-9-]*$')
    owner_agent: str
    workspace: str
    manifest: str


class Application(Strict):
    id: str = Field(pattern=r'^[a-z][a-z0-9-]{0,47}$')
    name: str = Field(min_length=1, max_length=100)
    description: str = Field(default='', max_length=500)
    icon: Literal['sources', 'knowledge', 'app'] = 'app'
    routes: list[str] = Field(default_factory=list)
    url: str
    url_env: str
    grant_secret_env: str
    repository: str | None = None
    enabled: bool = True
    runtime: Literal['serverless', 'substrate'] = 'serverless'
    substrate: SubstrateBinding | None = None
    reads: Literal['orchiddb'] = 'orchiddb'
    methods: list[Literal['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE']] = ['GET', 'HEAD']

    @model_validator(mode='after')
    def runtime_binding(self):
        if (self.runtime == 'substrate') != (self.substrate is not None):
            raise ValueError('Substrate applications require a substrate binding')
        return self

    def endpoint(self):
        value = os.getenv(self.url_env, self.url).rstrip('/')
        parsed = urlsplit(value)
        if parsed.scheme not in ('http', 'https') or not parsed.hostname or parsed.username or parsed.password or parsed.query or parsed.fragment or parsed.path:
            raise ValueError(f'{self.id}: app URL must be an HTTP(S) origin')
        return value

    def public(self):
        return {'id': self.id, 'name': self.name, 'description': self.description,
                'icon': self.icon, 'path': f'/apps/{self.id}/', 'routes': self.routes}


class Configuration(Strict):
    title: str = 'Mari workspace'
    project: str = '1'
    auth: Auth = Field(default_factory=Auth)
    apps: list[Application]

    @model_validator(mode='after')
    def unique_apps(self):
        if len({a.id for a in self.apps}) != len(self.apps):
            raise ValueError('App IDs must be unique')
        for app in self.apps:
            app.endpoint()
        return self


def load_config(path=None):
    return Configuration.model_validate(json.loads(Path(path or os.getenv('MARI_CONTAINER_CONFIG', Path(__file__).with_name('apps.json'))).read_text()))
