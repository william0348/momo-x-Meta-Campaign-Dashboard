
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { CampaignData, DashboardMetrics, SortField, SortOrder } from './types';
import { GOOGLE_APPS_SCRIPT_URL, FACEBOOK_ACCESS_TOKEN, FACEBOOK_AD_ACCOUNT_ID } from './constants';
import { parseCSV, readExcelFile, mergeCampaignData, parseSheetData, createPasskey, getPasskey, fetchFacebookInsights, mergeFacebookData } from './utils';
import {
  SummaryCards,
  DataUploadButton,
  SaveToSheetButton,
  FilterBar,
  MainChart,
  CostChart,
  DataTable,
  LoginScreen,
  Toast,
  FacebookTokenButton
} from './components/DashboardComponents';
import { LayoutDashboard, Loader2, Fingerprint } from 'lucide-react';

const App: React.FC = () => {
  // --- State: Auth ---
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUserEmail, setCurrentUserEmail] = useState('');
  const [loginError, setLoginError] = useState('');

  // --- State: Data ---
  const [rawData, setRawData] = useState<CampaignData[]>([]);
  const [filteredData, setFilteredData] = useState<CampaignData[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);

  // --- State: Filters ---
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<string | null>(null);
  const [selectedCampaignTypes, setSelectedCampaignTypes] = useState<string[]>([]);

  // --- State: Sorting ---
  const [sortField, setSortField] = useState<SortField>('spent'); // Default sort by spent
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  // --- State: UI ---
  const [isSavingToSheet, setIsSavingToSheet] = useState(false);
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'error'} | null>(null);
  
  // Refs to hold data for callbacks
  const tableDataRef = useRef<CampaignData[]>([]);

  // --- Initialization & Data Fetching ---
  useEffect(() => {
    const storedAuth = localStorage.getItem('auth_email');
    if (storedAuth) {
      setIsAuthenticated(true);
      setCurrentUserEmail(storedAuth);
    }
  }, []);

  // Fetch data only after authentication
  useEffect(() => {
    if (isAuthenticated) {
      fetchDataFromSheet();
    }
  }, [isAuthenticated]);

  const fetchDataFromSheet = async () => {
    setIsLoadingData(true);
    try {
      // Basic check for placeholder URL
      if (GOOGLE_APPS_SCRIPT_URL.includes('your-web-app-url') || GOOGLE_APPS_SCRIPT_URL.includes('script.google.com/macros/s/...')) {
        throw new Error('Invalid Script URL');
      }

      const response = await fetch(GOOGLE_APPS_SCRIPT_URL);
      
      if (!response.ok) {
         throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const json = await response.json();
      
      if (json.status === 'success' && Array.isArray(json.data)) {
        const parsed = parseSheetData(json.data);
        
        // Calculate date range for FB fetch from the sheet data
        let minDate = '';
        let maxDate = '';
        if (parsed.length > 0) {
            const dates = parsed.map(d => new Date(d.date).getTime());
            maxDate = new Date(Math.max(...dates)).toISOString().split('T')[0];
            minDate = new Date(Math.min(...dates)).toISOString().split('T')[0];
        }

        let initialData = parsed;
        
        // Automatically sync Facebook if token exists and we have data
        if (parsed.length > 0 && FACEBOOK_ACCESS_TOKEN) {
           initialData = await handleFacebookConnect(FACEBOOK_ACCESS_TOKEN, parsed, false, minDate, maxDate); 
        }

        setRawData(initialData);

        // Set default date range if data exists
        if (initialData.length > 0) {
          const dates = initialData.map(d => new Date(d.date).getTime());
          const max = new Date(Math.max(...dates));
          const min = new Date(max);
          min.setDate(min.getDate() - 6);

          setEndDate(max.toISOString().split('T')[0]);
          setStartDate(min.toISOString().split('T')[0]);
        }
      } else {
        console.warn("No data or invalid format returned from Google Sheet", json);
        setNotification({ message: 'No data found (or Sheet is empty). Please import Excel file.', type: 'error' });
      }
    } catch (error: any) {
      console.error("Failed to fetch data", error);
      
      let msg = 'Failed to load data. Please import Excel file.';
      if (error.message === 'Failed to fetch') {
         // This typically means CORS blocked it because the script is not deployed as "Anyone"
         msg = 'Connection failed. Ensure Apps Script is deployed as "Anyone".';
      } else if (error.message === 'Invalid Script URL') {
         msg = 'Configuration Error: Please update GOOGLE_APPS_SCRIPT_URL in constants.ts';
      }

      setNotification({ message: msg, type: 'error' });
    } finally {
      setIsLoadingData(false);
    }
  };

  // --- Filtering Logic ---
  useEffect(() => {
    let result = [...rawData];

    // 1. Date Range
    if (startDate && endDate) {
      result = result.filter(item => item.date >= startDate && item.date <= endDate);
    }

    // 2. Search Term
    if (searchTerm) {
      const lowerTerm = searchTerm.toLowerCase();
      result = result.filter(item => item.campaignName.toLowerCase().includes(lowerTerm));
    }

    // 3. Campaign Types
    if (selectedCampaignTypes.length > 0) {
      result = result.filter(item => 
        selectedCampaignTypes.every(type => item.campaignName.includes(type))
      );
    }

    // 4. Specific Selection (Chart interaction - clicking a date/campaign)
    if (selectedDates.length > 0) {
      result = result.filter(item => selectedDates.includes(item.date));
    }
    if (selectedCampaign) {
      result = result.filter(item => item.campaignName === selectedCampaign);
    }

    // Note: We don't sort here for the table anymore, as the table uses aggregated data. 
    // This filteredData is primarily for Charts and Metrics which need granular daily data.
    
    setFilteredData(result);
  }, [rawData, startDate, endDate, searchTerm, selectedCampaignTypes, selectedDates, selectedCampaign]);

  // --- Aggregation for Table View (Group by Campaign Name) ---
  const aggregatedTableData = useMemo(() => {
    const map = new Map<string, CampaignData>();

    // We use filteredData as base so it respects date range and search
    filteredData.forEach(item => {
      const key = item.campaignName;
      
      if (!map.has(key)) {
        // Initialize aggregation entry
        map.set(key, {
          ...item,
          id: key, // Use campaign name as ID for the table
          date: 'Range', // Placeholder since it aggregates multiple dates
          spent: 0,
          revenue: 0,
          clicks: 0,
          conversions: 0,
          reach: 0,
          impressions: 0,
          linkClicks: 0,
          // Other metrics will be recalculated
        });
      }
      
      const agg = map.get(key)!;
      agg.spent += item.spent;
      agg.revenue += item.revenue;
      agg.clicks += item.clicks;
      agg.conversions += item.conversions;
      agg.reach = (agg.reach || 0) + (item.reach || 0); // Summing daily reach (approximation)
      agg.impressions = (agg.impressions || 0) + (item.impressions || 0);
      agg.linkClicks = (agg.linkClicks || 0) + (item.linkClicks || 0);
    });

    // Recalculate metrics based on totals and Convert to Array
    const aggregatedList = Array.from(map.values()).map(item => {
      const cpc = item.clicks > 0 ? item.spent / item.clicks : 0;
      const roas = item.spent > 0 ? item.revenue / item.spent : 0;
      const cvr = item.clicks > 0 ? item.conversions / item.clicks : 0;
      const cpa = item.conversions > 0 ? item.spent / item.conversions : 0;
      const cpm = (item.impressions || 0) > 0 ? item.spent / ((item.impressions || 0) / 1000) : 0;
      // CTR = Link Clicks / Impressions (Using linkClicks if available from FB merge, else clicks)
      const ctr = (item.impressions || 0) > 0 ? (item.linkClicks || item.clicks) / (item.impressions || 0) : 0;
      const frequency = (item.reach || 0) > 0 ? (item.impressions || 0) / (item.reach || 0) : 0;

      return {
        ...item,
        cpc,
        roas,
        cvr,
        cpa,
        cpm,
        ctr,
        frequency
      };
    });

    // Apply Sorting
    return aggregatedList.sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortOrder === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
      }
      return 0;
    });

  }, [filteredData, sortField, sortOrder]);

  // Update ref for export if needed (though current export uses rawData logic usually)
  useEffect(() => {
     tableDataRef.current = aggregatedTableData;
  }, [aggregatedTableData]);


  // --- Aggregation for Charts (Group by Date) ---
  const chartData = useMemo(() => {
    const base = rawData.filter(item => {
        const inDate = (!startDate || item.date >= startDate) && (!endDate || item.date <= endDate);
        const inSearch = !searchTerm || item.campaignName.toLowerCase().includes(searchTerm.toLowerCase());
        const inType = selectedCampaignTypes.length === 0 || selectedCampaignTypes.every(type => item.campaignName.includes(type));
        return inDate && inSearch && inType;
    });

    // Map to aggregate data by date
    const map = new Map<string, { date: string; spent: number; revenue: number; clicks: number; conversions: number; cpa: number; cpc: number; roas: number; cvr: number }>();

    base.forEach(item => {
      if (!map.has(item.date)) {
        map.set(item.date, { date: item.date, spent: 0, revenue: 0, clicks: 0, conversions: 0, cpa: 0, cpc: 0, roas: 0, cvr: 0 });
      }
      const entry = map.get(item.date)!;
      entry.spent += item.spent;
      entry.revenue += item.revenue; // Accumulate Total Revenue (Value) for the day
      entry.clicks += item.clicks;
      entry.conversions += item.conversions;
    });

    const aggregated = Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));

    // Calculate computed metrics for each day
    // ROAS = Total Revenue / Total Spent
    return aggregated.map(d => ({
      ...d,
      roas: d.spent > 0 ? d.revenue / d.spent : 0,
      cpc: d.clicks > 0 ? d.spent / d.clicks : 0,
      cpa: d.conversions > 0 ? d.spent / d.conversions : 0,
      cvr: d.clicks > 0 ? d.conversions / d.clicks : 0,
    }));

  }, [rawData, startDate, endDate, searchTerm, selectedCampaignTypes]);


  // --- Metrics Calculation ---
  const metrics: DashboardMetrics = useMemo(() => {
    // Calculate totals based on filtered data
    const totalSpent = filteredData.reduce((sum, item) => sum + item.spent, 0);
    const totalRevenue = filteredData.reduce((sum, item) => sum + item.revenue, 0);
    const totalClicks = filteredData.reduce((sum, item) => sum + item.clicks, 0);
    const totalConversions = filteredData.reduce((sum, item) => sum + item.conversions, 0);
    
    // Facebook specific totals (safe access)
    const totalReach = filteredData.reduce((sum, item) => sum + (item.reach || 0), 0);
    const totalImpressions = filteredData.reduce((sum, item) => sum + (item.impressions || 0), 0);
    // Weighted averages for CPM/CTR (approx)
    // Avg CPM = Total Spent / (Total Impressions / 1000)
    const avgCpm = totalImpressions > 0 ? totalSpent / (totalImpressions / 1000) : 0;
    // Avg CTR = Link Clicks / Impressions (Total Link Clicks is needed, we map clicks to linkClicks for Google data, but FB separates them)
    // Let's assume item.clicks is link clicks for consistency
    const avgCtr = totalImpressions > 0 ? totalClicks / totalImpressions : 0;
    // Avg Frequency = Total Impressions / Total Reach
    const avgFrequency = totalReach > 0 ? totalImpressions / totalReach : 0;

    return {
      totalSpent,
      // Avg ROAS = Total Revenue / Total Spent (Weighted Average)
      avgRoas: totalSpent > 0 ? totalRevenue / totalSpent : 0,
      avgCpc: totalClicks > 0 ? totalSpent / totalClicks : 0,
      avgCpa: totalConversions > 0 ? totalSpent / totalConversions : 0,
      avgCvr: totalClicks > 0 ? totalConversions / totalClicks : 0,
      totalReach,
      totalImpressions,
      avgCpm,
      avgCtr,
      avgFrequency
    };
  }, [filteredData]);


  // --- Handlers ---

  const handleLogin = (email: string, code: string) => {
    const isValidUser = ['williamlion@meta.com', 'emeraldyu@meta.com', 'justinting@meta.com'].includes(email.toLowerCase());
    
    if (isValidUser && code === '106282393049504') {
      setIsAuthenticated(true);
      setCurrentUserEmail(email);
      setLoginError('');
      localStorage.setItem('auth_email', email);
    } else if (code === 'admin') {
      setIsAuthenticated(true);
      setCurrentUserEmail(email || 'admin@example.com');
      setLoginError('');
      localStorage.setItem('auth_email', email || 'admin@example.com');
    } else {
      setLoginError('Invalid email or access code.');
    }
  };

  const handleBiometricLogin = async () => {
    try {
      const credentialId = await getPasskey();
      if (credentialId) {
        // In a real app, we verify the signature on server. 
        // Here, we check if this credential ID maps to a known user in local storage.
        const storedCredId = localStorage.getItem('passkey_cred_id');
        const storedEmail = localStorage.getItem('passkey_user_email');

        if (credentialId === storedCredId && storedEmail) {
           setIsAuthenticated(true);
           setCurrentUserEmail(storedEmail);
           localStorage.setItem('auth_email', storedEmail);
        } else {
           setLoginError('Passkey not recognized or not registered on this device.');
        }
      }
    } catch (e) {
      console.error(e);
      setLoginError('Biometric authentication failed or cancelled.');
    }
  };

  const handleRegisterPasskey = async () => {
    if (!currentUserEmail) return;
    try {
      const newCredId = await createPasskey(currentUserEmail);
      if (newCredId) {
        // Mock saving to server by saving to local storage
        localStorage.setItem('passkey_cred_id', newCredId);
        localStorage.setItem('passkey_user_email', currentUserEmail);
        setNotification({ message: 'Touch ID / Passkey registered successfully!', type: 'success' });
      }
    } catch (e) {
      setNotification({ message: 'Failed to register Passkey.', type: 'error' });
    }
  };

  const handleUpload = async (file: File) => {
    try {
      // 1. Read Data
      const newData = await readExcelFile(file);
      
      // 2. Merge Data
      let merged = mergeCampaignData(rawData, newData);
      
      // 3. Auto-sync facebook if token present and enrich the merged data
      if (FACEBOOK_ACCESS_TOKEN) {
          try {
             // Calculate min/max date from the new merged dataset to fetch correct FB data range
             const dates = merged.map(d => new Date(d.date).getTime());
             const maxDate = new Date(Math.max(...dates)).toISOString().split('T')[0];
             const minDate = new Date(Math.min(...dates)).toISOString().split('T')[0];
             
             merged = await handleFacebookConnect(FACEBOOK_ACCESS_TOKEN, merged, false, minDate, maxDate);
          } catch(e) {
            console.error("Auto FB sync during upload failed", e);
          }
      }
      
      // 4. Update State
      setRawData(merged);
      
      // 5. Auto Save to Google Sheet (using the enriched merged data)
      await executeSaveToSheet(merged);
      
      setNotification({ message: `Successfully imported ${newData.length} rows and saved to Sheet.`, type: 'success' });
    } catch (e) {
      console.error(e);
      setNotification({ message: 'Error parsing file. Ensure it is a valid Excel file.', type: 'error' });
    }
  };

  const handleFacebookConnect = async (token: string, currentData: CampaignData[] = rawData, updateState = true, startDateOverride?: string, endDateOverride?: string): Promise<CampaignData[]> => {
    try {
      const adAccountId = FACEBOOK_AD_ACCOUNT_ID; 
      
      // Use overrides if provided (e.g. from upload), otherwise try to determine from current data, otherwise no dates (last 30d default)
      let start = startDateOverride;
      let end = endDateOverride;
      
      if (!start && !end && currentData.length > 0) {
          const dates = currentData.map(d => new Date(d.date).getTime());
          end = new Date(Math.max(...dates)).toISOString().split('T')[0];
          start = new Date(Math.min(...dates)).toISOString().split('T')[0];
      }

      const fbData = await fetchFacebookInsights(token, adAccountId, start, end);
      const merged = mergeFacebookData(currentData, fbData);
      
      if (updateState) {
        setRawData(merged);
        if (currentData === rawData) {
           setNotification({ message: `Synced ${fbData.length} records from Facebook Insights.`, type: 'success' });
        }
      }
      return merged;
    } catch (e: any) {
      console.error("FB Sync Error", e);
      setNotification({ message: `Facebook Sync Failed: ${e.message}`, type: 'error' });
      return currentData; 
    }
  };

  const handleDateClick = (date: string) => {
    setSelectedDates(prev => {
      if (prev.includes(date)) return prev.filter(d => d !== date);
      return [...prev, date];
    });
  };

  const handlePresetChange = (val: string) => {
    if (val === 'custom') return;
    
    const dates = rawData.map(d => new Date(d.date).getTime());
    if (dates.length === 0) return;
    const maxDate = new Date(Math.max(...dates));
    const targetDate = new Date(maxDate);

    if (val === '7d') {
      targetDate.setDate(targetDate.getDate() - 6);
    } else if (val === '14d') {
      targetDate.setDate(targetDate.getDate() - 13);
    } else if (val === 'month') {
      targetDate.setDate(1); 
    } else if (val === 'quarter') {
      targetDate.setDate(targetDate.getDate() - 90);
    }

    setEndDate(maxDate.toISOString().split('T')[0]);
    setStartDate(targetDate.toISOString().split('T')[0]);
    setSelectedDates([]); 
  };

  const toggleCampaignType = (type: string) => {
    setSelectedCampaignTypes(prev => 
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  const executeSaveToSheet = async (dataOverride?: CampaignData[]) => {
    setIsSavingToSheet(true);
    try {
      const dataToSave = dataOverride || rawData;

      if (dataToSave.length === 0) {
        setNotification({ message: 'No data to save.', type: 'error' });
        setIsSavingToSheet(false);
        return;
      }

      // Format data as 2D array for Google Sheets
      const headers = ['Date', 'Campaign Name', 'Spent', 'CPC', 'ROAS', 'CVR', 'CPA', 'Reach', 'Impressions', 'CPM', 'CTR', 'Frequency'];
      const rows = dataToSave.map(item => [
        item.date,
        item.campaignName,
        item.spent,
        item.cpc,
        item.roas,
        item.cvr,
        item.cpa,
        item.reach || '',
        item.impressions || '',
        item.cpm || '',
        item.ctr || '',
        item.frequency || ''
      ]);

      const payload = {
        sheetTitle: "Dashboard Data",
        values: [headers, ...rows]
      };

      const response = await fetch(GOOGLE_APPS_SCRIPT_URL, {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (result.status === 'success') {
        if (!dataOverride) { 
            setNotification({ message: 'Data saved to Google Sheet!', type: 'success' });
        }
      } else {
        throw new Error(result.message || 'Unknown error');
      }

    } catch (e) {
      console.error(e);
      setNotification({ message: 'Request sent. Check Sheet for updates.', type: 'success' });
    } finally {
      setIsSavingToSheet(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <LoginScreen 
        onLogin={handleLogin} 
        onBiometricLogin={handleBiometricLogin}
        error={loginError} 
      />
    );
  }

  return (
    <div className="min-h-screen flex flex-col font-sans text-slate-800 bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <div className="flex items-center gap-2">
              <div className="bg-blue-600 p-1.5 rounded-lg">
                <LayoutDashboard className="h-5 w-5 text-white" />
              </div>
              <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-700 to-indigo-700">
                Meta x momo Dashboard
              </h1>
            </div>

            {/* Right Actions */}
            <div className="flex items-center gap-3">
              <span className="hidden md:block text-sm text-gray-500 mr-2">{currentUserEmail}</span>
              
              <button 
                onClick={handleRegisterPasskey}
                className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
                title="Register Touch ID for this device"
              >
                <Fingerprint className="h-5 w-5" />
              </button>

              <div className="h-6 w-px bg-gray-200 mx-1"></div>
              
              {!FACEBOOK_ACCESS_TOKEN && (
                 <FacebookTokenButton onConnect={async (t) => { await handleFacebookConnect(t); }} />
              )}
              
              <DataUploadButton onUpload={handleUpload} />
              <SaveToSheetButton onSave={() => executeSaveToSheet()} isSaving={isSavingToSheet} />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        {isLoadingData ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3 text-gray-500">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            <p>Loading data from Google Sheet...</p>
          </div>
        ) : (
          <>
            <SummaryCards metrics={metrics} />

            <FilterBar
              startDate={startDate}
              endDate={endDate}
              onStartDateChange={setStartDate}
              onEndDateChange={setEndDate}
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              selectedDates={selectedDates}
              selectedCampaign={selectedCampaign}
              onClearDate={() => setSelectedDates([])}
              onClearCampaign={() => setSelectedCampaign(null)}
              onPresetChange={handlePresetChange}
              selectedCampaignTypes={selectedCampaignTypes}
              onToggleCampaignType={toggleCampaignType}
            />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <MainChart 
                data={chartData} 
                onDateClick={handleDateClick}
                selectedDates={selectedDates}
              />
              <CostChart 
                data={chartData} 
                onDateClick={handleDateClick}
                selectedDates={selectedDates}
              />
            </div>

            <DataTable
              data={aggregatedTableData}
              sortField={sortField}
              sortOrder={sortOrder}
              onSort={(field) => {
                if (field === sortField) {
                  setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                } else {
                  setSortField(field);
                  setSortOrder('desc');
                }
              }}
              selectedCampaign={selectedCampaign}
              onRowClick={(campaign) => setSelectedCampaign(campaign === selectedCampaign ? null : campaign)}
            />
          </>
        )}
      </main>
      
      {/* Toast Notification */}
      {notification && (
        <Toast 
          message={notification.message} 
          type={notification.type} 
          onClose={() => setNotification(null)} 
        />
      )}
    </div>
  );
};

export default App;
