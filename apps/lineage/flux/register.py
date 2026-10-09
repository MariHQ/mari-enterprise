"""Only the physical node types read by the lineage app."""
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
    'MariFact',
    'AgentFact',
    'MariDecision',
    'AgentDecision',
    'MariReview',
    'AgentReview',
    'MariFinding',
    'AxTrajectory',
    'AxStep',
    'AgentTrajectory',
    'AgentStep',
    'SubstrateTrajectory',
    'SubstrateStep',
    'TemporalConnector',
    'TemporalRun',
    'TemporalActivity',
    'TemporalObservation',
    'MariCollection',
    'SlackCollection',
    'GithubCollection',
    'SlackPrincipal',
    'GithubPrincipal',
    'AgentMiningReceipt',
    'MariPresentation',
)

from apps.base.catalog.relationships import CONTENT
LABELS=tuple(dict.fromkeys((*LABELS,*CONTENT,'AgentEntity','AgentEvidence','AgentFact','AgentDecision','AgentRun','AgentMiningReceipt','AgentReview','TemporalRun','TemporalActivity','TemporalWorkflow','TemporalConnector')))

if __name__ == '__main__':
    register('lineage', LABELS)
