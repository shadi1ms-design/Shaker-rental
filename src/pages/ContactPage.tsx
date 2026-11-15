import React from 'react';
import { ContactPage } from '../components/ContactPage';
import { PageIntro } from '../components/common/PageHeaderBanner';
import { PageTransition } from '../components/routing/PageTransition';

/** /contact */
export const ContactRoutePage: React.FC = () => (
  <PageTransition>
    <PageIntro themeKey="contact" />
    <ContactPage />
  </PageTransition>
);
