/** Khóa phiên ôn tập — dùng chung server/client (không có "use client"). */
export const chapterSessionKey = (examKey: string, chapterId: string) => `ch:${examKey}:${chapterId}`;
