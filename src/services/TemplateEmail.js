// Email templates for authentication
export const getLoginAlertTemplate = (loginTime, ipAddress, userAgent) => {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Login Alert</title>
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
          background-color: #f8f9fa;
        }
        .container {
          background: white;
          border-radius: 12px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          overflow: hidden;
        }
        .header {
          background: linear-gradient(135deg, #7269ef 0%, #6159cb 100%);
          color: white;
          padding: 30px;
          text-align: center;
        }
        .header h1 {
          margin: 0;
          font-size: 28px;
          font-weight: 600;
        }
        .header p {
          margin: 10px 0 0 0;
          opacity: 0.9;
          font-size: 16px;
        }
        .content {
          padding: 40px 30px;
        }
        .alert-icon {
          text-align: center;
          margin-bottom: 30px;
        }
        .alert-icon svg {
          width: 64px;
          height: 64px;
          fill: #f39c12;
        }
        .info-grid {
          background: #f8f9fa;
          border-radius: 8px;
          padding: 25px;
          margin: 25px 0;
        }
        .info-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 0;
          border-bottom: 1px solid #e9ecef;
        }
        .info-item:last-child {
          border-bottom: none;
        }
        .info-label {
          font-weight: 600;
          color: #495057;
        }
        .info-value {
          color: #6c757d;
          font-family: 'Courier New', monospace;
          background: white;
          padding: 4px 8px;
          border-radius: 4px;
          border: 1px solid #dee2e6;
        }
        .warning {
          background: #fff3cd;
          border: 1px solid #ffeaa7;
          border-radius: 8px;
          padding: 20px;
          margin: 25px 0;
        }
        .warning-icon {
          color: #856404;
          font-weight: bold;
          margin-bottom: 10px;
        }
        .footer {
          background: #f8f9fa;
          padding: 25px 30px;
          text-align: center;
          color: #6c757d;
          font-size: 14px;
        }
        .logo {
          color: #7269ef;
          font-weight: bold;
          font-size: 18px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🔐 Login Alert</h1>
          <p>Your account has been accessed</p>
        </div>
        
        <div class="content">
          <div class="alert-icon">
            <svg viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
            </svg>
          </div>
          
          <p style="text-align: center; font-size: 18px; margin-bottom: 30px;">
            We detected a new login to your <span class="logo">Chatvia</span> account.
          </p>
          
          <div class="info-grid">
            <div class="info-item">
              <span class="info-label">🕐 Login Time</span>
              <span class="info-value">${loginTime}</span>
            </div>
            <div class="info-item">
              <span class="info-label">🌐 IP Address</span>
              <span class="info-value">${ipAddress}</span>
            </div>
            <div class="info-item">
              <span class="info-label">💻 Device</span>
              <span class="info-value">${userAgent}</span>
            </div>
          </div>
          
          <div class="warning">
            <div class="warning-icon">⚠️ Security Notice</div>
            <p style="margin: 0; color: #856404;">
              If this login wasn't authorized by you, please change your password immediately 
              and review your account security settings.
            </p>
          </div>
        </div>
        
        <div class="footer">
          <p>This is an automated security alert from <span class="logo">Chatvia</span></p>
          <p>If you have any concerns, please contact our support team.</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

export const getOTPTemplate = (otpCode, isResend = false) => {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Verification Code</title>
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
          background-color: #f8f9fa;
        }
        .container {
          background: white;
          border-radius: 12px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          overflow: hidden;
        }
        .header {
          background: linear-gradient(135deg, #7269ef 0%, #6159cb 100%);
          color: white;
          padding: 30px;
          text-align: center;
        }
        .header h1 {
          margin: 0;
          font-size: 28px;
          font-weight: 600;
        }
        .header p {
          margin: 10px 0 0 0;
          opacity: 0.9;
          font-size: 16px;
        }
        .content {
          padding: 40px 30px;
          text-align: center;
        }
        .otp-container {
          background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
          border: 2px dashed #7269ef;
          border-radius: 12px;
          padding: 30px;
          margin: 30px 0;
        }
        .otp-code {
          font-size: 36px;
          font-weight: bold;
          color: #7269ef;
          letter-spacing: 8px;
          font-family: 'Courier New', monospace;
          margin: 0;
          text-shadow: 0 2px 4px rgba(114, 105, 239, 0.2);
        }
        .otp-label {
          color: #6c757d;
          font-size: 14px;
          margin-top: 10px;
        }
        .timer {
          background: #fff3cd;
          border: 1px solid #ffeaa7;
          border-radius: 8px;
          padding: 15px;
          margin: 25px 0;
          color: #856404;
        }
        .timer-icon {
          font-size: 20px;
          margin-right: 8px;
        }
        .security-tips {
          background: #d1ecf1;
          border: 1px solid #bee5eb;
          border-radius: 8px;
          padding: 20px;
          margin: 25px 0;
          text-align: left;
        }
        .security-tips h3 {
          color: #0c5460;
          margin-top: 0;
          font-size: 16px;
        }
        .security-tips ul {
          margin: 10px 0;
          padding-left: 20px;
        }
        .security-tips li {
          color: #0c5460;
          margin: 5px 0;
        }
        .footer {
          background: #f8f9fa;
          padding: 25px 30px;
          text-align: center;
          color: #6c757d;
          font-size: 14px;
        }
        .logo {
          color: #7269ef;
          font-weight: bold;
          font-size: 18px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🔐 Two-Factor Authentication</h1>
          <p>${isResend ? 'New verification code' : 'Your login verification code'}</p>
        </div>
        
        <div class="content">
          <p style="font-size: 18px; margin-bottom: 20px;">
            Please use the following code to complete your login:
          </p>
          
          <div class="otp-container">
            <div class="otp-code">${otpCode}</div>
            <div class="otp-label">Verification Code</div>
          </div>
          
          <div class="timer">
            <span class="timer-icon">⏰</span>
            <strong>This code will expire in 5 minutes</strong>
          </div>
          
          <div class="security-tips">
            <h3>🛡️ Security Tips:</h3>
            <ul>
              <li>Never share this code with anyone</li>
              <li>Chatvia will never ask for your verification code</li>
              <li>If you didn't request this code, please ignore this email</li>
              <li>For your security, this code can only be used once</li>
            </ul>
          </div>
        </div>
        
        <div class="footer">
          <p>This is an automated message from <span class="logo">Chatvia</span></p>
          <p>If you have any questions, please contact our support team.</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

export const getPasswordResetTemplate = (newPassword) => {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Password Reset</title>
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
          background-color: #f8f9fa;
        }
        .container {
          background: white;
          border-radius: 12px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          overflow: hidden;
        }
        .header {
          background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
          color: white;
          padding: 30px;
          text-align: center;
        }
        .header h1 {
          margin: 0;
          font-size: 28px;
          font-weight: 600;
        }
        .header p {
          margin: 10px 0 0 0;
          opacity: 0.9;
          font-size: 16px;
        }
        .content {
          padding: 40px 30px;
        }
        .password-container {
          background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
          border: 2px solid #28a745;
          border-radius: 12px;
          padding: 25px;
          margin: 25px 0;
          text-align: center;
        }
        .password-label {
          color: #6c757d;
          font-size: 14px;
          margin-bottom: 10px;
        }
        .password-value {
          font-size: 24px;
          font-weight: bold;
          color: #28a745;
          font-family: 'Courier New', monospace;
          letter-spacing: 2px;
          background: white;
          padding: 15px;
          border-radius: 8px;
          border: 1px solid #dee2e6;
          word-break: break-all;
        }
        .warning {
          background: #fff3cd;
          border: 1px solid #ffeaa7;
          border-radius: 8px;
          padding: 20px;
          margin: 25px 0;
        }
        .warning-icon {
          color: #856404;
          font-weight: bold;
          margin-bottom: 10px;
        }
        .steps {
          background: #d1ecf1;
          border: 1px solid #bee5eb;
          border-radius: 8px;
          padding: 20px;
          margin: 25px 0;
        }
        .steps h3 {
          color: #0c5460;
          margin-top: 0;
          font-size: 16px;
        }
        .steps ol {
          margin: 10px 0;
          padding-left: 20px;
        }
        .steps li {
          color: #0c5460;
          margin: 8px 0;
        }
        .footer {
          background: #f8f9fa;
          padding: 25px 30px;
          text-align: center;
          color: #6c757d;
          font-size: 14px;
        }
        .logo {
          color: #7269ef;
          font-weight: bold;
          font-size: 18px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🔑 Password Reset</h1>
          <p>Your new password has been generated</p>
        </div>
        
        <div class="content">
          <p style="font-size: 18px; margin-bottom: 20px;">
            Hello! We've generated a new password for your <span class="logo">Chatvia</span> account.
          </p>
          
          <div class="password-container">
            <div class="password-label">Your new password:</div>
            <div class="password-value">${newPassword}</div>
          </div>
          
          <div class="warning">
            <div class="warning-icon">⚠️ Important Security Notice</div>
            <p style="margin: 0; color: #856404;">
              Please login with this password and change it immediately to ensure your account security.
            </p>
          </div>
          
          <div class="steps">
            <h3>📋 Next Steps:</h3>
            <ol>
              <li>Login to your account using this new password</li>
              <li>Click avatar in the bottom right corner and click "Reset pass"</li>
              <li>Change your password to something secure and memorable</li>
              <li>Consider enabling Two-Factor Authentication for extra security</li>
            </ol>
          </div>
        </div>
        
        <div class="footer">
          <p>This is an automated message from <span class="logo">Chatvia</span></p>
          <p>If you didn't request this password reset, please contact our support team immediately.</p>
        </div>
      </div>
    </body>
    </html>
  `;
};
