import {usePlatformDecisions,platformDecisionActions} from './adapter';
import {page as page0} from '@mari-design/components/pages/DecisionsPage';
import {mount} from "@mari-app/screen";
mount("decisions", [page0], {decisions:usePlatformDecisions}, {decisions:platformDecisionActions});
