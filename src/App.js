import React, { useState, useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { v4 as uuidv4 } from "uuid";

// 🔹 插圖
import houseImg from "./images/house.png";
import trashImg from "./images/trash.png";
import personImg from "./images/person.png";
import cloudsImg from "./images/clouds.png";
import riverImg from "./images/river.png";
import forestImg from "./images/forest.png";

// 🔹 髒亂程度顏色
const levelColors = {
  1: "green",
  2: "yellow",
  3: "orange",
  4: "red",
  5: "violet"
};

const getMarkerIcon = (color) =>
  new L.Icon({
    iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-${color}.png`,
    shadowUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  });

// 🔹 地圖點選元件
function LocationSelector({ onSelect }) {
  useMapEvents({
    click(e) {
      onSelect([e.latlng.lat, e.latlng.lng]);
    }
  });
  return null;
}

// 🔹 地圖動態定位
function ChangeView({ center }) {
  const map = useMap();
  if (center) {
    map.setView(center, 16);
  }
  return null;
}

export default function App() {
  const [markers, setMarkers] = useState([]);
  const [selectedPos, setSelectedPos] = useState(null);
  const [photoFile, setPhotoFile] = useState(null);
  const [trashLevel, setTrashLevel] = useState(3);
  const [loadingLocation, setLoadingLocation] = useState(true);

  // 取得 GPS
  useEffect(() => {
    if (!navigator.geolocation) {
      alert("瀏覽器不支援定位功能");
      setLoadingLocation(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setSelectedPos({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLoadingLocation(false);
      },
      () => {
        alert("取得定位失敗，請點選地圖選擇位置");
        setLoadingLocation(false);
      }
    );
  }, []);

  const handleAddMarker = () => {
    if (selectedPos && photoFile) {
      const newMarker = {
        id: uuidv4(),
        lat: selectedPos.lat,
        lng: selectedPos.lng,
        photoURL: URL.createObjectURL(photoFile),
        level: trashLevel
      };
      setMarkers([...markers, newMarker]);
      setPhotoFile(null);
    } else {
      alert("請先選擇位置並拍照");
    }
  };

  if (loadingLocation) return <div style={{ padding: 20 }}>正在取得定位中，請稍候...</div>;

  return (
    <div className="app-container">
      {/* 背景 */}
      <div className="background">
        <img src={riverImg} alt="河流" className="river" />
        <img src={forestImg} alt="森林" className="forest" />
        <img src={houseImg} alt="房子" className="house" />
        <img src={trashImg} alt="垃圾桶" className="trash-icon" />
        <img src={personImg} alt="拍照人物" className="person" />
        <div className="clouds" style={{ backgroundImage: `url(${cloudsImg})` }} />
      </div>

      {/* 操作說明 */}
      <div className="info-box">
        <h2>操作說明</h2>
        <ul>
          <li>點選地圖選擇垃圾位置</li>
          <li>上傳圖片或拍照回報垃圾</li>
          <li>選擇垃圾髒亂程度</li>
          <li>點擊新增拍點</li>
        </ul>
        <div className="button-group">
          <input type="file" accept="image/*" onChange={(e) => setPhotoFile(e.target.files[0])} />
          <select value={trashLevel} onChange={(e) => setTrashLevel(Number(e.target.value))}>
            <option value={1}>1 - 非常乾淨</option>
            <option value={2}>2 - 輕微垃圾</option>
            <option value={3}>3 - 中等垃圾</option>
            <option value={4}>4 - 髒亂</option>
            <option value={5}>5 - 非常髒亂</option>
          </select>
          <button onClick={handleAddMarker}>新增拍點</button>
        </div>
      </div>

      {/* 地圖 */}
      <MapContainer
        center={selectedPos || [23.7, 120.53]}
        zoom={16}
        style={{ height: "400px", width: "90%", margin: "20px auto" }}
      >
        <ChangeView center={selectedPos} />
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <LocationSelector onSelect={setSelectedPos} />

        {markers.map((m) => (
          <Marker key={m.id} position={[m.lat, m.lng]} icon={getMarkerIcon(levelColors[m.level])}>
            <Popup>
              <img src={m.photoURL} alt="拍點照片" width="150" />
              <br />
              等級：{m.level}
            </Popup>
          </Marker>
        ))}

        {selectedPos && (
          <Marker position={[selectedPos.lat, selectedPos.lng]}>
            <Popup>選擇位置</Popup>
          </Marker>
        )}
      </MapContainer>
    </div>
  );
}
