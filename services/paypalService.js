/**
 * Dummy PayPal Service
 * Replace this with actual @paypal/checkout-server-sdk or raw REST API calls.
 */

class PaypalService {
  constructor() {
    this.clientId = process.env.PAYPAL_CLIENT_ID;
    this.clientSecret = process.env.PAYPAL_CLIENT_SECRET;
    this.isDummy = !this.clientId || !this.clientSecret;
    this.baseUrl = 'https://api-m.sandbox.paypal.com';
  }

  isConfigured() {
    return true; // We allow dummy testing
  }

  async getAccessToken() {
    const auth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
    const response = await fetch(`${this.baseUrl}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: 'grant_type=client_credentials'
    });
    
    if (!response.ok) {
      const error = await response.text();
      console.error('[PayPal] Access Token Error:', error);
      throw new Error('Failed to generate PayPal access token');
    }
    
    const data = await response.json();
    return data.access_token;
  }

  async createOrder({ booking, planKey, amount, returnUrl, cancelUrl }) {
    console.log('[PayPal] Creating order for:', { booking, planKey, amount });
    
    if (this.isDummy) {
      const dummyOrderId = `PAYPAL_ORDER_${Date.now()}`;
      return {
        id: dummyOrderId,
        status: 'CREATED',
        links: [
          {
            rel: 'approve',
            href: `https://www.sandbox.paypal.com/checkoutnow?token=${dummyOrderId}`
          }
        ]
      };
    }

    const accessToken = await this.getAccessToken();
    const response = await fetch(`${this.baseUrl}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [
          {
            amount: {
              currency_code: 'USD',
              value: (amount / 100).toFixed(2)
            },
            description: `Subscription: ${planKey}`
          }
        ],
        application_context: {
          return_url: returnUrl,
          cancel_url: cancelUrl,
          user_action: 'PAY_NOW',
          shipping_preference: 'NO_SHIPPING'
        }
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[PayPal] Create Order Error:', error);
      throw new Error('Failed to create PayPal order');
    }

    return response.json();
  }

  async captureOrder(orderId) {
    console.log('[PayPal] Capturing order:', orderId);
    
    if (this.isDummy) {
      return {
        id: orderId,
        status: 'COMPLETED',
        payer: {
          email_address: 'test-buyer@paypal.com'
        }
      };
    }

    const accessToken = await this.getAccessToken();
    const response = await fetch(`${this.baseUrl}/v2/checkout/orders/${orderId}/capture`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[PayPal] Capture Order Error:', error);
      throw new Error('Failed to capture PayPal order: ' + error);
    }

    return response.json();
  }
}

module.exports = new PaypalService();
