import React, { useState, useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import EXIF from "exif-js";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, getDocs } from "firebase/firestore";
import { v4 as uuidv4 } from "uuid";
import "./App.css";

// Firebase 設定
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// 髒亂程度對應 Leaflet marker 顏色
const levelColors = { 1: "green", 2: "yellow", 3: "orange", 4: "red", 5: "violet" };
const getMarkerIcon = (color) => new L.Icon({
  iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-${color}.png`,
  shadowUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// 點擊地圖選位置
const LocationSelector = ({ onSelect }) => {
  useMapEvents({ click(e) { onSelect([e.latlng.lat, e.latlng.lng]); } });
  return null;
};

// 地圖自動跳到定位
const ChangeView = ({ center }) => {
  const map = useMap();
  if (center) map.setView(center, 16);
  return null;
};

export default function App() {
  const [markers, setMarkers] = useState([]);
  const [manualLocation, setManualLocation] = useState(null);
  const [trashLevel, setTrashLevel] = useState(3);
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [step, setStep] = useState("start"); // start / main

  // 讀取 Firestore
  useEffect(() => {
    const fetchData = async () => {
      const snapshot = await getDocs(collection(db, "images"));
      setMarkers(snapshot.docs.map(doc => doc.data()));
    };
    fetchData();
  }, []);

  // 選檔案並嘗試讀 EXIF 或 GPS
  const handleFileChange = async (event) => {
    const selectedFile = event.target.files[0];
    if (!selectedFile) return;
    setFile(selectedFile);

    let lat = null, lng = null;
    try {
      const pos = await new Promise((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true })
      );
      lat = pos.coords.latitude; lng = pos.coords.longitude;
    } catch (err) {
      console.warn("GPS 取得失敗，需手動選擇位置");
    }
    setManualLocation(lat && lng ? [lat, lng] : null);
  };

  // 上傳圖片
  const handleUpload = async () => {
    if (!file) return alert("請先選擇圖片");
    if (!manualLocation) return alert("請先選擇位置");

    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", process.env.REACT_APP_CLOUDINARY_UPLOAD_PRESET);

    const res = await fetch(`https://api.cloudinary.com/v1_1/${process.env.REACT_APP_CLOUDINARY_CLOUD_NAME}/image/upload`, {
      method: "POST",
      body: formData
    });
    const data = await res.json();
    const imageUrl = data.secure_url;

    const docData = {
      id: uuidv4(),
      lat: manualLocation[0],
      lng: manualLocation[1],
      timestamp: new Date().toISOString(),
      imageUrl,
      level: trashLevel
    };
    await addDoc(collection(db, "images"), docData);
    setMarkers(prev => [...prev, docData]);

    setFile(null);
    setManualLocation(null);
    setTrashLevel(3);
    setUploading(false);
    alert("上傳完成！");
  };

  // 起始頁
  if (step === "start") {
    return (
      <div className="start-page">
        <h1>全民科學垃圾回報APP</h1>
        <button onClick={() => setStep("main")}>開始使用</button>
        <div className="feedback-buttons">
          <a href="https://forms.gle/u9uHmAygxK5fRkmc7" target="_blank" rel="noopener noreferrer">
            <button>操作說明</button>
          </a>
          <a href="https://forms.gle/u9uHmAygxK5fRkmc7" target="_blank" rel="noopener noreferrer">
            <button>回饋意見</button>
          </a>
        </div>
      </div>
    );
  }

  // 主頁
  return (
    <div className="app-content">
      {/* 背景動畫 */}
      <div className="background-layer">
        <img src={`${process.env.PUBLIC_URL}/images/forest.svg`} className="forest" alt="森林" />
        <img src={`${process.env.PUBLIC_URL}/images/river.svg`} className="river" alt="河流" />
        <img src={`${process.env.PUBLIC_URL}/images/house.svg`} className="house" alt="房子" />
        <img src={`${process.env.PUBLIC_URL}/images/trash.svg`} className="trash" alt="垃圾" />
        <img src={`${process.env.PUBLIC_URL}/images/person.svg`} className="person" alt="拍照的人" />
      </div>

      <h1>全民科學垃圾回報APP</h1>

      <div className="controls">
        <input type="file" accept="image/*" onChange={handleFileChange} />
        <select value={trashLevel} onChange={e => setTrashLevel(Number(e.target.value))}>
          <option value={1}>1 - 非常乾淨</option>
          <option value={2}>2 - 輕微垃圾</option>
          <option value={3}>3 - 中等垃圾</option>
          <option value={4}>4 - 髒亂</option>
          <option value={5}>5 - 非常髒亂</option>
        </select>
        <button onClick={handleUpload} disabled={uploading}>{uploading ? "上傳中..." : "上傳"}</button>
      </div>

      <MapContainer center={[23.7, 120.53]} zoom={10} style={{ height: "500px", width: "100%" }}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <LocationSelector onSelect={pos => setManualLocation(pos)} />
        {manualLocation && <Marker position={manualLocation} icon={getMarkerIcon(levelColors[trashLevel])}>
          <Popup>已選擇的位置（等級：{trashLevel}）</Popup>
        </Marker>}
        {markers.map((m) => <Marker key={m.id} position={[m.lat, m.lng]} icon={getMarkerIcon(levelColors[m.level || 3])}>
          <Popup>
            <img src={m.imageUrl} alt="uploaded" width="150" />
            <br />等級：{m.level || 3}<br />{m.timestamp}
          </Popup>
        </Marker>)}
      </MapContainer>
    </div>
  );
}
