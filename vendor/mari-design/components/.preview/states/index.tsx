import type { ComponentSpec } from "./types";
import { CORE } from "./core";
import { FORMS } from "./forms";
import { NAVIGATION } from "./navigation";
import { CARDS } from "./cards";
import { CHATFLOW } from "./chatflow";
import { INSIGHTS } from "./insights";
import { SHELL } from "./shell";
import { LINEAGE } from "./lineage";
import { OVERVIEW } from "./overview";
import { KNOWLEDGE } from "./knowledge";
import { DOCREVIEW } from "./docreview";
import { SOURCES } from "./sources";
import { ADMIN } from "./admin";

/* The component state matrix. One group file per area; each component declares
   every state worth reviewing, including error and overflow states.
   Render one with: node scripts/shot.mjs --sheet <name> "state:<Component>" */
export const COMPONENT_STATES: ComponentSpec[] = [
  ...CORE, ...FORMS, ...NAVIGATION, ...CARDS, ...CHATFLOW, ...INSIGHTS,
  ...SHELL, ...LINEAGE, ...OVERVIEW, ...KNOWLEDGE, ...DOCREVIEW,
  ...SOURCES, ...ADMIN,
];

export type { ComponentSpec, StateSpec } from "./types";
