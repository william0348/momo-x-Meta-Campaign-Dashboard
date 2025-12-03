
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

export const parseCSV = (csv: string): CampaignData[] => {
  const lines = csv.split('\n').filter((line) => line.trim() !== '');
  const data: CampaignData[] = [];
  for (let i = 1; i < lines.length; i++) {
    const regex = /(".*?"|[^",\s]+)(?=\s*,|\s*$)/g;
    const matches = lines[i].match(regex);
    if (matches && matches.length >= 7) {
      const cleanMatches = matches.map((m) => m.replace(/^"|"$/g, ''));
      const [dateRaw, campaignName, spentStr, cpcStr, roasStr, cvrStr, cpaStr] = cleanMatches;
      const spent = parseNumber(spentStr);
      const cpc = parseNumber(cpcStr);
      const roas = parseNumber(roasStr);
      const cvr = parsePercentage(cvrStr); 
      const cpa = parseNumber(cpaStr);
      const clicks = cpc > 0 ? spent / cpc : 0;
      const conversions = cpa > 0 ? spent / cpa : 0; 
      const revenue = spent * roas;

      data.push({
        id: `${dateRaw}-${i}`, 
        date: normalizeDate(dateRaw),
        campaignName,
        spent,
        cpc,
        roas,
        cvr,
        cpa,
        clicks,
        conversions,
        revenue
      });
    }
  }
  return data;
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

export const parseSheetData = (values: any[][]): CampaignData[] => {
  if (!values || values.length < 2) return [];

  const headers = values[0].map(h => String(h).trim());
  const data: CampaignData[] = [];

  const findIndex = (candidates: string[]) => {
    for (const candidate of candidates) {
      let idx = headers.indexOf(candidate);
      if (idx !== -1) return idx;
      idx = headers.findIndex(h => h.toLowerCase() === candidate.toLowerCase());
      if (idx !== -1) return idx;
    }
    const englishCandidates = candidates.filter(c => /^[a-zA-Z]+$/.test(c));
    for (const eng of englishCandidates) {
       const idx = headers.findIndex(h => h.toLowerCase().includes(eng.toLowerCase()));
       if (idx !== -1) return idx;
    }
    return -1;
  };

  const dateIdx = findIndex(['日期', 'Date']);
  const campaignIdx = findIndex(['廣告活動', 'Campaign', 'Campaign Name']);
  const spentIdx = findIndex(['費用', 'spent', 'Spent']);
  const cpcIdx = findIndex(['流量成本', 'cpc', 'CPC']);
  const roasIdx = findIndex(['ROAS', 'roas']);
  const cvrIdx = findIndex(['CVR', 'cvr']);
  const cpaIdx = findIndex(['CPA', 'cpa']);
  
  // FB specific indices might exist if previously merged and saved
  const reachIdx = findIndex(['Reach', 'reach']);
  const impIdx = findIndex(['Impressions', 'impressions']);
  const cpmIdx = findIndex(['CPM', 'cpm']);
  const ctrIdx = findIndex(['CTR', 'ctr']);
  const freqIdx = findIndex(['Frequency', 'frequency']);

  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    if (!row || row.length === 0) continue;

    const dateRaw = dateIdx !== -1 ? row[dateIdx] : undefined;
    const campaignName = campaignIdx !== -1 ? row[campaignIdx] : undefined;

    if (!dateRaw || !campaignName) continue;

    const spent = spentIdx !== -1 ? parseNumber(row[spentIdx]) : 0;
    const cpc = cpcIdx !== -1 ? parseNumber(row[cpcIdx]) : 0;
    const roas = roasIdx !== -1 ? parseNumber(row[roasIdx]) : 0;
    const cvr = cvrIdx !== -1 ? parsePercentage(row[cvrIdx]) : 0;
    const cpa = cpaIdx !== -1 ? parseNumber(row[cpaIdx]) : 0;

    const reach = reachIdx !== -1 ? parseNumber(row[reachIdx]) : undefined;
    const impressions = impIdx !== -1 ? parseNumber(row[impIdx]) : undefined;
    const cpm = cpmIdx !== -1 ? parseNumber(row[cpmIdx]) : undefined;
    const ctr = ctrIdx !== -1 ? parsePercentage(row[ctrIdx]) : undefined;
    const frequency = freqIdx !== -1 ? parseNumber(row[freqIdx]) : undefined;

    const dateNormalized = normalizeDate(dateRaw);
    if (!dateNormalized) continue;

    const clicks = cpc > 0 ? spent / cpc : 0;
    const conversions = cpa > 0 ? spent / cpa : 0;
    const revenue = spent * roas;

    data.push({
      id: `${dateNormalized}-${i}-${Math.random().toString(36).substr(2, 5)}`,
      date: dateNormalized,
      campaignName: String(campaignName).trim(),
      spent,
      cpc,
      roas,
      cvr,
      cpa,
      clicks,
      conversions,
      revenue,
      reach,
      impressions,
      cpm,
      ctr,
      frequency
    });
  }

  return data;
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
        const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet);

        const parsedData: CampaignData[] = jsonData.map((row, index) => {
          const rowKeys = Object.keys(row);
          const findValue = (candidates: string[]) => {
            for (const candidate of candidates) {
              if (row[candidate] !== undefined) return row[candidate];
              const trimmedKey = rowKeys.find(k => k.trim() === candidate);
              if (trimmedKey && row[trimmedKey] !== undefined) return row[trimmedKey];
            }
            const englishCandidates = candidates.filter(c => /^[a-zA-Z]+$/.test(c));
            for (const eng of englishCandidates) {
               const fuzzyKey = rowKeys.find(k => k.toLowerCase().includes(eng.toLowerCase()));
               if (fuzzyKey && row[fuzzyKey] !== undefined) return row[fuzzyKey];
            }
            return undefined;
          };

          const dateRaw = findValue(['日期', 'Date']);
          const campaignName = findValue(['廣告活動', 'Campaign']);
          const spentStr = findValue(['費用', 'spent']); 
          const cpcStr = findValue(['流量成本', 'cpc']); 
          const roasStr = findValue(['ROAS', 'roas']);
          const cvrStr = findValue(['CVR', 'cvr']);
          const cpaStr = findValue(['CPA', 'cpa']);

          const spent = parseNumber(spentStr);
          const cpc = parseNumber(cpcStr);
          const roas = parseNumber(roasStr);
          const cvr = parsePercentage(cvrStr);
          const cpa = parseNumber(cpaStr);

          const clicks = cpc > 0 ? spent / cpc : 0;
          const conversions = cpa > 0 ? spent / cpa : 0; 
          const revenue = spent * roas;
          const dateNormalized = normalizeDate(dateRaw);

          if (!dateNormalized || !campaignName) return null;

          return {
            id: `${dateNormalized}-${index}-${Math.random().toString(36).substr(2, 9)}`,
            date: dateNormalized,
            campaignName: String(campaignName).trim(),
            spent,
            cpc,
            roas,
            cvr,
            cpa,
            clicks,
            conversions,
            revenue
          };
        }).filter((item): item is CampaignData => item !== null);

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
  existing.forEach(item => {
    const key = `${item.date}|${item.campaignName}`;
    map.set(key, item);
  });
  incoming.forEach(item => {
    const key = `${item.date}|${item.campaignName}`;
    const existingItem = map.get(key);
    // Keep FB data if incoming (from excel) doesn't have it
    if(existingItem) {
        if (!item.reach && existingItem.reach) item.reach = existingItem.reach;
        if (!item.impressions && existingItem.impressions) item.impressions = existingItem.impressions;
        if (!item.cpm && existingItem.cpm) item.cpm = existingItem.cpm;
        if (!item.ctr && existingItem.ctr) item.ctr = existingItem.ctr;
        if (!item.frequency && existingItem.frequency) item.frequency = existingItem.frequency;
        if (!item.linkClicks && existingItem.linkClicks) item.linkClicks = existingItem.linkClicks;
    }
    map.set(key, item);
  });
  return Array.from(map.values()).sort((a, b) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );
};

export const fetchFacebookInsights = async (accessToken: string, adAccountId: string, startDate?: string, endDate?: string): Promise<CampaignData[]> => {
  try {
    // 1. Determine Date Range
    // If no dates provided, use "last_30d" or similar, but typically we want alignment.
    // However, API requires specific format for time_range
    const timeRangeStr = (startDate && endDate) 
        ? `&time_range={"since":"${startDate}","until":"${endDate}"}`
        : `&date_preset=maximum`; // fallback if no dates

    // 2. Build URL
    // Fields: campaign_id,campaign_name,spend,reach,impressions,actions
    // Time Increment: 1 (Daily)
    // Filter: action_type IN ["link_click", "omni_purchase"]
    const fields = 'campaign_id,campaign_name,spend,reach,impressions,actions';
    const filtering = encodeURIComponent(JSON.stringify([{ field: "action_type", operator: "IN", value: ["link_click", "omni_purchase"] }]));
    
    // Using v19.0 as stable version
    const url = `https://graph.facebook.com/v19.0/act_${adAccountId}/insights?level=campaign&fields=${fields}&time_increment=1&filtering=${filtering}${timeRangeStr}&access_token=${accessToken}&limit=1000`;
    
    const response = await fetch(url);
    const result = await response.json();
    
    if (result.error) {
      console.error("Facebook API Error Details:", result.error);
      throw new Error(result.error.message);
    }
    
    if (!result.data) {
        return [];
    }
    
    return result.data.map((item: any, index: number) => {
      const spent = parseFloat(item.spend || '0');
      const impressions = parseInt(item.impressions || '0');
      const reach = parseInt(item.reach || '0');
      
      // Parse Actions for link_click
      let linkClicks = 0;
      if (Array.isArray(item.actions)) {
          const clickAction = item.actions.find((action: any) => action.action_type === 'link_click');
          if (clickAction) {
              linkClicks = parseInt(clickAction.value || '0');
          }
      }

      // --- Metrics Calculations ---
      // CPM = spent / (impressions / 1000)
      const cpm = impressions > 0 ? spent / (impressions / 1000) : 0;
      
      // Frequency = impressions / reach
      const frequency = reach > 0 ? impressions / reach : 0;
      
      // CPC = spent / link_click
      const cpc = linkClicks > 0 ? spent / linkClicks : 0;
      
      // CTR = link_click / impressions
      const ctr = impressions > 0 ? linkClicks / impressions : 0;
      
      return {
        id: `fb-${item.date_start}-${item.campaign_id}-${index}`,
        date: item.date_start, // date_start is the day
        campaignName: item.campaign_name,
        spent: spent, // API returns string, float parsed
        cpc: cpc,
        roas: 0,
        cvr: 0, 
        cpa: 0,
        clicks: linkClicks, // mapping link clicks to clicks
        conversions: 0,
        revenue: 0,
        reach,
        impressions,
        cpm,
        ctr,
        linkClicks,
        frequency
      } as CampaignData;
    });
  } catch (error) {
    console.error("Facebook API Error:", error);
    throw error;
  }
};

export const mergeFacebookData = (sheetData: CampaignData[], fbData: CampaignData[]): CampaignData[] => {
  const map = new Map<string, CampaignData>();
  
  sheetData.forEach(item => {
    map.set(`${item.date}|${item.campaignName.trim()}`, { ...item });
  });

  fbData.forEach(fbItem => {
    const key = `${fbItem.date}|${fbItem.campaignName.trim()}`;
    const existing = map.get(key);
    
    if (existing) {
      map.set(key, {
        ...existing,
        reach: fbItem.reach,
        impressions: fbItem.impressions,
        cpm: fbItem.cpm,
        ctr: fbItem.ctr,
        linkClicks: fbItem.linkClicks,
        frequency: fbItem.frequency,
        // Optional: override spent/cpc if you want API to be truth source
      });
    }
  });

  return Array.from(map.values()).sort((a, b) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );
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
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 2,
  }).format(value);
};

export const formatDecimal = (value: number) => {
  return value.toFixed(1);
};
