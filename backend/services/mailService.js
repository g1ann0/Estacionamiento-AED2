// Transporte de correo compartido. Existía uno solo dentro de authController, privado del
// módulo: cualquier otra parte del sistema que necesite mandar un mail tenía que declarar el
// suyo y duplicar la configuración. Vive acá para que haya una sola.
//
// Variables requeridas en .env: SMTP_SERVICE, SMTP_USER, SMTP_PASS.

const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: process.env.SMTP_SERVICE || 'gmail',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

// El remitente por defecto es la misma casilla autenticada: mandar `from` con otro dominio
// hace que el proveedor lo reescriba o lo marque como spam.
async function enviarMail({ to, subject, text, html, attachments }) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    throw new Error('El envío de correo no está configurado (faltan SMTP_USER / SMTP_PASS)');
  }
  return transporter.sendMail({ from: process.env.SMTP_USER, to, subject, text, html, attachments });
}

module.exports = { transporter, enviarMail };
