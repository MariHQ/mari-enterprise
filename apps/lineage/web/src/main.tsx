import {usePlatformLineage} from './adapter';
import {platformLineageActions} from './actions';
import {page as page0} from '@mari-design/components/pages/LineagePage';
import {mount} from "@mari-app/screen";
mount("lineage", [page0], {lineage:usePlatformLineage}, {lineage:platformLineageActions});
