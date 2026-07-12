"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import AlertModal from "@/components/AlertModal";
import ConfirmModal from "@/components/ConfirmModal";

interface AlertOptions {
  variant?: "error" | "success";
  heading?: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void;
}

interface AlertState {
  message: string;
  options?: AlertOptions;
  resolve: () => void;
}

interface ConfirmState {
  message: string;
  resolve: (value: boolean) => void;
}

interface ModalContextValue {
  showAlert: (message: string, options?: AlertOptions) => Promise<void>;
  showConfirm: (message: string) => Promise<boolean>;
}

const ModalContext = createContext<ModalContextValue | null>(null);

export function ModalProvider({ children }: { children: ReactNode }) {
  const [alertState, setAlertState] = useState<AlertState | null>(null);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);

  const showAlert = useCallback(
    (message: string, options?: AlertOptions) =>
      new Promise<void>((resolve) => setAlertState({ message, options, resolve })),
    []
  );

  const showConfirm = useCallback(
    (message: string) =>
      new Promise<boolean>((resolve) => setConfirmState({ message, resolve })),
    []
  );

  const handleAlertClose = () => {
    alertState?.resolve();
    setAlertState(null);
  };

  const handleConfirmOk = () => {
    confirmState?.resolve(true);
    setConfirmState(null);
  };

  const handleConfirmCancel = () => {
    confirmState?.resolve(false);
    setConfirmState(null);
  };

  return (
    <ModalContext.Provider value={{ showAlert, showConfirm }}>
      {children}
      <AlertModal
        open={!!alertState}
        message={alertState?.message ?? ""}
        variant={alertState?.options?.variant}
        heading={alertState?.options?.heading}
        confirmText={alertState?.options?.confirmText}
        cancelText={alertState?.options?.cancelText}
        onConfirm={alertState?.options?.onConfirm}
        onClose={handleAlertClose}
      />
      <ConfirmModal
        open={!!confirmState}
        title="확인"
        message={confirmState?.message ?? ""}
        onConfirm={handleConfirmOk}
        onCancel={handleConfirmCancel}
        danger
      />
    </ModalContext.Provider>
  );
}

export function useModal() {
  const ctx = useContext(ModalContext);
  if (!ctx) throw new Error("useModal must be used within ModalProvider");
  return ctx;
}
