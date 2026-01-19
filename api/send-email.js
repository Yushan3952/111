import nodemailer from "nodemailer";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Only POST allowed" });
  }

  try {
    const { email, phone, location, level, imageUrl } = req.body;

    if (!email || !phone || !location || !level || !imageUrl) {
      return res.status(400).json({ message: "Missing fields" });
    }

    // 🔹 設定你的 Gmail
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: "sow112021012@gmail.com",       // ← 改成你的 Gmail
        pass: "haidrlnvbjmuflsg",      // ← 建議使用 App Password
      },
    });

    const mailOptions = {
      from: "sow112021012@gmail.com",
      to: "sow112021012@gmail.com",         // ← 收信人（你自己）
      subject: `垃圾回報協助通知 
      html: 
        <h3>垃圾回報協助通知12345</h3>
       
      
      `,
    };

    await transporter.sendMail(mailOptions);

    res.status(200).json({ message: "Email sent successfully" });
  } catch (err) {
    console.error("Send email error:", err);
    res.status(500).json({ message: "Failed to send email", error: err.message });
  }
}
