
import { CampaignData } from './types';
import * as XLSX from 'xlsx';

// Helper to handle "157,047" string to number
const parseNumber = (value: string | number | undefined): number => {
  if (typeof value === 'number') return value;
  if (!value) return 0;
  const clean = value.replace(/,/g, '').trim();
  if (clean === '-' || clean === '') return 0;
  return parseFloat(clean) || 0;
};

// Helper to handle "0.90%" to 0.009
const parsePercentage = (value: string | number | undefined): number => {
  if (typeof value === 'number') {
    return value;
  }
  if (!value) return 0;
  const clean = value.replace('%', '').trim();
  if (clean === '-' || clean === '') return 0;
  return parseFloat(clean) / 100 || 0; 
};

// Normalize date to YYYY-MM-DD
const normalizeDate = (dateInput: string | number | Date): string => {
  let date: Date;
  if (dateInput instanceof Date) {
    date = dateInput;
  } else if (typeof dateInput === 'number') {
    date = new Date(Math.round((dateInput - 25569) * 86400 * 1000));
  } else {
    date = new Date(dateInput);
  }
  if (isNaN(date.getTime())) return '';
  return date.toISOString().split('T')[0];
};

// --- Google Sign-In Helpers ---

/**
 * Verifies a Google Identity Services ID token against Google's tokeninfo endpoint.
 * This runs entirely client-side (no backend), so it confirms the token's signature,
 * expiry and audience are valid, and returns the verified email — good enough gating
 * for an internal tool, but not a substitute for server-side session verification.
 */
export const verifyGoogleIdToken = async (idToken: string, expectedClientId: string): Promise<{ email: string, emailVerified: boolean } | null> => {
  const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
  if (!response.ok) return null;

  const payload = await response.json();
  if (payload.aud !== expectedClientId) return null;
  if (!payload.email) return null;

  return { email: String(payload.email).toLowerCase(), emailVerified: payload.email_verified === 'true' || payload.email_verified === true };
};

/**
 * Fetches the list of Gmail accounts authorized to view the dashboard from the
 * "Authorized Users" Google Sheet tab (managed via the Admin panel).
 */
export const fetchAuthorizedEmails = async (scriptUrl: string, sheetName: string): Promise<string[]> => {
  const response = await fetch(`${scriptUrl}?sheet=${encodeURIComponent(sheetName)}`);
  if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

  const json = await response.json();
  if (json.status !== 'success' || !Array.isArray(json.data)) throw new Error(json.message || 'Failed to load authorized users.');

  // Skip header row, drop blanks
  return json.data.slice(1)
    .map((row: any[]) => String(row[0] || '').trim().toLowerCase())
    .filter((email: string) => email.length > 0);
};

/**
 * Overwrites the "Authorized Users" sheet tab with the given email list.
 */
export const saveAuthorizedEmails = async (scriptUrl: string, sheetName: string, emails: string[]): Promise<void> => {
  const response = await fetch(scriptUrl, {
    method: 'POST',
    mode: 'cors',
    body: JSON.stringify({
      sheetTitle: sheetName,
      values: [['Email'], ...emails.map(email => [email])],
    }),
  });

  const result = await response.json();
  if (result.status !== 'success') throw new Error(result.message);
};

const mapRowToCampaignData = (row: any[], index: number, headers: string[]): CampaignData | null => {
    const findIndex = (candidates: string[]) => {
      for (const candidate of candidates) {
        let idx = headers.indexOf(candidate);
        if (idx !== -1) return idx;
        idx = headers.findIndex(h => h.toLowerCase() === candidate.toLowerCase());
        if (idx !== -1) return idx;
      }
      return -1;
    };
  
    // Momo Metrics Indices
    const dateIdx = findIndex(['日期', 'Date']);
    const campaignIdx = findIndex(['廣告活動', '廣告後台名稱', 'Campaign Name']);
    const spentIdx = findIndex(['費用', '花費', 'Spent']);
    const cpcIdx = findIndex(['流量成本', 'CPC']);
    const roasIdx = findIndex(['ROAS']);
    const cvrIdx = findIndex(['CVR']);
    const cpaIdx = findIndex(['CPA']);
  
    // Facebook Metrics Indices
    const fbPurchaseIdx = findIndex(['FB Purchases', 'Purchases', 'fbPurchase']);
    const fbCpaIdx = findIndex(['FB CPA', 'fbCpa']);
    const fbCvrIdx = findIndex(['FB CVR', 'fbCvr']);
    const fbCpcIdx = findIndex(['FB CPC', 'fbCpc']);
    const fbCtrIdx = findIndex(['FB CTR', 'fbCtr']);
    const cpmIdx = findIndex(['CPM']);
    const fbClicksIdx = findIndex(['FB Link Clicks', 'Link Clicks', 'fbLinkClicks']);
    const imprIdx = findIndex(['Impressions']);

    const dateRaw = dateIdx !== -1 ? row[dateIdx] : undefined;
    const campaignName = campaignIdx !== -1 ? row[campaignIdx] : undefined;
  
    if (!dateRaw || !campaignName) return null;
  
    // Parse Momo Data
    const spent = spentIdx !== -1 ? parseNumber(row[spentIdx]) : 0;
    const momoCpc = cpcIdx !== -1 ? parseNumber(row[cpcIdx]) : 0;
    const roas = roasIdx !== -1 ? parseNumber(row[roasIdx]) : 0;
    const momoCvr = cvrIdx !== -1 ? parsePercentage(row[cvrIdx]) : 0;
    const momoCpa = cpaIdx !== -1 ? parseNumber(row[cpaIdx]) : 0;
    
    // Parse Facebook Data (if present in sheet)
    const fbPurchase = fbPurchaseIdx !== -1 ? parseNumber(row[fbPurchaseIdx]) : 0;
    const fbCpa = fbCpaIdx !== -1 ? parseNumber(row[fbCpaIdx]) : 0;
    const fbCvr = fbCvrIdx !== -1 ? parsePercentage(row[fbCvrIdx]) : 0;
    const fbCpc = fbCpcIdx !== -1 ? parseNumber(row[fbCpcIdx]) : 0;
    const fbCtr = fbCtrIdx !== -1 ? parsePercentage(row[fbCtrIdx]) : 0;
    const cpm = cpmIdx !== -1 ? parseNumber(row[cpmIdx]) : 0;
    const fbLinkClicks = fbClicksIdx !== -1 ? parseNumber(row[fbClicksIdx]) : 0;
    const impressions = imprIdx !== -1 ? parseNumber(row[imprIdx]) : 0;

    const dateNormalized = normalizeDate(dateRaw);
    if (!dateNormalized) return null;
  
    const momoClicks = momoCpc > 0 ? spent / momoCpc : 0;
    const momoConversions = momoCpa > 0 ? spent / momoCpa : 0;
    const revenue = spent * roas;
  
    return {
      id: `${dateNormalized}-${index}-${Math.random().toString(36).substr(2, 5)}`,
      date: dateNormalized,
      campaignName: String(campaignName).trim(),
      spent,
      momoCpc,
      roas,
      momoCvr,
      momoCpa,
      momoClicks,
      momoConversions,
      revenue,
      // FB fields
      fbPurchase,
      fbCpa,
      fbCvr,
      fbCpc,
      fbCtr,
      cpm,
      fbLinkClicks,
      impressions
    };
  };

export const parseSheetData = (values: any[][]): CampaignData[] => {
  if (!values || values.length < 2) return [];
  const headers = values[0].map(h => String(h).trim());
  return values.slice(1)
    .map((row, index) => mapRowToCampaignData(row, index, headers))
    .filter((item): item is CampaignData => item !== null);
};

export const readExcelFile = (file: File): Promise<CampaignData[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
          const headers = jsonData[0].map(h => String(h).trim());
          const parsedData = jsonData.slice(1)
            .map((row, index) => mapRowToCampaignData(row, index, headers))
            .filter((item): item is CampaignData => item !== null);
          resolve(parsedData);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = (err) => reject(err);
      reader.readAsArrayBuffer(file);
    });
  };

export const mergeCampaignData = (existing: CampaignData[], incoming: CampaignData[]): CampaignData[] => {
  const map = new Map<string, CampaignData>();
  
  // 1. Add all existing data to map
  existing.forEach(item => {
    const key = `${item.date}|${item.campaignName.trim()}`;
    map.set(key, item);
  });

  // 2. Add incoming data ONLY if it doesn't already exist
  // This prioritizes existing data and only appends strictly new records.
  incoming.forEach(item => {
    const key = `${item.date}|${item.campaignName.trim()}`;
    if (!map.has(key)) {
        map.set(key, item);
    }
  });

  return Array.from(map.values()).sort((a, b) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );
};

// --- Facebook API Helpers ---

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const RATE_LIMIT_CODES = new Set([4, 17, 32, 613, 80000, 80003, 80004]);

const fetchPage = async (url: string, attempt = 0): Promise<any> => {
    const response = await fetch(url);
    const json = await response.json();

    if (!response.ok || json.error) {
        const err = json.error || {};
        const code = err.code;
        console.error("Facebook API Error:", err);

        // Rate limit — retry with exponential backoff (max 4 retries)
        if (RATE_LIMIT_CODES.has(code) && attempt < 4) {
            const wait = Math.pow(2, attempt + 1) * 5000; // 10s, 20s, 40s, 80s
            console.warn(`Rate limit hit (code ${code}). Waiting ${wait / 1000}s before retry ${attempt + 1}/4...`);
            await sleep(wait);
            return fetchPage(url, attempt + 1);
        }

        throw new Error(err.message || `HTTP error! status: ${response.status}`);
    }

    return json;
}

// Helper to add days to a date string YYYY-MM-DD
const addDaysToDate = (dateStr: string, days: number): string => {
    const date = new Date(dateStr);
    date.setDate(date.getDate() + days);
    return date.toISOString().split('T')[0];
};

/**
 * Fetches Facebook Insights with chunking to avoid large request errors.
 * Breaks the requested date range into 30-day chunks.
 */
export const fetchFacebookInsights = async (accessToken: string, adAccountId: string, startDate?: string, endDate?: string): Promise<Partial<CampaignData>[]> => {
  try {
    // Basic fields configuration - Removed 'reach', added 'omni_purchase' via actions
    const fields = 'campaign_id,campaign_name,spend,impressions,actions';
    const filtering = encodeURIComponent(JSON.stringify([{ field: "action_type", operator: "IN", value: ["link_click", "omni_purchase"] }]));
    
    // Determine the full range to fetch
    // If no dates provided, fallback to maximum (not recommended for large accounts)
    if (!startDate || !endDate) {
        // Fallback for no date selection (risky for large data)
        const url = `https://graph.facebook.com/v19.0/act_${adAccountId}/insights?level=campaign&fields=${fields}&time_increment=1&filtering=${filtering}&date_preset=maximum&access_token=${accessToken}&limit=500`;
        const result = await fetchAllPages(url);
        return processFbRawData(result);
    }

    // --- Date Chunking Logic ---
    let allRawData: any[] = [];
    let currentChunkStart = startDate;
    const finalDate = new Date(endDate);

    while (new Date(currentChunkStart) <= finalDate) {
        // Define chunk end (Start + 30 days)
        let currentChunkEnd = addDaysToDate(currentChunkStart, 30);
        
        // Cap chunk end at the final requested end date
        if (new Date(currentChunkEnd) > finalDate) {
            currentChunkEnd = endDate;
        }

        const timeRange = `&time_range={"since":"${currentChunkStart}","until":"${currentChunkEnd}"}`;
        const url = `https://graph.facebook.com/v19.0/act_${adAccountId}/insights?level=campaign&fields=${fields}&time_increment=1&filtering=${filtering}${timeRange}&access_token=${accessToken}&limit=500`;
        
        // Fetch all pages for this chunk
        const chunkData = await fetchAllPages(url);
        allRawData = allRawData.concat(chunkData);

        // Move to next day after current chunk
        currentChunkStart = addDaysToDate(currentChunkEnd, 1);

        // Delay between chunks to avoid rate limiting
        if (new Date(currentChunkStart) <= finalDate) {
            await sleep(1500);
        }
    }
    
    return processFbRawData(allRawData);

  } catch (error) {
    console.error("Facebook API Error:", error);
    throw error;
  }
};

// Helper to handle pagination for a specific URL
const fetchAllPages = async (initialUrl: string): Promise<any[]> => {
    let allData: any[] = [];
    let url: string | undefined = initialUrl;

    while (url) {
        const result = await fetchPage(url);
        if (result.data) {
            allData = allData.concat(result.data);
        }
        url = result.paging?.next;
    }
    return allData;
};

// Helper to process the raw array into CampaignData
const processFbRawData = (data: any[]): Partial<CampaignData>[] => {
    return data.map((item: any) => {
        const spent = parseFloat(item.spend || '0');
        const impressions = parseInt(item.impressions || '0');
        
        let linkClicks = 0;
        let purchases = 0;

        if (Array.isArray(item.actions)) {
            const clickAction = item.actions.find((action: any) => action.action_type === 'link_click');
            if (clickAction) {
                linkClicks = parseInt(clickAction.value || '0');
            }
            const purchaseAction = item.actions.find((action: any) => action.action_type === 'omni_purchase');
            if (purchaseAction) {
                purchases = parseInt(purchaseAction.value || '0');
            }
        }

        // New Formulas
        // cpc = spend / link_click
        const fbCpc = linkClicks > 0 ? spent / linkClicks : 0;
        // ctr = link_click / impressions
        const fbCtr = impressions > 0 ? linkClicks / impressions : 0;
        // CPA = spend / Purchase
        const fbCpa = purchases > 0 ? spent / purchases : 0;
        // CVR = Purchase / link_click
        const fbCvr = linkClicks > 0 ? purchases / linkClicks : 0;

        return {
            date: item.date_start,
            campaignName: item.campaign_name,
            impressions,
            cpm: impressions > 0 ? spent / (impressions / 1000) : 0,
            fbCpc,
            fbCtr,
            fbLinkClicks: linkClicks,
            fbPurchase: purchases,
            fbCpa,
            fbCvr
        };
    });
};

export const mergeFacebookData = (sheetData: CampaignData[], fbData: Partial<CampaignData>[]): CampaignData[] => {
    const fbMap = new Map<string, Partial<CampaignData>>();
    fbData.forEach(fbItem => {
        if (fbItem.date && fbItem.campaignName) {
            fbMap.set(`${fbItem.date}|${fbItem.campaignName.trim()}`, fbItem);
        }
    });

    return sheetData.map(sheetItem => {
        const key = `${sheetItem.date}|${sheetItem.campaignName.trim()}`;
        const fbMatch = fbMap.get(key);
        if (fbMatch) {
            return { ...sheetItem, ...fbMatch };
        }
        return sheetItem;
    }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
};


// --- Export Helpers ---

export const exportToCSV = (data: CampaignData[], filename: string) => {
  if (data.length === 0) return;

  const headers = [
    'Date', 'Campaign Name', 'Spent', 'Revenue', 'ROAS',
    'Momo Clicks', 'Momo Conversions', 'Momo CPC', 'Momo CPA', 'Momo CVR',
    'Impressions', 'FB Link Clicks', 'FB CPC', 'FB CTR', 'CPM', 'FB Purchases', 'FB CPA', 'FB CVR'
  ];

  const escapeCsv = (value: any) => `"${String(value ?? '').replace(/"/g, '""')}"`;

  const rows = data.map(item => [
    item.date,
    escapeCsv(item.campaignName),
    item.spent,
    item.revenue,
    item.roas,
    item.momoClicks,
    item.momoConversions,
    item.momoCpc,
    item.momoCpa,
    item.momoCvr,
    item.impressions || 0,
    item.fbLinkClicks || 0,
    item.fbCpc || 0,
    item.fbCtr || 0,
    item.cpm || 0,
    item.fbPurchase || 0,
    item.fbCpa || 0,
    item.fbCvr || 0,
  ]);

  const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
  // Prepend BOM so Excel opens UTF-8 (Chinese campaign names) correctly
  const blob = new Blob(['﻿' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value); 
};

export const formatPercentage = (value: number) => {
  return `${(value * 100).toFixed(1)}%`;
};

export const formatNumber = (value: number) => {
    if (value === 0) return '0';
    if (!value) return '-';
    // Format integers without decimals
    if (Number.isInteger(value)) {
       return new Intl.NumberFormat('en-US').format(value);
    }
    return new Intl.NumberFormat('en-US', {
      maximumFractionDigits: 2,
    }).format(value);
};

export const formatDecimal = (value: number) => {
  if (value === 0) return '0.0';
  if (!value) return '-';
  return value.toFixed(1);
};
