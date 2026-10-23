import React from 'react';
import { ContactPage } from '../components/ContactPage';
import { PageHeaderBanner } from '../components/common/PageHeaderBanner';
import { PageTransition } from '../components/routing/PageTransition';

/** /about and /contact */
export const AboutPage: React.FC = () => (
  <PageTransition>
    <PageHeaderBanner themeKey="contact" />
    <ContactPage />
  </PageTransition>
);
