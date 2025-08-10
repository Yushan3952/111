// App.js
import React, { useEffect, useState } from "react";
import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  getDocs,
  deleteDoc,
  doc,
} from "firebase/firestore";
import exifr from "exifr";

// ✅ Firebase 設定（已替換成你的）
const firebaseConfig = {
  apiKey: "AIzaSyBz-BR5fzHDkK_YcUHgIYy3DfeNUuaUDn4",
  authDomain: "trashmap-d648e.firebaseapp.com",
  projectId: "trashmap-d648e",
  storageBucket: "trashmap-d648e.appspot.com",
  messagingSenderId: "20749402893",
  appId: "1:20749402893:web:281a1c7b431b06c4fcfb86",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export default function App() {
  const [images, setImages] = useState([]);

  useEffect(() => {
    const fetchImages = async () => {
      const querySnapshot = await getDocs(collection(db, "images"));
      const imgData = [];

      for (const docSnap of querySnapshot.docs) {
        const data = docSnap.data();
        let meta = {};

        try {
          const response = await fetch(data.url);
          const blob = await response.blob();
          meta = await exifr.parse(blob, ["CreateDate", "latitude", "longitude"]);
        } catch (err) {
          console.error("❌ 無法讀取 EXIF：", err);
        }

        imgData.push({
          id: docSnap.id,
          url: data.url,
          public_id: data.public_id,
          takenAt: meta?.CreateDate
            ? new Date(meta.CreateDate).toLocaleString()
            : "未知",
          location: meta?.latitude
            ? `${meta.latitude.toFixed(6)}, ${meta.longitude.toFixed(6)}`
            : "未知",
        });
      }
      setImages(imgData);
    };

    fetchImages();
  }, []);

  const handleDelete = async (id, public_id) => {
    console.log("🧪 準備刪除圖片：", { id, public_id });
    try {
      const res = await fetch("https://222-nu-one.vercel.app/delete-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ public_id }),
      });

      const result = await res.json();
      console.log("✅ Cloudinary 回應：", result);

      if (result.error) throw new Error(result.error);

      await deleteDoc(doc(db, "images", id));
      setImages(images.filter((img) => img.id !== id));
    } catch (err) {
      console.error("❌ 刪除失敗：", err.message);
    }
  };

  return (
    <div>
      <h1>TrashMap 圖片管理</h1>
      {images.map((img) => (
        <div key={img.id} style={{ marginBottom: "20px" }}>
          <img src={img.url} alt="uploaded" width="300" />
          <p>📅 拍攝時間：{img.takenAt}</p>
          <p>📍 拍攝位置：{img.location}</p>
          <button onClick={() => handleDelete(img.id, img.public_id)}>刪除</button>
        </div>
      ))}
    </div>
  );
}
