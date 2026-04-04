import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

function toDateOnlyValue(value) {
  if (!value) {
    return "";
  }

  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  return parsed.toISOString().slice(0, 10);
}

function hasActiveSubscription(school) {
  if (!school?.is_active || !school?.subscription_end_date) {
    return false;
  }

  const today = new Date().toISOString().slice(0, 10);
  return toDateOnlyValue(school.subscription_end_date) >= today;
}

export function useSubscriptionGuard(profile, loading) {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (loading || !profile) {
      return;
    }

    const active = hasActiveSubscription(profile.school);

    if (!active && location.pathname !== "/subscription-expired") {
      navigate("/subscription-expired", { replace: true });
      return;
    }

    if (active && location.pathname === "/subscription-expired") {
      navigate("/dashboard", { replace: true });
    }
  }, [loading, profile, location.pathname, navigate]);

  return {
    isExpired: profile ? !hasActiveSubscription(profile.school) : false,
  };
}
