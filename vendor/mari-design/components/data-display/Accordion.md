# Accordion

**Type:** Data display
**Source:** [`Accordion.tsx`](./Accordion.tsx) (this repo)

Disclosure sections, wrapping [`@radix-ui/react-accordion`](https://www.radix-ui.com/primitives/docs/components/accordion). A settings page's grouped panels, an FAQ list.

## Props

Discriminated on `type` (default `"single"`):

| `type` | Extra props | Notes |
|---|---|---|
| `"single"` (default) | `defaultValue?: string`, `collapsible?: boolean` (default `true`) | Only one section open at a time. |
| `"multiple"` | `defaultValue?: string[]` | Any number of sections open at once. |
| both | `items: AccordionItemData[]` | `{ value, title, content }`. |

## Usage

```tsx
import { Accordion } from "@mari-design/components";
// or directly: from "./Accordion"

<Accordion
  items={[
    { value: "billing", title: "Billing", content: <BillingPanel /> },
    { value: "security", title: "Security", content: <SecurityPanel /> },
  ]}
/>

<Accordion type="multiple" defaultValue={["billing"]} items={items} />
```
