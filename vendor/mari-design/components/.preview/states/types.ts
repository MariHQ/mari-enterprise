import type { ReactNode } from "react";

/** One rendered state of one component. */
export type StateSpec = {
  id: string;
  label: string;
  node: ReactNode;
  /** Frame width in px. Defaults to the component's width, then 720. */
  width?: number;
};

/** Every state a component can be in. Author the boring ones AND the ugly ones:
    default, each variant, loading, empty, error, disabled, selected, and the
    overflow cases (very long text, too many items, narrow frame). */
export type ComponentSpec = {
  id: string;
  title: string;
  width?: number;
  states: StateSpec[];
};
