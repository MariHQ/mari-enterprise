from datetime import timedelta

from temporalio import workflow
from temporalio.common import RetryPolicy


@workflow.defn
class MineKnowledge:
    def __init__(self):
        self.decision = None
        self.status = "created"

    @workflow.query
    def state(self):
        return self.status

    @workflow.signal
    def review(self, decision: dict):
        if self.decision is None:
            self.decision = decision

    @workflow.run
    async def run(self, request: dict):
        # Schedule executions reuse arguments but each gets a distinct workflow ID.
        request = {**request, "run_id": workflow.info().workflow_id}
        retry = RetryPolicy(initial_interval=timedelta(seconds=2), maximum_attempts=5)
        async def activity(name, arg, minutes=2):
            if name == "set_status": self.status = arg["status"]
            return await workflow.execute_activity(name, arg,
                start_to_close_timeout=timedelta(minutes=minutes), retry_policy=retry)
        if workflow.patched('daily-decisions-v2') and request.get('miner_version') == 'decisions-extract-v2':
            seen=list(request.get('seen',[]));total=request.get('candidate_count',0)
            while True:
                self.status='retrieving'
                evidence=await activity('retrieve_unmined',{**request,'seen':seen})
                if not evidence:
                    self.status='completed' if seen else 'no_new_data'
                    if seen:await activity('set_status',{**request,'status':'completed','candidate_count':total})
                    return {'candidates':total,'status':self.status}
                import hashlib
                batch_id=request['run_id']+':'+hashlib.sha256('|'.join(e['event_id'] for e in evidence).encode()).hexdigest()[:16]
                batch={**request,'run_id':batch_id,'evidence':evidence}
                self.status='extracting_decisions'
                candidates=await activity('execute_substrate',batch,minutes=25)
                await activity('save_candidates',{'run_id':batch_id,'candidates':candidates})
                await activity('mark_mined',{'run_id':batch_id,'evidence':[
                    {'source_id':e['source_id'],'event_id':e['event_id']} for e in evidence]})
                seen.extend(e['event_id'] for e in evidence);total+=len(candidates)
                if workflow.info().is_continue_as_new_suggested():
                    workflow.continue_as_new({**request,'seen':seen,'candidate_count':total})
        try:
            quiet_empty = workflow.patched('mining-empty-check-v1') and request.get('incremental', False)
            if not quiet_empty:
                await activity("set_status", {**request, "status": "retrieving"})
            else:
                self.status = 'retrieving'
            incremental = workflow.patched('mining-source-revisions-v1') and request.get('incremental', False)
            evidence = await activity("retrieve_unmined" if incremental else "retrieve", request)
            if incremental and not evidence:
                self.status = 'no_new_data'
                if not quiet_empty:
                    await activity("set_status", {**request, "status": "no_new_data"})
                return {"candidates": 0, "status": "no_new_data"}
            await activity("set_status", {**request, "status": "executing"})
            candidates = await activity("execute_substrate", {**request, "evidence": evidence}, minutes=25)
            await activity("save_candidates", {**request, "candidates": candidates})
            if incremental:
                await activity("mark_mined", {"run_id": request["run_id"], "evidence": [
                    {"source_id": item["source_id"], "event_id": item["event_id"]} for item in evidence]})
            if not candidates:
                await activity("set_status", {**request, "status": "no_candidates"})
                return {"candidates": 0}
            await activity("set_status", {**request, "status": "awaiting_review"})
            try:
                await workflow.wait_condition(lambda: self.decision is not None, timeout=timedelta(days=7))
            except TimeoutError:
                self.decision = {"approved": False, "note": "Review expired after seven days", "expired": True}
            await activity("record_review", {**request, **self.decision, "candidates":candidates})
            status = "expired" if self.decision.get("expired") else "approved" if self.decision["approved"] else "rejected"
            await activity("set_status", {**request, "status": status})
            return {"candidates": len(candidates), "status": status}
        except Exception:
            await activity("set_status", {**request, "status": "failed"})
            raise


@workflow.defn
class SourceSync:
    def __init__(self):
        self.status = "starting"

    @workflow.query
    def state(self):
        return self.status

    @workflow.run
    async def run(self, request: dict):
        steady = workflow.patched('source-stable-run-v1')
        while True:
            self.status = "syncing"
            result = await workflow.execute_activity("sync_source", request,
                start_to_close_timeout=timedelta(minutes=30),
                heartbeat_timeout=timedelta(minutes=2),
                retry_policy=RetryPolicy(initial_interval=timedelta(seconds=60),
                    maximum_interval=timedelta(minutes=25), maximum_attempts=5))

            if request.get('once'):
                return result
            self.status = "waiting_for_next_poll"
            await workflow.sleep(timedelta(minutes=15))
            request = {"source":request["source"],"target":request["target"],"known":result["known"]}
            if not steady or workflow.info().is_continue_as_new_suggested():
                workflow.continue_as_new(request)
