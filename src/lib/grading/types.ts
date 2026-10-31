/** Kiểu dữ liệu kết quả chấm — dùng chung giữa server và client. */

export interface RubricScore {
  id: string;
  criterion: string;
  max: number;
  awarded: number;
  comment: string;
}

export interface EssayGradeResult {
  status: "graded";
  score: number;
  maxScore: number;
  rubric: RubricScore[];
  correctPoints: string[];
  missingPoints: string[];
  incorrectPoints: string[];
  feedback: string;
  suggestions: string[];
  offTopic: boolean;
  modelAnswer: string;
  gradedAt: string;
}

/** Trạng thái chấm tự luận khi không có kết quả. */
export type EssayGradeState =
  | EssayGradeResult
  | { status: "insufficient_reference"; message: string }
  | { status: "unavailable"; message: string }
  | { status: "failed"; message: string }
  | { status: "blank" };

export interface McqGrade {
  questionId: string;
  selected: string | null;
  correctOptionId: string;
  isCorrect: boolean;
  blank: boolean;
  points: number;
  awarded: number;
}
