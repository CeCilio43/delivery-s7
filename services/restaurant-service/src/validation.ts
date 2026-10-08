// Request-body parsing for the owner endpoints. Each parser returns either
// the cleaned-up data or a client-facing error message.

type Result<T> = { data: T; error?: undefined } | { data?: undefined; error: string };

const MAX_NAME_LENGTH = 100;
const MAX_TEXT_LENGTH = 500;
const MAX_PRICE = 10000;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requiredText(value: unknown, field: string, max: number): Result<string> {
  if (typeof value !== 'string' || value.trim() === '') {
    return { error: `${field} is required` };
  }
  if (value.trim().length > max) return { error: `${field} must be at most ${max} characters` };
  return { data: value.trim() };
}

// Leaving the field out, null and an empty string all mean "no value".
function optionalText(value: unknown, field: string, max: number): Result<string | null> {
  if (value === undefined || value === null || value === '') return { data: null };
  if (typeof value !== 'string') return { error: `${field} must be a string` };
  if (value.trim().length > max) return { error: `${field} must be at most ${max} characters` };
  return { data: value.trim() || null };
}

function price(value: unknown): Result<string> {
  const num = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  if (typeof num !== 'number' || !Number.isFinite(num) || num <= 0 || num > MAX_PRICE) {
    return { error: `price must be a number between 0 and ${MAX_PRICE}` };
  }
  if (Math.round(num * 100) !== num * 100) {
    return { error: 'price can have at most 2 decimals' };
  }
  // Passed to Prisma as a string so the Decimal column gets the exact value.
  return { data: num.toFixed(2) };
}

function boolean(value: unknown, field: string): Result<boolean> {
  return typeof value === 'boolean' ? { data: value } : { error: `${field} must be true or false` };
}

export interface RestaurantInput {
  name: string;
  address: string;
  cuisine: string | null;
  description: string | null;
}

export function parseNewRestaurant(body: unknown): Result<RestaurantInput> {
  if (!isPlainObject(body)) return { error: 'Request body must be a JSON object' };
  const name = requiredText(body.name, 'name', MAX_NAME_LENGTH);
  if (name.error !== undefined) return name;
  const address = requiredText(body.address, 'address', MAX_TEXT_LENGTH);
  if (address.error !== undefined) return address;
  const cuisine = optionalText(body.cuisine, 'cuisine', MAX_NAME_LENGTH);
  if (cuisine.error !== undefined) return cuisine;
  const description = optionalText(body.description, 'description', MAX_TEXT_LENGTH);
  if (description.error !== undefined) return description;
  return {
    data: { name: name.data, address: address.data, cuisine: cuisine.data, description: description.data },
  };
}

export type RestaurantUpdate = Partial<RestaurantInput & { isOpen: boolean }>;

/** Only the fields present in the body are updated. */
export function parseRestaurantUpdate(body: unknown): Result<RestaurantUpdate> {
  if (!isPlainObject(body)) return { error: 'Request body must be a JSON object' };
  const update: RestaurantUpdate = {};

  if ('name' in body) {
    const r = requiredText(body.name, 'name', MAX_NAME_LENGTH);
    if (r.error !== undefined) return r;
    update.name = r.data;
  }
  if ('address' in body) {
    const r = requiredText(body.address, 'address', MAX_TEXT_LENGTH);
    if (r.error !== undefined) return r;
    update.address = r.data;
  }
  if ('cuisine' in body) {
    const r = optionalText(body.cuisine, 'cuisine', MAX_NAME_LENGTH);
    if (r.error !== undefined) return r;
    update.cuisine = r.data;
  }
  if ('description' in body) {
    const r = optionalText(body.description, 'description', MAX_TEXT_LENGTH);
    if (r.error !== undefined) return r;
    update.description = r.data;
  }
  if ('isOpen' in body) {
    const r = boolean(body.isOpen, 'isOpen');
    if (r.error !== undefined) return r;
    update.isOpen = r.data;
  }

  if (Object.keys(update).length === 0) return { error: 'Nothing to update' };
  return { data: update };
}

export interface MenuItemInput {
  name: string;
  description: string | null;
  price: string;
  isAvailable: boolean;
}

export function parseNewMenuItem(body: unknown): Result<MenuItemInput> {
  if (!isPlainObject(body)) return { error: 'Request body must be a JSON object' };
  const name = requiredText(body.name, 'name', MAX_NAME_LENGTH);
  if (name.error !== undefined) return name;
  const description = optionalText(body.description, 'description', MAX_TEXT_LENGTH);
  if (description.error !== undefined) return description;
  const itemPrice = price(body.price);
  if (itemPrice.error !== undefined) return itemPrice;
  let isAvailable = true;
  if ('isAvailable' in body) {
    const r = boolean(body.isAvailable, 'isAvailable');
    if (r.error !== undefined) return r;
    isAvailable = r.data;
  }
  return {
    data: { name: name.data, description: description.data, price: itemPrice.data, isAvailable },
  };
}

export type MenuItemUpdate = Partial<MenuItemInput>;

/** Only the fields present in the body are updated. */
export function parseMenuItemUpdate(body: unknown): Result<MenuItemUpdate> {
  if (!isPlainObject(body)) return { error: 'Request body must be a JSON object' };
  const update: MenuItemUpdate = {};

  if ('name' in body) {
    const r = requiredText(body.name, 'name', MAX_NAME_LENGTH);
    if (r.error !== undefined) return r;
    update.name = r.data;
  }
  if ('description' in body) {
    const r = optionalText(body.description, 'description', MAX_TEXT_LENGTH);
    if (r.error !== undefined) return r;
    update.description = r.data;
  }
  if ('price' in body) {
    const r = price(body.price);
    if (r.error !== undefined) return r;
    update.price = r.data;
  }
  if ('isAvailable' in body) {
    const r = boolean(body.isAvailable, 'isAvailable');
    if (r.error !== undefined) return r;
    update.isAvailable = r.data;
  }

  if (Object.keys(update).length === 0) return { error: 'Nothing to update' };
  return { data: update };
}
