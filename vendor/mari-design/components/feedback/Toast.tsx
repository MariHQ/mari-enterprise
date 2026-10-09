import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useState } from "react";
import * as RT from "@radix-ui/react-toast";
import { CheckCircle2, Info, XCircle } from "lucide-react";

// Toast — the one transient-feedback primitive (Radix Toast, console skin).
// Mount <Toaster/> once in the shell; fire with useToast():
//   const toast = useToast();
//   toast("Workflow saved");                 // default
//   toast("Run failed — see the panel", "error");
//   toast("Draft imported", "success");

export type ToastTone = "default" | "success" | "error";
type Item = { id: number; text: string; tone: ToastTone };

/* The default is deliberately NOT a silent no-op. `<Toaster>` is mounted in
   exactly one place in this repo — the preview canvas — so every `useToast()`
   in a real app was firing into nothing, and a control whose whole visible
   effect is a toast looked wired and did nothing (§2). A control that cannot
   act must not be drawn; the way to find out is to be told, not to ship it. */
const ToastCtx = createContext<((text: string, tone?: ToastTone) => void) | null>(null);

export function useToast() {
  const fire = useContext(ToastCtx);
  return useCallback(
    (text: string, tone: ToastTone = "default") => {
      if (!fire) {
        // Loud in development, harmless in production: never swallow the fact
        // that the feedback the caller asked for did not happen.
        if (typeof console !== "undefined") {
          console.error(
            `useToast(): no <Toaster> is mounted, so this toast was dropped: ${text}. ` +
            "Wrap the app root in <Toaster> or give the control a visible effect that does not need one.",
          );
        }
        return;
      }
      fire(text, tone);
    },
    [fire],
  );
}

const TONE: Record<ToastTone, { border: string; icon: ReactNode }> = {
  default: { border: "border-ink/15", icon: <Info size={15} className="text-biscay-2" /> },
  success: { border: "border-moss/35", icon: <CheckCircle2 size={15} className="text-moss" /> },
  error: { border: "border-espelette/35", icon: <XCircle size={15} className="text-espelette" /> },
};

export function Toaster({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Item[]>([]);

  const push = useCallback((text: string, tone: ToastTone = "default") => {
    const id = Date.now() + Math.random();
    setItems((xs) => [...xs.slice(-2), { id, text, tone }]);
  }, []);

  return (
    <ToastCtx.Provider value={push}>
      <RT.Provider swipeDirection="right" duration={3500}>
        {children}
        {items.map((t) => (
          <RT.Root
            key={t.id}
            className={`flex items-center gap-2.5 rounded-[4px] border bg-paper px-3.5 py-2.5 text-[13px] text-ink ${TONE[t.tone].border}`}
            onOpenChange={(open: boolean) => { if (!open) setItems((xs) => xs.filter((x) => x.id !== t.id)); }}
          >
            {TONE[t.tone].icon}
            <RT.Description>{t.text}</RT.Description>
          </RT.Root>
        ))}
        <RT.Viewport className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 w-[320px] max-w-[calc(100vw-2rem)] outline-none" />
      </RT.Provider>
    </ToastCtx.Provider>
  );
}
