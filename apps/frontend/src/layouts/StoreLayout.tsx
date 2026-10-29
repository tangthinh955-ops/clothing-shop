import { Container } from '@mui/material';
import { Outlet } from 'react-router';
import { AnnouncementBar } from './store/AnnouncementBar';
import { StoreFooter } from './store/StoreFooter';
import { StoreHeader } from './store/StoreHeader';

export function StoreLayout() {
  return <>
    <a className="skip-link" href="#main-content">Đến nội dung chính</a>
    <AnnouncementBar />
    <StoreHeader />
    <Container component="main" id="main-content" maxWidth="lg" sx={{ minHeight: '65vh' }}>
      <Outlet />
    </Container>
    <StoreFooter />
  </>;
}
