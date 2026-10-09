"""Only the physical node types read by the facts app."""
from apps.base.catalog.provision import register

LABELS = (
    'MariFact',
    'AgentFact',
    'MariReview',
)

from apps.base.catalog.relationships import CONTENT
LABELS=tuple(dict.fromkeys((*LABELS,*CONTENT,'AgentEntity','AgentEvidence','AgentFact','AgentDecision','AgentRun','AgentMiningReceipt','AgentReview','TemporalRun','TemporalActivity','TemporalWorkflow','TemporalConnector')))

if __name__ == '__main__':
    register('facts', LABELS)
