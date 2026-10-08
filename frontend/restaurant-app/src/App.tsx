import { Navigate, Route, Routes } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import Orders from './pages/Orders';
import Menu from './pages/Menu';
import RestaurantSettings from './pages/RestaurantSettings';
import NewRestaurant from './pages/NewRestaurant';
import NotificationToast from './components/NotificationToast';
import ProtectedRoute from './components/ProtectedRoute';
import { useAuth } from './context/AuthContext';

function App() {
  const { isAuthenticated } = useAuth();

  return (
    <>
      <NotificationToast />
      <Routes>
        <Route
          path="/login"
          element={isAuthenticated ? <Navigate to="/orders" replace /> : <Login />}
        />
        <Route
          path="/register"
          element={isAuthenticated ? <Navigate to="/orders" replace /> : <Register />}
        />
        <Route
          path="/orders"
          element={
            <ProtectedRoute>
              <Orders />
            </ProtectedRoute>
          }
        />
        <Route
          path="/menu"
          element={
            <ProtectedRoute>
              <Menu />
            </ProtectedRoute>
          }
        />
        <Route
          path="/restaurant"
          element={
            <ProtectedRoute>
              <RestaurantSettings />
            </ProtectedRoute>
          }
        />
        <Route
          path="/restaurants/new"
          element={
            <ProtectedRoute>
              <NewRestaurant />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to={isAuthenticated ? '/orders' : '/login'} replace />} />
      </Routes>
    </>
  );
}

export default App;
