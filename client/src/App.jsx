import { BrowserRouter, Route, Routes } from 'react-router-dom';
import BookingPage from './features/bookings/pages/BookingPage.jsx';
import AdminPage from './features/grounds/pages/AdminPage.jsx';
import AccountPage from './features/account/pages/AccountPage.jsx';
import GroundDetailPage from './features/grounds/pages/GroundDetailPage.jsx';
import AboutPage from './pages/AboutPage.jsx';

function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Routes>
        <Route path="/" element={<BookingPage />} />
        <Route path="/ground/:id" element={<GroundDetailPage />} />
        <Route path="/booking/:id" element={<BookingPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/account" element={<AccountPage />} />
        <Route path="/about" element={<AboutPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
