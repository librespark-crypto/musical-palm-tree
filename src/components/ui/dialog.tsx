'use client';

/**
 * Modal + bottom-sheet dialog built on Radix Dialog.
 *
 * Radix is used here (and for tabs) because a modal genuinely needs focus
 * trapping, scroll locking, escape handling and correct ARIA wiring - all things
 * that are easy to get subtly wrong by hand. On phones the same component
 * renders as a bottom sheet with touch-friendly targets.
 */
import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/primitives';

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export interface ModalProps {
  open: boolean;
  onOpenChange(open: boolean): void;
  title: string;
  description?: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  size = 'md',
  className,
}: ModalProps): React.JSX.Element {
  const width = size === 'sm' ? 'sm:max-w-md' : size === 'lg' ? 'sm:max-w-3xl' : 'sm:max-w-xl';
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/45 backdrop-blur-[2px] data-[state=open]:animate-in-up" />
        <DialogPrimitive.Content
          className={cn(
            'fixed z-50 flex flex-col border border-line bg-surface shadow-pop focus:outline-none',
            'inset-x-0 bottom-0 max-h-[92dvh] rounded-t-[18px]',
            'sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:max-h-[88dvh] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[16px]',
            width,
            className,
          )}
          aria-describedby={description ? undefined : 'dialog-no-description'}
        >
          <div className="flex items-start justify-between gap-4 border-b border-line px-4 py-3 sm:px-5">
            <div className="min-w-0">
              <DialogPrimitive.Title className="text-[15px] font-semibold leading-tight">{title}</DialogPrimitive.Title>
              {description ? (
                <DialogPrimitive.Description className="mt-0.5 text-[12.5px] leading-snug text-ink-muted">
                  {description}
                </DialogPrimitive.Description>
              ) : (
                <span id="dialog-no-description" className="sr-only">
                  {title}
                </span>
              )}
            </div>
            <DialogPrimitive.Close asChild>
              <Button variant="ghost" size="icon-sm" aria-label="Close dialog">
                <X />
              </Button>
            </DialogPrimitive.Close>
          </div>
          <div className="scroll-x flex-1 overflow-y-auto px-4 py-4 sm:px-5">{children}</div>
          {footer ? (
            <div className="flex flex-wrap justify-end gap-2 border-t border-line px-4 py-3 sm:px-5">{footer}</div>
          ) : null}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange(open: boolean): void;
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm(): void;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  onConfirm,
}: ConfirmDialogProps): React.JSX.Element {
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {cancelLabel}
          </Button>
          <Button
            variant={destructive ? 'danger' : 'primary'}
            onClick={() => {
              onOpenChange(false);
              onConfirm();
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="text-sm leading-relaxed text-ink-muted">{message}</div>
    </Modal>
  );
}

/** Small hook so pages can `confirm()` imperatively for destructive actions. */
export function useConfirm(): {
  confirm: (options: Omit<ConfirmDialogProps, 'open' | 'onOpenChange' | 'onConfirm'>) => Promise<boolean>;
  dialog: React.ReactNode;
} {
  const [state, setState] = React.useState<{
    options: Omit<ConfirmDialogProps, 'open' | 'onOpenChange' | 'onConfirm'>;
    resolve: (value: boolean) => void;
  } | null>(null);

  const confirm = React.useCallback(
    (options: Omit<ConfirmDialogProps, 'open' | 'onOpenChange' | 'onConfirm'>) =>
      new Promise<boolean>((resolve) => setState({ options, resolve })),
    [],
  );

  const dialog = state ? (
    <ConfirmDialog
      {...state.options}
      open
      onOpenChange={(open) => {
        if (!open) {
          state.resolve(false);
          setState(null);
        }
      }}
      onConfirm={() => {
        state.resolve(true);
        setState(null);
      }}
    />
  ) : null;

  return { confirm, dialog };
}
