"""Discover public app manifests from native AX tasks, without a registry service."""
import json
import logging
import os
import time
from threading import Lock
from typing import Literal

from pydantic import Field, ConfigDict, BaseModel, field_validator
from .config import Application

log = logging.getLogger(__name__)


class AppManifest(BaseModel):
    model_config = ConfigDict(extra='forbid')
    id: str = Field(pattern=r'^[a-z][a-z0-9-]{0,47}$')
    name: str = Field(min_length=1,max_length=100)
    description: str = Field(default='',max_length=500)
    icon: Literal['app','sources','knowledge'] = 'app'
    routes: list[str] = Field(min_length=1,max_length=20)
    temporal_worker: bool = False
    methods: list[Literal['GET','HEAD','POST','PUT','PATCH','DELETE']] = ['GET','HEAD']

    @field_validator('routes')
    @classmethod
    def safe_routes(cls, routes):
        import re
        if any(not re.fullmatch(r'/[a-z0-9][a-z0-9/-]*', route) or '..' in route or '//' in route for route in routes):
            raise ValueError('Routes must be local application paths')
        return routes


def validate_manifest(value, owner):
    manifest=AppManifest.model_validate(value)
    if manifest.id != owner: raise ValueError('Only the owning AX task can register an app')
    return manifest


def registered_app(task):
    values=[e.value for e in task.spec.env if e.name=='MARI_APP_REGISTRATION']
    if len(values)!=1 or len(values[0])>8192: return None
    manifest=validate_manifest(json.loads(values[0]), task.metadata.name)
    workspaces=[w for w in task.spec.workspaces if w.path=='/workspace/mari']
    if len(workspaces)!=1: raise ValueError('App workspace binding is missing')
    name=manifest.id
    return Application(**manifest.model_dump(exclude={"temporal_worker"}),url=os.getenv('MARI_SUBSTRATE_URL','http://host.docker.internal:18081'),
        url_env='MARI_SUBSTRATE_URL',grant_secret_env='MARI_APP_GRANT_SECRET',runtime='substrate',
        substrate={'actor':task.metadata.atespace+'/'+name,'owner_agent':name,'workspace':workspaces[0].name,
                   'manifest':f'apps/{name}/workspace/task.yaml'})


class Registry:
    def __init__(self, configured, loader=None):
        self.static={a.id:a for a in configured if a.enabled}
        self.current=dict(self.static);self.expires=0;self.lock=Lock();self.loader=loader

    def _tasks(self):
        import grpc
        from .ax_protocol import ax_pb2, ax_pb2_grpc
        with grpc.insecure_channel(os.environ['MARI_AX_ENDPOINT']) as channel:
            api=ax_pb2_grpc.AXStub(channel)
            tasks=[]
            for offset in range(0,10000,100):
                page=api.ListTasks(ax_pb2.ListTasksRequest(atespace='mari',limit=100,offset=offset),timeout=3).tasks
                tasks.extend(page)
                if len(page)<100: return tasks
            raise ValueError('AX app catalog exceeds supported size')

    def applications(self):
        if not self.loader and not os.getenv('MARI_AX_ENDPOINT'): return self.static
        with self.lock:
            if time.monotonic()<self.expires: return self.current
            try:
                apps=dict(self.static)
                routes={route for app in apps.values() for route in app.routes}
                for task in (self.loader or self._tasks)():
                    try:
                        app=registered_app(task)
                        if app is None: continue
                        # Existing static deployments and their route ownership take precedence.
                        if app.id in apps or routes.intersection(app.routes): continue
                        app.endpoint();apps[app.id]=app;routes.update(app.routes)
                    except (ValueError,TypeError):
                        log.warning('Ignoring invalid app registration for %s',task.metadata.name)
                self.current=apps
            except Exception:
                # Preserve last good catalog during a transient AX outage.
                log.warning('AX app discovery unavailable; retaining previous catalog')
            self.expires=time.monotonic()+5
            return self.current
