import {usePlatformOverview} from './adapter';
import {page as page0} from '@mari-design/components/pages/OverviewPage';
import {mount} from "@mari-app/screen";
mount("overview", [page0], {'overview':usePlatformOverview}, {});
