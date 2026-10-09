import { renderToStaticMarkup } from 'react-dom/server';
import { ArrowUpRight, Layers, Workflow, Activity } from 'lucide-react';
import { Logo } from '@mari/shell/Logo';
import { PageHeader } from '@mari/layout/PageHeader';
import { Card } from '@mari/layout/Card';
import { CardBody, CardSection, CardActions } from '@mari/layout/CardShell';
import { buttonClasses } from '@mari/actions/Button';
import { Truncate } from '@mari/data-display/Truncate';
import { PAGE_CONTAINER, DASH3 } from '@mari/tokens/pagegrid';

const services = [
  { name: 'Mari', category: 'Workspace', description: 'Browse knowledge, manage sources, and explore your workflows.', href: 'http://mari-container.stack.127.0.0.1.sslip.io:8084', icon: Layers },
  { name: 'Temporal', category: 'Workflow execution', description: 'Inspect workflow runs, activity history, retries, and task queues.', href: 'http://localhost:18000', icon: Workflow },
  { name: 'Flink', category: 'Stream processing', description: 'Inspect ingestion jobs, checkpoints, task managers, and logs.', href: 'http://localhost:18001', icon: Activity },
];

export function render() {
  return renderToStaticMarkup(<>
    <header className="bg-biscay text-white border-b border-ink/15">
      <div className="mx-auto max-w-[1400px] px-5 sm:px-8 py-4 flex items-center justify-between gap-3">
        <Logo /><span className="font-term text-[11px] uppercase tracking-[0.1em]">Local services</span>
      </div>
    </header>
    <main className={PAGE_CONTAINER}>
      <PageHeader eyebrow="Your local stack" title="Service dashboard" description="One place to open your workspace and service consoles." />
      <div className={`mt-6 ${DASH3}`}>
        {services.map(({name, category, description, href, icon: Icon}) => <Card key={name} title={name} eyebrow={category} icon={<Icon size={22} strokeWidth={1.9} className="text-biscay mt-1" aria-hidden="true" />}>
          <CardBody>
            <p className="text-[13px] leading-relaxed text-ink/70 min-h-[40px]">{description}</p>
            <CardSection label="Address"><Truncate className="font-term text-[11px] text-ink/70">{href.replace('http://', '')}</Truncate></CardSection>
            <CardActions primary={<a className={buttonClasses({variant:'primary'})} href={href} target="_blank" rel="noopener noreferrer">Open {name}<ArrowUpRight size={16} aria-hidden="true" /><span className="sr-only"> in a new tab</span></a>} />
          </CardBody>
        </Card>)}
      </div>
      <p className="mt-6 text-[12px] text-ink/65">Links open in a new tab. Services are hosted on this computer.</p>
    </main>
  </>);
}
