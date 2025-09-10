import PropTypes from "prop-types";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import AuthConsumer from "./AuthContext";

BanMessage.propTypes = {
  threadId: PropTypes.number.isRequired,
  children: PropTypes.node,
};

export default function BanMessage({ threadId, children }) {
  const { user, isAuthenticated } = AuthConsumer();
  const navigate = useNavigate();

  // Check ban status for current user
  const { data: banStatus, isLoading } = useQuery({
    queryKey: ["ban-status", threadId, user?.username],
    queryFn: async () => {
      if (!isAuthenticated || !user?.username) return { banned: false };
      try {
        const response = await axios.get(`/api/thread/${threadId}/ban-status/${user.username}`);
        return response.data;
      } catch {
        // If error, assume not banned
        return { banned: false };
      }
    },
    enabled: isAuthenticated && !!user?.username && !!threadId,
  });

  // If loading, show children (don't block)
  if (isLoading) {
    return children;
  }

  // If user is banned, redirect to banned page
  if (banStatus?.banned) {
    navigate(`/banned/${threadId}`);
    return null;
  }

  // If not banned, show children
  return children;
}
