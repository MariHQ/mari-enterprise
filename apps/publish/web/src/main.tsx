import {useAppPage,appPageActions} from './publish';
import {page as page0} from '@mari-design/components/pages/PublishPage';
import {mount} from "@mari-app/screen";
mount("publish", [page0], {'publish':()=>useAppPage('publish')}, {'publish':(ctx:any)=>appPageActions('publish',ctx)});
