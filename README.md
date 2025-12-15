<div align="center">
  <img width="1200" height="475" alt="Project Banner"
       src="https://sf-static.upanhlaylink.com/img/image_20251215fe6391e84db286b1cceed718880ec0e5.jpg" />
  
  <h1> Hướng Dẫn Triển Khai Dự Án</h1>
  
  <p>
    <img src="https://img.shields.io/badge/Firebase-FFCA28?style=for-the-badge&logo=firebase&logoColor=black" alt="Firebase"/>
    <img src="https://img.shields.io/badge/AI-Powered-blue?style=for-the-badge&logo=openai&logoColor=white" alt="AI"/>
    <img src="https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" alt="Node.js"/>
  </p>
  
  <p><em>Hướng dẫn chi tiết triển khai hệ thống </em></p>
</div>

---

## Mục Lục

- [1. Cấu Hình Database (Firebase)](#1-cấu-hình-database-firebase)
- [2. Tích Hợp API Key AI](#2-tích-hợp-api-key-ai)
- [3. Cài Đặt Thư Viện](#3-cài-đặt-thư-viện)
- [4. Chạy Dự Án](#4-chạy-dự-án)
- [5. Thiết Lập Quyền Admin](#5-thiết-lập-quyền-admin)
- [6. Hoàn Tất Triển Khai](#6-hoàn-tất-triển-khai)

---

## 1. Cấu Hình Database (Firebase)

### Các bước thực hiện:

1. **Tạo Project mới trên Firebase**
   - Truy cập [Firebase Console](https://console.firebase.google.com/)
   - Tạo một project mới

2. **Khởi tạo Database**
   - Vào mục **Firestore Database** hoặc **Realtime Database**
   - Khởi tạo database theo nhu cầu dự án

3. **Lấy Firebase Configuration**
   - Truy cập **Project Settings** → **General**
   - Sao chép **Firebase Config** (API Key, Project ID, etc.)

4. **Thêm cấu hình vào dự án**
   - Cập nhật thông tin Firebase Config vào file cấu hình của project

<div align="center">
  <img src="https://sf-static.upanhlaylink.com/img/image_2025121586e5042108d8aedaea513a1177f6c38a.jpg" alt="Firebase Configuration" width="800"/>
</div>

> **⚠️ Lưu ý:** Không commit Firebase Config chứa thông tin nhạy cảm lên repository công khai

---

## 2. Tích Hợp API Key AI

### Cách thêm API Key:

- Khai báo **API Key AI** vào hệ thống theo một trong hai cách:
  
  **Cách 1:** Thêm vào cấu hình chung
  - API Key áp dụng cho toàn bộ hệ thống
  
  **Cách 2:** Thêm riêng cho từng chức năng
  - Quản lý bởi Admin
  - Linh hoạt hơn cho các module khác nhau

> **Bảo mật:** Tuyệt đối KHÔNG công khai API Key trên repository

---

## 3. Cài Đặt Thư Viện

Mở **Terminal** tại thư mục gốc của project và chạy:

```bash
npm install
```

###  Xử lý lỗi Dependency Conflict

Nếu gặp lỗi xung đột thư viện, sử dụng các lệnh sau:

```bash
# Cài đặt với legacy peer deps
npm install --legacy-peer-deps

# Cài đặt Firebase với legacy mode
npm install firebase --legacy-peer-deps
```

---

## 4. Chạy Dự Án

Sau khi cài đặt đầy đủ thư viện, khởi chạy dự án ở môi trường phát triển:

```bash
npm run dev
```

Hệ thống sẽ được khởi chạy tại địa chỉ local (thường là `http://localhost:3000`)

---

## 5. Thiết Lập Quyền Admin

### Bước 1: Đăng ký tài khoản

- Đăng ký một tài khoản người dùng mới trên hệ thống

### Bước 2: Cấp quyền Admin

1. Truy cập **Firebase Console** → **Database**
2. Tìm tài khoản vừa tạo trong collection `users`
3. Thêm/cập nhật field `role: "admin"` cho tài khoản đó

### Bước 3: Xác nhận quyền

- Đăng nhập lại với tài khoản vừa cấp quyền
- Tài khoản đã chuyển sang trạng thái **Admin**

###  Quyền của Admin

Admin có toàn quyền quản lý hệ thống, bao gồm:

- **Quản lý người dùng**
  - Xem danh sách user
  - Phân quyền cho user khác
  - Khóa/mở khóa tài khoản

-  **Quản lý cấu hình hệ thống**
  - Chỉnh sửa các thiết lập toàn cục
  - Quản lý database

-  **Quản lý API Key**
  - Thêm/sửa/xóa API Key chung
  - Thêm API Key cho từng chức năng cụ thể trong mục **Quản Lý**

---

## 6. Hoàn Tất Triển Khai

Sau khi hoàn thành toàn bộ các bước trên:

- ✔️ Hệ thống sẵn sàng hoạt động
- ✔️ Database và các chức năng AI được kết nối đầy đủ
- ✔️ Tài khoản Admin có toàn quyền quản lý hệ thống
- ✔️ Có thể tiếp tục mở rộng hoặc triển khai trên môi trường **production**

---

## Publish và deploy website lên hosting

Lúc này website của bạn đang chạy ở môi trường phát triển, để deploy lên hosting, bạn cần thực hiện các bước sau:

1. Tạo tài khoản hosting
2. Cấu hình domain
3. Deploy website
Lưu ý: Khi triển khai dự án lên hosting, API của Firebase có thể không hoạt động do giới hạn cấu hình. Vì vậy, cần cấu hình lại Firebase API Key bằng cách khai báo trong file .env của dự án, sau đó triển khai ứng dụng trên VPS để đảm bảo hệ thống vận hành ổn định và an toàn.

---

<div align="center">
  <p>Presented by <strong>Admin LIMVA</strong> - Phan Văn An</p>
</div>
