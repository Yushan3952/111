// src/App.js
import React, { useEffect, useState, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import exifr from "exifr";
import { db } from "./firebase";
import { collection, addDoc, getDocs, serverTimestamp } from "firebase/firestore";

// 修正 leaflet icon 問題
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.3/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.3/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.3/dist/images/marker-shadow.png",
});

// 手動選點元件
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

  // 讀取 Firestore 已上傳照片
  useEffect(() => {
    const load = async () => {
      try {
        const snap = await getDocs(collection(db, "images"));
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setPhotos(list);
      } catch (err) {
        console.error("讀取 Firestore 失敗:", err);
      }
    };
    load();
  }, []);

  // 手動選點
  const onManualSelect = (latlng) => {
    setManualLatLng(latlng);
    setNeedManualPick(false);
    alert(`你已選擇位置： ${latlng.lat.toFixed(6)}, ${latlng.lng.toFixed(6)}。請再次按 上傳。`);
  };

  // 上傳流程
  const handleUpload = async () => {
    if (!file) {
      alert("請先選擇照片");
      return;
    }
    setLoadingUpload(true);
    setProgress(0);

    try {
      // 1. 嘗試讀 EXIF
      const exifData = await exifr.parse(file, ["DateTimeOriginal", "latitude", "longitude"]);
      let takenTime = exifData?.DateTimeOriginal ? new Date(exifData.DateTimeOriginal).toISOString() : new Date().toISOString();
      let lat = exifData?.latitude ?? null;
      let lng = exifData?.longitude ?? null;

      // 2. 如果沒有 GPS，使用手動選點
      if ((!lat || !lng) && !manualLatLng) {
        setNeedManualPick(true);
        alert("照片沒有 GPS，請在地圖上選擇位置");
        setLoadingUpload(false);
        return;
      }
      if (manualLatLng) {
        lat = manualLatLng.lat;
        lng = manualLatLng.lng;
      }

      // 3. 上傳 Cloudinary
      const form = new FormData();
      form.append("file", file);
      form.append("upload_preset", "trashmap_unsigned");

      const cloudRes = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", "https://api.cloudinary.com/v1_1/dwhn02tn5/image/upload");
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setProgress(Math.round((e.loaded * 100) / e.total));
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve(JSON.parse(xhr.responseText));
          else reject(new Error(`Upload failed: ${xhr.statusText}`));
        };
        xhr.onerror = () => reject(new Error("Network error"));
        xhr.send(form);
      });

      // 4. 寫入 Firestore
      await addDoc(collection(db, "images"), {
        imageUrl: cloudRes.secure_url,
        lat,
        lng,
        takenTime,
        createdAt: serverTimestamp()
      });

      alert("上傳成功！");
      window.location.reload();
    } catch (err) {
      console.error("上傳失敗：", err);
      alert("上傳失敗：" + (err.message || err));
    } finally {
      setLoadingUpload(false);
    }
  };

  return (
    <div className="container">
      <header>
        <h1>TrashMap — 民眾回報</h1>
      </header>

      <div style={{ marginBottom: 12 }}>
        <input
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(e) => {
            setFile(e.target.files[0] ?? null);
            setManualLatLng(null);
          }}
        />
        <button onClick={handleUpload} disabled={loadingUpload} style={{ marginLeft: 8 }}>
          {loadingUpload ? `上傳中 ${progress}%` : "上傳照片"}
        </button>
      </div>

      {needManualPick && (
        <div style={{ marginBottom: 12, color: "#b00" }}>
          <strong>請在地圖上點一下位置來指定照片位置</strong>
        </div>
      )}

      <div style={{ height: 520, marginBottom: 12 }}>
        <MapContainer
          center={[23.7, 120.5]}
          zoom={9}
          style={{ height: "100%", width: "100%" }}
          whenCreated={(map) => (mapRef.current = map)}
        >
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {needManualPick && <ClickToSelect onSelect={onManualSelect} />}
          {photos.map((p, idx) =>
            p.lat && p.lng ? (
              <Marker key={idx} position={[p.lat, p.lng]}>
                <Popup>
                  <div style={{ textAlign: "center" }}>
                    <img src={p.imageUrl} alt="photo" style={{ width: "180px", display: "block", marginBottom: 6 }} />
                    <div>{p.takenTime ? new Date(p.takenTime).toLocaleString() : "無時間資訊"}</div>
                  </div>
                </Popup>
              </Marker>
            ) : null
          )}
          {manualLatLng && <Marker position={[manualLatLng.lat, manualLatLng.lng]} />}
        </MapContainer>
      </div>
    </div>
  );
}
