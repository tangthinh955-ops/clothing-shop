import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';

export function useLinkToken(): string {
  const location = useLocation();
  const navigate = useNavigate();
  const parameters = new URLSearchParams(location.hash.slice(1));
  const hasToken = parameters.has('token');
  const tokenFromLink = parameters.get('token') ?? '';
  const [capturedToken, setCapturedToken] = useState(tokenFromLink);
  useEffect(() => {
    if (!hasToken) return;
    setCapturedToken(tokenFromLink);
    void navigate({ pathname: location.pathname, search: location.search }, { replace: true });
  }, [hasToken, location.pathname, location.search, navigate, tokenFromLink]);
  // Only explicit token links replace auth state; anchors such as #main-content keep their normal behavior.
  return hasToken ? tokenFromLink : capturedToken;
}
