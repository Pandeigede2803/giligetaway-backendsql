// util/emailSender.js
const nodemailer = require("nodemailer");

/**
 * Kirim email menggunakan Brevo SMTP
 * @param {Object} options
 * @param {string} options.to - Alamat email tujuan
 * @param {string} options.subject - Subjek email
 * @param {string} options.html - Konten HTML email
 * @param {string} [options.cc] - Email CC opsional
 */
const sendEmail = async ({ to, subject, html, cc }) => {
  try {
    // ✅ Buat transporter SMTP Brevo
    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST_BREVO, // contoh: smtp-relay.brevo.com
      port: 587, // gunakan 465 jika secure: true
      secure: false,
      auth: {
        user: process.env.EMAIL_LOGIN_BREVO,
        pass: process.env.EMAIL_PASS_BREVO,
      },
    });


//     EMAIL_NOREPLY=noreply@giligetaway.com
// EMAIL_PASS_NOREPLY=Getaway-1234

    // ✅ Setup email options
    const mailOptions = {
      from: process.env.EMAIL_NOREPLY, // nama pengirim
      to, // penerima utama
      // cc: cc || process.env.EMAIL_BOOKING, // optional, default cc ke booking
      subject,
      html,
    };

    // ✅ Kirim email
    const info = await transporter.sendMail(mailOptions);

    console.log(
      `📧 Email sent → ${to} | Subject: "${subject}" | MessageId: ${info.messageId}`
    );
    return info;
  } catch (error) {
    console.error("❌ Error sending email:", error.message);
    throw new Error(`Email gagal dikirim ke ${to}: ${error.message}`);
  }
};

module.exports = { sendEmail };