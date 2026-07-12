"use client";

import Header from "../components/Header";
import ChatBot from "../components/ChatBot";
import PageTransition from "../components/PageTransition";
import { ModalProvider } from "@/context/ModalContext";

export default function RootTemplate({ children }: { children: React.ReactNode }) {
  return (
    <ModalProvider>
      <Header />
      <PageTransition>{children}</PageTransition>
      <ChatBot />
    </ModalProvider>
  );
}
