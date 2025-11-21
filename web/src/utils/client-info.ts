/**
 * Simple client info parser (lightweight, can be disabled if performance is a concern)
 */
export const getClientInfo = (): string | null => {
  if (typeof navigator === "undefined") {
    return null;
  }

  const ua = navigator.userAgent.toLowerCase();
  
  // Simple browser detection
  if (ua.includes("chrome") && !ua.includes("edg")) {
    return "Chrome";
  } else if (ua.includes("safari") && !ua.includes("chrome")) {
    return "Safari";
  } else if (ua.includes("firefox")) {
    return "Firefox";
  } else if (ua.includes("edg")) {
    return "Edge";
  }
  
  return null;
};

