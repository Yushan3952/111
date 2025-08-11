// src/App.js
import React, { useEffect, useState } from "react";
import { db } from "./firebase";
import { collection, getDocs } from "firebase/firestore";
import exifr from "exifr";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export default function App() {
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);

  // 從 Firestore 讀取資料並解析 EXIF
  useEffect(() => {
    const fetchImages = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "images"));
        const data = await Promise.all(
          querySnapshot.docs.map(async (docSnap) => {
            const item = { id: docSnap.id, ...docSnap.data() };
            try {
              const res = await fetch(item.url);
              const blob = await res.blob();
              const exifData = await exifr.parse(blob, [
                "DateTimeOriginal",
                "latitude",
                "longitude",
              ]);
              if (exifData) {
                item.takenTime = exifData.DateTimeOriginal
                  ? new Date(exifData.DateTimeOriginal).toLocaleString()
                  : "無資料";
                item.lat = exifData.latitude || null;
                item.lng = exifData.longitude || null;
              }
            } catch (err) {
              console.error("讀取 EXIF 失敗", err);
            }
            return item;
          })
        );
        setImages(data);
      } catch (error) {
        console.error("讀取 Firestore 失敗", error);
      } finally {
        setLoading(false);
      }
    };

    fetchImages();
  }, []);

  // 初始化 Leaflet 地圖與標記
  useEffect(() => {
    if (!loading && images.length > 0) {
      const map = L.map("map").setView([23.7, 120.5], 10);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors",
      }).addTo(map);

      images.forEach((img) => {
        if (img.lat && img.lng) {
          L.marker([img.lat, img.lng])
            .addTo(map)
            .bindPopup(
              `<img src="${img.url}" width="100"><br>${img.takenTime || ""}`
            );
        }
      });
    }
  }, [loading, images]);

  return (
    <div>
      <h1>全民科學垃圾回報地圖</h1>
      <div id="map" style={{ height: "400px", marginBottom: "20px" }}></div>
      {loading ? (
        <p>載入中...</p>
      ) : (
        images.map((img) => (
          <div key={img.id} style={{ marginBottom: "20px" }}>
            <img src={img.url} alt="" style={{ width: "200px" }} />
            <p>拍攝時間：{img.takenTime || "無資料"}</p>
            <p>
              位置：
              {img.lat && img.lng
                ? `${img.lat.toFixed(6)}, ${img.lng.toFixed(6)}`
                : "無資料"}
            </p>
          </div>
        ))
      )}
    </div>
  );
}

}
