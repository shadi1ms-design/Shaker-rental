import { useEffect } from 'react';

function setOrUpdateMetaTag(selector: string, attr: string, value: string, tagName = 'meta') {
  if (typeof document === 'undefined') return;
  let element = document.querySelector(selector);
  if (!element) {
    element = document.createElement(tagName);
    if (selector.includes('name="')) {
      const match = selector.match(/name="([^"]+)"/);
      if (match) element.setAttribute('name', match[1]);
    } else if (selector.includes('property="')) {
      const match = selector.match(/property="([^"]+)"/);
      if (match) element.setAttribute('property', match[1]);
    } else if (selector.includes('rel="')) {
      const match = selector.match(/rel="([^"]+)"/);
      if (match) element.setAttribute('rel', match[1]);
    }
    document.head.appendChild(element);
  }
  element.setAttribute(attr, value);
}

export interface DocumentTitleOptions {
  canonicalPath?: string;
  noindex?: boolean;
}

export function useDocumentTitle(
  title?: string,
  description?: string,
  options?: DocumentTitleOptions
) {
  const canonicalPath = options?.canonicalPath;
  const noindex = Boolean(options?.noindex);

  useEffect(() => {
    if (typeof document === 'undefined') return;

    const baseTitle = 'شاكر لتأجير السيارات';
    const fullTitle =
      !title || title === 'الرئيسية' ? `${baseTitle} | أسطول دمشق الأحدث` : `${title} | ${baseTitle}`;
    document.title = fullTitle;

    const defaultDescription =
      description ||
      'شركة شاكر لتأجير السيارات في دمشق - الخيار الأول لتأجير سيارات السيدان، سيدان (اقتصادي)، وSUV بأسعار منافسة وعقود رسمية.';

    setOrUpdateMetaTag('meta[name="description"]', 'content', defaultDescription);
    setOrUpdateMetaTag('meta[property="og:title"]', 'content', fullTitle);
    setOrUpdateMetaTag('meta[property="og:description"]', 'content', defaultDescription);
    setOrUpdateMetaTag(
      'meta[name="robots"]',
      'content',
      noindex ? 'noindex,nofollow' : 'index,follow'
    );

    const origin =
      typeof window !== 'undefined' ? window.location.origin : 'https://shakerrent.com';
    const resolvedPath =
      canonicalPath ??
      (typeof window !== 'undefined' ? window.location.pathname || '/' : '/');
    const canonicalUrl = `${origin}${resolvedPath.startsWith('/') ? resolvedPath : `/${resolvedPath}`}`;

    setOrUpdateMetaTag('meta[property="og:url"]', 'content', canonicalUrl);
    setOrUpdateMetaTag('link[rel="canonical"]', 'href', canonicalUrl, 'link');
  }, [title, description, canonicalPath, noindex]);
}
