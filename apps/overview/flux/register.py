"""Only the physical node types read by the overview app."""
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
)

from apps.base.catalog.relationships import CONTENT
LABELS=tuple(dict.fromkeys((*LABELS,*CONTENT,'AgentEntity','AgentEvidence','AgentFact','AgentDecision','AgentRun','AgentMiningReceipt','AgentReview','TemporalRun','TemporalActivity','TemporalWorkflow','TemporalConnector')))

if __name__ == '__main__':
    register('overview', LABELS)
