import React, { useState, useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import EXIF from "exif-js";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, getDocs } from "firebase/firestore";
import { v4 as uuidv4 } from "uuid";
import { Helmet } from "react-helmet";
import "./App.css";

// 🔹 Firebase 設定
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

// 髒亂程度對應 Leaflet marker 顏色名稱
const levelColors = {
  1: "green",
  2: "yellow",
  3: "orange",
  4: "red",
  5: "violet"
};

// 產生彩色 marker icon
const getMarkerIcon = (color) =>
  new L.Icon({
    iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-${color}.png`,
    shadowUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  });

// 手動選點元件
const LocationSelector = ({ onSelect }) => {
  useMapEvents({
    click(e) {
      onSelect([e.latlng.lat, e.latlng.lng]);
    }
  });
  return null;
};

// 動態跳到使用者定位
function ChangeView({ center }) {
  const map = useMap();
  if (center) map.setView(center, 16);
  return null;
}

export default function App() {
  const [markers, setMarkers] = useState([]);
  const [manualLocation, setManualLocation] = useState(null);
  const [trashLevel, setTrashLevel] = useState(3);
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [step, setStep] = useState("start"); // start / main
  const [userPos, setUserPos] = useState(null);

  // 🔹 載入 Firestore
  useEffect(() => {
    const fetchData = async () => {
      const querySnapshot = await getDocs(collection(db, "images"));
      const data = querySnapshot.docs.map(doc => doc.data());
      setMarkers(data);
    };
    fetchData();
  }, []);

  // 🔹 取得使用者定位
  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      pos => setUserPos([pos.coords.latitude, pos.coords.longitude]),
      () => console.warn("無法取得定位")
    );
  }, []);

  // 🔹 處理圖片選擇
  const handleFileChange = async (event) => {
    const selectedFile = event.target.files[0];
    if (!selectedFile) return;
    setFile(selectedFile);

    let lat = null, lng = null;

    await new Promise((resolve) => {
      EXIF.getData(selectedFile, function () {
        const latExif = EXIF.getTag(this, "GPSLatitude");
        const lngExif = EXIF.getTag(this, "GPSLongitude");
        const latRef = EXIF.getTag(this, "GPSLatitudeRef");
        const lngRef = EXIF.getTag(this, "GPSLongitudeRef");

        if (latExif && lngExif) {
          const convertDMSToDD = (dms, ref) => {
            let degrees = dms[0].numerator / dms[0].denominator;
            let minutes = dms[1].numerator / dms[1].denominator;
            let seconds = dms[2].numerator / dms[2].denominator;
            let dd = degrees + minutes / 60 + seconds / 3600;
            if (ref === "S" || ref === "W") dd = -dd;
            return dd;
          };
          lat = convertDMSToDD(latExif, latRef);
          lng = convertDMSToDD(lngExif, lngRef);
        }
        resolve();
      });
    });

    setManualLocation(lat && lng ? [lat, lng] : null);
    if (!lat || !lng) alert("圖片沒有 GPS 資訊，請在地圖上點選位置");
  };

  // 🔹 上傳
  const handleUpload = async () => {
    if (!file) return alert("請先選擇圖片");
    if (!manualLocation) return alert("請先在地圖上點選位置");
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

    const newData = {
      id: uuidv4(),
      lat: manualLocation[0],
      lng: manualLocation[1],
      timestamp: new Date().toISOString(),
      imageUrl,
      level: trashLevel
    };

    await addDoc(collection(db, "images"), newData);

    setMarkers(prev => [...prev, newData]);
    setFile(null);
    setManualLocation(null);
    setTrashLevel(3);
    setUploading(false);
    alert("上傳完成！");
  };

  // 🔹 首頁
  if (step === "start") {
    return (
      <div className="start-page">
        <Helmet>
          <title>雲林垃圾回報系統</title>
          <meta name="description" content="雲林垃圾地圖，回報髒亂程度，讓大家共同守護環境" />
          <meta name="keywords" content="垃圾回報, 雲林, 環境保護, 垃圾地圖, 全民科學" />
        </Helmet>

        <h1>全民科學垃圾回報APP</h1>

        <div className="instruction-card">
          <h3>操作說明</h3>
          <ol>
            <li>點擊「開始使用」進入地圖</li>
            <li>選擇或拍攝垃圾照片</li>
            <li>選擇髒亂程度</li>
            <li>點擊「上傳」回報垃圾位置</li>
            <li>查看地圖上的其他垃圾回報</li>
          </ol>
        </div>

        <button className="start-btn" onClick={() => setStep("main")}>開始使用</button>

        <div style={{ marginTop: "20px" }}>
          <a href="https://forms.gle/u9uHmAygxK5fRkmc7" target="_blank" rel="noopener noreferrer">
            <button className="start-btn">回饋意見</button>
          </a>
        </div>
      </div>
    );
  }

  // 🔹 主畫面
  return (
    <div className="main-page">
      <h1>全民科學垃圾回報APP</h1>

      <div className="map-controls">
        <div className="controls">
          <input type="file" accept="image/*" onChange={handleFileChange} />
          <div className="level-select">
            <label>髒亂程度：</label>
            <select value={trashLevel} onChange={e => setTrashLevel(Number(e.target.value))}>
              <option value={1}>1 - 非常乾淨</option>
              <option value={2}>2 - 輕微垃圾</option>
              <option value={3}>3 - 中等垃圾</option>
              <option value={4}>4 - 髒亂</option>
              <option value={5}>5 - 非常髒亂</option>
            </select>
          </div>
          {uploading && <p>上傳中...</p>}
          <button onClick={handleUpload} disabled={uploading}>上傳</button>
          <div style={{ marginTop: "10px" }}>
            <a href="https://forms.gle/u9uHmAygxK5fRkmc7" target="_blank" rel="noopener noreferrer">
              <button>回饋意見</button>
            </a>
          </div>
        </div>

        <div className="legend-card">
          <img src={`${process.env.PUBLIC_URL}/legend.png`} alt="垃圾等級對照表" />
        </div>
      </div>

      <MapContainer center={userPos || [23.7, 120.53]} zoom={10} className="map-container">
        <ChangeView center={userPos} />
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <LocationSelector onSelect={setManualLocation} />

        {markers.map((m, idx) => (
          <Marker key={idx} position={[m.lat, m.lng]} icon={getMarkerIcon(levelColors[m.level || 3])}>
            <Popup>
              <img src={m.imageUrl} alt="uploaded" />
              <br />
              等級：{m.level || 3}<br />
              {m.timestamp}
            </Popup>
          </Marker>
        ))}

        {manualLocation && (
          <Marker position={manualLocation} icon={getMarkerIcon(levelColors[trashLevel])}>
            <Popup>已選擇位置（等級：{trashLevel}）</Popup>
          </Marker>
        )}
      </MapContainer>
    </div>
  );
}

