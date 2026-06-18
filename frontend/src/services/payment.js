/**
 * Dynamically loads the Razorpay checkout script
 */
export const loadRazorpayScript = () => {
  return new Promise((resolve) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => {
      resolve(true);
    };
    script.onerror = () => {
      resolve(false);
    };
    document.body.appendChild(script);
  });
};

/**
 * Initiates a Razorpay payment gateway checkout modal
 */
export const payWithRazorpay = async ({ amount, orderId, keyId, onSuccess, onFailure }) => {
  const isLoaded = await loadRazorpayScript();
  if (!isLoaded) {
    if (onFailure) {
      onFailure(new Error("Razorpay SDK failed to load. Please check your internet connection."));
    } else {
      alert("Razorpay checkout script failed to load.");
    }
    return;
  }

  const options = {
    key: keyId,
    amount: amount, // expected in paise (1 INR = 100 paise)
    currency: "INR",
    name: "Red Velvet Bistro",
    description: "Food QR Order Checkout",
    order_id: orderId,
    handler: function (response) {
      if (onSuccess) {
        onSuccess({
          razorpay_payment_id: response.razorpay_payment_id,
          razorpay_order_id: response.razorpay_order_id,
          razorpay_signature: response.razorpay_signature,
        });
      }
    },
    modal: {
      ondismiss: function () {
        if (onFailure) {
          onFailure(new Error("Payment window closed."));
        }
      }
    },
    prefill: {
      contact: "",
    },
    theme: {
      color: "#dc2626", // Crimson/red accent
    },
  };

  try {
    const paymentObject = new window.Razorpay(options);
    paymentObject.open();
  } catch (error) {
    if (onFailure) {
      onFailure(error);
    }
  }
};
