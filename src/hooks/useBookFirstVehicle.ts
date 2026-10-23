import { useCallback } from 'react';
import { useAppData } from '../contexts/DataContext';
import { navigate, routes } from '../router';

/** Opens the booking page of the first vehicle (or the catalog when the fleet is empty). */
export function useBookFirstVehicle() {
  const { vehicles } = useAppData();
  return useCallback(() => {
    if (vehicles[0]) navigate(routes.book(vehicles[0].id));
    else navigate(routes.cars);
  }, [vehicles]);
}
