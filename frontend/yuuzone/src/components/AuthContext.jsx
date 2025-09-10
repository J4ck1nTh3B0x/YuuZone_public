import { useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import PropTypes from "prop-types";
import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { io } from "socket.io-client";
import { useTranslation } from "react-i18next";
import themeManager from "../utils/themeManager";

const AuthContext = createContext();

AuthProvider.propTypes = {
  children: PropTypes.any,
};

export function AuthProvider({ children }) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const localData = JSON.parse(localStorage.getItem("user") || "null");
  const [isAuthenticated, setIsAuthenticated] = useState(!!localData); // Start with localStorage state
  const [user, setUser] = useState(localData || {});
  const [socket, setSocket] = useState(null);
  const [theme, setTheme] = useState('light');
  const [customTheme, setCustomTheme] = useState(null);
  const [isLoading, setIsLoading] = useState(!!localData); // Show loading while validating existing session
  
  // Ref to track current socket for cleanup
  const socketRef = useRef(null);
  
  const { refetch } = useQuery({
    queryKey: ["user"],
    queryFn: async () => {

      return await axios
        .get("/api/user")
        .then((res) => {
  
          localStorage.setItem("user", JSON.stringify(res.data));
          setUser(res.data);
          setIsAuthenticated(true);
          setIsLoading(false);
          return res.data;
        })
        .catch((error) => {
  
          // Only clear auth state if we get a 401 (not authenticated)
          if (error.response?.status === 401) {
            localStorage.removeItem("user");
            setIsAuthenticated(false);
            setUser({});
          }
          setIsLoading(false);
          
          // Only handle non-401 errors
          if (error.response?.status !== 401) {
            // Error fetching user data
          }
          return {};
        });
    },
    retry: false, // Don't retry on any errors
    enabled: true, // Always run on mount to check for existing authentication
    staleTime: 10 * 60 * 1000, // 10 minutes - user data can be stale longer
    gcTime: 15 * 60 * 1000, // 15 minutes - keep user data longer
    refetchOnWindowFocus: false, // Prevent refetch when window regains focus
    refetchOnMount: false, // Prevent refetch when component mounts
    refetchOnReconnect: false, // Prevent refetch on network reconnect
  });
  
  // Force check for existing authentication on mount
  useEffect(() => {
    // Only check authentication once on mount, don't force refetch
    // The query will run automatically due to enabled: true
  }, []); // Empty dependency array means this runs once on mount

  // Fetch theme and custom theme when user is authenticated
  useEffect(() => {
    if (isAuthenticated && user.id) {
      // Fetch basic theme from backend
      axios.get('/api/user/theme').then(res => {
        setTheme(res.data.theme || 'light');
        applyTheme(res.data.theme || 'light');
      }).catch(() => {
        // If theme fetch fails, use default
        setTheme('light');
        applyTheme('light');
      });

      // Fetch custom theme from backend
      axios.get('/api/user/custom-theme').then(res => {
        if (res.data.has_custom_theme && res.data.theme) {
          setCustomTheme(res.data.theme);
          themeManager.applyCustomTheme(res.data.theme.theme_data);
        } else {
          setCustomTheme(null);
          themeManager.removeCustomTheme();
        }
      }).catch(() => {
        // If custom theme fetch fails, use default
        setCustomTheme(null);
        themeManager.removeCustomTheme();
      });
    }
  }, [isAuthenticated, user.id]);

  // Ensure user validation runs when component mounts and user is authenticated
  useEffect(() => {
    if (isAuthenticated && user.id && !isLoading) {
      // Don't force refetch - let the query handle its own lifecycle
      // The query will automatically revalidate when needed
    }
  }, [isAuthenticated, user.id, isLoading]);

  // Apply theme to document
  const applyTheme = useCallback((themeValue) => {
    // If custom theme is active, don't change the dark/light class
    if (customTheme) {
      return;
    }
    
    if (themeValue === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [customTheme]);

  // Switch to custom theme mode
  const switchToCustomTheme = useCallback((themeData) => {
    if (themeData) {
      setCustomTheme(themeData);
      themeManager.applyCustomTheme(themeData.theme_data);
      // Save to backend
      axios.post('/api/user/custom-theme', { theme_id: themeData.id }).catch(() => {});
    }
  }, []);

  // Switch back to light/dark mode
  const switchToSystemTheme = useCallback((themeValue = 'light') => {
    setCustomTheme(null);
    themeManager.removeCustomTheme();
    setTheme(themeValue);
    applyTheme(themeValue);
    // Save to backend
    axios.patch('/api/user/theme', { theme: themeValue }).catch(() => {});
    // Remove custom theme from backend
    axios.delete('/api/user/custom-theme').catch(() => {});
  }, [applyTheme]);

  // Function to update user data immediately
  const updateUserData = useCallback((newUserData) => {
    setUser(newUserData);
    localStorage.setItem("user", JSON.stringify(newUserData));
    // Also update the query cache
    queryClient.setQueryData(["user"], newUserData);
  }, [queryClient]);

  // Listen for real-time theme changes
  useEffect(() => {
    if (!socket || !socket.connected) return;
    const handleThemeChanged = (data) => {
      if (data && data.theme) {
        setTheme(data.theme);
        applyTheme(data.theme);
      }
    };
    socket.on('theme_changed', handleThemeChanged);
    return () => {
      if (socket && socket.connected) {
        socket.off('theme_changed', handleThemeChanged);
      }
    };
  }, [socket, applyTheme]);

  // Listen for real-time karma changes
  useEffect(() => {
    if (!socket || !socket.connected) return;
    const handleKarmaUpdated = (data) => {
      if (data && data.user_id && user && data.user_id === user.id) {
        setUser((prevUser) => ({
          ...prevUser,
          karma: {
            ...prevUser.karma,
            user_karma: data.user_karma
          }
        }));
      }
    };
    socket.on('karma_updated', handleKarmaUpdated);
    return () => {
      if (socket && socket.connected) {
        socket.off('karma_updated', handleKarmaUpdated);
      }
    };
  }, [socket, user]);

  // Listen for real-time profile info changes
  useEffect(() => {
    if (!socket || !socket.connected) return;
    const handleProfileUpdated = (data) => {
      if (data && data.username && user && data.username === user.username && data.updated_fields) {
        setUser((prevUser) => ({
          ...prevUser,
          ...data.updated_fields,
          avatar: data.avatar_url || prevUser.avatar,
        }));
      }
    };
    socket.on('profile_updated', handleProfileUpdated);
    return () => {
      if (socket && socket.connected) {
        socket.off('profile_updated', handleProfileUpdated);
      }
    };
  }, [socket, user]);

  // Listen for real-time coin balance updates
  useEffect(() => {
    const handleCoinBalanceUpdated = (data) => {
      if (data && data.new_balance && user) {
        setUser((prevUser) => ({
          ...prevUser,
          wallet: {
            ...prevUser.wallet,
            coin_balance: data.new_balance
          }
        }));
      }
    };

    // Listen for socket events
    if (socket && socket.connected) {
      socket.on('coin_balance_updated', handleCoinBalanceUpdated);
      socket.on('coin_purchase_complete', handleCoinBalanceUpdated);
      socket.on('avatar_purchased', handleCoinBalanceUpdated);
    }

    // Listen for custom events (fallback for when sockets fail)
    const handleCustomCoinBalanceUpdate = (event) => {
      const { newBalance } = event.detail;
      if (newBalance && user) {
        setUser((prevUser) => ({
          ...prevUser,
          wallet: {
            ...prevUser.wallet,
            coin_balance: newBalance
          }
        }));
      }
    };

    window.addEventListener('coinBalanceUpdated', handleCustomCoinBalanceUpdate);

    // Listen for user data updates (e.g., from payment completion)
    const handleUserDataUpdated = (event) => {
      
      if (event.detail) {
        setUser(event.detail);
        localStorage.setItem("user", JSON.stringify(event.detail));
        
      }
    };

    window.addEventListener('userDataUpdated', handleUserDataUpdated);

    return () => {
      if (socket && socket.connected) {
        socket.off('coin_balance_updated', handleCoinBalanceUpdated);
        socket.off('coin_purchase_complete', handleCoinBalanceUpdated);
        socket.off('avatar_purchased', handleCoinBalanceUpdated);
      }
      window.removeEventListener('coinBalanceUpdated', handleCustomCoinBalanceUpdate);
      window.removeEventListener('userDataUpdated', handleUserDataUpdated);
    };
  }, [user]);

  // Global payment completion handler for automatic redirects
  useEffect(() => {
    const handlePaymentCompleted = (data) => {
      console.log('🔍 DEBUG: AuthContext received payment_completed socket event:', data);

      const { payment_reference, payment_type, amount, tier_name, new_balance, user_subscription_types } = data;
      
      
      
      // Update coin balance if provided
      if (new_balance && user) {

        setUser((prevUser) => ({
          ...prevUser,
          wallet: {
            ...prevUser.wallet,
            coin_balance: new_balance
          }
        }));
      }

      // Update user subscription types if provided (for subscription payments)
      if (user_subscription_types && user) {
        setUser((prevUser) => ({
          ...prevUser,
          subscription_types: user_subscription_types
        }));
      }

      // Emit a custom event that components can listen to for redirects
      const event = new CustomEvent('paymentCompleted', {
        detail: {
          payment_reference,
          payment_type,
          amount,
          tier_name,
          new_balance,
          user_subscription_types
        }
      });
      
      console.log('🔍 DEBUG: AuthContext dispatching paymentCompleted custom event:', event.detail);
      window.dispatchEvent(event);
    };

    if (socket && socket.connected) {
      socket.on('payment_completed', handlePaymentCompleted);
    }

    return () => {
      if (socket && socket.connected) {
        socket.off('payment_completed', handlePaymentCompleted);
      }
    };
  }, [socket, user]);

  // Listen for subscription purchase events to update user subscription types
  useEffect(() => {
    const handleSubscriptionPurchased = async (data) => {
      const { tier_name, tier_slug, amount, currency, payment_status } = data;
      
      // Refresh user data to get updated subscription types
      try {
        const userResponse = await axios.get('/api/user');
        if (userResponse.data && user) {
          setUser(userResponse.data);
          localStorage.setItem("user", JSON.stringify(userResponse.data));
        }
      } catch (error) {
        console.error('Failed to refresh user data after subscription purchase:', error);
      }
    };

    if (socket && socket.connected) {
      socket.on('subscription_purchased', handleSubscriptionPurchased);
    }

    return () => {
      if (socket && socket.connected) {
        socket.off('subscription_purchased', handleSubscriptionPurchased);
      }
    };
  }, [socket, user]);

  // Update theme in backend and locally
  const updateTheme = useCallback((newTheme) => {
    setTheme(newTheme);
    applyTheme(newTheme);
    axios.patch('/api/user/theme', { theme: newTheme })
      .then(res => {
      })
      .catch((err) => {
        // Optionally, show an error but DO NOT revert the UI
      });
  }, [applyTheme]);

  // Update custom theme
  const updateCustomTheme = useCallback((newCustomTheme) => {
    setCustomTheme(newCustomTheme);
    if (newCustomTheme) {
      themeManager.applyCustomTheme(newCustomTheme.theme_data);
    } else {
      themeManager.removeCustomTheme();
    }
  }, []);

  useEffect(() => {

    
    // Clean up existing socket if user changed or logged out
    if (!user && socket) {
      
      try {
        if (socket.connected) {
          socket.emit('leave', { room: `user_${socket.auth?.userId}` });
        }
        socket.disconnect();
      } catch (error) {
        // Error cleaning up socket
      }
      setSocket(null);
      socketRef.current = null;
      return;
    }

    // Create new socket if user exists and no connected socket
    if (user && user.id && (!socket || !socket.connected)) {
      
      
      // Clean up existing disconnected socket
      if (socket && !socket.connected) {
        try {
          socket.disconnect();
              } catch (error) {
        // Error disconnecting old socket
      }
        setSocket(null);
        socketRef.current = null;
      }
      
      let newSocket = null; // Declare outside try block for cleanup access
      
      try {
        const socketUrl = import.meta.env.VITE_SOCKET_URL || window.location.origin;

        
        newSocket = io(socketUrl, {
          transports: ["polling", "websocket"], // Start with polling, upgrade to websocket
          reconnection: true,
          reconnectionAttempts: 5,
          reconnectionDelay: 1000,
          reconnectionDelayMax: 5000,
          timeout: 20000, // Increased timeout for better connection stability
          forceNew: false,
          upgrade: true,
          withCredentials: true,
          autoConnect: true,
          rememberUpgrade: true,
          maxHttpBufferSize: 1e6,
          pingTimeout: 60000, // Increased ping timeout
          pingInterval: 25000, // Increased ping interval
          extraHeaders: {
            'X-Requested-With': 'XMLHttpRequest'
          }
        });

        newSocket.on("connect", () => {
          try {
    
            newSocket.emit("join", { room: `user_${user.id}` });
                } catch (error) {
        // Failed to join user room on connect
      }
        });

        newSocket.on("disconnect", (reason) => {
  
        });

        newSocket.on("connect_error", (error) => {
          // Don't show error to user for socket connection issues
        });

        newSocket.on("reconnect", (attemptNumber) => {
  
          try {
            // Rejoin user room after reconnection
            newSocket.emit("join", { room: `user_${user.id}` });
          } catch (error) {
            // Failed to join user room on reconnect
          }
        });

        newSocket.on("reconnect_error", (error) => {
          // Socket reconnection error
        });

        newSocket.on("reconnect_failed", () => {
          // Socket reconnection failed
        });

        newSocket.on("error", (error) => {
          // Socket error
        });


        setSocket(newSocket);
        socketRef.current = newSocket; // Store in ref for cleanup
        
        // Log when socket becomes available

      } catch (error) {
        setSocket(null);
        socketRef.current = null;
        newSocket = null; // Ensure newSocket is null if creation fails
      }

      return () => {

        // Use ref to avoid stale closure issues
        const currentSocket = socketRef.current;
        if (currentSocket && typeof currentSocket.disconnect === 'function') {
          try {
            if (currentSocket.connected) {
              currentSocket.emit("leave", { room: `user_${user.id}` });
            }
            currentSocket.disconnect();

          } catch (error) {
            // Error cleaning up new socket
          }
        } else {
          
        }
      };
    } else {
      // No socket action needed
    }
  }, [user]);

  // Add global error handler for socket-related errors
  useEffect(() => {
    const handleGlobalError = (event) => {
      if (event.error && event.error.message && event.error.message.includes('socket is not defined')) {
        // Global socket error detected
      }
    };

    window.addEventListener('error', handleGlobalError);
    window.addEventListener('unhandledrejection', (event) => {
      if (event.reason && event.reason.message && event.reason.message.includes('socket is not defined')) {
        // Global socket promise rejection
      }
    });

    return () => {
      window.removeEventListener('error', handleGlobalError);
    };
  }, [socket, user]);

  function login(userInfo) {

    
    // Add a small delay to ensure backend session is established
    setTimeout(() => {
      localStorage.setItem("user", JSON.stringify(userInfo));
      setUser(userInfo);
      setIsAuthenticated(true);
      
      // Update user data silently without refetching
      queryClient.setQueryData(['user'], userInfo);
      
      // Only invalidate specific queries that don't contain user drafts
      // Avoid invalidating post creation, comment drafts, or form data
      queryClient.invalidateQueries({ 
        queryKey: ['threads'],
        exact: false 
      });
      queryClient.invalidateQueries({ 
        queryKey: ['subscriptions'],
        exact: false 
      });
      // DO NOT invalidate posts, comments, or form-related queries to preserve drafts
      

    }, 100);
  }
  async function logout({ redirect = false } = {}) {
    try {
      // Try to logout from server
      await axios.get("/api/user/logout");
    } catch (error) {
      // Continue with client-side cleanup even if server logout fails
    }

    // Clean up socket connection
    try {
      if (socket && socket.connected) {
        socket.emit('leave', { room: `user_${user.id}` });
        socket.disconnect();
      }
    } catch (error) {
      // Socket disconnect error
    }
    setSocket(null);
    socketRef.current = null; // Clean up ref as well

    // Clear all cookies more thoroughly
    try {
      // Get all cookies and clear them
      const cookies = document.cookie.split(";");

      for (let cookie of cookies) {
        const eqPos = cookie.indexOf("=");
        const name = eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim();

        // Clear cookie for current domain and path
        document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;`;
        document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=${window.location.hostname};`;
        document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=.${window.location.hostname};`;
      }

      // Specifically clear known session cookies
      const sessionCookies = ['yuuzone_session', 'session', 'connect.sid', 'JSESSIONID'];
      sessionCookies.forEach(cookieName => {
        document.cookie = `${cookieName}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;`;
        document.cookie = `${cookieName}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=${window.location.hostname};`;
        document.cookie = `${cookieName}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=.${window.location.hostname};`;
      });
    } catch (error) {
      // Cookie clearing error
    }

    // Clear localStorage and sessionStorage
    try {
      localStorage.clear();
      sessionStorage.clear();
      // Explicitly reset subscription management visibility
      localStorage.removeItem('hideManageSubscription');
    } catch (error) {
      // Storage clearing error
    }

    // Clear any cached data in memory
    try {
      // Reset axios default headers
      delete axios.defaults.headers.common['Authorization'];
      delete axios.defaults.headers.common['X-Requested-With'];
    } catch (error) {
      // Axios headers clearing error
    }

    // Clear custom theme
    themeManager.removeCustomTheme();
    setCustomTheme(null);

    // Update auth state immediately
    setUser({});
    setIsAuthenticated(false);

    // Invalidate all queries and clear cache
    try {
      // Only invalidate specific queries that don't contain user drafts
      // Avoid invalidating post creation, comment drafts, or form data
      queryClient.invalidateQueries({ 
        queryKey: ['user'],
        exact: true 
      });
      queryClient.invalidateQueries({ 
        queryKey: ['threads'],
        exact: false 
      });
      queryClient.invalidateQueries({ 
        queryKey: ['subscriptions'],
        exact: false 
      });
      // DO NOT invalidate posts, comments, or form-related queries to preserve drafts
      
      // Clear only specific caches that don't contain user input
      queryClient.removeQueries({ 
        queryKey: ['user'],
        exact: true 
      });
      queryClient.removeQueries({ 
        queryKey: ['threads'],
        exact: false 
      });
      queryClient.removeQueries({ 
        queryKey: ['subscriptions'],
        exact: false 
      });
      // DO NOT remove posts, comments, or form-related queries to preserve drafts
    } catch (error) {
      // Query cache clearing error
    }

    // Force a complete page reload to ensure all state is cleared
    if (redirect) {
      window.location.href = "/all";
    } else {
      // Small delay to ensure all cleanup is complete before potential navigation
      setTimeout(() => {
      }, 100);
    }
  }
  return <AuthContext.Provider value={{ 
    isAuthenticated, 
    isLoading,
    login, 
    logout, 
    user, 
    socket: socket && socket.connected ? socket : null, // Only provide socket when connected
    theme, 
    setTheme: updateTheme,
    customTheme,
    setCustomTheme: updateCustomTheme,
    switchToCustomTheme,
    switchToSystemTheme,
    updateUserData
  }}>{children}</AuthContext.Provider>;
}

export default function AuthConsumer() {
  const context = useContext(AuthContext);
  
  // Add safety check to ensure socket is available
  if (!context) {
    return {
      isAuthenticated: false,
      isLoading: false,
      login: () => {},
      logout: () => {},
      user: {},
      socket: null,
      theme: 'light',
      setTheme: () => {},
      customTheme: null,
      setCustomTheme: () => {},
      switchToCustomTheme: () => {},
      switchToSystemTheme: () => {},
      updateUserData: () => {}
    };
  }
  
  // Ensure socket is only provided when it's fully initialized
  const safeSocket = context.socket && context.socket.connected ? context.socket : null;
  
  // Debug logging for socket access
  if (context.socket && !context.socket.connected) {
    
  } else if (safeSocket) {
    
  }
  
  // Add additional safety check for socket access
  if (safeSocket && typeof safeSocket.on !== 'function') {
    return {
      ...context,
      socket: null
    };
  }
  
  return {
    ...context,
    socket: safeSocket
  };
}

export { AuthContext };
