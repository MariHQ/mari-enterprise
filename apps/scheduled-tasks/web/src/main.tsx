import {usePlatformScheduledTasks,platformScheduledActions} from './scheduled-tasks';
import {page as page0} from '@mari-design/components/pages/ScheduledTasksPage';
import {mount} from "@mari-app/screen";
mount("scheduled-tasks", [page0], {'scheduled-tasks':usePlatformScheduledTasks}, {'scheduled-tasks':platformScheduledActions});
