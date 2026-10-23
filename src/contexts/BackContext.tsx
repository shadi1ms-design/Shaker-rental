import { createContext, useContext } from 'react';

/** Back action of the current page, provided by SiteLayout and used by PageHeaderBanner. */
export const BackContext = createContext<(() => void) | null>(null);

export const useBackAction = (): (() => void) | null => useContext(BackContext);
