import axios from 'axios';
import type { User, Sender, JobsResponse, StatsResponse } from '../types';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000/api';

const apiClient = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const api = {
  // Authentication
  loginWithGoogle: async (credential: string): Promise<User> => {
    const res = await apiClient.post<User>('/auth/google', { credential });
    return res.data;
  },

  // Senders
  getSenders: async (): Promise<Sender[]> => {
    const res = await apiClient.get<Sender[]>('/senders');
    return res.data;
  },

  createSender: async (senderData: {
    type?: 'ethereal' | 'custom';
    name?: string;
    email?: string;
    host?: string;
    port?: number;
    user?: string;
    pass?: string;
  }): Promise<Sender> => {
    const res = await apiClient.post<Sender>('/senders', senderData);
    return res.data;
  },

  // Jobs
  getScheduledJobs: async (page = 1, limit = 10, status?: string): Promise<JobsResponse> => {
    const res = await apiClient.get<JobsResponse>('/jobs/scheduled', {
      params: { page, limit, status },
    });
    return res.data;
  },

  getSentJobs: async (page = 1, limit = 10, status?: string): Promise<JobsResponse> => {
    const res = await apiClient.get<JobsResponse>('/jobs/sent', {
      params: { page, limit, status },
    });
    return res.data;
  },

  getStats: async (): Promise<StatsResponse> => {
    const res = await apiClient.get<StatsResponse>('/jobs/stats');
    return res.data;
  },

  getJobDetails: async (id: string): Promise<any> => {
    const res = await apiClient.get(`/jobs/${id}`);
    return res.data;
  },

  // Campaigns
  scheduleCampaign: async (formData: FormData): Promise<{
    message: string;
    campaignId: string;
    leadsCount: number;
  }> => {
    const res = await axios.post(`${API_BASE}/campaigns`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return res.data;
  },
};
