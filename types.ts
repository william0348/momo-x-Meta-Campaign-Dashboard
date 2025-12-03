
export interface CampaignData {
  id: string;
  date: string; // Normalized to YYYY-MM-DD
  campaignName: string;
  spent: number;
  cpc: number;
  roas: number;
  cvr: number; // Stored as decimal (e.g., 0.05 for 5%)
  cpa: number;
  // Computed fields for aggregation
  clicks: number;
  conversions: number;
  revenue: number;
  // Facebook Insights Data
  reach?: number;
  impressions?: number;
  cpm?: number;
  ctr?: number;
  linkClicks?: number;
  frequency?: number;
}

export interface DashboardMetrics {
  totalSpent: number;
  avgRoas: number;
  avgCvr: number;
  avgCpa: number;
  avgCpc: number;
  // Facebook Metrics
  totalReach?: number;
  totalImpressions?: number;
  avgCpm?: number;
  avgCtr?: number;
  avgFrequency?: number;
}

export type SortField = keyof CampaignData;
export type SortOrder = 'asc' | 'desc';
