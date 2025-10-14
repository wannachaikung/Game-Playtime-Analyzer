const axios = require('axios');

/**
 * Sends a notification to a Discord webhook URL.
 * @param {string} webhookUrl The Discord webhook URL.
 * @param {string} message The message content to send.
 * @returns {Promise<void>}
 */
async function sendDiscordWebhook(webhookUrl, message) {
  if (!webhookUrl) {
    const errorMsg = 'No Discord Webhook URL provided.';
    console.error(`Error: ${errorMsg}`);
    return Promise.reject(new Error(errorMsg));
  }

  try {
    // Discord webhooks expect a JSON payload with a 'content' field.
    await axios.post(webhookUrl, { content: message });
    console.log('Successfully sent message via Discord webhook.');
  } catch (error) {
    console.error(`Failed to send message via webhook: ${error.response ? JSON.stringify(error.response.data) : error.message}`);
    // Re-throw a simpler error to avoid leaking too much detail.
    throw new Error('Failed to send message via webhook.');
  }
}

module.exports = { sendDiscordWebhook };
