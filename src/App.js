import React from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

// 這是修正 marker 圖示的問題（Leaflet 預設 marker 不會顯示）
delete L.Icon.Default.prototype._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.3/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.3/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.3/images/marker-shadow.png",
});

export default function App() {
  return (
    <div style={{ height: "100vh" }}>
      <MapContainer center={[25.033, 121.565]} zoom={13} style={{ height: "100%" }}>
        <TileLayer
          attribution='&copy; <a href="https://osm.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker position={[25.033, 121.565]}>
          <Popup>這裡是台北101</Popup>
        </Marker>
      </MapContainer>
    </div>
  );
}
