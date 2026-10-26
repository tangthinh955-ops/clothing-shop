import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';

export function useLinkToken(): string {
  const location = useLocation();
  const navigate = useNavigate();
  const [token] = useState(() => new URLSearchParams(location.hash.slice(1)).get('token') ?? '');
  useEffect(() => {
    if (location.hash) void navigate(location.pathname, { replace: true });
  }, [location.hash, location.pathname, navigate]);
  return token;
}
