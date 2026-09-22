import { apiClient } from './client';

export interface RestaurantSummary {
  id: string;
  name: string;
  cuisine: string | null;
  address: string;
  isOpen: boolean;
}

export interface MenuItem {
  id: string;
  name: string;
  description: string | null;
  price: string;
  isAvailable: boolean;
}

export interface RestaurantDetail {
  id: string;
  name: string;
  description: string | null;
  cuisine: string | null;
  address: string;
  isOpen: boolean;
  menuItems: MenuItem[];
}

export async function getRestaurants(search?: string): Promise<RestaurantSummary[]> {
  const { data } = await apiClient.get<RestaurantSummary[]>('/restaurants', {
    params: search ? { search } : undefined,
  });
  return data;
}

export async function getRestaurantById(id: string): Promise<RestaurantDetail> {
  const { data } = await apiClient.get<RestaurantDetail>(`/restaurants/${id}`);
  return data;
}
