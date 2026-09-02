# 📱 BOWCON MOBILE — Trụ Sở Điều Hành Di Động & Trợ Lý Thoại iOS

> **Ứng dụng di động độc lập dành riêng cho iPhone của Ngài**  
> Kết nối trực tiếp với Não Bộ Trung Tâm `@bow/agent v4.0.0` qua WebSocket thời gian thực (Cổng 4078).

---

## 🌟 Các Tính Năng Nổi Bật (Key Capabilities)

1. **🎙️ Màn Hình Cuộc Gọi Đàm Thoại 2 Chiều Trực Tiếp (Live Voice Call)**:
   * Trải nghiệm như một cuộc gọi điện thoại VIP với người quản gia thông thái.
   * **Mắt OLED ảo**: Tái hiện chính xác đôi mắt OLED của Robot thật trên màn hình iPhone (`happy`, `listening`, `thinking`, `speaking`, `sleeping`).
   * **Sóng âm thanh vi mô (Radiating Sound Waveform)**: Hiển thị vòng sóng phát sáng khi Ngài hoặc BOWCON đang nói.
   * **Cơ chế Ngắt lời thời gian thực (Full-Duplex Barge-in < 80ms)**: Ngài cất tiếng là BOWCON lập tức im lặng lắng nghe.
   * Hỗ trợ thanh nhập văn bản nhanh khi Ngài ở nơi đông người hoặc ồn ào.

2. **🛒 Quản Trị Kinh Doanh Shop of BOW Từ Xa**:
   * Xem doanh thu hôm nay, chi phí giá vốn (COGS), lợi nhuận ròng và tỷ suất biên lợi nhuận %.
   * **Hàng đợi đơn chờ bàn giao (`pending_fulfillment`)**: Cảnh báo đơn chờ > 15 phút và nút **Bàn Giao Ngay 1-Click**.

3. **🏠 Điều Khiển Nhà Thông Minh & Thăm Dò Robot ESP32-S3**:
   * Bật/tắt đèn bàn làm việc từ xa.
   * Bật điều hòa 24°C trước khi về phòng 15 phút.
   * Xem mức pin %, nhiệt độ chip và trạng thái sạc của Robot ở nhà.
   * Nút phát chuông loa MAX98357 tại nhà.

4. **👁️ Mắt Thần Soi Màn Hình Máy Tính PC (Remote Screen Vision)**:
   * Chụp ảnh tức thì **Màn hình chính (Màn 2)** hoặc **Màn hình phụ (Màn 1)** của PC ở nhà và xem trực tiếp trên iPhone.

5. **👥 Biệt Đội Đa Agent (Multi-Agent Swarm)**:
   * Giao việc nhanh cho `TechScout`, `CoderDevOps`, `ShopOperations`, `HardwareVision`.

---

## 🚀 Hướng Dẫn Khởi Chạy Nhanh (Local Testing)

```bash
# Cài đặt dependencies
npm install

# Khởi chạy máy chủ Dev Server mở cổng cho điện thoại trong cùng mạng WiFi
npm run dev -- --host
```
* Trên iPhone kết nối cùng mạng WiFi nhà, mở Safari gõ: `http://<IP-Máy-Tính>:5173`.
* Nhấn nút **Chia Sẻ (Share) -> Thêm vào Màn hình chính (Add to Home Screen)** để dùng ngay như app Native!

---

## 📲 Hướng Dẫn Xuất File `.ipa` Và Cài Vào iPhone (Sideloading)

1. **Đóng gói dự án**:
   ```bash
   npm run build
   npx cap add ios
   npx cap sync ios
   ```
2. **Cài vào iPhone bằng Sideloadly (Miễn phí trên Windows)**:
   * Mở phần mềm **Sideloadly** trên máy tính.
   * Cắm cáp iPhone vào PC $\to$ Kéo file `.ipa` vào Sideloadly.
   * Nhập Apple ID cá nhân của Ngài $\to$ Nhấn **Start**.
   * Trên iPhone: Vào *Cài đặt $\to$ Cài đặt chung $\to$ Quản lý VPN & Thiết bị $\to$ Tin cậy Apple ID*.
   * App **BOWCON** sẽ xuất hiện trên màn hình chính của iPhone!
