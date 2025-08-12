// src/App.js
// src/App.js
import React, { useEffect, useState, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import exifr from "exifr";
import { db } from "./firebase";
import { collection, addDoc, getDocs, serverTimestamp } from "firebase/firestore";

/*
  注意：
  - Cloudinary 使用 unsigned upload preset (trashmap_unsigned)
  - cloud name = dwhn02tn5
  - 若你要用私人（signed）上傳或 server proxy，請改成 server 端上傳流程
*/

// 修正 leaflet icon 問題（webpack）
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.3/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.3/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.3/dist/images/marker-shadow.png",
});

// 小元件：讓使用者在地圖上點選位置（只有在需要時顯示）
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
  const [photos, setPhotos] = useState([]); // 從 firestore 讀出的照片資料
  const [loadingUpload, setLoadingUpload] = useState(false);
  const [progress, setProgress] = useState(0);
  const [needManualPick, setNeedManualPick] = useState(false);
  const [manualLatLng, setManualLatLng] = useState(null);
  const mapRef = useRef();

  // 讀 Firestore 已上傳的照片
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

  // Helper: 嘗試用 Nominatim 把地址字串轉成經緯度
  const geocodeAddress = async (address) => {
    try {
      const q = encodeURIComponent(address);
      const url = `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1`;
      const res = await fetch(url, { headers: { "User-Agent": "TrashMapApp/1.0 (your@email)" }});
      if (!res.ok) return null;
      const arr = await res.json();
      if (arr && arr.length > 0) {
        return { lat: parseFloat(arr[0].lat), lng: parseFloat(arr[0].lon) };
      }
      return null;
    } catch (err) {
      console.error("geocode error", err);
      return null;
    }
  };

  // 處理上傳流程
  const handleUpload = async () => {
    if (!file) {
      alert("請先選擇照片");
      return;
    }
    setLoadingUpload(true);
    setProgress(0);

    try {
      // 1) 先讀 EXIF（從 File 物件）
      const exifData = await exifr.parse(file, [
        "DateTimeOriginal",
        "latitude",
        "longitude",
        "ImageDescription",
        "UserComment",
        "XPComment"
      ]);

      // 從 exif 取時間
      let takenTime = null;
      if (exifData?.DateTimeOriginal) {
        takenTime = new Date(exifData.DateTimeOriginal).toISOString();
      }

      // 從 exif 取經緯
      let lat = exifData?.latitude ?? null;
      let lng = exifData?.longitude ?? null;

      // 2) 如果沒有 GPS，嘗試從 EXIF 的描述欄位抓地址文字並 geocode
      if ((!lat || !lng) && (exifData?.ImageDescription || exifData?.UserComment || exifData?.XPComment)) {
        const candidate = exifData.ImageDescription || exifData.UserComment || exifData.XPComment;
        const geoc = await geocodeAddress(candidate.toString());
        if (geoc) {
          lat = geoc.lat;
          lng = geoc.lng;
        }
      }

      // 3) 如果仍然沒 GPS，要求使用者在地圖上手動選擇位置（備援）
      if ((!lat || !lng) && !manualLatLng) {
        setNeedManualPick(true);
        setLoadingUpload(false);
        alert("照片沒有 GPS，也無可用地址。請在地圖上點選位置，或使用含定位的原始照片上傳。");
        return;
      }

      // 如果使用者已在地圖點選，覆寫
      if (manualLatLng) {
        lat = manualLatLng.lat;
        lng = manualLatLng.lng;
      }

      // 4) 上傳到 Cloudinary (unsigned)
      const form = new FormData();
      form.append("file", file);
      form.append("upload_preset", "trashmap_unsigned"); // 你的 unsigned preset 名稱

      // 用 fetch 上傳並顯示進度（fetch 沒有 progress 原生 API，使用 XHR）
      const uploadWithProgress = () => new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", `https://api.cloudinary.com/v1_1/dwhn02tn5/image/upload`);
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const pct = Math.round((e.loaded * 100) / e.total);
            setProgress(pct);
          }
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const json = JSON.parse(xhr.responseText);
              resolve(json);
            } catch (err) {
              reject(err);
            }
          } else {
            reject(new Error(`Upload failed: ${xhr.statusText}`));
          }
        };
        xhr.onerror = () => reject(new Error("Network error during upload"));
        xhr.send(form);
      });

      const cloudRes = await uploadWithProgress();

      // 5) 寫入 Firestore
      await addDoc(collection(db, "images"), {
        imageUrl: cloudRes.secure_url,
        lat,
        lng,
        takenTime: takenTime || null,
        createdAt: serverTimestamp()
      });

      alert("上傳並儲存成功！");
      // 重新整理照片清單（簡單做法：reload）
      window.location.reload();
    } catch (err) {
      console.error("上傳失敗：", err);
      alert("上傳失敗：" + (err.message || err));
    } finally {
      setLoadingUpload(false);
    }
  };

  // 當使用者在地圖點選位置（手動備援）
  const onManualSelect = (latlng) => {
    setManualLatLng(latlng);
    setNeedManualPick(false);
    // 之後要重新按上傳：這裡我們保留 file 與 manualLatLng，提醒使用者再按上傳
    alert(`你已選擇位置： ${latlng.lat.toFixed(6)}, ${latlng.lng.toFixed(6)}。請再次按 上傳。`);
  };

  return (
    <div className="container">
      <header>
        <h1>TrashMap — 民眾回報（自動從照片讀取位置/時間）</h1>
      </header>

      <div style={{ marginBottom: 12 }}>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => {
            setFile(e.target.files[0] ?? null);
            setManualLatLng(null);
          }}
        />
        <button onClick={handleUpload} disabled={loadingUpload} style={{ marginLeft: 8 }}>
          {loadingUpload ? `上傳中 ${progress}%` : "上傳照片（自動讀取 GPS/時間）"}
        </button>
      </div>

      {needManualPick && (
        <div style={{ marginBottom: 12, color: "#b00" }}>
          <strong>請在地圖上點一下位置來指定照片位置（備援）</strong>
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
          {/* 如果需要手動選點，啟用 ClickToSelect */}
          {needManualPick && <ClickToSelect onSelect={onManualSelect} />}

          {photos.map((p, idx) => (
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
          ))}

          {/* 如果使用者手動選過位置，顯示暫時標記 */}
          {manualLatLng && <Marker position={[manualLatLng.lat, manualLatLng.lng]} />}
        </MapContainer>
      </div>

      <section>
