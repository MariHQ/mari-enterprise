import {usePlatformWorkflows,platformWorkflowActions} from './adapter';
import {page as page0} from '@mari-design/components/pages/WorkflowsPage';
import {mount} from "@mari-app/screen";
mount("workflows", [page0], {workflows:usePlatformWorkflows}, {workflows:platformWorkflowActions});
