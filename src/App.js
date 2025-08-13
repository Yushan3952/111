import React, { useState, useEffect, useRef } from "react";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, getDocs, query, orderBy } from "firebase/firestore";
import exifr from "exifr";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import CameraCapture from "./CameraCapture";
import "./App.css";

// Firebase config 這邊換成你的
const firebaseConfig = {
  apiKey: "你的API_KEY",
  authDomain: "你的_AUTH_DOMAIN",
  projectId: "你的_PROJECT_ID",
  storageBucket: "你的_STORAGE_BUCKET",
  messagingSenderId: "你的_MSG_ID",
  appId: "你的_APP_ID",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Leaflet icon 修正（webpack）
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.3/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.3/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.3/dist/images/marker-shadow.png",
});

export default function App() {
  const [images, setImages] = useState([]);
  const [showCamera, setShowCamera] = useState(false);
  const [loading, setLoading] = useState(false);

  // 讀照片資料
  useEffect(() => {
    fetchImages();
  }, []);

  const fetchImages = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, "images"), orderBy("timestamp", "desc"));
      const snap = await getDocs(q);
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setImages(list);
    } catch (err) {
      console.error("Firestore 讀取失敗:", err);
    } finally {
      setLoading(false);
    }
  };

  // 相簿上傳
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setLoading(true);

    try {
      const exifData = await exifr.parse(file);
      const lat = exifData?.latitude ?? null;
      const lng = exifData?.longitude ?? null;
      const dateTaken = exifData?.DateTimeOriginal
        ? exifData.DateTimeOriginal.toISOString()
        : new Date().toISOString();

      const url = await uploadToCloudinary(file);

      await addDoc(collection(db, "images"), {
        url,
        lat,
        lng,
        dateTaken,
        timestamp: Date.now(),
      });

      await fetchImages();
    } catch (err) {
      console.error("上傳失敗", err);
      alert("上傳失敗：" + (err.message || err));
    } finally {
      setLoading(false);
      e.target.value = ""; // 清空 input，方便重複選同一張
    }
  };

  // 即拍即傳用，帶入 file, lat, lng
  const handleCameraCapture = async (file, lat, lng) => {
    setLoading(true);
    try {
      const url = await uploadToCloudinary(file);

      await addDoc(collection(db, "images"), {
        url,
        lat,
        lng,
        dateTaken: new Date().toISOString(),
        timestamp: Date.now(),
      });

      await fetchImages();
      setShowCamera(false);
    } catch (err) {
      console.error("即拍即傳上傳失敗", err);
      alert("上傳失敗：" + (err.message || err));
    } finally {
      setLoading(false);
    }
  };

  // Cloudinary unsigned upload
  const uploadToCloudinary = async (file) => {
    const form = new FormData();
    form.append("file", file);
    form.append("upload_preset", "trashmap_unsigned");

    const res = await fetch(
      "https://api.cloudinary.com/v1_1/dwhn02tn5/image/upload",
      {
        method: "POST",
        body: form,
      }
    );
    const data = await res.json();
    return data.secure_url;
  };

  return (
    <div className="App">
      <h1>TrashMap 民眾回報系統</h1>

      <div className="upload-options">
        <label className="upload-button">
          從相簿選擇
          <input
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
            disabled={loading}
          />
        </label>

        <button
          className="camera-button"
          onClick={() => setShowCamera(true)}
          disabled={loading}
        >
          即拍即傳
        </button>
      </div>

      {showCamera && (
        <CameraCapture
          onCapture={handleCameraCapture}
          onClose={() => setShowCamera(false)}
        />
      )}

      {loading && <p>載入中...</p>}

      <div style={{ height: "400px", marginTop: "20px" }}>
        <MapContainer
          center={[23.7, 120.5]}
          zoom={10}
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

          {images.map((img) =>
            img.lat && img.lng ? (
              <Marker key={img.id} position={[img.lat, img.lng]}>
                <Popup>
                  <img
                    src={img.url}
                    alt="照片"
                    style={{ width: "200px", display: "block", marginBottom: 5 }}
                  />
                  <div>
                    拍攝時間:{" "}
                    {img.dateTaken
                      ? new Date(img.dateTaken).toLocaleString()
                      : "無資料"}
                  </div>
                </Popup>
              </Marker>
            ) : null
          )}
        </MapContainer>
      </div>
    </div>
  );
}
