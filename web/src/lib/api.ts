// Shared session recovery for authenticated platform HTTP requests.
let activeProject = '';
export function setActiveProject(project: string | number | null) {
  activeProject = project == null ? '' : String(project);
  clearQueryCache();
}
export function projectHeaders(): Record<string,string> {
  return activeProject ? {'X-Mari-Project':activeProject} : {};
}
export function clearQueryCache() {
  window.dispatchEvent(new Event('mari:knowledge-change'));
}
// The auth provider owns cookie recovery; concurrent rejected requests share a recheck.
type SessionRecovery = () => Promise<boolean>;

let recoverSessionFn: SessionRecovery | null = null;
let recoveryInFlight: Promise<boolean> | null = null;
let recoveriesUsed = 0;

/** How many times one page load may try to re-establish a session before a
 *  401 is simply reported. Three covers a couple of unlucky instance hops; it
 *  cannot become a retry loop. */
const MAX_RECOVERIES = 3;

/** Installed by AuthProvider. Passing null (unmount) disables recovery. */
export function setSessionRecovery(fn: SessionRecovery | null) {
  recoverSessionFn = fn;
  if (!fn) recoveryInFlight = null;
}

/** Resolves true when a usable session now exists. Concurrent callers share
 *  one attempt, so twenty queries failing at once cause one recovery. */
function recoverSession(): Promise<boolean> {
  if (!recoverSessionFn || recoveriesUsed >= MAX_RECOVERIES) return Promise.resolve(false);
  if (!recoveryInFlight) {
    recoveriesUsed += 1;
    const attempt = recoverSessionFn().catch(() => false);
    recoveryInFlight = attempt;
    void attempt.then(() => { if (recoveryInFlight === attempt) recoveryInFlight = null; });
  }
  return recoveryInFlight;
}

/** Session recovery for HTTP reads and writes. It retries one rejected
 * request after AuthProvider re-checks the cookie; network/5xx responses pass
 * through untouched so callers can render their real failure. */
export async function authenticatedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const response = await fetch(input, init);
  if (response.status !== 401 || !await recoverSession()) return response;
  return fetch(input, init);
}
