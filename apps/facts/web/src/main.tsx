import {usePlatformFacts,platformFactActions} from './adapter';
import {page as page0} from '@mari-design/components/pages/FactsPage';
import {mount} from "@mari-app/screen";
mount("facts", [page0], {facts:usePlatformFacts}, {facts:platformFactActions});
