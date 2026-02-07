const nodemailer = require('nodemailer');
require('dotenv').config();

/**
 * Servicio de Email para notificaciones del sistema
 */
class EmailService {
  constructor() {
    this.transporter = null;
    this.initializeTransporter();
  }

  /**
   * Inicializar el transportador de email
   */
  initializeTransporter() {
    try {
      this.transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST || 'smtp.gmail.com',
        port: process.env.EMAIL_PORT || 587,
        secure: false, // true para 465, false para otros puertos
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS
        }
      });

      console.log('✅ Servicio de email inicializado correctamente');
    } catch (error) {
      console.error('❌ Error al inicializar servicio de email:', error);
    }
  }

  /**
   * Enviar email de notificación de desactivación de cuenta
   */
  async enviarNotificacionDesactivacion(usuario) {
    try {
      const mailOptions = {
        from: `"Sistema de Estacionamiento" <${process.env.EMAIL_USER}>`,
        to: usuario.email,
        subject: '⚠️ Tu cuenta ha sido desactivada',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: #f44336; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
              .content { background: #f9f9f9; padding: 30px; border: 1px solid #ddd; border-top: none; }
              .footer { background: #333; color: white; padding: 15px; text-align: center; font-size: 12px; border-radius: 0 0 5px 5px; }
              .button { background: #2196F3; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; margin-top: 20px; }
              .warning { background: #fff3cd; border: 1px solid #ffc107; padding: 15px; border-radius: 5px; margin: 20px 0; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>⚠️ Cuenta Desactivada</h1>
              </div>
              <div class="content">
                <p>Hola <strong>${usuario.nombre} ${usuario.apellido}</strong>,</p>
                
                <div class="warning">
                  <p><strong>⚠️ IMPORTANTE:</strong> Tu cuenta en el Sistema de Estacionamiento ha sido <strong>desactivada</strong> por un administrador.</p>
                </div>
                
                <h3>¿Qué significa esto?</h3>
                <ul>
                  <li>❌ No podrás acceder al sistema</li>
                  <li>❌ Tus vehículos han sido desactivados</li>
                  <li>❌ No podrás realizar nuevas transacciones</li>
                  <li>📊 Tu historial se mantiene guardado</li>
                </ul>
                
                <h3>Detalles de tu cuenta:</h3>
                <ul>
                  <li><strong>DNI:</strong> ${usuario.dni}</li>
                  <li><strong>Email:</strong> ${usuario.email}</li>
                  <li><strong>Fecha de desactivación:</strong> ${new Date().toLocaleString('es-AR')}</li>
                </ul>
                
                <p><strong>Si crees que esto es un error, por favor contacta al administrador del sistema.</strong></p>
                
                <p>Saludos,<br>
                <strong>Equipo de Estacionamiento</strong></p>
              </div>
              <div class="footer">
                <p>© ${new Date().getFullYear()} Sistema de Estacionamiento - Todos los derechos reservados</p>
              </div>
            </div>
          </body>
          </html>
        `
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log('✅ Email de desactivación enviado:', info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('❌ Error al enviar email de desactivación:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Enviar email de notificación de activación de cuenta
   */
  async enviarNotificacionActivacion(usuario) {
    try {
      const mailOptions = {
        from: `"Sistema de Estacionamiento" <${process.env.EMAIL_USER}>`,
        to: usuario.email,
        subject: '✅ Tu cuenta ha sido reactivada',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: #4CAF50; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
              .content { background: #f9f9f9; padding: 30px; border: 1px solid #ddd; border-top: none; }
              .footer { background: #333; color: white; padding: 15px; text-align: center; font-size: 12px; border-radius: 0 0 5px 5px; }
              .button { background: #2196F3; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; margin-top: 20px; }
              .success { background: #d4edda; border: 1px solid #4CAF50; padding: 15px; border-radius: 5px; margin: 20px 0; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>✅ Cuenta Reactivada</h1>
              </div>
              <div class="content">
                <p>Hola <strong>${usuario.nombre} ${usuario.apellido}</strong>,</p>
                
                <div class="success">
                  <p><strong>✅ ¡Buenas noticias!</strong> Tu cuenta en el Sistema de Estacionamiento ha sido <strong>reactivada</strong>.</p>
                </div>
                
                <h3>Ya puedes:</h3>
                <ul>
                  <li>✅ Acceder al sistema normalmente</li>
                  <li>✅ Utilizar tus vehículos</li>
                  <li>✅ Realizar transacciones</li>
                  <li>✅ Gestionar tu cuenta</li>
                </ul>
                
                <h3>Detalles de tu cuenta:</h3>
                <ul>
                  <li><strong>DNI:</strong> ${usuario.dni}</li>
                  <li><strong>Email:</strong> ${usuario.email}</li>
                  <li><strong>Fecha de reactivación:</strong> ${new Date().toLocaleString('es-AR')}</li>
                </ul>
                
                <p>¡Bienvenido de vuelta!</p>
                
                <p>Saludos,<br>
                <strong>Equipo de Estacionamiento</strong></p>
              </div>
              <div class="footer">
                <p>© ${new Date().getFullYear()} Sistema de Estacionamiento - Todos los derechos reservados</p>
              </div>
            </div>
          </body>
          </html>
        `
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log('✅ Email de activación enviado:', info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('❌ Error al enviar email de activación:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new EmailService();
