// src/App.js
import React, { useState, useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import exifr from "exifr";
import { db } from "./firebase";
import { collection, addDoc, getDocs } from "firebase/firestore";

const App = () => {
  const [file, setFile] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(false);

  // Leaflet Marker 修正圖示路徑
  delete L.Icon.Default.prototype._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: "https://unpkg.com/leaflet@1.9.3/dist/images/marker-icon-2x.png",
    iconUrl: "https://unpkg.com/leaflet@1.9.3/dist/images/marker-icon.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.3/dist/images/marker-shadow.png"
  });

  // 讀取 Firestore 中的圖片資料
  useEffect(() => {
    const fetchPhotos = async () => {
      const querySnapshot = await getDocs(collection(db, "images"));
      const list = [];
      querySnapshot.forEach(doc => list.push(doc.data()));
      setPhotos(list);
    };
    fetchPhotos();
  }, []);

  // 上傳圖片到 Cloudinary 並存到 Firestore
  const handleUpload = async () => {
    if (!file) {
      alert("請選擇一張照片");
      return;
    }

    setLoading(true);

    try {
      // 從 EXIF 讀取 GPS 與時間
      const exifData = await exifr.parse(file, ["latitude", "longitude", "DateTimeOriginal"]);
      if (!exifData?.latitude || !exifData?.longitude) {
        alert("照片缺少 GPS 位置資訊");
        setLoading(false);
        return;
      }

      const lat = exifData.latitude;
      const lng = exifData.longitude;
      const dateTime = exifData.DateTimeOriginal ? exifData.DateTimeOriginal.toISOString() : null;

      // 上傳到 Cloudinary
      const formData = new FormData();
      formData.append("file", file);
      formData.append("upload_preset", "trashmap_unsigned");

      const cloudinaryRes = await fetch(
        "https://api.cloudinary.com/v1_1/dwhn02tn5/image/upload",
        { method: "POST", body: formData }
      );

      const cloudinaryData = await cloudinaryRes.json();

      // 儲存到 Firestore
      await addDoc(collection(db, "images"), {
        imageUrl: cloudinaryData.secure_url,
        lat,
        lng,
        dateTime
      });

      alert("上傳成功！");
      window.location.reload();
    } catch (error) {
      console.error(error);
      alert("上傳失敗");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1>TrashMap 民眾端</h1>
      <input type="file" accept="image/*" onChange={e => setFile(e.target.files[0])} />
      <button onClick={handleUpload} disabled={loading}>
        {loading ? "上傳中..." : "上傳"}
      </button>

      <MapContainer center={[23.7, 120.5]} zoom={10} style={{ height: "500px", marginTop: "20px" }}>
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="© OpenStreetMap 貢獻者"
        />
        {photos.map((p, idx) => (
          <Marker key={idx} position={[p.lat, p.lng]}>
            <Popup>
              <img src={p.imageUrl} alt="Trash" style={{ width: "150px" }} /><br />
              {p.dateTime ? new Date(p.dateTime).toLocaleString() : "無時間資訊"}
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
};

export default App;

