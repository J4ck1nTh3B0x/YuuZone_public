import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "./i18n";
import { deduplicateInfiniteQuery } from "./utils/postDeduplication";

// Global configuration to prevent user draft loss
const preventDraftLoss = () => {
  // Prevent accidental page refresh with unsaved changes
  window.addEventListener('beforeunload', (event) => {
    // Check if there are any active forms or text inputs with content
    const activeInputs = document.querySelectorAll('input[type="text"], textarea, [contenteditable="true"]');
    const hasUnsavedContent = Array.from(activeInputs).some(input => {
      if (input.tagName === 'TEXTAREA' || input.type === 'text') {
        return input.value.trim().length > 0;
      }
      if (input.hasAttribute('contenteditable')) {
        return input.textContent.trim().length > 0;
      }
      return false;
    });
    
    if (hasUnsavedContent) {
      event.preventDefault();
      event.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
      return event.returnValue;
    }
  });
  
  // Prevent form submission with unsaved changes in other forms
  document.addEventListener('submit', (event) => {
    const form = event.target;
    const otherInputs = document.querySelectorAll('input[type="text"], textarea, [contenteditable="true"]');
    
    Array.from(otherInputs).forEach(input => {
      if (!form.contains(input) && input.value.trim().length > 0) {
        // There are unsaved changes in other forms
        if (!confirm('You have unsaved changes in other areas. Continue anyway?')) {
          event.preventDefault();
          return false;
        }
      }
    });
  });
};

// Initialize draft loss prevention
preventDraftLoss();


const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false, // Prevent refetch when window regains focus
      refetchOnMount: false, // Prevent refetch when component mounts
      refetchOnReconnect: false, // Prevent refetch on network reconnect
      staleTime: 5 * 60 * 1000, // 5 minutes - data stays fresh longer
      gcTime: 10 * 60 * 1000, // 10 minutes - keep data in cache longer
      // Global deduplication for post queries
      select: (data, query) => {
        // Only apply deduplication to post-related queries
        if (query.queryKey[0] === 'posts' && data?.pages) {
          return deduplicateInfiniteQuery(data);
        }
        return data;
      },
      // Global error handling to prevent unnecessary refetches
      onError: (error, query) => {
        // Don't automatically retry on errors to prevent losing user input
        console.warn('Query error (not retrying to preserve user input):', error);
      },
    },
    mutations: {
      retry: 1,
      // Don't automatically refetch queries after mutations to preserve user input
      onSuccess: () => {
        // Let real-time updates handle data synchronization instead of refetching
      },
      // Don't automatically retry mutations to prevent losing user input
      onError: (error, variables, context) => {
        console.warn('Mutation error (not retrying to preserve user input):', error);
      },
    },
  },
});

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      <ReactQueryDevtools initialIsOpen={false} />
      {/* ToastContainer moved to AppLayout.jsx to avoid duplicate containers */}
    </QueryClientProvider>
  </React.StrictMode>
);
