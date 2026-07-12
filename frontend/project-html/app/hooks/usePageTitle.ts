import { useEffect } from "react";

export function usePageTitle(title: string) {
  useEffect(() => {
    document.title = title ? `${title} | Road A Eye` : "Road A Eye";
  }, [title]);
}
