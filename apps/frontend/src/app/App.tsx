import { Route, Routes } from 'react-router';
import { CartProvider } from '../features/cart/CartProvider';
import { CartPage } from '../features/cart/pages/CartPage';
import { CheckoutPage } from '../features/checkout/pages/CheckoutPage';
import { OrderSubmissionProvider } from '../features/checkout/OrderSubmissionProvider';
import { OrderDetailPage } from '../features/orders/pages/OrderDetailPage';
import { StoreLayout } from '../layouts/StoreLayout';
import { AuthPage } from '../features/auth/pages/AuthPage';
import { VerifyPage } from '../features/auth/pages/VerifyPage';
import { AccountPage } from '../features/account/AccountPage';
import { AdminPage } from '../features/admin/AdminPage';
import { CategoriesPage } from '../features/admin/categories/pages/CategoriesPage';
import { InventoryPage } from '../features/admin/inventory/pages/InventoryPage';
import { ProductsPage } from '../features/admin/products/pages/ProductsPage';
import { ProductCreatePage } from '../features/admin/products/pages/ProductCreatePage';
import { ProductEditPage } from '../features/admin/products/pages/ProductEditPage';
import { SettingsPage } from '../features/admin/settings/pages/SettingsPage';
import { CatalogPage } from '../features/catalog/pages/CatalogPage';
import { HomePage } from '../features/catalog/pages/HomePage';
import { ProductDetailPage } from '../features/catalog/pages/ProductDetailPage';
import { policyPages } from '../features/information/content/policies';
import { PolicyPage } from '../features/information/pages/PolicyPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { PrivateRoute } from './router/PrivateRoute';

export function App() {
  // CartProvider wraps every store route: the drawer, header badge and /cart share one cart.
  return <CartProvider>
    <OrderSubmissionProvider>
    <Routes>
      <Route element={<StoreLayout />}>
        <Route index element={<HomePage />} />
        <Route path="shop" element={<CatalogPage />} />
        <Route path="products/:slug" element={<ProductDetailPage />} />
        <Route path="cart" element={<CartPage />} />
        <Route path="checkout" element={<CheckoutPage />} />
        {/* /orders/:code is the guest access route: the fragment token is read by the page itself. */}
        <Route path="orders/:code" element={<OrderDetailPage />} />
        <Route path="login" element={<AuthPage key="login" mode="login" />} />
        <Route path="register" element={<AuthPage key="register" mode="register" />} />
        <Route path="forgot-password" element={<AuthPage key="forgot" mode="forgot" />} />
        <Route path="reset-password" element={<AuthPage key="reset" mode="reset" />} />
        <Route path="verify-email" element={<VerifyPage />} />
        <Route path="account" element={<PrivateRoute>{(user) => <AccountPage user={user} />}</PrivateRoute>} />
        <Route path="admin" element={<PrivateRoute admin>{() => <AdminPage />}</PrivateRoute>} />
        <Route path="admin/categories" element={<PrivateRoute admin>{() => <CategoriesPage />}</PrivateRoute>} />
        <Route path="admin/inventory" element={<PrivateRoute admin>{() => <InventoryPage />}</PrivateRoute>} />
        <Route path="admin/products" element={<PrivateRoute admin>{() => <ProductsPage />}</PrivateRoute>} />
        <Route path="admin/products/new" element={<PrivateRoute admin>{() => <ProductCreatePage />}</PrivateRoute>} />
        <Route path="admin/products/:productId" element={<PrivateRoute admin>{() => <ProductEditPage />}</PrivateRoute>} />
        <Route path="admin/settings" element={<PrivateRoute admin>{() => <SettingsPage />}</PrivateRoute>} />
        {policyPages.map((policy) => <Route key={policy.path} path={policy.path} element={<PolicyPage policy={policy} />} />)}
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
    </OrderSubmissionProvider>
  </CartProvider>;
}
