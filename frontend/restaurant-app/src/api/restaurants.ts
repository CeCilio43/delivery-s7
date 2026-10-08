import { apiClient } from './client';

export interface MenuItem {
  id: string;
  restaurantId: string;
  name: string;
  description: string | null;
  price: string;
  isAvailable: boolean;
}

export interface Restaurant {
  id: string;
  name: string;
  description: string | null;
  cuisine: string | null;
  address: string;
  isOpen: boolean;
  menuItems: MenuItem[];
}

export interface RestaurantDetailsInput {
  name: string;
  address: string;
  cuisine: string | null;
  description: string | null;
}

export type RestaurantUpdate = Partial<RestaurantDetailsInput & { isOpen: boolean }>;

export interface MenuItemInput {
  name: string;
  description: string | null;
  price: number;
  isAvailable?: boolean;
}

export type MenuItemUpdate = Partial<MenuItemInput>;

// All of these go through the gateway's /owner area, which only lets
// restaurant owners in; restaurant-service checks each restaurant is theirs.

export async function getMyRestaurants(): Promise<Restaurant[]> {
  const { data } = await apiClient.get<Restaurant[]>('/owner/restaurants');
  return data;
}

export async function createRestaurant(input: RestaurantDetailsInput): Promise<Restaurant> {
  const { data } = await apiClient.post<Restaurant>('/owner/restaurants', input);
  return data;
}

export async function updateRestaurant(id: string, update: RestaurantUpdate): Promise<Restaurant> {
  const { data } = await apiClient.patch<Restaurant>(`/owner/restaurants/${id}`, update);
  return data;
}

export async function addMenuItem(restaurantId: string, input: MenuItemInput): Promise<MenuItem> {
  const { data } = await apiClient.post<MenuItem>(
    `/owner/restaurants/${restaurantId}/menu-items`,
    input,
  );
  return data;
}

export async function updateMenuItem(
  restaurantId: string,
  itemId: string,
  update: MenuItemUpdate,
): Promise<MenuItem> {
  const { data } = await apiClient.patch<MenuItem>(
    `/owner/restaurants/${restaurantId}/menu-items/${itemId}`,
    update,
  );
  return data;
}

export async function deleteMenuItem(restaurantId: string, itemId: string): Promise<void> {
  await apiClient.delete(`/owner/restaurants/${restaurantId}/menu-items/${itemId}`);
}
