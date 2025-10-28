const nodemailer = require('nodemailer');

let transporter = null;

function initializeEmailService() {
  if (transporter) {
    return transporter;
  }

  // Using Gmail SMTP service
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    },
  });

  return transporter;
}

async function sendBookingNotificationEmail(bookingDetails) {
  try {
    const mailer = initializeEmailService();

    // Get admin emails from environment variable
    const adminEmails = process.env.ADMIN_EMAILS?.split(',').map((e) => e.trim()) || [];

    if (!adminEmails.length) {
      console.warn('No admin emails configured in ADMIN_EMAILS');
      return;
    }

    // Format the booking details for email
    const emailContent = `
      <h2>New Booking Received</h2>
      <p><strong>Ground:</strong> ${bookingDetails.groundName}</p>
      <p><strong>Location:</strong> ${bookingDetails.location}, ${bookingDetails.city}</p>
      <p><strong>Date:</strong> ${bookingDetails.date}</p>
      <p><strong>Time Slot:</strong> ${bookingDetails.slot}</p>
      <p><strong>Customer Name:</strong> ${bookingDetails.customerName}</p>
      <p><strong>Customer Phone:</strong> ${bookingDetails.customerPhone}</p>
      <p><strong>Price:</strong> Rs. ${bookingDetails.priceAtBooking}</p>
      <p><strong>Booking ID:</strong> ${bookingDetails.bookingId}</p>
      <hr />
      <p><small>This is an automated email. Do not reply to this message.</small></p>
    `;

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: adminEmails.join(','),
      subject: `New Booking: ${bookingDetails.groundName} - ${bookingDetails.date} ${bookingDetails.slot}`,
      html: emailContent,
    };

    const result = await mailer.sendMail(mailOptions);
    console.log(`✅ Booking notification email sent successfully for booking ID: ${bookingDetails.bookingId}`);
    console.log(`📧 Email sent to: ${adminEmails.join(', ')}`);
    console.log(`📮 Message ID: ${result.messageId}`);
  } catch (error) {
    console.error('Error sending booking notification email:', error);
    // Don't throw - we don't want email failures to block the booking
  }
}

async function sendCancellationNotificationEmail(bookingDetails) {
  try {
    const mailer = initializeEmailService();

    const adminEmails = process.env.ADMIN_EMAILS?.split(',').map((e) => e.trim()) || [];

    if (!adminEmails.length) {
      console.warn('No admin emails configured in ADMIN_EMAILS');
      return;
    }

    const emailContent = `
      <h2>Booking Cancelled</h2>
      <p><strong>Ground:</strong> ${bookingDetails.groundName}</p>
      <p><strong>Location:</strong> ${bookingDetails.location}, ${bookingDetails.city}</p>
      <p><strong>Date:</strong> ${bookingDetails.date}</p>
      <p><strong>Time Slot:</strong> ${bookingDetails.slot}</p>
      <p><strong>Customer Name:</strong> ${bookingDetails.customerName}</p>
      <p><strong>Customer Phone:</strong> ${bookingDetails.customerPhone}</p>
      <p><strong>Booking ID:</strong> ${bookingDetails.bookingId}</p>
      <hr />
      <p><small>This is an automated email. Do not reply to this message.</small></p>
    `;

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: adminEmails.join(','),
      subject: `Booking Cancelled: ${bookingDetails.groundName} - ${bookingDetails.date} ${bookingDetails.slot}`,
      html: emailContent,
    };

    const result = await mailer.sendMail(mailOptions);
    console.log(
      `✅ Booking cancellation email sent to admins for booking ID: ${bookingDetails.bookingId}`
    );
    console.log(`📧 Email sent to: ${adminEmails.join(', ')}`);
    console.log(`📮 Message ID: ${result.messageId}`);
  } catch (error) {
    console.error('Error sending cancellation notification email:', error);
  }
}

module.exports = {
  sendBookingNotificationEmail,
  sendCancellationNotificationEmail,
};
