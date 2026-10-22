import { useEffect } from 'react';

export function useDocumentTitle(title?: string) {
  useEffect(() => {
    const baseTitle = 'شاكر لتأجير السيارات';
    if (!title) {
      document.title = baseTitle;
      return;
    }
    document.title = `${title} | ${baseTitle}`;
  }, [title]);
}
