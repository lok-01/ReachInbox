export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
}

export type JobStatus = 'PENDING' | 'SCHEDULED' | 'SENT' | 'FAILED' | 'RATE_LIMITED';

export interface Sender {
  id: string;
  email: string;
  name: string;
  host: string;
  port: number;
  createdAt: string;
}

export interface EmailJob {
  id: string;
  recipient: string;
  subject: string;
  body?: string;
  status: JobStatus;
  scheduledAt: string;
  sentAt?: string;
  sender: string;
  senderName: string;
  error?: string;
  createdAt: string;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface JobsResponse {
  jobs: EmailJob[];
  pagination: Pagination;
}

export interface StatsResponse {
  PENDING?: number;
  SCHEDULED?: number;
  SENT?: number;
  FAILED?: number;
  RATE_LIMITED?: number;
}
