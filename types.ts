
export interface CampaignData {
  id: string;
  date: string; // Normalized to YYYY-MM-DD
  campaignName: string;

  // Momo (Sheet/Excel) Metrics
  spent: number; // Shared metric
  momoCpc: number;
  roas: number; // Shared metric
  momoCvr: number;
  momoCpa: number;
  
  // Facebook Insights Metrics
  fbCpc?: number;
  fbCtr?: number;
  impressions?: number; // Needed for CTR calculation, but likely not displayed if user wants it removed from UI
  cpm?: number;
  fbLinkClicks?: number;
  fbPurchase?: number; // New: omni_purchase
  fbCpa?: number;      // New: spent / purchase
  fbCvr?: number;      // New: purchase / link_click

  // Computed fields for aggregation
  momoClicks: number;
  momoConversions: number;
  revenue: number;
}

export interface DashboardMetrics {
  totalSpent: number;
  avgRoas: number;
  
  // Momo Metrics
  avgMomoCvr: number;
  avgMomoCpa: number;
  avgMomoCpc: number;

  // Facebook Metrics
  avgCpm?: number;
  avgFbCtr?: number;
  avgFbCpc?: number;
  totalFbPurchase?: number; // New
  avgFbCpa?: number;        // New
  avgFbCvr?: number;        // New
}

export type SortField = keyof CampaignData | 'fbCpc' | 'fbCtr' | 'fbPurchase' | 'fbCpa' | 'fbCvr';
export type SortOrder = 'asc' | 'desc';
export type MetricSource = 'momo' | 'fb';
