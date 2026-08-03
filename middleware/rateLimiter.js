// Simple memory-based rate limiter middleware to prevent exceeding API usage limits on button clicks/requests.
const requestCounts = new Map();

// Default: Max 100 requests per minute per IP address
const apiRateLimiter = ({ windowMs = 60 * 1000, maxRequests = 100 } = {}) => {
  return (req, res, next) => {
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    const now = Date.now();

    if (!requestCounts.has(ip)) {
      requestCounts.set(ip, []);
    }

    const timestamps = requestCounts.get(ip).filter((t) => now - t < windowMs);
    timestamps.push(now);
    requestCounts.set(ip, timestamps);

    if (timestamps.length > maxRequests) {
      return res.status(429).json({
        message: 'Too many requests. Please slow down to prevent exceeding API limits.'
      });
    }

    next();
  };
};

module.exports = { apiRateLimiter };
