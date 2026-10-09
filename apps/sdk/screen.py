"""Shared app hosting and generic record APIs; page logic lives in each app."""
import os
from pathlib import Path
import sys
from fastapi import APIRouter
from apps.sdk.runtime import Manifest,create_app
from apps.sdk.data import reader
from apps.sdk import writes
from apps.sdk.graph import projection

def create_screen(name,routers,static_dir):
    router=APIRouter()
    router.include_router(reader.router)
    router.include_router(writes.router)
    for item in routers: router.include_router(item)
    @router.get('/api/record')
    def record(id:str): return reader.record(id)
    @router.get('/api/history')
    def history(id:str,table:str):
        return reader.execute('MATCH (r:History) WHERE r.record_id=$id RETURN '+projection()+' ORDER BY r.stream_offset DESC LIMIT 100',{'id':id},table=table)
    return create_app(Manifest(name=name),router,static_dir,api_prefix='')
