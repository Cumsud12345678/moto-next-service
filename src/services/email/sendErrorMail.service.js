import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL,
    pass: process.env.APP_PASSWORD,
  },
});

const sendErrorMail = async (error) => {
  await transporter.sendMail({
    from: process.env.EMAIL,
    to: process.env.EMAIL,
    subject: `🚨 Server Error (${error.statusCode})`,
    html: `
      <h2>Server Xətası</h2>

      <p><b>Message:</b> ${error.message}</p>
      <p><b>Status:</b> ${error.statusCode}</p>
      <p><b>URL:</b> ${error.url}</p>
      <p><b>Method:</b> ${error.method}</p>
      <p><b>User:</b> ${error.user || "Guest"}</p>
      <p><b>IP:</b> ${error.ip}</p>

      <h3>Stack</h3>
      <pre>${error.stack}</pre>
    `,
  });
};

export {
  sendErrorMail
}