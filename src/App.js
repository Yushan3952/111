import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import axios from 'axios';
import 'leaflet/dist/leaflet.css';

// Fix default marker icon issues with React-Leaflet + Webpack
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.3/images/marker-icon-2x.png',
  iconUrl:
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.3/images/marker-icon.png',
  shadowUrl:
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.3/images/marker-shadow.png',
});

function LocationMarker({ setSelectedPosition }) {
  useMapEvents({
    click(e) {
      setSelectedPosition(e.latlng);
    },
  });
  return null;
}

export default function App() {
  const [images, setImages] = useState([]); // {url, lat, lng, timestamp}
  const [selectedPosition, setSelectedPosition] = useState(null);
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  // Load saved images from localStorage (模擬資料庫，方便開發，部署時可換成 Firebase/DB)
  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem('trashmap-images') || '[]');
    setImages(saved);
  }, []);

  // 儲存到 localStorage
  const saveImages = (newImages) => {
    localStorage.setItem('trashmap-images', JSON.stringify(newImages));
    setImages(newImages);
  };

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const handleUpload = async () => {
    if (!file) {
      alert('請先選擇圖片');
      return;
    }
    if (!selectedPosition) {
      alert('請先點擊地圖標記上傳位置');
      return;
    }
    setUploading(true);
    try {
      // 上傳 Cloudinary
      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', process.env.REACT_APP_CLOUDINARY_UPLOAD_PRESET);

      const res = await axios.post(
        `https://api.cloudinary.com/v1_1/${process.env.REACT_APP_CLOUDINARY_CLOUD_NAME}/upload`,
        formData
      );

      // 新增圖片標記
      const newImage = {
        url: res.data.secure_url,
        lat: selectedPosition.lat,
        lng: selectedPosition.lng,
        timestamp: new Date().toISOString(),
      };

      const newImages = [...images, newImage];
      saveImages(newImages);

      alert('上傳成功！');
      setFile(null);
      setSelectedPosition(null);
    } catch (err) {
      console.error(err);
      alert('上傳失敗');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{ padding: '10px' }}>
      <h1>全民科學垃圾熱點回報</h1>

      <MapContainer
        center={[23.7, 120.4]} // 雲林中心
        zoom={9}
        style={{ height: '500px', width: '100%' }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="© OpenStreetMap contributors"
        />
        <LocationMarker setSelectedPosition={setSelectedPosition} />

        {images.map((img, idx) => (
          <Marker key={idx} position={[img.lat, img.lng]}>
            <Popup>
              <div>
                <img src={img.url} alt="垃圾照片" style={{ width: '200px' }} />
                <br />
                <small>上傳時間: {new Date(img.timestamp).toLocaleString()}</small>
              </div>
            </Popup>
          </Marker>
        ))}

        {selectedPosition && (
          <Marker position={[selectedPosition.lat, selectedPosition.lng]}>
            <Popup>上傳位置</Popup>
          </Marker>
        )}
      </MapContainer>

      <div style={{ marginTop: '10px' }}>
        <input type="file" accept="image/*" onChange={handleFileChange} />
        <button onClick={handleUpload} disabled={uploading}>
          {uploading ? '上傳中...' : '上傳垃圾照片'}
        </button>
        <p>請先點擊地圖標記上傳位置，再選擇圖片並點擊上傳</p>
      </div>
    </div>
  );
}
