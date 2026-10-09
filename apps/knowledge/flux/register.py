"""Only the physical node types read by the knowledge app."""
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
    'MariConfiguration',
    'MariProject',
    'MariCollection',
    'SlackCollection',
    'GithubCollection',
    'MariReview',
    'AgentReview',
    'MariFinding',
    'TemporalConnector',
)

from apps.base.catalog.relationships import CONTENT
LABELS=tuple(dict.fromkeys((*LABELS,*CONTENT,'AgentEntity','AgentEvidence','AgentFact','AgentDecision','AgentRun','AgentMiningReceipt','AgentReview','TemporalRun','TemporalActivity','TemporalWorkflow','TemporalConnector')))

if __name__ == '__main__':
    register('knowledge', LABELS)
