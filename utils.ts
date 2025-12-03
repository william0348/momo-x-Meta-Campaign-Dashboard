
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

// --- WebAuthn / Passkey Helpers ---

/**
 * Registers a new Passkey (Touch ID) for the current user.
 */
export const createPasskey = async (email: string): Promise<string | null> => {
  if (!window.PublicKeyCredential) {
    // Silently return null if not supported
    return null;
  }

  // Check for iframe restrictions before attempting
  if (window.self !== window.top) {
      console.warn("Passkeys are likely disabled in this iframe context.");
      return null;
  }

  // Random challenge (Mock)
  const challenge = new Uint8Array(32);
  window.crypto.getRandomValues(challenge);

  // User ID based on email
  const userId = new Uint8Array(email.length);
  for (let i = 0; i < email.length; i++) userId[i] = email.charCodeAt(i);

  const publicKey: PublicKeyCredentialCreationOptions = {
    challenge,
    rp: {
      name: "Meta x momo Dashboard",
      id: window.location.hostname, 
    },
    user: {
      id: userId,
      name: email,
      displayName: email,
    },
    pubKeyCredParams: [
      { alg: -7, type: "public-key" }, // ES256
      { alg: -257, type: "public-key" }, // RS256
    ],
    authenticatorSelection: {
      authenticatorAttachment: "platform", 
      userVerification: "required",
    },
    timeout: 60000,
    attestation: "none",
  };

  try {
    const credential = await navigator.credentials.create({ publicKey }) as PublicKeyCredential;
    if (credential) {
      return credential.id; 
    }
  } catch (e: any) {
    if (e.name === 'NotAllowedError' || 
        e.message.includes('Permissions Policy') || 
        e.message.includes('feature is not enabled')) {
        console.warn("Passkey creation blocked by browser policy (likely running in iframe).");
        return null;
    }
    console.error("WebAuthn Create Error:", e);
    throw e;
  }
  return null;
};

/**
 * Authenticates using an existing Passkey.
 */
export const getPasskey = async (): Promise<string | null> => {
  if (!window.PublicKeyCredential) return null;
  
  if (window.self !== window.top) {
      console.warn("Passkeys are likely disabled in this iframe context.");
      return null;
  }

  const challenge = new Uint8Array(32);
  window.crypto.getRandomValues(challenge);

  const publicKey: PublicKeyCredentialRequestOptions = {
    challenge,
    rpId: window.location.hostname,
    userVerification: "required",
    timeout: 60000,
  };

  try {
    const assertion = await navigator.credentials.get({ publicKey }) as PublicKeyCredential;
    if (assertion) {
      return assertion.id;
    }
  } catch (e: any) {
    if (e.name === 'NotAllowedError' || 
        e.message.includes('Permissions Policy') || 
        e.message.includes('feature is not enabled')) {
        return null; 
    }
    console.error("WebAuthn Get Error:", e);
  }
  return null;
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
    const campaignIdx = findIndex(['廣告活動', 'Campaign Name']);
    const spentIdx = findIndex(['費用', 'Spent']);
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

const fetchPage = async (url: string): Promise<any> => {
    const response = await fetch(url);
    if (!response.ok) {
        const errorData = await response.json();
        console.error("Facebook API Error Details:", errorData.error);
        throw new Error(errorData.error?.message || `HTTP error! status: ${response.status}`);
    }
    return response.json();
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
