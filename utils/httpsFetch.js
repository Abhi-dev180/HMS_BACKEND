const https = require('https');

/**
 * Lightweight, IPv4-safe fetch wrapper for Google APIs and external HTTPS requests on Windows
 * Prevents IPv6 connection timeouts (UND_ERR_CONNECT_TIMEOUT) when IPv6 transit is unavailable
 */
function httpsFetch(urlStr, options = {}) {
  return new Promise((resolve, reject) => {
    try {
      const url = new URL(urlStr);
      const method = (options.method || 'GET').toUpperCase();
      const headers = { ...(options.headers || {}) };
      let body = options.body;

      if (body && typeof body === 'object' && !(body instanceof Buffer) && !(body instanceof URLSearchParams)) {
        body = JSON.stringify(body);
        if (!headers['Content-Type']) headers['Content-Type'] = 'application/json';
      } else if (body instanceof URLSearchParams) {
        body = body.toString();
        if (!headers['Content-Type']) headers['Content-Type'] = 'application/x-www-form-urlencoded';
      }

      if (body && !headers['Content-Length']) {
        headers['Content-Length'] = Buffer.byteLength(body);
      }

      const req = https.request(
        {
          hostname: url.hostname,
          port: url.port || 443,
          path: url.pathname + url.search,
          method,
          headers,
          family: 4, // Force IPv4 to prevent IPv6 connect timeouts on Windows/ISPs
          timeout: options.timeout || 12000
        },
        (res) => {
          const chunks = [];
          res.on('data', (chunk) => chunks.push(chunk));
          res.on('end', () => {
            const buffer = Buffer.concat(chunks);
            const text = buffer.toString('utf8');
            resolve({
              ok: res.statusCode >= 200 && res.statusCode < 300,
              status: res.statusCode,
              statusText: res.statusMessage || '',
              headers: res.headers,
              text: async () => text,
              json: async () => {
                try {
                  return JSON.parse(text);
                } catch {
                  return {};
                }
              },
              buffer: async () => buffer
            });
          });
        }
      );

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('HTTPS connection timed out'));
      });

      req.on('error', (err) => {
        reject(err);
      });

      if (body) {
        req.write(body);
      }
      req.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { httpsFetch };
