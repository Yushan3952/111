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

    // 🔹 設定 Gmail
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: "sow112021012@gmail.com", 
        pass: "haidrlnvbjmuflsg", // 確保這是 Google 生成的「應用程式密碼」
      },
    });

    const mailOptions = {
      from: "sow112021012@gmail.com",
      to: "sow112021012@gmail.com",
      // 修正點 1: 使用反引號包起來
      subject: 垃圾回報協助通知 (等級 ${level}), 
      // 修正點 2: 使用反引號包起來，支援多行 HTML
      html: `
        <h3>垃圾回報協助通知</h3>
        <p>📍 位置: 緯度 ${location[0]}, 經度 ${location[1]}</p>
        <p>等級: ${level}</p>
        <p>使用者 Gmail: ${email}</p>
        <p>使用者電話: ${phone}</p>
        <p>圖片連結: <a href="${imageUrl}">${imageUrl}</a></p>
      `,
    };

    await transporter.sendMail(mailOptions);
    res.status(200).json({ message: "Email sent successfully" });

  } catch (err) {
    console.error("Send email error:", err);
    res.status(500).json({ 
      message: "Failed to send email", 
      error: err.message 
    });
  }
}
