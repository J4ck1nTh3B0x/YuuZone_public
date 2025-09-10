import Navbar from "./Navbar";
import ThreadsSidebar from "./ThreadsSidebar";
import { Outlet, useLocation, useParams } from "react-router-dom";
import AuthConsumer from "./AuthContext.jsx";
import Modal from "./Modal.jsx";
import NewPost from "./NewPost.jsx";
import Svg from "./Svg.jsx";
import { useState } from "react";
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { ConfirmProvider } from './useConfirm.jsx';
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import PaymentTest from "./PaymentTest.jsx";
import useRealtimeCoins from "../hooks/useRealtimeCoins.js";

export default function AppLayout() {
  const location = useLocation();
  const params = useParams();
  const { isAuthenticated, isLoading } = AuthConsumer();
  const [showModal, setShowModal] = useState(false);
  
  // Initialize real-time coin updates
  useRealtimeCoins();
  
  // List of routes where sidebar and floating button should NOT appear
  const hideSidebarRoutes = [
    "/login",
    "/register",
    "/forgot-password",
    "/settings",
    "/inbox"
  ];
  const shouldShowSidebar = !hideSidebarRoutes.some((route) => location.pathname.startsWith(route)) && !isLoading;
  
  // Check if we're on a subthread page
  const isOnSubthreadPage = location.pathname.startsWith("/t/");
  const subthreadName = isOnSubthreadPage ? location.pathname.split("/t/")[1] : null;
  
  // Get subthread data if we're on a subthread page
  const { data: subthreadData } = useQuery({
    queryKey: ["thread", subthreadName],
    queryFn: async () => {
      if (!subthreadName) return null;
      try {
        return await axios.get(`/api/threads/${subthreadName}`).then((res) => res.data);
      } catch (error) {
        return null;
      }
    },
    enabled: !!subthreadName && isAuthenticated && !isLoading,
  });
  
  // Determine if we should show the create post button
  const shouldShowCreatePostButton = isAuthenticated && !isLoading && (
    shouldShowSidebar || // Show on regular pages
    isOnSubthreadPage // Show on all subthread pages
  );

  return (
    <ConfirmProvider>
      <Navbar />
      <ToastContainer
        position="top-right"
        autoClose={4000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme={document.documentElement.classList.contains('dark') ? 'dark' : 'light'}
        limit={3}
      />
      <div className="flex min-h-screen bg-theme-light-gray2 dark:bg-theme-dark-bg dark:text-theme-dark-text pt-16">
        {/* Sidebar - Fixed position with fixed width */}
        {shouldShowSidebar && !isLoading && (
          <div className="hidden md:block fixed left-0 top-16 w-80 h-[calc(100vh-4rem)] z-10">
            <ThreadsSidebar />
          </div>
        )}
        
        {/* Main Content Area - Takes remaining space with small gap */}
        <div className={`flex-1 min-w-0 ${shouldShowSidebar && !isLoading ? 'md:ml-80' : ''} px-2 md:px-4 lg:px-6`}>
          <Outlet />
        </div>
        
        {/* Floating Action Button */}
        {shouldShowCreatePostButton && !isLoading && (
          <div
            className="fixed right-5 bottom-5 w-14 h-14 rounded-lg bg-theme-blue active:scale-90 z-50 shadow-lg"
            onClick={() => setShowModal(true)}>
            <Svg
              type="add"
              className="text-white cursor-pointer fill-current hover:text-white"
              onClick={() => setShowModal(true)}
            />
          </div>
        )}
        
        {/* Modal */}
        {showModal && isAuthenticated && !isLoading && (
          <Modal showModal={showModal} setShowModal={setShowModal}>
            <NewPost 
              setShowModal={setShowModal} 
              threadInfo={isOnSubthreadPage && subthreadData?.threadData ? {
                thread_id: subthreadData.threadData.id,
                thread_name: subthreadData.threadData.name
              } : {}}
            />
          </Modal>
        )}
        
        {/* Payment Test Component (Development Only) */}
        {process.env.NODE_ENV === 'development' && <PaymentTest />}
      </div>
    </ConfirmProvider>
  );
}
