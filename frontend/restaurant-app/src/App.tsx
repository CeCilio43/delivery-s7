import { Navigate, Route, Routes } from 'react-router-dom';
import Login from './pages/Login';
import Orders from './pages/Orders';
import ProtectedRoute from './components/ProtectedRoute';
import { useAuth } from './context/AuthContext';

function App() {
  const { isAuthenticated } = useAuth();

  return (
    <Routes>
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/orders" replace /> : <Login />}
      />
      <Route
        path="/orders"
        element={
          <ProtectedRoute>
            <Orders />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to={isAuthenticated ? '/orders' : '/login'} replace />} />
    </Routes>
  );
}

export default App;
