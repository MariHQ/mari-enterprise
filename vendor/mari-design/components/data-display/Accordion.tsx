import type { ReactNode } from "react";
import * as RA from "@radix-ui/react-accordion";
import { ChevronDown } from "lucide-react";
import { focusRing } from "../tokens/focusRing";
import { Skeleton, SkeletonLine } from "./Skeleton";
import { Scrollable } from "./Scrollable";

export type AccordionItemData = { value: string; title: ReactNode; content: ReactNode };

const ROOT_CLASS = "rounded-md border border-ink/15 bg-paper";
const TRIGGER_CLASS = `group flex w-full items-center justify-between gap-3 px-4 py-3 text-[13px] font-medium text-ink text-left ${focusRing}`;

function Items({ items }: { items: AccordionItemData[] }) {
  return (
    <>
      {items.map((item) => (
        <RA.Item key={item.value} value={item.value} className="border-b border-ink/10 last:border-0">
          <RA.Header>
            <RA.Trigger className={TRIGGER_CLASS}>
              {/* min-w-0 + break-words: a long unbroken title used to run past
                  the chevron and out of the panel. */}
              <span className="min-w-0 break-words">{item.title}</span>
              <ChevronDown size={15} className="text-ink/65 shrink-0 transition-transform group-data-[state=open]:rotate-180" />
            </RA.Trigger>
          </RA.Header>
          <RA.Content className="px-4 pb-4 text-[13px] text-ink/70 break-words">{item.content}</RA.Content>
        </RA.Item>
      ))}
    </>
  );
}

/* Past this many sections the panel scrolls in place rather than running to
   thousands of pixels: 200 collapsed triggers is a 9,600px card (§20). */
const BOUND_AT = 10;
const MAX_HEIGHT = 480;

export type AccordionProps =
  | { type?: "single"; items: AccordionItemData[]; defaultValue?: string; collapsible?: boolean; loading?: boolean }
  | { type: "multiple"; items: AccordionItemData[]; defaultValue?: string[]; loading?: boolean };

/** Wraps a long section list in the one scroll container (§20). */
function Bounded({ items, children }: { items: AccordionItemData[]; children: ReactNode }) {
  if (items.length <= BOUND_AT) return <>{children}</>;
  return (
    <Scrollable axis="y" style={{ maxHeight: MAX_HEIGHT }} className="rounded-md border border-ink/15 bg-paper">
      {children}
    </Scrollable>
  );
}

/** Disclosure sections — a settings page's grouped panels, an FAQ list. */
export function Accordion(props: AccordionProps) {
  /* A disclosure list's SECTION TITLES are the caller's own headings, given
     in `items` and known before anything is fetched — it is the panel bodies
     that are in flight. Greying the titles turned a settings page into four
     anonymous grey rows that said nothing about what was arriving, and each
     one re-laid out when the real heading landed at a different width. When a
     caller genuinely has no items yet, the bars stand. */
  if (props.loading) {
    const heads: (ReactNode | null)[] = props.items.length
      ? props.items.map((it) => it.title)
      : [null, null, null, null];
    return (
      <div className={ROOT_CLASS} aria-busy="true">
        {heads.map((title, i) => (
          <div key={i} className="flex items-center justify-between gap-3 border-b border-ink/10 px-4 py-3 last:border-0">
            {title != null
              ? <span className="min-w-0 truncate text-[13.5px] font-medium text-ink">{title}</span>
              : <SkeletonLine w={`${52 - i * 6}%`} h={13} />}
            <Skeleton width={15} height={15} rounded="rounded-[3px]" />
          </div>
        ))}
      </div>
    );
  }
  // The border lives on the scroll wrapper when there is one, so a bounded
  // accordion still reads as exactly one boxed panel.
  const rootClass = props.items.length > BOUND_AT ? "bg-paper" : ROOT_CLASS;

  if (props.type === "multiple") {
    return (
      <Bounded items={props.items}>
        <RA.Root type="multiple" defaultValue={props.defaultValue} className={rootClass}>
          <Items items={props.items} />
        </RA.Root>
      </Bounded>
    );
  }
  return (
    <Bounded items={props.items}>
      <RA.Root type="single" collapsible={props.collapsible ?? true} defaultValue={props.defaultValue} className={rootClass}>
        <Items items={props.items} />
      </RA.Root>
    </Bounded>
  );
}
