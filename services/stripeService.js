const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

class StripeService {
  // Create or get Stripe customer
  async createOrGetCustomer(user) {
    try {
      // Check if customer already exists
      const customers = await stripe.customers.list({
        email: user.email,
        limit: 1,
      });

      if (customers.data.length > 0) {
        return customers.data[0];
      }

      // Create new customer
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.username,
        metadata: {
          userId: user._id.toString(),
        },
      });

      return customer;
    } catch (error) {
      throw new Error(`Stripe customer creation failed: ${error.message}`);
    }
  }

  // Create payment intent for one-time payment
  async createPaymentIntent(
    amount,
    currency = "usd",
    customerId,
    metadata = {}
  ) {
    try {
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Convert to cents
        currency,
        customer: customerId,
        metadata,
        automatic_payment_methods: {
          enabled: true,
        },
      });

      return paymentIntent;
    } catch (error) {
      throw new Error(`Payment intent creation failed: ${error.message}`);
    }
  }

  // Create subscription for recurring payments
  async createSubscription(customerId, priceData, metadata = {}) {
    try {
      // Create a price for the subscription
      const price = await stripe.prices.create({
        unit_amount: Math.round(priceData.amount * 100),
        currency: priceData.currency || "usd",
        recurring: {
          interval: priceData.interval, // 'month', 'year', etc.
        },
        product_data: {
          name: priceData.productName,
          description: priceData.description,
        },
      });

      // Create the subscription
      const subscription = await stripe.subscriptions.create({
        customer: customerId,
        items: [
          {
            price: price.id,
          },
        ],
        payment_behavior: "default_incomplete",
        payment_settings: { save_default_payment_method: "on_subscription" },
        expand: ["latest_invoice.payment_intent"],
        metadata,
      });

      return {
        subscription,
        clientSecret: subscription.latest_invoice.payment_intent.client_secret,
      };
    } catch (error) {
      throw new Error(`Subscription creation failed: ${error.message}`);
    }
  }

  // Add payment method to customer
  async attachPaymentMethod(paymentMethodId, customerId) {
    try {
      await stripe.paymentMethods.attach(paymentMethodId, {
        customer: customerId,
      });

      const paymentMethod = await stripe.paymentMethods.retrieve(
        paymentMethodId
      );
      return paymentMethod;
    } catch (error) {
      throw new Error(`Payment method attachment failed: ${error.message}`);
    }
  }

  // Get customer's payment methods
  async getCustomerPaymentMethods(customerId) {
    try {
      const paymentMethods = await stripe.paymentMethods.list({
        customer: customerId,
        type: "card",
      });

      return paymentMethods.data;
    } catch (error) {
      throw new Error(`Failed to retrieve payment methods: ${error.message}`);
    }
  }

  // Set default payment method
  async setDefaultPaymentMethod(customerId, paymentMethodId) {
    try {
      const customer = await stripe.customers.update(customerId, {
        invoice_settings: {
          default_payment_method: paymentMethodId,
        },
      });

      return customer;
    } catch (error) {
      throw new Error(
        `Setting default payment method failed: ${error.message}`
      );
    }
  }

  // Cancel subscription
  async cancelSubscription(subscriptionId) {
    try {
      const subscription = await stripe.subscriptions.cancel(subscriptionId);
      return subscription;
    } catch (error) {
      throw new Error(`Subscription cancellation failed: ${error.message}`);
    }
  }

  // Retrieve payment intent
  async retrievePaymentIntent(paymentIntentId) {
    try {
      const paymentIntent = await stripe.paymentIntents.retrieve(
        paymentIntentId
      );
      return paymentIntent;
    } catch (error) {
      throw new Error(`Failed to retrieve payment intent: ${error.message}`);
    }
  }

  // Create refund
  async createRefund(paymentIntentId, amount = null) {
    try {
      const refundData = { payment_intent: paymentIntentId };
      if (amount) {
        refundData.amount = Math.round(amount * 100);
      }

      const refund = await stripe.refunds.create(refundData);
      return refund;
    } catch (error) {
      throw new Error(`Refund creation failed: ${error.message}`);
    }
  }
}

module.exports = new StripeService();
