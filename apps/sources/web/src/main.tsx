import {usePlatformSources} from './adapter';
import {page as page0} from '@mari-design/components/pages/SourcesPage';
import {mount} from "@mari-app/screen";
mount("sources", [page0], {'sources':usePlatformSources}, {});
