require('dotenv').config();

const isConfigured = () => {
    return !!process.env.CASHFREE_APP_ID && !!process.env.CASHFREE_SECRET_KEY;
};

const getBaseUrl = () => {
    // If CASHFREE_ENV is 'PRODUCTION', use prod URL, otherwise sandbox
    if (process.env.CASHFREE_ENV === 'PRODUCTION') {
        return 'https://api.cashfree.com/pg';
    }
    return 'https://sandbox.cashfree.com/pg';
};

const getHeaders = () => {
    const appId = (process.env.CASHFREE_APP_ID || '').trim();
    const secretKey = (process.env.CASHFREE_SECRET_KEY || '').trim();
    return {
        'x-client-id': appId,
        'x-client-secret': secretKey,
        'x-api-version': '2023-08-01',
        'Content-Type': 'application/json'
    };
};

const createOrder = async (orderId, amount, customerDetails = {}, returnUrl, currency = "INR") => {
    if (!isConfigured()) throw new Error("Cashfree is not configured");

    // Clean and validate phone number (must be 10 digits)
    let rawPhone = String(customerDetails.phone || '').replace(/\D/g, '');
    if (rawPhone.length > 10) rawPhone = rawPhone.slice(-10);
    if (rawPhone.length !== 10) rawPhone = '9876543210';

    // Clean and validate customer ID
    let rawCustId = String(customerDetails.id || `CUST_${Date.now()}`).replace(/[^a-zA-Z0-9_-]/g, '_');
    if (!rawCustId) rawCustId = `CUST_${Date.now()}`;

    // Clean and validate amount (ensure integer or float > 0)
    let numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) numAmount = 100;

    const requestPayload = {
        order_id: String(orderId),
        order_amount: numAmount,
        order_currency: currency.toUpperCase(),
        customer_details: {
            customer_id: rawCustId,
            customer_name: customerDetails.name || "Customer",
            customer_email: customerDetails.email || "customer@example.com",
            customer_phone: rawPhone
        },
        order_meta: {
            return_url: returnUrl || `${process.env.FRONTEND_URL || 'http://localhost:5173'}/payment-status?order_id={order_id}`
        }
    };

    const url = `${getBaseUrl()}/orders`;
    console.log('[cashfreeService] Creating order at:', url, 'with payload:', JSON.stringify(requestPayload));

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(requestPayload)
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('[cashfreeService] API error response:', data);
            throw new Error(data.message || 'Failed to create Cashfree order');
        }

        console.log('[cashfreeService] Order created successfully:', data.order_id, 'payment_session_id:', data.payment_session_id ? 'present' : 'missing');
        return data;
    } catch (error) {
        console.error('[cashfreeService] createOrder exception:', error.message);
        throw error;
    }
};

const getOrder = async (orderId) => {
    if (!isConfigured()) throw new Error("Cashfree is not configured");

    const url = `${getBaseUrl()}/orders/${orderId}`;
    console.log('[cashfreeService] Fetching order from:', url);

    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: getHeaders()
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('[cashfreeService] API getOrder error response:', data);
            throw new Error(data.message || 'Failed to fetch Cashfree order');
        }

        return data;
    } catch (error) {
        console.error('[cashfreeService] getOrder exception:', error.message);
        throw error;
    }
};

module.exports = {
    isConfigured,
    createOrder,
    getOrder
};
