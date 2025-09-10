import { useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import axios from "axios";
import AuthConsumer from "../../components/AuthContext";
import { Loader } from "../../components/Loader";
import Error from "../../components/Error";

export default function BannedPage() {
  const { threadId } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated } = AuthConsumer();
  const { t } = useTranslation();

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/login");
    }
  }, [isAuthenticated, navigate]);

  // Fetch ban information
  const { data: banInfo, isLoading, error } = useQuery({
    queryKey: ["ban-info", threadId],
    queryFn: async () => {
      const response = await axios.get(`/api/thread/${threadId}/banned`);
      return response.data;
    },
    enabled: isAuthenticated && !!threadId,
    retry: false,
  });

  // Set page title
  useEffect(() => {
    document.title = t('banned.pageTitle');
    return () => {
      document.title = "YuuZone";
    };
  }, [t]);

  if (!isAuthenticated) {
    return null; // Will redirect to login
  }

  if (isLoading) {
    return <Loader />;
  }

  if (error) {
    // If user is not banned, redirect to home
    if (error.response?.status === 404) {
      navigate('/');
      return null;
    }
    return <Error message={t('banned.failedToLoadBanInfo')} />;
  }

  if (!banInfo?.banned) {
    // User is not banned, redirect to home
    navigate('/');
    return null;
  }

  const formatDate = (dateString) => {
    if (!dateString) return t('banned.unknown');
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-theme-light-gray2 p-4">
      <div className="max-w-md w-full">
        <div className="bg-theme-bg-primary rounded-lg shadow-lg border border-theme-error-border p-8 text-center">
          {/* Oops Header */}
          <div className="text-theme-error text-6xl mb-4">🚫</div>
          <h1 className="text-3xl font-bold text-theme-error mb-6">{t('banned.oops')}</h1>

          {/* Ban Message */}
          <div className="space-y-4 text-left">
            <p className="text-theme-text-primary">
              {t('banned.bannedFromSubthread', {
                subthread: banInfo.subthread_name,
                bannedBy: banInfo.banned_by,
                date: formatDate(banInfo.banned_at)
              })}
            </p>

            <div className="bg-theme-error-light border border-theme-error-border rounded-lg p-4">
              <p className="text-sm font-semibold text-theme-error mb-2">{t('banned.reason')}</p>
              <p className="text-theme-error">{banInfo.reason}</p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-8">
            <Link
              to="/"
              className="block w-full bg-theme-blue text-white py-2 px-4 rounded-lg hover:bg-theme-button-primary-hover transition-colors"
            >
              {t('banned.goToHomeFeed')}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
