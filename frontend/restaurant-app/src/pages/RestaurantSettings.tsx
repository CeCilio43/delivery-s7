import { updateRestaurant } from '../api/restaurants';
import OpenToggle from '../components/OpenToggle';
import Page from '../components/Page';
import RestaurantDetailsForm from '../components/RestaurantDetailsForm';
import { useRestaurant } from '../context/RestaurantContext';
import { apiErrorMessage } from '../lib/format';

export default function RestaurantSettings() {
  const { restaurant, replace } = useRestaurant();

  return (
    <Page title="Restaurant">
      {restaurant && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]">
          <section aria-label="Details" className="rounded-2xl bg-panel p-6 shadow-elevation-low">
            <h2 className="mb-4 font-display text-[18px] font-medium text-charcoal">Details</h2>
            {/* Keyed so switching restaurants resets the form's fields. */}
            <RestaurantDetailsForm
              key={restaurant.id}
              initial={restaurant}
              submitLabel="Save changes"
              busyLabel="Saving…"
              onSubmit={async (input) => {
                try {
                  replace(await updateRestaurant(restaurant.id, input));
                } catch (err) {
                  throw new Error(apiErrorMessage(err, 'Could not save your changes.'));
                }
              }}
            />
          </section>

          <section aria-label="Opening status" className="h-fit rounded-2xl bg-panel p-6 shadow-elevation-low">
            <h2 className="font-display text-[18px] font-medium text-charcoal">Taking orders</h2>
            <p className="mt-2 font-body text-sm text-muted">
              While closed, customers can still browse your menu but can't place new orders.
              Orders already placed are not affected.
            </p>
            <div className="mt-4">
              <OpenToggle />
            </div>
          </section>
        </div>
      )}
    </Page>
  );
}
