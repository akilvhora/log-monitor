export interface PaginatedResponse<T> {
  data: T[];
  nextCursor: string | null;
  total: number;
}

export interface ApiError {
  error: string;
  message: string;
  statusCode: number;
}
