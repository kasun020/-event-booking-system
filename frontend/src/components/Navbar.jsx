import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, logout, isAdmin, isOrganizer } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isActive = (path) => location.pathname === path || location.pathname.startsWith(path + '/');

  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <Link to="/">
          <span className="brand-icon">🎫</span>
          <span className="brand-name">EventHub</span>
        </Link>
      </div>

      <div className="navbar-links">
        <Link to="/events" className={isActive('/events') ? 'nav-link active' : 'nav-link'}>Events</Link>
        {user && (
          <Link to="/bookings" className={isActive('/bookings') ? 'nav-link active' : 'nav-link'}>My Bookings</Link>
        )}
        {isOrganizer && (
          <Link to="/events/create" className={isActive('/events/create') ? 'nav-link active' : 'nav-link'}>Create Event</Link>
        )}
        {isAdmin && (
          <Link to="/users" className={isActive('/users') ? 'nav-link active' : 'nav-link'}>Users</Link>
        )}
        <Link to="/payment" className={isActive('/payment') ? 'nav-link active' : 'nav-link'}>
          <span className="badge-soon">Payment</span>
        </Link>
        <Link to="/notifications" className={isActive('/notifications') ? 'nav-link active' : 'nav-link'}>
          <span className="badge-soon">Notifications</span>
        </Link>
      </div>

      <div className="navbar-user">
        {user ? (
          <>
            <div className="user-info">
              <div className="user-avatar">{user.name?.[0]?.toUpperCase() || 'U'}</div>
              <div className="user-details">
                <span className="user-name">{user.name}</span>
                <span className="user-role">{user.role}</span>
              </div>
            </div>
            <button className="btn-ghost" onClick={handleLogout}>Logout</button>
          </>
        ) : (
          <>
            <Link to="/login" className="btn-ghost">Login</Link>
            <Link to="/register" className="btn-primary">Sign Up</Link>
          </>
        )}
      </div>
    </nav>
  );
}
