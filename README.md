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

Hiện có ba học phần ôn tập giữa kỳ: **IT004 – Cơ sở dữ liệu**, **IT005 – Nhập môn mạng máy tính** và **IT006 – Kiến trúc máy tính**. Kiến trúc được thiết kế để mở rộng theo cấu trúc:

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

### 🎓 Lý thuyết trọng tâm

- IT006 có phần lý thuyết cô đọng, sắp xếp theo mức độ ra đề của 10 đề giữa kỳ, giải thích từ đầu và có ví dụ từng bước.
- Các ví dụ tính toán và khuôn code MIPS được kiểm chứng bằng bộ mô phỏng trong bộ test.

### ✍️ Chấm tự luận bằng AI

- Bài tự luận được AI (Google Gemini) chấm theo **đáp án mẫu và rubric**, chấp nhận cách diễn đạt tương đương.
- Kết quả gồm điểm tham khảo, các ý đúng, ý còn thiếu, ý sai, nhận xét và gợi ý cải thiện.
- Với bài code MIPS, AI chấm theo **ý nghĩa của đoạn lệnh** (dùng thanh ghi khác đáp án mẫu vẫn được tính đúng) và **trích đúng lệnh sai** kèm cách sửa.
- Với đại số quan hệ, AI chấm theo kết quả của biểu thức nên chấp nhận các cách viết tương đương.
- **Nút chèn ký hiệu** (σ, π, ⋈, ⟕, ÷, ℑ, bản số…) ngay trên ô tự luận, dùng được cả khi ôn tập và khi thi.
- Sinh viên có thể sửa bài ngay trên kết quả rồi gửi chấm lại.
- Câu hỏi chưa có đáp án mẫu hoặc rubric tin cậy **không bị chấm điểm giả tạo**.
- AI không bao giờ được gọi trực tiếp từ trình duyệt; mọi lượt gọi đều qua máy chủ với giới hạn tần suất, timeout và model dự phòng.

### ⏱️ Thi thử sát cấu trúc đề thật

- Đề thi được tạo theo cấu trúc riêng của từng môn: **IT005** gồm 30 câu trắc nghiệm trong 65 phút; **IT006** gồm 16 câu trắc nghiệm (8 điểm) và 2 câu tự luận (2 điểm) trong 65 phút: một câu viết chương trình MIPS, một câu chuyển đổi mã máy; **IT004** toàn tự luận như đề thật, gồm Câu 1 ERD và chuyển đổi (2,5 điểm), Câu 2 SQL và đại số quan hệ (7,5 điểm) trong 75 phút.
- **Thuật toán tạo đề**: kết hợp câu hỏi đã xác minh trong ngân hàng (ưu tiên câu chưa gặp) với các **bài tính toán mới** sinh tự động từ 21 dạng bài của IT005 và 23 dạng bài của IT006. Với IT005: độ trễ, thông lượng, số RTT của HTTP, checksum, Seq/ACK của TCP, cửa sổ trượt, điều khiển tắc nghẽn… Đáp án của bài sinh mới được **tính bằng code** nên luôn chính xác.
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

## Ngân hàng câu hỏi IT006

| Phần | Nội dung | Trắc nghiệm | Tự luận |
|---|---|:---:|:---:|
| **Chương 1a** – Các khái niệm và công nghệ | Phân loại máy tính, các lớp phần mềm, thành phần máy tính, bộ nhớ, frame buffer | 82 | – |
| **Chương 1b** – Hiệu suất | Thời gian CPU, CPI, xung nhịp, so sánh máy, thông lượng | 54 | – |
| **Chương 2a** – Phép tính và toán hạng | Thanh ghi, `lw`/`sw`, hằng số, số bù hai, mở rộng dấu, endian | 68 | 10 |
| **Chương 2b** – Biểu diễn lệnh và rẽ nhánh | Mã máy R/I/J, lệnh logic, `beq`/`bne`/`slt`, if-else, vòng lặp, xử lý chuỗi, biên dịch | 117 | 51 |
| **Chương 2c** – Thủ tục và stack | `jal`/`jr`, quy ước thanh ghi, stack, thủ tục lồng nhau và đệ quy | 36 | 7 |
| | **Tổng cộng** | **357** | **68** |

- Tổng hợp từ **10 đề giữa kỳ giai đoạn 2019–2026** và tài liệu training, cùng các câu **soạn thêm từ slide và sổ tay** để phủ toàn bộ Chương 1 và Chương 2; mỗi câu đều ghi rõ nguồn.
- Tự luận tập trung ở Chương 2 như đề thật: dịch C sang MIPS, viết chương trình từ mô tả bằng lời (mảng, chuỗi ký tự), yêu cầu → mã máy và mã máy → ý nghĩa, tính địa chỉ rẽ nhánh, tìm và sửa lỗi, viết thủ tục, đệ quy.
- **Bộ mô phỏng MIPS** viết riêng kiểm chứng mã máy và kết quả chạy của đáp án mỗi lần build; đáp án mẫu dạng code được chạy thử với dữ liệu mẫu, mã hex trong lời giải được mã hóa lại để đối chiếu.
- Bảng tham khảo MIPS có thể mở ngay khi ôn tập và khi làm bài thi.

## Ngân hàng câu hỏi IT004

Chỉ ôn các dạng có thể ra thi, chủ yếu lấy từ đề giữa kỳ giai đoạn 2015–2026 và chia theo đúng dạng trong đề:

| Phần | Dạng bài |
|---|---|
| **Chương 1** | Câu 1: thiết kế ERD từ mô tả nghiệp vụ và chuyển sang mô hình quan hệ |
| **Chương 2** | Chuyển ERD đã cho, xác định khóa chính và khóa ngoại |
| **SQL** | Ràng buộc, khóa ngoại, thêm và sửa cột, cập nhật, xóa |
| **Chương 3** | Chọn, chiếu, kết · “Nếu có”: kết ngoài · “Không, chưa, chỉ”: phép trừ · “Cả hai”: phép giao · “Tất cả”: phép chia · “Với mỗi”: gom nhóm, lọc sau gom nhóm, lớn nhất, tỉ lệ phần trăm |

- Dạng đã ra nhưng còn ít câu được soạn thêm và ghi rõ nguồn.
- Đề thi thử ghép một Câu 1 và một Câu 2 trọn vẹn của các năm.
- Khi dựng ngân hàng, mọi tên quan hệ và thuộc tính trong lời giải được đối chiếu tự động với lược đồ của đề.

## Giao diện

- Phong cách **Modern Educational SaaS Dashboard**: nền sáng, màu chủ đạo xanh dương, font Be Vietnam Pro, bo góc mềm và bóng nhẹ.
- Animation có chủ đích (chuyển trang, phản hồi đáp án, thanh tiến độ, số liệu thống kê), tôn trọng tùy chọn `prefers-reduced-motion`.
- **Responsive**: sidebar trên máy tính, thanh điều hướng dưới trên điện thoại; các lựa chọn đáp án đủ lớn để thao tác bằng tay.
- Skeleton loading, trạng thái chờ riêng cho AI và empty state rõ ràng.
- **Ba chế độ giao diện:** sáng, tối hoặc theo hệ thống, được ghi nhớ trên trình duyệt.
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
    ├── mips/          Bộ mã hóa, giải mã và mô phỏng MIPS, kiểm chứng đáp án
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
- [x] IT006 – Ôn tập giữa kỳ, có tự luận chấm bằng AI
- [x] IT004 – Ôn tập giữa kỳ Chương 1, 2, 3
- [ ] IT005 – Ôn tập cuối kỳ
- [ ] IT006 – Ôn tập cuối kỳ
- [ ] Mở rộng sang các học phần khác tại UIT

## Tác giả

Phát triển bởi **Huỳnh Mai Phong** ([huynh-phong](https://github.com/huynh-phong)) – sinh viên Trường Đại học Công nghệ Thông tin, ĐHQG-HCM.

Mọi góp ý về câu hỏi, đáp án hoặc tính năng xin gửi qua mục **Issues** của repository.
