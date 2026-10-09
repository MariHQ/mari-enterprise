import type { SetupData } from "../../pages/SetupPage";
import type { PageFixtures } from "./types";
import { LONG_NAME, LONG_TITLE, LONG_WORD, MIXED_SCRIPT, UNBREAKABLE } from "./stress";

const ADMIN: SetupData = {
  step: "admin", name: "Maya Chen", email: "maya@team.com",
  password: "correct-horse-battery", workspace: "Acme Product",
};

export const FIXTURES: PageFixtures<SetupData> = {
  default: { data: ADMIN },
  admin: { data: ADMIN },
  saving: { data: ADMIN, loading: true },
  error: { data: ADMIN, error: "Workspace setup is temporarily unavailable." },
  success: { data: { ...ADMIN, step: "done" } },
  overflow: { data: { ...ADMIN, name: LONG_NAME, workspace: LONG_TITLE }, error: LONG_TITLE },
  stress: { data: { ...ADMIN, name: MIXED_SCRIPT, email: `${UNBREAKABLE}@example.com`, password: LONG_WORD, workspace: LONG_WORD } },
};
