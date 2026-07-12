import type { Metadata } from "next";
import FAQEditClient from "./FAQEditClient";

export const metadata: Metadata = { title: "FAQ 수정 | Road A Eye" };

interface FAQEditPageProps {
  searchParams: Promise<{ faq_no?: string }>;
}

export default async function FAQEditPage({ searchParams }: FAQEditPageProps) {
  const { faq_no } = await searchParams;
  return <FAQEditClient faqNo={faq_no} />;
}
