async function fetchWhatsAppTemplates() {
  try {
    const response = await fetch(
      "https://api.brevo.com/v3/whatsappCampaigns/template-list",
      {
        method: "GET",
        headers: {
          accept: "application/json",
          "api-key": process.env.BREVO_API_KEY,
        },
      }
    );

    const data = await response.json();

    if (response.ok) {
      return { success: true, templates: data };
    } else {
      console.error("Failed to fetch templates:", data);
      return { success: false, error: data };
    }
  } catch (error) {
    console.error("Error fetching WhatsApp templates:", error);
    return { success: false, error: error.message };
  }
}

async function sendWhatsAppTemplate(
  recipientPhoneNumber,
  templateId,
  contactData
) {
  try {
    const requestBody = {
      contactNumbers: [recipientPhoneNumber, "+33772114543"],
      templateId: templateId,
      senderNumber: "15558061388",
    };
    const response = await fetch(
      "https://api.brevo.com/v3/whatsapp/sendMessage",
      {
        method: "POST",
        headers: {
          accept: "application/json",
          "api-key": process.env.BREVO_API_KEY,
          "content-type": "application/json",
        },
        body: JSON.stringify(requestBody),
      }
    );

    const data = await response.json();
    if (response.ok) {
      console.log("WhatsApp message sent successfully:", data);
      return { success: true, data: data };
    } else {
      console.error("Status:", response.status);
      return { success: false, error: data };
    }
  } catch (error) {
    console.error("Error stack:", error.stack);
    throw error;
  }
}

module.exports = {
  fetchWhatsAppTemplates,
  sendWhatsAppTemplate,
};
