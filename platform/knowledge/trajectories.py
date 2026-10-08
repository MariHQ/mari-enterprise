"""Agent execution events, shared by Substrate callers and actor emitters."""
from datetime import datetime
from typing import Literal
from pydantic import BaseModel, Field
from .records import KnowledgeChange, command_id
from .mappings import topic_for
from .ingestion import publish_changes


class TrajectoryStep(BaseModel):
    step_id: str = Field(min_length=1,max_length=256)
    ordinal: int = Field(ge=0)
    tool: str = Field(min_length=1,max_length=256)
    status: Literal['running','completed','failed']
    started_at: datetime
    finished_at: datetime | None = None
    summary: str = Field(default='',max_length=2000)
    record_ids: list[str] = Field(default_factory=list,max_length=100)


class Trajectory(BaseModel):
    run_id: str = Field(min_length=1,max_length=256)
    actor_id: str = Field(min_length=1,max_length=256)
    prompt: str = Field(default='',max_length=4000)
    model: str = Field(default='',max_length=256)
    status: Literal['running','completed','failed']
    started_at: datetime
    finished_at: datetime | None = None
    record_ids: list[str] = Field(default_factory=list,max_length=100)
    steps: list[TrajectoryStep] = Field(default_factory=list,max_length=100)


def trajectory_changes(run: Trajectory, project='1'):
    run_key='substrate:run:'+run.run_id
    step_keys=['substrate:step:'+command_id(project,run.actor_id,run.run_id,{'step':s.step_id}) for s in run.steps]
    payload=run.model_dump(mode='json',exclude={'steps'})
    properties={**payload,'supporting_record_ids':run.record_ids,'step_ids':step_keys,'step_count':len(run.steps),
        'failure_count':sum(step.status=='failed' for step in run.steps)}
    def change(identity,kind,title,props):
        return KnowledgeChange(table=topic_for('substrate',kind),record_id=identity,
            event_id=command_id(project,run.actor_id,identity,props),project_id=project,
            operation='upsert',kind=kind,source='substrate',title=title[:2000],actor=run.actor_id,
            observed_at=int((run.finished_at or run.started_at).timestamp()),properties=props)
    result=[change(run_key,'trajectory',run.prompt or run.actor_id,properties)]
    for step,identity in zip(run.steps,step_keys):
        result.append(change(identity,'step',step.tool,{**step.model_dump(mode='json'),
            'run_ids':[run_key],'supporting_record_ids':step.record_ids}))
    return result


def publish_trajectory(run: Trajectory, project='1'):
    return publish_changes(trajectory_changes(run,project))
