import type { Metadata } from "next";
import { ExamRoom } from "./exam-room";

export const metadata: Metadata = { title: "Phòng thi" };

export default function ExamRoomPage() {
  return <ExamRoom />;
}
