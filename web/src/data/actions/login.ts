import type { LoginActions } from '@mari-design/components/pages/LoginPage';
import { authPost } from '../../lib/auth';
import type { ActionContext } from './index';
export function loginActions({refresh}: ActionContext): LoginActions {
  return {
    signIn: async ({email,password}) => { await authPost('/auth/login',{email,password}); await refresh(); },
    register: async () => { throw new Error('Accounts are configured by the platform operator.'); },
    bypass: async () => { throw new Error('Sign in with your platform credentials.'); },
    oauth: () => { throw new Error('Sign in with your platform credentials.'); },
  };
}
