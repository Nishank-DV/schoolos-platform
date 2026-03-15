export type Role =
  | "superadmin"
  | "school_admin"
  | "teacher"
  | "parent"
  | "student"
  | "integration_service";

export interface JwtPayload {
  sub: string;
  email: string;
  role: Role;
  schoolId?: string;
  studentId?: string;
  parentId?: string;
  teacherId?: string;
  iat?: number;
  exp?: number;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// CareerBuddy
export interface StudentContext {
  studentId: string;
  name: string;
  grade: number;
  school: string;
  favoriteSubjects: string[];
  hobbies: string[];
  likedActivities: string[];
  dislikedActivities: string[];
}

export interface AssessmentQuestionPayload {
  category: "interest" | "personality" | "aptitude";
  question: string;
  options: string[];
}

export interface CareerRecommendationPayload {
  career: string;
  rank: number;
  category: "top" | "alternate";
  reasoning?: string;
}

export interface CareerReportPayload {
  streamRecommendation: string;
  topCareers: string[];
  alternateCareers: string[];
  interestProfile: string;
  skillRoadmap: string[];
}
