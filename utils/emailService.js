const nodemailer = require('nodemailer');

// Create a transporter object
const createTransporter = () => {
  // For development, using Ethereal for testing
  if (process.env.NODE_ENV !== 'production') {
    return nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: process.env.EMAIL_USER || 'ethereal.user@ethereal.email',
        pass: process.env.EMAIL_PASS || 'ethereal_password'
      }
    });
  }
  
  // For production environment
  return nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE || 'Gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });
};

/**
 * Send a subscription confirmation email
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email
 * @param {string} options.name - Recipient name (optional)
 * @param {string} options.token - Confirmation token
 */
exports.sendSubscriptionConfirmation = async (options) => {
  try {
    const transporter = createTransporter();
    
    const mailOptions = {
      from: `"Khelkud Nepal" <${process.env.EMAIL_USER || 'no-reply@khelkudnepal.com'}>`,
      to: options.to,
      subject: 'Confirm Your Subscription to Khelkud Nepal',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 20px;">
            <img src="https://via.placeholder.com/150x50?text=Khelkud+Nepal" alt="Khelkud Nepal" style="max-width: 100%;">
          </div>
          <h2 style="color: #333;">Hello ${options.name || 'Sports Fan'}!</h2>
          <p>Thank you for subscribing to Khelkud Nepal. We're excited to keep you updated with the latest sports news.</p>
          <p>Please confirm your subscription by clicking the button below:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.BASE_URL || 'http://localhost:3000'}/api/subscriptions/confirm/${options.token}" 
               style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">
              Confirm Subscription
            </a>
          </div>
          <p>If the button doesn't work, copy and paste this link into your browser:</p>
          <p><a href="${process.env.BASE_URL || 'http://localhost:3000'}/api/subscriptions/confirm/${options.token}">
            ${process.env.BASE_URL || 'http://localhost:3000'}/api/subscriptions/confirm/${options.token}
          </a></p>
          <p>If you didn't request this subscription, you can safely ignore this email.</p>
          <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; color: #777; font-size: 12px;">
            <p>&copy; ${new Date().getFullYear()} Khelkud Nepal. All rights reserved.</p>
            <p>You can <a href="${process.env.BASE_URL || 'http://localhost:3000'}/api/subscriptions/unsubscribe/${options.token}">unsubscribe</a> at any time.</p>
          </div>
        </div>
      `
    };
    
    const info = await transporter.sendMail(mailOptions);
    console.log('Subscription confirmation email sent:', info.messageId);
    
    // For development, log preview URL
    if (process.env.NODE_ENV !== 'production' && info.preview) {
      console.log('Preview URL:', nodemailer.getTestMessageUrl(info));
    }
    
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending subscription confirmation email:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Send a newsletter to subscribers
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email
 * @param {string} options.subject - Email subject
 * @param {string} options.content - Email content (HTML)
 * @param {string} options.token - Unsubscribe token
 */
exports.sendNewsletter = async (options) => {
  try {
    const transporter = createTransporter();
    
    const mailOptions = {
      from: `"Khelkud Nepal" <${process.env.EMAIL_USER || 'no-reply@khelkudnepal.com'}>`,
      to: options.to,
      subject: options.subject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 20px;">
            <img src="https://via.placeholder.com/150x50?text=Khelkud+Nepal" alt="Khelkud Nepal" style="max-width: 100%;">
          </div>
          ${options.content}
          <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; color: #777; font-size: 12px;">
            <p>&copy; ${new Date().getFullYear()} Khelkud Nepal. All rights reserved.</p>
            <p>You can <a href="${process.env.BASE_URL || 'http://localhost:3000'}/api/subscriptions/unsubscribe/${options.token}">unsubscribe</a> at any time.</p>
          </div>
        </div>
      `
    };
    
    const info = await transporter.sendMail(mailOptions);
    console.log('Newsletter email sent:', info.messageId);
    
    // For development, log preview URL
    if (process.env.NODE_ENV !== 'production' && info.preview) {
      console.log('Preview URL:', nodemailer.getTestMessageUrl(info));
    }
    
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending newsletter email:', error);
    return { success: false, error: error.message };
  }
}; 