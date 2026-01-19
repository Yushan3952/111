// 單純測試 /api/send-email
const testSendEmail = async () => {
  try {
    const res = await fetch("/api/send-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        test: true // 只放個測試欄位，不需要真實資料
      })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "寄信失敗");

    console.log("✅ /api/send-email 已執行", data);
  } catch (err) {
    console.error("❌ 執行 /api/send-email 失敗:", err);
  }
};

// 在需要的時候呼叫它，例如按鈕點擊：
<button onClick={testSendEmail}>測試寄信 API</button>
