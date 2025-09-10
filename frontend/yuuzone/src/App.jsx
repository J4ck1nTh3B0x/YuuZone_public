import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { Suspense, lazy } from "react";
import { Navigate, RouterProvider, createBrowserRouter } from "react-router-dom";
import AppLayout from "./components/AppLayout.jsx";
import { AuthProvider } from "./components/AuthContext.jsx";
import Error from "./components/Error.jsx";
import FeedLayout from "./components/FeedLayout.jsx";
import { Loader } from "./components/Loader.jsx";
import RequireAuth from "./components/PrivateRoute.jsx";
import Login from "./pages/login/Login.jsx";
import Register from "./pages/register/Register.jsx";
import VerifyEmailSuccess from "./pages/VerifyEmailSuccess.jsx";
import VerifyEmailExpired from "./pages/VerifyEmailExpired.jsx";
import PasswordResetExpired from "./pages/PasswordResetExpired.jsx";
import LinkExpired from "./pages/LinkExpired.jsx";
import AccountDeletionVerification from "./pages/AccountDeletionVerification.jsx";
import useRealtimeCoins from "./hooks/useRealtimeCoins.js";

const Feed = lazy(() => import("./pages/feed/Feed.jsx"));
const Profile = lazy(() => import("./pages/profile/Profile.jsx"));
const FullPost = lazy(() => import("./pages/fullPost/FullPost.jsx"));
const Inbox = lazy(() => import("./pages/inbox/Inbox.jsx"));
const SavedPosts = lazy(() => import("./pages/saved/SavedPosts.jsx"));
const SubThread = lazy(() => import("./pages/thread/SubThread.jsx"));
const ForgotPassword = lazy(() => import("./pages/forgot-password/ForgotPassword.jsx"));

const ManagedSubthreads = lazy(() => import("./pages/ManagedSubthreads"));
const BannedPage = lazy(() => import("./pages/banned/BannedPage.jsx"));
const Settings = lazy(() => import("./pages/settings/Settings.jsx"));
const Subscriptions = lazy(() => import("./pages/subscription/Subscriptions.jsx"));
const PaymentSuccess = lazy(() => import("./pages/subscription/PaymentSuccess.jsx"));
const CoinShop = lazy(() => import("./pages/coin-shop/CoinShop.jsx"));
const AvailableAvatars = lazy(() => import("./pages/available-avatars/AvailableAvatars.jsx"));
const SuperManagerDashboard = lazy(() => import("./components/SuperManagerDashboard.jsx"));

const router = createBrowserRouter([
  {
    path: "/",
    element: <AppLayout />,
    errorElement: <Error />,
    children: [
      {
        path: "/",
        element: <FeedLayout />,
        children: [
          {
            path: "/",
            element: <Navigate to="/all" />,
          },
          {
            path: "/:feedName",
            element: <Feed />,
          },
          {
            path: "/post/:postId",
            element: <FullPost />,
          },
        ],
      },
      {
        path: "/u/:username",
        element: <Profile />,
      },
      {
        path: "/t/:threadName",
        element: <SubThread />,
      },
      {
        path: "/saved",
        element: (
          <RequireAuth>
            <SavedPosts />
          </RequireAuth>
        ),
      },
      {
        path: "/inbox",
        element: (
          <RequireAuth>
            <Inbox />
          </RequireAuth>
        ),
      },
      {
        path: "/managed-subthreads",
        element: (
          <RequireAuth>
            <ManagedSubthreads />
          </RequireAuth>
        ),
      },
      {
        path: "/banned/:threadId",
        element: (
          <RequireAuth>
            <BannedPage />
          </RequireAuth>
        ),
      },
      {
        path: "/settings",
        element: (
          <RequireAuth>
            <Settings />
          </RequireAuth>
        ),
      },
      {
        path: "/subscription",
        element: <Navigate to="/subscriptions" />,
      },
      {
        path: "/subscriptions",
        element: (
          <RequireAuth>
            <Subscriptions />
          </RequireAuth>
        ),
      },
      {
        path: "/payment-success/:paymentReference",
        element: <PaymentSuccess />,
      },
      {
        path: "/coin-shop",
        element: (
          <RequireAuth>
            <CoinShop />
          </RequireAuth>
        ),
      },
      {
        path: "/available-avatars",
        element: (
          <RequireAuth>
            <AvailableAvatars />
          </RequireAuth>
        ),
      },
      {
        path: "/super-manager",
        element: (
          <RequireAuth>
            <SuperManagerDashboard />
          </RequireAuth>
        ),
      },
      {
        path: "/verify-email-success",
        element: <VerifyEmailSuccess />,
      },
      {
        path: "/verify-email-expired",
        element: <VerifyEmailExpired />,
      },
      {
        path: "/password-reset-expired",
        element: <PasswordResetExpired />,
      },
      {
        path: "/link-expired",
        element: <LinkExpired />,
      },
      {
        path: "/account-deletion-verification/:token",
        element: <AccountDeletionVerification />,
      },
      {
        path: "/account-deletion-verification/success",
        element: <AccountDeletionVerification />,
      },
      {
        path: "/account-deletion-verification/error",
        element: <AccountDeletionVerification />,
      },
    ],
  },
  {
    path: "/login",
    element: <Login />,
  },
  {
    path: "/register",
    element: <Register />,
  },
  {
    path: "/forgot-password",
    element: <ForgotPassword />,
  },
]);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 120000,
    },
  },
});

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      {process.env.NODE_ENV === 'development' && <ReactQueryDevtools initialIsOpen={false} />}
      <AuthProvider>
        <Suspense fallback={<Loader />}>
          <RouterProvider router={router} fallbackElement={<Loader />} />
        </Suspense>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
