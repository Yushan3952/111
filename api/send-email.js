const nodemailer = require("nodemailer");
module.exports = async (req, res) => {
  // 確保回傳標頭為 JSON
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== "POST") {
    return res.status(405).json({ message: "Only POST allowed" });
  }

  try {
    const { email, phone, location, level, imageUrl ,county ,town, teamname, teamphone} = req.body;

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: "sow112021012@gmail.com",
        pass: "haidrlnvbjmuflsg", // 這裡請確保是 16 位元的應用程式密碼
      },
    });

    const mailOptions = {
      from: "sow112021012@gmail.com",
      to: "sow112021012@gmail.com,tongyiluan9@gmail.com,hermes981012@gmail.com,c65201314@gmail.com,aaaaxtw@gmail.com,nimo941014980722@gmail.com",
      // 修正點：加上反引號
      subject: `垃圾回報協助通知 (等級 ${level})`, 
      // 修正點：加上反引號，支援多行 HTML 與變數插入
      html: `
        <h3>垃圾回報協助通知</h3>
        <p>📍 位置: 緯度 ${location[0]}, 經度 ${location[1]}</p>
        <p>等級: ${level}</p>
        <p>使用者 Gmail: ${email}</p>
        <p>使用者電話: ${phone}</p>
        <p>清潔隊位置: ${county},${town}</p>
        <p>清潔隊資訊: ${teamname},${teamphone}</p>
        <p>圖片連結: <a href="${imageUrl}">${imageUrl}</a></p>
      `,
    };

    await transporter.sendMail(mailOptions);
    return res.status(200).json({ success: true, message: "Email sent successfully" });

  } catch (err) {
    console.error("Server Error:", err);
    return res.status(500).json({ 
      success: false, 
      message: "Internal Server Error", 
      error: err.message 
    });
  }
};
