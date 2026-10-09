"""Register the worker's evidence graph before its existing schedule bootstrap."""
import asyncio
from apps.base.catalog.provision import register

LABELS = (
    'MariDocument',
    'SlackMessage',
    'SlackThread',
    'GithubIssue',
    'GithubPullRequest',
    'GithubComment',
    'GithubFile',
    'GithubDocument',
    'AgentDecision',
    'AgentMiningReceipt',
)

from apps.base.catalog.relationships import CONTENT
LABELS=tuple(dict.fromkeys((*LABELS,*CONTENT,'AgentEntity','AgentEvidence','AgentFact','AgentDecision','AgentRun','AgentMiningReceipt','AgentReview','TemporalRun','TemporalActivity','TemporalWorkflow','TemporalConnector')))

if __name__ == '__main__':
    register('temporal', LABELS)
    from .bootstrap import schedule
    asyncio.run(schedule())
