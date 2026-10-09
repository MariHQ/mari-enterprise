import {useAppPage,appPageActions} from './insights';
import {page as page0} from '@mari-design/components/pages/InsightsPage';
import {mount} from "@mari-app/screen";
mount("insights", [page0], {'insights':()=>useAppPage('insights')}, {'insights':(ctx:any)=>appPageActions('insights',ctx)});
