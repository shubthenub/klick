import { useEffect } from "react";

export default function silentRefresh(callback) {
  useEffect(() => {
    let timeout= null;

    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === "visible") {
        // Clear any existing timeout to avoid overlap
        if (timeout) clearTimeout(timeout);

        timeout = window.setTimeout(() => {
          callback(); // Trigger your silent reload logic
        }, 5000); // You can adjust this delay
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityOrFocus);
    window.addEventListener("focus", handleVisibilityOrFocus);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityOrFocus);
      window.removeEventListener("focus", handleVisibilityOrFocus);
      if (timeout) clearTimeout(timeout);
    };
  }, [callback]);
}
