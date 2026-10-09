import {usePlatformKnowledge,usePlatformDocument,platformKnowledgeActions,platformDocumentActions} from './knowledge';
import {useAppPage} from './auxiliary';
import {page as page0} from '@mari-design/components/pages/KnowledgePage';
import {page as page1} from '@mari-design/components/pages/DocReviewPage';
import {page as page2} from '@mari-design/components/pages/LibraryPage';
import {page as page3} from '@mari-design/components/pages/AuditPage';
import {page as page4} from '@mari-design/components/pages/WelcomePage';
import {mount} from "@mari-app/screen";
mount("knowledge", [page0,page1,page2,page3,page4], {knowledge:usePlatformKnowledge,'doc-review':usePlatformDocument,library:()=>useAppPage('library'),audit:()=>useAppPage('audit'),welcome:()=>useAppPage('welcome')}, {knowledge:platformKnowledgeActions,'doc-review':platformDocumentActions});
