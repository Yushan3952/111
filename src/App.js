// src/App.js
import React, { useEffect, useState, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import exifr from "exifr";
import { db } from "./firebase";
import { collection, addDoc, getDocs, serverTimestamp } from "firebase/firestore";

// Leaflet 圖標修正
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.3/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.3/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.3/dist/images/marker-shadow.png",
});

// 小元件：點擊地圖取得經緯度（備援）
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
  const [photos, setPhotos] = useState([]); // Firestore 照片資料
  const [loadingUpload, setLoadingUpload] = useState(false);
  const [progress, setProgress] = useState(0);
  const [needManualPick, setNeedManualPick] = useState(false);
  const [manualLatLng, setManualLatLng] = useState(null);
  const mapRef = useRef();

  // 讀 Firestore 照片
  useEffect(() => {
    const load = async () => {
      try {
        const snap = await getDocs(collection(db, "images"));
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setPhotos(list);
      } catch (err) {
        console.error("讀取 Firestore 失敗:", err);
      }
    };
    load();
  }, []);

  // 透過 Nominatim 將地址文字轉經緯度
  const geocodeAddress = async (address) => {
    try {
      const q = encodeURIComponent(address);
      const url = `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1`;
      const res = await fetch(url, { headers: { "User-Agent": "TrashMapApp/1.0 (your@email)" } });
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

  // 上傳照片與處理流程
  const handleUpload = async () => {
    if (!file) {
      alert("請先選擇照片");
      return;
    }
    setLoadingUpload(true);
    setProgress(0);

    try {
      // 讀取完整 EXIF
      const exifData = await exifr.parse(file);
      console.log("完整 exifData:", exifData);

      // 拍攝時間 (ISO)
      let takenTime = exifData.DateTimeOriginal
        ? new Date(exifData.DateTimeOriginal).toISOString()
        : null;

      // 取經緯度
      let lat = exifData.latitude ?? exifData.gpsLatitude ?? null;
      let lng = exifData.longitude ?? exifData.gpsLongitude ?? null;

      // 若無 GPS，嘗試從文字欄位解析地址轉經緯
      if (
        (!lat || !lng) &&
        (exifData.ImageDescription || exifData.UserComment || exifData.XPComment)
      ) {
        const candidate =
          exifData.ImageDescription || exifData.UserComment || exifData.XPComment;
        const geoc = await geocodeAddress(candidate.toString());
        if (geoc) {
          lat = geoc.lat;
          lng = geoc.lng;
        }
      }

      // 若還是沒經緯度，且沒手動選擇，要求手動點
      if ((!lat || !lng) && !manualLatLng) {
        setNeedManualPick(true);
        setLoadingUpload(false);
        alert("照片沒有 GPS，也無可用地址。請在地圖上點選位置，或使用含定位的原始照片上傳。");
        return;
      }

      // 手動選擇覆蓋
      if (manualLatLng) {
        lat = manualLatLng.lat;
        lng = manualLatLng.lng;
      }

      // 上傳到 Cloudinary unsigned
      const form = new FormData();
      form.append("file", file);
      form.append("upload_preset", "trashmap_unsigned");

      const uploadWithProgress = () =>
        new Promise((resolve, reject) => {
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

      // Firestore 新增照片資料
      await addDoc(collection(db, "images"), {
        imageUrl: cloudRes.secure_url,
        lat,
        lng,
        takenTime: takenTime || null,
        createdAt: serverTimestamp(),
      });

      alert("上傳並儲存成功！");
      window.location.reload();
    } catch (err) {
      console.error("上傳失敗：", err);
      alert("上傳失敗：" + (err.message || err));
    } finally {
      setLoadingUpload(false);
    }
  };

  // 使用者點選地圖手動定位
  const onManualSelect = (latlng) => {
    setManualLatLng(latlng);
    setNeedManualPick(false);
    alert(
      `你已選擇位置： ${latlng.lat.toFixed(6)}, ${latlng.lng.toFixed(6)}。請再次按 上傳。`
    );
  };

  return (
    <div className="container" style={{ maxWidth: 720, margin: "auto", padding: 12 }}>
      <header>
        <h1>全民科學垃圾回報系統</h1>
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
        <button
          onClick={handleUpload}
          disabled={loadingUpload}
          style={{ marginLeft: 8 }}
        >
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
          {needManualPick && <ClickToSelect onSelect={onManualSelect} />}
          {photos.map((p, idx) =>
            p.lat && p.lng ? (
              <Marker key={idx} position={[p.lat, p.lng]}>
                <Popup>
                  <div style={{ textAlign: "center" }}>
                    <img
                      src={p.imageUrl}
                      alt="photo"
                      style={{ width: "180px", display: "block", marginBottom: 6 }}
                    />
                    <div>
                      {p.takenTime
                        ? new Date(p.takenTime).toLocaleString()
                        : "無時間資訊"}
                    </div>
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
