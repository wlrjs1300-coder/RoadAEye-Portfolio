import type { Metadata } from "next";
import FAQEditClient from "../FAQEditClient";

export const metadata: Metadata = { title: "FAQ 수정 | Road A Eye" };

interface FAQEditDynamicPageProps {
  params: Promise<{ faq_no: string }>;
}

export default async function FAQEditDynamicPage({ params }: FAQEditDynamicPageProps) {
  const { faq_no } = await params;
  return <FAQEditClient faqNo={faq_no} />;
}
