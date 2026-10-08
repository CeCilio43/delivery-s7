import { useState } from 'react';
import {
  addMenuItem,
  deleteMenuItem,
  updateMenuItem,
  type MenuItem,
  type MenuItemInput,
  type Restaurant,
} from '../api/restaurants';
import MenuItemForm from '../components/MenuItemForm';
import Page from '../components/Page';
import { useRestaurant } from '../context/RestaurantContext';
import { apiErrorMessage, formatPrice, itemCount } from '../lib/format';

// MenuItemForm shows thrown errors' messages; turn API errors into ones
// with the backend's explanation.
async function withApiError<T>(action: () => Promise<T>, fallback: string): Promise<T> {
  try {
    return await action();
  } catch (err) {
    throw new Error(apiErrorMessage(err, fallback));
  }
}

function MenuItemRow({
  restaurant,
  item,
  onSaved,
  onDeleted,
}: {
  restaurant: Restaurant;
  item: MenuItem;
  onSaved: (item: MenuItem) => void;
  onDeleted: (itemId: string) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState('');

  async function run(action: () => Promise<void>, fallback: string) {
    setIsBusy(true);
    setError('');
    try {
      await action();
    } catch (err) {
      setError(apiErrorMessage(err, fallback));
    } finally {
      setIsBusy(false);
    }
  }

  const toggleAvailable = () =>
    run(async () => {
      onSaved(await updateMenuItem(restaurant.id, item.id, { isAvailable: !item.isAvailable }));
    }, 'Could not change availability.');

  const remove = () =>
    run(async () => {
      await deleteMenuItem(restaurant.id, item.id);
      onDeleted(item.id);
    }, 'Could not remove this item.');

  if (isEditing) {
    return (
      <li aria-label={`Editing ${item.name}`} className="rounded-2xl bg-panel p-4 shadow-elevation-low">
        <MenuItemForm
          initial={item}
          submitLabel="Save"
          busyLabel="Saving…"
          onCancel={() => setIsEditing(false)}
          onSubmit={async (input: MenuItemInput) => {
            const saved = await withApiError(
              () => updateMenuItem(restaurant.id, item.id, input),
              'Could not save this item.',
            );
            onSaved(saved);
            setIsEditing(false);
          }}
        />
      </li>
    );
  }

  return (
    <li
      aria-label={item.name}
      className={`flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-panel p-4 shadow-elevation-low ${
        item.isAvailable ? '' : 'opacity-70'
      }`}
    >
      <div className="min-w-0 flex-1">
        <h3 className="font-display text-[17px] font-medium text-charcoal">
          {item.name}
          {!item.isAvailable && (
            <span className="ml-2 rounded-2xl bg-canvas px-2 py-0.5 font-body text-xs font-normal text-muted">
              Unavailable
            </span>
          )}
        </h3>
        {item.description && <p className="mt-1 font-body text-sm text-muted">{item.description}</p>}
        {error && (
          <p role="alert" className="mt-1 font-body text-xs text-danger">
            {error}
          </p>
        )}
      </div>
      <span className="font-body text-sm font-medium text-charcoal">{formatPrice(item.price)}</span>
      {isConfirmingDelete ? (
        <div className="flex items-center gap-2">
          <span className="font-body text-xs text-charcoal">Remove from the menu?</span>
          <button
            type="button"
            disabled={isBusy}
            onClick={remove}
            className="rounded-2xl bg-danger px-3 py-1.5 font-display text-xs font-medium text-white disabled:opacity-60"
          >
            Remove
          </button>
          <button
            type="button"
            onClick={() => setIsConfirmingDelete(false)}
            className="rounded-2xl px-3 py-1.5 font-display text-xs font-medium text-muted hover:text-charcoal"
          >
            Keep
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-1">
          <button
            type="button"
            role="switch"
            aria-checked={item.isAvailable}
            aria-label={`${item.name} available`}
            disabled={isBusy}
            onClick={toggleAvailable}
            className="rounded-2xl px-3 py-1.5 font-display text-xs font-medium text-charcoal hover:bg-canvas disabled:opacity-60"
          >
            {item.isAvailable ? 'Mark unavailable' : 'Mark available'}
          </button>
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="rounded-2xl px-3 py-1.5 font-display text-xs font-medium text-charcoal hover:bg-canvas"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => setIsConfirmingDelete(true)}
            className="rounded-2xl px-3 py-1.5 font-display text-xs font-medium text-danger hover:bg-danger/10"
          >
            Delete
          </button>
        </div>
      )}
    </li>
  );
}

export default function Menu() {
  const { restaurant, patch } = useRestaurant();

  function setItems(update: (items: MenuItem[]) => MenuItem[]) {
    if (restaurant) patch(restaurant.id, (r) => ({ ...r, menuItems: update(r.menuItems) }));
  }

  return (
    <Page title="Menu">
      {restaurant && (
        <>
          <section aria-label="Add a menu item" className="rounded-2xl bg-panel p-6 shadow-elevation-low">
            <h2 className="mb-4 font-display text-[18px] font-medium text-charcoal">Add a menu item</h2>
            <MenuItemForm
              submitLabel="Add to menu"
              busyLabel="Adding…"
              onSubmit={async (input) => {
                const created = await withApiError(
                  () => addMenuItem(restaurant.id, input),
                  'Could not add this item.',
                );
                setItems((items) => [...items, created]);
              }}
            />
          </section>

          <h2 className="mt-8 font-display text-[18px] font-medium text-charcoal">
            {itemCount(restaurant.menuItems.length)}
          </h2>
          {restaurant.menuItems.length === 0 ? (
            <p className="mt-3 font-body text-sm text-muted">
              Your menu is empty. Customers can't order until you add something.
            </p>
          ) : (
            <ul className="mt-3 flex flex-col gap-3">
              {restaurant.menuItems.map((item) => (
                <MenuItemRow
                  key={item.id}
                  restaurant={restaurant}
                  item={item}
                  onSaved={(saved) => setItems((items) => items.map((i) => (i.id === saved.id ? saved : i)))}
                  onDeleted={(id) => setItems((items) => items.filter((i) => i.id !== id))}
                />
              ))}
            </ul>
          )}
        </>
      )}
    </Page>
  );
}
