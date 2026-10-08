import { Link, useNavigate } from 'react-router-dom';
import { createRestaurant } from '../api/restaurants';
import AuthCard from '../components/AuthCard';
import RestaurantDetailsForm from '../components/RestaurantDetailsForm';
import { useRestaurant } from '../context/RestaurantContext';
import { apiErrorMessage } from '../lib/format';

export default function NewRestaurant() {
  const { restaurants, replace, select } = useRestaurant();
  const navigate = useNavigate();

  return (
    <AuthCard
      title={restaurants.length === 0 ? 'Set up your restaurant' : 'Add a restaurant'}
      subtitle="It starts closed, so you can add your menu before customers can order."
    >
      <RestaurantDetailsForm
        submitLabel="Create restaurant"
        busyLabel="Creating…"
        onSubmit={async (input) => {
          try {
            const created = await createRestaurant(input);
            replace(created);
            select(created.id);
            navigate('/menu');
          } catch (err) {
            throw new Error(apiErrorMessage(err, 'Could not create your restaurant.'));
          }
        }}
      />
      {restaurants.length > 0 && (
        <Link to="/orders" className="text-center font-body text-sm text-brand hover:text-brand-dark">
          Back to {restaurants.length === 1 ? restaurants[0]!.name : 'your restaurants'}
        </Link>
      )}
    </AuthCard>
  );
}
