/** Bố cục tập trung (phòng thi): không có sidebar/thanh điều hướng để tránh xao nhãng. */
export default function FocusLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-dvh bg-background">{children}</div>;
}
