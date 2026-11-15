import React from 'react';
import { CarCatalog } from '../components/CarCatalog';
import { PageIntro } from '../components/common/PageHeaderBanner';
import { PageTransition } from '../components/routing/PageTransition';
import { useAppData } from '../contexts/DataContext';

/** /cars - the full fleet catalog. */
export const CatalogPage: React.FC = () => {
  const { vehicles } = useAppData();

  return (
    <PageTransition>
      <PageIntro themeKey="catalog" />
      <CarCatalog vehicles={vehicles} />
    </PageTransition>
  );
};
