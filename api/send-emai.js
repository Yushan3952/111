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
        pass: "pmti xrcp pbhl mhiw",      // ← 建議使用 App Password
      },
    });

    const mailOptions = {
      from: "sow112021012@gmail.com",
      to: "sow112021012@gmail.com",         // ← 收信人（你自己）
      subject: `垃圾回報協助通知 (等級 ${level})`,
      html: `
        <h3>垃圾回報協助通知</h3>
        <p>📍 位置: 緯度 ${location[0]}, 經度 ${location[1]}</p>
        <p>等級: ${level}</p>
        <p>使用者 Gmail: ${email}</p>
        <p>使用者電話: ${phone}</p>
        <p>照片:</p>
        <img src="${imageUrl}" style="max-width:300px;"/>
      `,
    };

    await transporter.sendMail(mailOptions);

    res.status(200).json({ message: "Email sent successfully" });
  } catch (err) {
    console.error("Send email error:", err);
    res.status(500).json({ message: "Failed to send email", error: err.message });
  }
}
