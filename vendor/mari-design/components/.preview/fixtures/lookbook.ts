/* Lookbook canvas fixtures.

   The lookbook's exhibits document the catalog itself, so their copy lives in
   the page. What does NOT live there is the sample content the two long-text
   sections push through the primitives: that is fixture data like anywhere
   else, and it comes straight out of the shared stress vocabulary. */

import type { LookbookData, LookbookSamples, LookbookSection } from "../../pages/LookbookPage";
import type { PageFixtures } from "./types";
import {
  LONG_TITLE, LONG_PARAGRAPH, LONG_NAME, LONG_DOC_TITLE, LONG_SOURCE, LONG_URL,
  UNBREAKABLE, LONG_WORD, HUGE_NUMBER_STR, HUGE_PERCENT, MIXED_SCRIPT,
  MANY_TAGS, MANY_INITIALS,
} from "./stress";

const SAMPLES: LookbookSamples = {
  title: LONG_TITLE,
  paragraph: LONG_PARAGRAPH,
  name: LONG_NAME,
  docTitle: LONG_DOC_TITLE,
  importPath: `import { Everything } from "${LONG_SOURCE}"`,
  url: LONG_URL,
  token: UNBREAKABLE,
  word: LONG_WORD,
  mixedScript: MIXED_SCRIPT,
  bigNumber: HUGE_NUMBER_STR,
  percent: HUGE_PERCENT,
  tags: MANY_TAGS,
  initials: MANY_INITIALS,
};

const at = (section: LookbookSection): { data: LookbookData } => ({ data: { section, samples: SAMPLES } });

export const FIXTURES: PageFixtures<LookbookData> = {
  all: at("all"),
  foundations: at("foundations"),
  buttons: at("buttons"),
  inputs: at("inputs"),
  "data-display": at("data-display"),
  feedback: at("feedback"),
  icons: at("icons"),
  loading: { ...at("all"), loading: true },
  overflow: at("overflow"),
  stress: at("stress"),
};
