import React, { useState, useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, getDocs } from "firebase/firestore";
import { v4 as uuidv4 } from "uuid";

// Firebase 設定
const firebaseConfig = {
  apiKey: "AIzaSyAeX-tc-Rlr08KU8tPYZ4QcXDFdAx3LYHI",
  authDomain: "trashmap-d648e.firebaseapp.com",
  projectId: "trashmap-d648e",
  storageBucket: "trashmap-d648e.firebasestorage.app",
  messagingSenderId: "527164483024",
  appId: "1:527164483024:web:a40043feb0e05672c085d5",
  measurementId: "G-MFJDX8XJML"
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Marker 顏色
const levelColors = { 1: "green", 2: "yellow", 3: "orange", 4: "red", 5: "violet" };
const getMarkerIcon = (color) =>
  new L.Icon({
    iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-${color}.png`,
    shadowUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  });

// 點擊選擇位置
const LocationSelector = ({ onSelect }) => {
  useMapEvents({
    click(e) {
      onSelect([e.latlng.lat, e.latlng.lng]);
    },
  });
  return null;
};

// 地圖自動移動
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
  const [loadingLocation, setLoadingLocation] = useState(true);

  // 操作說明 — 重新做成獨立 Modal
  const [showGuide, setShowGuide] = useState(false);

  // 讀取 Firebase 資料
  useEffect(() => {
    const fetchData = async () => {
      const querySnapshot = await getDocs(collection(db, "images"));
      const data = querySnapshot.docs.map((doc) => doc.data());
      setMarkers(data);
    };
    fetchData();
  }, []);

  // 取得手機定位
  useEffect(() => {
    if (!navigator.geolocation) {
      alert("瀏覽器不支援定位功能");
      setLoadingLocation(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setManualLocation([latitude, longitude]);
        setLoadingLocation(false);
      },
      () => {
        alert("定位失敗，請直接點擊地圖選擇位置");
        setLoadingLocation(false);
      }
    );
  }, []);

  // 上傳
  const handleUpload = async () => {
    if (!file) return alert("請選擇圖片");
    if (!manualLocation) return alert("請選擇位置");

    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", "trashmap_unsigned");

    const res = await fetch("https://api.cloudinary.com/v1_1/dwhn02tn5/image/upload", {
      method: "POST",
      body: formData,
    });
    const data = await res.json();
    const imageUrl = data.secure_url;

    const newDoc = {
      id: uuidv4(),
      lat: manualLocation[0],
      lng: manualLocation[1],
      timestamp: new Date().toISOString(),
      imageUrl,
      level: trashLevel,
    };

    await addDoc(collection(db, "images"), newDoc);
    setMarkers([...markers, newDoc]);
    setFile(null);
  };

  if (loadingLocation)
    return <div style={{ padding: 20, fontSize: 20 }}>正在取得定位中，請稍候...</div>;

  return (
    <>
      {/* 🔥 固定 Legend Panel（與操作說明分開） */}
      <div className="legend-panel">
        <img src="/legend.png" alt="legend" />
      </div>

      {/* 🔥 操作說明 Modal */}
      {showGuide && (
        <div className="modal-bg" onClick={() => setShowGuide(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <h2>操作說明</h2>
            <p>1. 點擊地圖選擇位置。</p>
            <p>2. 上傳垃圾照片。</p>
            <p>3. 選擇垃圾等級。</p>
            <button onClick={() => setShowGuide(false)}>關閉</button>
          </div>
        </div>
      )}

      {/* 主要內容區 */}
      <div className="container">
        <h1>全民科學垃圾回報 APP</h1>

        <div className="controls">
          <div>
            <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files[0])} />
            <select value={trashLevel} onChange={(e) => setTrashLevel(Number(e.target.value))}>
              <option value={1}>1 - 非常乾淨</option>
              <option value={2}>2 - 輕微垃圾</option>
              <option value={3}>3 - 中等垃圾</option>
              <option value={4}>4 - 髒亂</option>
              <option value={5}>5 - 非常髒亂</option>
            </select>
            <button onClick={handleUpload}>上傳</button>
          </div>

          <div style={{ textAlign: "center" }}>
            <button onClick={() => setShowGuide(true)}>操作說明</button>
            <a
              href="https://forms.gle/u9uHmAygxK5fRkmc7"
              target="_blank"
              rel="noopener noreferrer"
            >
              <button>回饋意見</button>
            </a>
          </div>
        </div>

        {/* 地圖區 */}
        <div className="map-container">
          <MapContainer
            center={manualLocation || [23.7, 120.53]}
            zoom={16}
            style={{ height: "100%", width: "100%" }}
          >
            <ChangeView center={manualLocation} />
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <LocationSelector onSelect={setManualLocation} />

            {markers.map((m) => (
              <Marker key={m.id} position={[m.lat, m.lng]} icon={getMarkerIcon(levelColors[m.level || 3])}>
                <Popup>
                  <img src={m.imageUrl} alt="uploaded" width="150" />
                  <br />
                  等級：{m.level || 3}
                  <br />
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
      </div>
    </>
  );
}
