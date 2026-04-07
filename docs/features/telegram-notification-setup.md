# Telegram Error Notification Setup Guide

## Overview

The system now sends real-time error notifications to Telegram when critical errors occur in the cron job for expired bookings. This helps catch issues immediately before they cascade into bigger problems.

---

## Setup Steps

### 1. Create a Telegram Bot

1. Open Telegram and search for `@BotFather`
2. Send `/newbot` command
3. Follow the instructions to create your bot
4. You'll receive a **Bot Token** like: `1234567890:ABCdefGHIjklMNOpqrsTUVwxyz`
5. Copy and save this token

### 2. Get Your Chat ID

**Option A: Using @userinfobot**
1. Search for `@userinfobot` in Telegram
2. Send any message to it
3. It will reply with your user info including your **Chat ID**

**Option B: Using @RawDataBot**
1. Search for `@RawDataBot` in Telegram
2. Send any message to it
3. Look for `"id":` in the response - that's your **Chat ID**

**Option C: For Group Chats**
1. Add your bot to the group
2. Send a message in the group
3. Visit: `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates`
4. Look for `"chat":{"id":` - that's your **Group Chat ID** (usually starts with `-`)

### 3. Add to Environment Variables

Add these to your `.env` file:

```bash
# Telegram Bot Configuration
TELEGRAM_BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz
TELEGRAM_CHAT_ID=123456789
```

**Notes:**
- Replace `TELEGRAM_BOT_TOKEN` with your actual bot token
- Replace `TELEGRAM_CHAT_ID` with your actual chat ID
- For group chats, the ID usually starts with `-` (e.g., `-987654321`)

### 4. Start a Conversation with Your Bot

**Important:** Before your bot can send you messages, you must start a conversation:

1. Search for your bot in Telegram (use the username you gave it)
2. Click **START** or send `/start`
3. Your bot can now send you messages

For group chats:
1. Add the bot to your group
2. Make sure the bot has permission to send messages

### 5. Test the Integration

Create a test script to verify it works:

```javascript
// test-telegram.js
require('dotenv').config();
const { sendTelegramMessage } = require('./util/telegram');

(async () => {
  try {
    await sendTelegramMessage(`
🧪 <b>Test Notification</b>

This is a test message from Gili Getaway Backend.

<b>Time:</b> ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Makassar' })}

✅ Telegram integration is working!
    `.trim());

    console.log('✅ Test message sent successfully!');
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
})();
```

Run it:
```bash
node test-telegram.js
```

You should receive a message from your bot!

---

## Notification Types

### 1. Booking-Level Errors

Sent when a specific booking fails to process:

```
🚨 CRONJOB ERROR - Expired Booking Processing

Booking ID: 15770
Ticket ID: GG-OW-15770
Contact: user@example.com
Schedule ID: 59
SubSchedule ID: 110
Passengers: 2

Error: Cannot read properties of undefined (reading 'length')

Time: 3/11/2025, 14:30:00

⚠️ Seats may not have been released. Manual check required.
```

**Action Required:**
- Check the specific booking in the database
- Verify if seats were released
- Manually process if needed

### 2. Fatal Errors

Sent when the entire cron job fails:

```
🔥 CRONJOB FATAL ERROR - handleExpiredBookings

Error Type: TypeError
Error Message: Cannot read properties of undefined (reading 'length')

Stack Trace:
at /Users/.../util/cronJobs.js:196:62
at process.processTicksAndRejections...

Time: 3/11/2025, 14:30:00

🚨 Critical: Entire expired bookings process failed!
```

**Action Required:**
- Immediate investigation needed
- Check server logs for more details
- Fix the underlying issue
- Restart the service if necessary

---

## Troubleshooting

### Error: "Failed to send Telegram message"

**Possible causes:**

1. **Invalid Bot Token**
   - Verify your `TELEGRAM_BOT_TOKEN` is correct
   - Check for extra spaces or newlines

2. **Invalid Chat ID**
   - Verify your `TELEGRAM_CHAT_ID` is correct
   - For groups, make sure it includes the `-` prefix

3. **Bot Not Started**
   - You must send `/start` to your bot first
   - For groups, add the bot and ensure it has permissions

4. **Network Issues**
   - Check if the server can reach `api.telegram.org`
   - Verify firewall settings

### No Notifications Received

1. **Check Environment Variables**
   ```bash
   # In your server
   echo $TELEGRAM_BOT_TOKEN
   echo $TELEGRAM_CHAT_ID
   ```

2. **Check Logs**
   - Look for "Failed to send Telegram message" in logs
   - Look for the warning "Telegram token / chat-id missing"

3. **Test Manually**
   - Use the test script above to verify connectivity

4. **Bot Blocked**
   - Make sure you haven't blocked the bot
   - Check bot settings in Telegram

---

## Security Best Practices

1. **Keep Your Token Secret**
   - Never commit `.env` file to git
   - Use `.gitignore` to exclude `.env`
   - Rotate tokens if exposed

2. **Restrict Bot Access**
   - Only add the bot to necessary chats
   - Use a private group for error notifications
   - Limit who can access the group

3. **Monitor Token Usage**
   - Regularly check bot activity in BotFather
   - Revoke and recreate tokens if suspicious activity detected

---

## Advanced Configuration

### Using Multiple Chat IDs

To send notifications to multiple recipients:

**Option 1: Group Chat (Recommended)**
- Create a dedicated group for errors
- Add all team members
- Add the bot to the group
- Use the group's chat ID

**Option 2: Multiple Individual Chats**
Modify `util/telegram.js`:

```javascript
const CHAT_IDS = process.env.TELEGRAM_CHAT_IDS?.split(',') || [];

exports.sendTelegramMessage = async (text) => {
  if (!TOKEN || CHAT_IDS.length === 0) {
    console.warn('🔔 Telegram token / chat-ids missing – skipping send');
    return;
  }

  for (const chatId of CHAT_IDS) {
    try {
      await axios.post(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
        chat_id: chatId.trim(),
        text,
        parse_mode: 'HTML',
      });
    } catch (err) {
      console.error(`❌ Failed to send to ${chatId}:`, err.message);
    }
  }
};
```

Then in `.env`:
```bash
TELEGRAM_CHAT_IDS=123456789,987654321,-111222333
```

### Custom Notification Formatting

The notifications use HTML formatting. Available tags:

- `<b>text</b>` - **Bold**
- `<i>text</i>` - *Italic*
- `<code>text</code>` - `Monospace`
- `<pre>text</pre>` - Preformatted
- `<a href="url">text</a>` - Link

Example:
```javascript
const message = `
🚨 <b>Error Alert</b>

<i>Something went wrong</i>

<code>${error.message}</code>

<a href="https://yourapp.com/admin">Check Admin Panel</a>
`;
```

---

## Monitoring

### Daily Summary (Optional)

You can add a daily summary notification:

```javascript
// In cronJobs.js
const sendDailySummary = async () => {
  const today = new Date().toISOString().split('T')[0];

  const processedCount = await Booking.count({
    where: {
      payment_status: 'expired',
      updated_at: {
        [Op.gte]: new Date(today),
      },
    },
  });

  const message = `
📊 <b>Daily Expired Bookings Summary</b>

<b>Date:</b> ${new Date().toLocaleDateString('id-ID')}
<b>Total Processed:</b> ${processedCount}

✅ All bookings processed successfully
  `.trim();

  await sendTelegramMessage(message);
};

// Schedule daily at 11:59 PM
cron.schedule('59 23 * * *', async () => {
  await sendDailySummary();
});
```

---

## References

- [Telegram Bot API Documentation](https://core.telegram.org/bots/api)
- [BotFather Commands](https://core.telegram.org/bots#6-botfather)
- [HTML Formatting in Telegram](https://core.telegram.org/bots/api#html-style)
