/** Các bài tự luận MIPS mẫu, chia nhỏ để xem từng phần C ứng với những lệnh nào. */

export interface WalkStep {
  /** Đoạn C đang xét, phải nằm nguyên văn trong `c`. */
  piece: string;
  /** Vị trí các dòng trong `code` (tính từ 0). */
  lines: number[];
  why: string;
}

export interface Walkthrough {
  id: string;
  title: string;
  /** Biến nằm ở thanh ghi nào. */
  vars: string;
  c: string;
  code: string[];
  steps: WalkStep[];
}

export const WALKTHROUGHS: Walkthrough[] = [
  {
    id: "if-else",
    title: "If-else",
    vars: "f, g, h, i, j nằm ở $s0, $s1, $s2, $s3, $s4",
    c: "if (i > j) f = g + h; else f = g - h;",
    code: [
      "slt $t0, $s4, $s3",
      "beq $t0, $zero, Else",
      "add $s0, $s1, $s2",
      "j   Exit",
      "Else: sub $s0, $s1, $s2",
      "Exit:",
    ],
    steps: [
      { piece: "if (i > j)", lines: [0], why: "MIPS chỉ biết hỏi “nhỏ hơn không?”. i > j nghĩa là j < i, nên viết slt với j đứng trước." },
      { piece: "if (i > j)", lines: [1], why: "$t0 = 0 nghĩa là điều kiện sai, nên nhảy sang phần else." },
      { piece: "f = g + h;", lines: [2], why: "Điều kiện đúng thì làm phần này." },
      { piece: "else", lines: [3], why: "Làm xong phải nhảy qua else. Quên lệnh này thì máy làm luôn cả phép trừ." },
      { piece: "f = g - h;", lines: [4], why: "Nhãn Else đánh dấu nơi bắt đầu phần else." },
    ],
  },
  {
    id: "tong-tb",
    title: "Tính tổng, trung bình",
    vars: "i, sum, avg nằm ở $s0, $s1, $s2; địa chỉ đầu mảng A ở $s3",
    c: "sum = 0; for (i = 0; i < 8; i++) sum = sum + A[i]; avg = sum / 8;",
    code: [
      "add  $s1, $zero, $zero",
      "add  $s0, $zero, $zero",
      "Loop: slti $t0, $s0, 8",
      "beq  $t0, $zero, Exit",
      "sll  $t1, $s0, 2",
      "add  $t1, $t1, $s3",
      "lw   $t2, 0($t1)",
      "add  $s1, $s1, $t2",
      "addi $s0, $s0, 1",
      "j    Loop",
      "Exit: srl $s2, $s1, 3",
    ],
    steps: [
      { piece: "sum = 0;", lines: [0], why: "Lấy 0 + 0 rồi cất vào sum." },
      { piece: "i = 0;", lines: [1], why: "Tương tự, gán i = 0." },
      { piece: "i < 8;", lines: [2, 3], why: "Hỏi i < 8 không. Nếu không ($t0 = 0) thì thoát vòng lặp." },
      { piece: "A[i]", lines: [4, 5, 6], why: "Khuôn 3 lệnh lấy A[i]: nhân i với 4, cộng địa chỉ đầu mảng, rồi đọc." },
      { piece: "sum = sum + A[i];", lines: [7], why: "Cộng dồn vào sum." },
      { piece: "i++", lines: [8, 9], why: "Tăng i rồi quay lại đầu vòng." },
      { piece: "avg = sum / 8;", lines: [10], why: "Chia 8 bằng dịch phải 3 bit, vì 8 = 2³." },
    ],
  },
  {
    id: "tim-max",
    title: "Tìm lớn nhất",
    vars: "GTLN, i nằm ở $s0, $s1; địa chỉ đầu mảng B ở $s7",
    c: "GTLN = B[0]; for (i = 1; i <= 9; i++) if (B[i] > GTLN) GTLN = B[i];",
    code: [
      "lw   $s0, 0($s7)",
      "addi $s1, $zero, 1",
      "Loop: slti $t0, $s1, 10",
      "beq  $t0, $zero, Exit",
      "sll  $t1, $s1, 2",
      "add  $t1, $t1, $s7",
      "lw   $t2, 0($t1)",
      "slt  $t0, $s0, $t2",
      "beq  $t0, $zero, Next",
      "add  $s0, $t2, $zero",
      "Next: addi $s1, $s1, 1",
      "j    Loop",
      "Exit:",
    ],
    steps: [
      { piece: "GTLN = B[0];", lines: [0], why: "Coi phần tử đầu là lớn nhất. Chỉ số 0 nên độ dời là 0." },
      { piece: "i = 1;", lines: [1], why: "Bắt đầu xét từ phần tử thứ hai." },
      { piece: "i <= 9;", lines: [2, 3], why: "i <= 9 cũng là i < 10, viết được bằng slti." },
      { piece: "B[i]", lines: [4, 5, 6], why: "Khuôn 3 lệnh lấy B[i]." },
      { piece: "if (B[i] > GTLN)", lines: [7, 8], why: "B[i] > GTLN nghĩa là GTLN < B[i]. Sai thì bỏ qua lệnh gán." },
      { piece: "GTLN = B[i];", lines: [9], why: "Cộng với 0 là cách gán giá trị." },
      { piece: "i++", lines: [10, 11], why: "Nhãn Next đặt ở đây để trường hợp nào cũng tăng i." },
    ],
  },
  {
    id: "hai-mang",
    title: "Hai mảng",
    vars: "g, j, i nằm ở $s2, $s3, $s4; địa chỉ đầu A, B ở $s6, $s7",
    c: "for (i = 1; i < 5; i++) A[i] = j - g + B[i];",
    code: [
      "addi $s4, $zero, 1",
      "Loop: slti $t0, $s4, 5",
      "beq  $t0, $zero, Exit",
      "sll  $t1, $s4, 2",
      "add  $t2, $t1, $s7",
      "lw   $t3, 0($t2)",
      "sub  $t4, $s3, $s2",
      "add  $t3, $t4, $t3",
      "add  $t2, $t1, $s6",
      "sw   $t3, 0($t2)",
      "addi $s4, $s4, 1",
      "j    Loop",
      "Exit:",
    ],
    steps: [
      { piece: "i = 1;", lines: [0], why: "Gán i = 1." },
      { piece: "i < 5;", lines: [1, 2], why: "Sai thì thoát vòng lặp." },
      { piece: "B[i]", lines: [3, 4, 5], why: "Nhân i với 4 một lần, kết quả dùng được cho cả hai mảng. Cộng địa chỉ đầu B rồi đọc." },
      { piece: "j - g + B[i]", lines: [6, 7], why: "Tính lần lượt từ trái sang phải, đúng thứ tự j trừ g." },
      { piece: "A[i] =", lines: [8, 9], why: "Ghi vào mảng nên dùng sw, không phải lw." },
      { piece: "i++", lines: [10, 11], why: "Tăng i rồi quay lại." },
    ],
  },
  {
    id: "chuoi",
    title: "Xử lý chuỗi",
    vars: "Địa chỉ đầu chuỗi ở $s3. ‘a’ = 97, ‘A’ = 65, nên chữ hoa = chữ thường − 32",
    c: "Đổi mọi chữ thường trong chuỗi thành chữ hoa; chuỗi kết thúc bằng byte 0",
    code: [
      "Loop: lbu $a0, 0($s3)",
      "beq  $a0, $zero, End",
      "slti $t0, $a0, 123",
      "beq  $t0, $zero, Next",
      "slti $t0, $a0, 97",
      "bne  $t0, $zero, Next",
      "addi $a0, $a0, -32",
      "sb   $a0, 0($s3)",
      "Next: addi $s3, $s3, 1",
      "j    Loop",
      "End:",
    ],
    steps: [
      { piece: "Đổi mọi chữ thường", lines: [0], why: "Mỗi ký tự 1 byte nên đọc bằng lbu, không phải lw." },
      { piece: "kết thúc bằng byte 0", lines: [1], why: "Gặp số 0 là hết chuỗi." },
      { piece: "chữ thường", lines: [2, 3, 4, 5], why: "Chữ thường có mã từ 97 đến 122. Ngoài khoảng này thì bỏ qua." },
      { piece: "thành chữ hoa", lines: [6, 7], why: "Trừ 32 rồi ghi lại đúng chỗ bằng sb." },
      { piece: "trong chuỗi", lines: [8, 9], why: "Sang ký tự sau: cộng 1, không phải cộng 4." },
    ],
  },
];

export const walkthroughCode = (id: string) => WALKTHROUGHS.find((w) => w.id === id)!.code.join("\n");

/** Các đoạn chạy từng bước. */
export interface TraceExample {
  id: string;
  title: string;
  code: string[];
  regs: Record<string, number>;
  watch: string[];
}

export const TRACES: TraceExample[] = [
  {
    id: "vong-lap",
    title: "Vòng lặp (đề 2025–2026)",
    code: ["start: slt $t2, $t0, $t1", "beq  $t2, $zero, end", "addi $t1, $t1, 1", "addi $t0, $t0, 2", "j start", "end: sub $t0, $t0, $t1"],
    regs: { $t0: 3, $t1: 7 },
    watch: ["$t0", "$t1", "$t2"],
  },
  {
    id: "if-dung",
    title: "If-else, đi nhánh trên",
    code: ["slti $t0, $s1, 5", "beq  $t0, $zero, ELSE", "sll  $t1, $s1, 2", "add  $s2, $s2, $t1", "j End", "ELSE: add $s2, $s1, $zero", "End:"],
    regs: { $s1: 1, $s2: 0 },
    watch: ["$s1", "$s2", "$t0", "$t1"],
  },
  {
    id: "if-sai",
    title: "If-else, đi nhánh dưới",
    code: ["slti $t0, $s1, 5", "beq  $t0, $zero, ELSE", "sll  $t1, $s1, 2", "add  $s2, $s2, $t1", "j End", "ELSE: add $s2, $s1, $zero", "End:"],
    regs: { $s1: 9, $s2: 0 },
    watch: ["$s1", "$s2", "$t0", "$t1"],
  },
];
