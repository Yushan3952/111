// src/App.js
import React, { useEffect, useState } from "react";
import { getFirestore, collection, getDocs, deleteDoc, doc } from "firebase/firestore";
import app from "./firebase"; // 引入剛剛的 Firebase 初始化
import "./App.css";

const db = getFirestore(app);

const PASSWORD = "winnie3952";

function App() {
  const [images, setImages] = useState([]);
  const [password, setPassword] = useState("");
  const [authorized, setAuthorized] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchImages = async () => {
    try {
      setLoading(true);
      const colRef = collection(db, "images");
      const snapshot = await getDocs(colRef);
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setImages(list);
    } catch (error) {
      console.error("讀取失敗：", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authorized) {
      fetchImages();
    }
  }, [authorized]);

  const handleDelete = async (id, public_id) => {
    if (!window.confirm("確定要刪除這筆資料嗎？")) return;

    try {
      const res = await fetch("https://222-nu-one.vercel.app/delete-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ public_id }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "刪除圖片失敗");

      await deleteDoc(doc(db, "images", id));
      alert("刪除成功");
      fetchImages();
    } catch (error) {
      alert("刪除失敗：" + error.message);
    }
  };

  if (!authorized) {
    return (
      <div style={{ maxWidth: 400, margin: "100px auto", textAlign: "center" }}>
        <h2>請輸入密碼</h2>
        <input
          type={showPassword ? "text" : "password"}
          placeholder="輸入密碼"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ padding: 10, width: "80%" }}
        />
        <div style={{ marginTop: 10 }}>
          <label>
            <input
              type="checkbox"
              checked={showPassword}
              onChange={() => setShowPassword(!showPassword)}
            />{" "}
            顯示密碼
          </label>
        </div>
        <button
          style={{ marginTop: 20, padding: "8px 20px" }}
          onClick={() => {
            if (password === PASSWORD) setAuthorized(true);
            else alert("密碼錯誤");
          }}
        >
          登入
        </button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 800, margin: "auto", padding: 20 }}>
      <h1>TrashMap 管理後台</h1>
      {loading && <p>讀取中...</p>}
      {!loading && images.length === 0 && <p>目前沒有任何資料</p>}

      {!loading && images.length > 0 && (
        <table border="1" cellPadding="10" style={{ width: "100%" }}>
          <thead>
            <tr>
              <th>圖片</th>
              <th>上傳時間</th>
              <th>上傳位置</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {images.map((item) => (
              <tr key={item.id}>
                <td>
                  <img
                    src={item.url}
                    alt="垃圾照片"
                    style={{ width: 120, height: 80, objectFit: "cover" }}
                  />
                </td>
                <td>
                  {item.timestamp
                    ? new Date(item.timestamp).toLocaleString()
                    : "無資料"}
                </td>
                <td>
                  {item.lat?.toFixed(5)}, {item.lng?.toFixed(5)}
                </td>
                <td>
                  <button onClick={() => handleDelete(item.id, item.publicId)}>
                    刪除
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default App;
