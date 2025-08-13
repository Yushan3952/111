// src/App.js
import React, { useEffect, useState, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import exifr from "exifr";
import { db } from "./firebase";
import { collection, addDoc, getDocs, serverTimestamp } from "firebase/firestore";

// Leaflet icon fix
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.3/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.3/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.3/dist/images/marker-shadow.png",
});

// 點擊地圖選位置元件（備援）
function ClickToSelect({ onSelect }) {
  useMapEvents({
    click(e) {
      onSelect(e.latlng);
    },
  });
  return null;
}

export default function App() {
  const [file, setFile] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [loadingUpload, setLoadingUpload] = useState(false);
  const [progress, setProgress] = useState(0);
  const [needManualPick, setNeedManualPick] = useState(false);
  const [manualLatLng, setManualLatLng] = useState(null);
  const mapRef = useRef();

  // 讀取 Firestore 照片資料
  useEffect(() => {
    const loadPhotos = async () => {
      try {
        const snap = await getDocs(collection(db, "images"));
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setPhotos(list);
      } catch (err) {
        console.error("讀取 Firestore 失敗:", err);
      }
    };
    loadPhotos();
  }, []);

  // Helper: geocode 地址
  const geocodeAddress = async (address) => {
    try {
      const q = encodeURIComponent(address);
      const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1`, {
        headers: { "User-Agent": "TrashMapApp/1.0 (your@email)" }
      });
      if (!res.ok) return null;
      const arr = await res.json();
      if (arr.length > 0) return { lat: parseFloat(arr[0].lat), lng: parseFloat(arr[0].lon) };
      return null;
    } catch (err) {
      console.error("geocode error", err);
      return null;
    }
  };

  // 處理上傳
  const handleUpload = async () => {
    if (!file) return alert("請先選擇照片");
    setLoadingUpload(true);
    setProgress(0);

    try {
      // 1) 讀 EXIF
      const exifData = await exifr.parse(file, ["DateTimeOriginal", "latitude", "longitude", "ImageDescription", "UserComment", "XPComment"]);
      let takenTime = exifData?.DateTimeOriginal ? new Date(exifData.DateTimeOriginal).toISOString() : null;
      let lat = exifData?.latitude ?? null;
      let lng = exifData?.longitude ?? null;

      // 2) 若無 GPS 嘗試 geocode
      if ((!lat || !lng) && (exifData?.ImageDescription || exifData?.UserComment || exifData?.XPComment)) {
        const addr = exifData.ImageDescription || exifData.UserComment || exifData.XPComment;
        const geoc = await geocodeAddress(addr.toString());
        if (geoc) { lat = geoc.lat; lng = geoc.lng; }
      }

      // 3) 仍無 GPS，手動選
      if ((!lat || !lng) && !manualLatLng) {
        setNeedManualPick(true);
        setLoadingUpload(false);
        return alert("照片沒有 GPS，也無可用地址。請在地圖上點選位置。");
      }

      // 使用者手動選
      if (manualLatLng) { lat = manualLatLng.lat; lng = manualLatLng.lng; }

      // 4) 上傳 Cloudinary unsigned
      const form = new FormData();
      form.append("file", file);
      form.append("upload_preset", "trashmap_unsigned");

      const cloudRes = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", "https://api.cloudinary.com/v1_1/dwhn02tn5/image/upload");
        xhr.upload.onprogress = e => { if (e.lengthComputable) setProgress(Math.round((e.loaded*100)/e.total)); };
        xhr.onload = () => xhr.status>=200 && xhr.status<300 ? resolve(JSON.parse(xhr.responseText)) : reject(new Error(xhr.statusText));
        xhr.onerror = () => reject(new Error("Network error during upload"));
        xhr.send(form);
      });

      // 5) 寫入 Firestore
      await addDoc(collection(db, "images"), {
        imageUrl: cloudRes.secure_url,
        lat,
        lng,
        takenTime: takenTime || null,
        createdAt: serverTimestamp()
      });

      alert("上傳成功！");
      window.location.reload();
    } catch (err) {
      console.error(err);
      alert("上傳失敗：" + (err.message || err));
    } finally {
      setLoadingUpload(false);
    }
  };

  const onManualSelect = latlng => {
    setManualLatLng(latlng);
    setNeedManualPick(false);
    alert(`你已選擇位置：${latlng.lat.toFixed(6)}, ${latlng.lng.toFixed(6)}。請再次按上傳。`);
  };

  return (
    <div className="container">
      <header>
        <h1>全民科學垃圾回報系統</h1>
      </header>

      <div style={{ marginBottom: 12 }}>
        <input type="file" accept="image/*" capture="environment" onChange={e => { setFile(e.target.files[0] ?? null); setManualLatLng(null); }} />
        <button onClick={handleUpload} disabled={loadingUpload} style={{ marginLeft: 8 }}>
          {loadingUpload ? `上傳中 ${progress}%` : "上傳照片（自動讀取 GPS/時間）"}
        </button>
      </div>

      {needManualPick && <div style={{ color:"#b00", marginBottom:12 }}><strong>請在地圖上點一下位置來指定照片位置（備援）</strong></div>}

      <div style={{ height: 520, marginBottom: 12 }}>
        <MapContainer center={[23.7, 120.5]} zoom={9} style={{ height:"100%", width:"100%" }} whenCreated={map=>mapRef.current=map}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {needManualPick && <ClickToSelect onSelect={onManualSelect} />}
          {photos.map((p, idx) => p.lat && p.lng ? (
            <Marker key={idx} position={[p.lat, p.lng]}>
              <Popup style={{ textAlign:"center" }}>
                <img src={p.imageUrl} alt="photo" style={{ width:"180px", display:"block", marginBottom:6 }} />
                <div>{p.takenTime ? new Date(p.takenTime).toLocaleString() : "無時間資訊"}</div>
              </Popup>
            </Marker>
          ) : null)}
          {manualLatLng && <Marker position={[manualLatLng.lat, manualLatLng.lng]} />}
        </MapContainer>
      </div>
    </div>
  );
}

