<div align="center">

# UIT StudyLab

**Nền tảng ôn tập và thi thử thông minh dành cho sinh viên Trường Đại học Công nghệ Thông tin – ĐHQG-HCM**

Làm trực tiếp câu hỏi trong các bộ đề · Hiểu vì sao đúng, vì sao sai · Thi thử sát cấu trúc đề thật

![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=nextdotjs&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white)
![Zod](https://img.shields.io/badge/Zod-4-3E67B1?logo=zod&logoColor=white)
![Gemini](https://img.shields.io/badge/Google_Gemini-AI_chấm_tự_luận-8E75B2?logo=googlegemini&logoColor=white)
![Vercel](https://img.shields.io/badge/Deploy-Vercel-000000?logo=vercel&logoColor=white)

</div>

---

## Giới thiệu

**UIT StudyLab** giúp sinh viên UIT ôn tập giữa kỳ, cuối kỳ và luyện thi thử một cách có hệ thống. Thay vì đọc lại lý thuyết dài, sinh viên làm trực tiếp từng câu hỏi trong các bộ đề, nhận phản hồi ngay sau mỗi câu và hiểu rõ lỗi sai của mình.

Phiên bản đầu tiên tập trung vào học phần **IT005 – Nhập môn mạng máy tính (ôn tập giữa kỳ)**. Kiến trúc được thiết kế để mở rộng theo cấu trúc:

```
Học phần → Giữa kỳ / Cuối kỳ → Chương → Bộ câu hỏi
```

> UIT StudyLab là dự án độc lập của sinh viên, **không phải hệ thống chính thức** của Trường Đại học Công nghệ Thông tin.

## Tính năng chính

### 📚 Ôn tập theo chương

- Câu hỏi được chia theo chương, mỗi chương có tiến độ, số câu đã làm và tỉ lệ trả lời đúng riêng.
- Quy trình **chọn đáp án → xác nhận → phản hồi**: lựa chọn chỉ được khóa sau khi xác nhận.
- **Trả lời đúng:** thông báo "Chính xác!" kèm giải thích ngắn gọn về bản chất kiến thức.
- **Trả lời sai:** chỉ ra đáp án đúng, vì sao đáp án đó đúng, **vì sao phương án bạn chọn sai**, kiến thức liên quan và mẹo ghi nhớ. Câu sai được tự động lưu để ôn lại.
- Đánh dấu câu cần xem lại, quay lại câu trước, ôn lại chương từ đầu, phím tắt bàn phím.
- Hiển thị đầy đủ công thức toán (LaTeX), bảng, thông điệp HTTP, chuỗi bit, địa chỉ IP…

### ✍️ Chấm tự luận bằng AI

- Bài tự luận được AI (Google Gemini) chấm theo **đáp án mẫu và rubric**, chấp nhận cách diễn đạt tương đương.
- Kết quả gồm điểm tham khảo, các ý đúng, ý còn thiếu, ý sai, nhận xét và gợi ý cải thiện.
- Câu hỏi chưa có đáp án mẫu hoặc rubric tin cậy **không bị chấm điểm giả tạo**.
- AI không bao giờ được gọi trực tiếp từ trình duyệt; mọi lượt gọi đều qua máy chủ với giới hạn tần suất, timeout và model dự phòng.

### ⏱️ Thi thử sát cấu trúc đề thật

- Đề thi được tạo theo cấu trúc đề giữa kỳ thực tế: **30 câu · 65 phút**, phân bố đúng tỉ trọng từng chương.
- **Thuật toán tạo đề**: kết hợp câu hỏi đã xác minh trong ngân hàng (ưu tiên câu chưa gặp) với các **bài tính toán mới** sinh tự động từ 21 dạng bài: độ trễ, thông lượng, số RTT của HTTP, checksum, Seq/ACK của TCP, cửa sổ trượt, điều khiển tắc nghẽn… Đáp án của bài sinh mới được **tính bằng code** nên luôn chính xác.
- Phòng thi có đồng hồ đếm ngược, danh sách câu, đánh dấu xem lại, cảnh báo trước khi nộp và tự động nộp khi hết giờ.
- **Đáp án được niêm phong (mã hóa AES-256-GCM)** cho tới khi nộp bài: trong lúc thi, trình duyệt không thể đọc được đáp án.
- Bài làm được lưu liên tục, tải lại trang không mất bài.

### 📊 Kết quả, lịch sử và thống kê

- Điểm tổng (thang 10), điểm từng phần, số câu đúng / sai / bỏ trống, thời gian làm bài và kết quả theo từng chương.
- Xem lại toàn bộ đề kèm đáp án và lời giải; lọc riêng câu sai hoặc bỏ trống.
- Nếu phần tự luận chưa chấm được, điểm trắc nghiệm vẫn được lưu và **không hiển thị điểm tổng như thể đã chấm đủ**.
- Báo lỗi câu hỏi để người quản trị xác minh.
- Trang thống kê theo dõi tiến độ, độ chính xác từng chương và biểu đồ điểm các lần thi thử.

## Ngân hàng câu hỏi IT005

| Chương | Nội dung | Số câu |
|---|---|:---:|
| **Chương 1** – Giới thiệu về Internet | Mạng biên, mạng lõi, chuyển mạch gói/kênh, độ trễ, thông lượng, mô hình phân tầng | 45 |
| **Chương 2** – Tầng ứng dụng | Client–server, P2P, HTTP, cookie, web cache, email, DNS, FTP, socket | 86 |
| **Chương 3** – Tầng vận chuyển | UDP, checksum, rdt, Go-Back-N, Selective Repeat, TCP, điều khiển luồng và tắc nghẽn | 80 |
| | **Tổng cộng** | **211** |

- Câu hỏi được tổng hợp từ các đề giữa kỳ đã thi và bộ đề ôn tập, loại bỏ câu trùng lặp.
- **Mọi đáp án đều được xét lại từng câu.** Các đáp án tham khảo sai trong tài liệu gốc đã được sửa và ghi chú ngay trong lời giải; các câu mơ hồ hoặc có nhiều đáp án đúng đã bị loại.
- Mỗi câu có lời giải riêng cho đáp án đúng và cho **từng phương án sai**.

## Giao diện

- Phong cách **Modern Educational SaaS Dashboard**: nền sáng, màu chủ đạo xanh dương, font Be Vietnam Pro, bo góc mềm và bóng nhẹ.
- Animation có chủ đích (chuyển trang, phản hồi đáp án, thanh tiến độ, số liệu thống kê), tôn trọng tùy chọn `prefers-reduced-motion`.
- **Responsive**: sidebar trên máy tính, thanh điều hướng dưới trên điện thoại; các lựa chọn đáp án đủ lớn để thao tác bằng tay.
- Skeleton loading, trạng thái chờ riêng cho AI và empty state rõ ràng.
- Không cần tài khoản: tiến độ học tập được lưu ngay trên trình duyệt.

## Công nghệ

| Thành phần | Công nghệ |
|---|---|
| Framework | Next.js (App Router, Route Handlers) · React · TypeScript |
| Giao diện | Tailwind CSS · Radix UI (phong cách shadcn/ui) · Lucide Icons · Motion |
| Nội dung | react-markdown · remark-gfm · KaTeX |
| Dữ liệu & kiểm tra | Zod · Zustand (lưu tiến độ phía trình duyệt) |
| AI | Google Gemini qua lớp `AIProvider` có thể thay nhà cung cấp |
| Lưu trữ phía máy chủ | Upstash Redis (rate limit, cache kết quả chấm) |
| Kiểm thử | Vitest |
| Triển khai | Vercel |

## Kiến trúc

```
src/
├── app/
│   ├── (main)/        Tổng quan · Ôn tập · Thi thử · Kết quả · Câu hỏi đã lưu · Thống kê
│   ├── (focus)/       Phòng thi (bố cục tập trung)
│   └── api/           Chấm tự luận · Tạo đề · Nộp bài · Báo lỗi câu hỏi
├── components/        Thành phần giao diện, câu hỏi, phiên ôn tập
└── lib/
    ├── bank/          Schema và truy cập ngân hàng câu hỏi
    ├── exam/          Thuật toán tạo đề, sinh bài tính toán, niêm phong đáp án, chấm điểm
    ├── ai/            Chấm tự luận bằng AI
    ├── net/           Bộ tính toán địa chỉ IPv4 độc lập
    └── store/         Tiến độ ôn tập, phiên thi, lịch sử
content/               Ngân hàng câu hỏi theo học phần → kỳ thi → chương
tests/                 Kiểm thử chấm điểm, tạo đề, niêm phong đáp án, kết quả AI
```

**Điểm nổi bật về kỹ thuật**

- **An toàn đáp án:** đề thi được gửi cho trình duyệt dưới dạng không có đáp án; đáp án nằm trong token mã hóa và chỉ được mở ở máy chủ khi nộp bài, giúp hệ thống không cần cơ sở dữ liệu phiên thi.
- **Kiểm chứng bằng code:** các câu tính toán được tạo và kiểm tra bằng thuật toán độc lập; hàng trăm câu sinh ngẫu nhiên được kiểm tra trong bộ test.
- **Dữ liệu được kiểm tra chặt chẽ:** mọi câu hỏi và mọi phản hồi từ AI đều được xác thực bằng schema trước khi sử dụng.
- **Bảo vệ API:** giới hạn tần suất theo IP, ngân sách AI theo ngày, chặn request khác nguồn và không để lộ khóa bí mật ra phía trình duyệt.

## Lộ trình

- [x] IT005 – Ôn tập giữa kỳ
- [ ] IT005 – Ôn tập cuối kỳ
- [ ] Bổ sung câu hỏi tự luận có đáp án mẫu và rubric
- [ ] Mở rộng sang các học phần khác tại UIT

## Tác giả

Phát triển bởi **[huynh-phong](https://github.com/huynh-phong)** – sinh viên Trường Đại học Công nghệ Thông tin, ĐHQG-HCM.

Mọi góp ý về câu hỏi, đáp án hoặc tính năng xin gửi qua mục **Issues** của repository.
