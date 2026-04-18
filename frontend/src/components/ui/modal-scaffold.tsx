import type { ReactNode } from "react";
import { DialogBody, DialogFooter, DialogHeader, DialogShell } from "./dialog-shell";

export function ModalScaffold({
  size = "lg",
  eyebrow,
  title,
  description,
  onClose,
  footer,
  children,
}: {
  size?: "sm" | "md" | "lg" | "xl" | "full";
  eyebrow?: string;
  title: string;
  description?: string;
  onClose?: () => void;
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <DialogShell size={size}>
      <DialogHeader eyebrow={eyebrow} title={title} description={description} onClose={onClose} />
      <DialogBody>{children}</DialogBody>
      {footer ? <DialogFooter>{footer}</DialogFooter> : null}
    </DialogShell>
  );
}
