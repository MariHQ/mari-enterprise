from temporalio import workflow

@workflow.defn
class StackSmoke:
    @workflow.run
    async def run(self, value: str) -> str:
        return 'temporal:' + value
