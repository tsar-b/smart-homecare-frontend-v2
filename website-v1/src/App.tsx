import { BrowserRouter, Route, Routes } from 'react-router-dom';

import { Layout } from './components/Layout';
import { ScrollManager } from './components/ScrollManager';
import { SiteProvider } from './context/SiteContext';
import { AboutPage } from './pages/AboutPage';
import { AccountPage } from './pages/AccountPage';
import { BookingPage } from './pages/BookingPage';
import { HomePage } from './pages/HomePage';
import { NotFoundPage } from './pages/NotFoundPage';
import { ServiceDetailPage } from './pages/ServiceDetailPage';
import { ServicesPage } from './pages/ServicesPage';
import { SupportPage } from './pages/SupportPage';

export default function App() {
  return (
    <BrowserRouter>
      <SiteProvider>
        <ScrollManager />
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<HomePage />} />
            <Route path="services" element={<ServicesPage />} />
            <Route path="services/:serviceSlug" element={<ServiceDetailPage />} />
            <Route path="book" element={<BookingPage />} />
            <Route path="about" element={<AboutPage />} />
            <Route path="support" element={<SupportPage />} />
            <Route path="account" element={<AccountPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </SiteProvider>
    </BrowserRouter>
  );
}
