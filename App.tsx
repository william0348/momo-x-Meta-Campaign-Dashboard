
import React, { useState, useEffect, useMemo } from 'react';
import { CampaignData, DashboardMetrics, SortField, SortOrder, MetricSource } from './types';
import { GOOGLE_APPS_SCRIPT_URL, FACEBOOK_ACCESS_TOKEN, FACEBOOK_AD_ACCOUNT_ID } from './constants';
import { readExcelFile, mergeCampaignData, parseSheetData, createPasskey, getPasskey, fetchFacebookInsights, mergeFacebookData } from './utils';
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
  LoadFacebookDataButton,
  MetricSourceToggle
} from './components/DashboardComponents';
import { LayoutDashboard, Loader2, Fingerprint } from 'lucide-react';

const App: React.FC = () => {
  // --- State: Auth ---
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUserEmail, setCurrentUserEmail] = useState('');
  const [loginError, setLoginError] = useState('');

  // --- State: Data ---
  const [rawData, setRawData] = useState<CampaignData[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [isFetchingFbData, setIsFetchingFbData] = useState(false);

  // --- State: Filters ---
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<string | null>(null);
  const [selectedCampaignTypes, setSelectedCampaignTypes] = useState<string[]>([]);
  const [metricSource, setMetricSource] = useState<MetricSource>('momo');

  // --- State: Sorting ---
  const [sortField, setSortField] = useState<SortField>('spent');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  // --- State: UI ---
  const [isSavingToSheet, setIsSavingToSheet] = useState(false);
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'error'} | null>(null);
  
  // --- Initialization & Data Fetching ---
  useEffect(() => {
    const storedAuth = localStorage.getItem('auth_email');
    if (storedAuth) {
      setIsAuthenticated(true);
      setCurrentUserEmail(storedAuth);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchDataFromSheet();
    }
  }, [isAuthenticated]);

  const fetchDataFromSheet = async () => {
    setIsLoadingData(true);
    try {
      if (GOOGLE_APPS_SCRIPT_URL.includes('your-web-app-url')) {
        throw new Error('Invalid Script URL');
      }

      const response = await fetch(GOOGLE_APPS_SCRIPT_URL);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      
      const json = await response.json();
      
      let initialData: CampaignData[] = [];
      if (json.status === 'success' && Array.isArray(json.data) && json.data.length > 1) {
        initialData = parseSheetData(json.data);
      } else {
        setNotification({ message: 'No sheet data found.', type: 'error' });
      }

      setRawData(initialData);
      handlePresetChange("7d", initialData);

    } catch (error: any) {
      let msg = 'Failed to load data.';
      if (error.message.includes('Failed to fetch')) msg = 'Connection failed. Ensure Apps Script is deployed properly.';
      setNotification({ message: msg, type: 'error' });
    } finally {
      setIsLoadingData(false);
    }
  };

  const filteredData = useMemo(() => {
    let result = [...rawData];
    if (startDate && endDate) {
      result = result.filter(item => item.date >= startDate && item.date <= endDate);
    }
    if (searchTerm) {
      const lowerTerm = searchTerm.toLowerCase();
      result = result.filter(item => item.campaignName.toLowerCase().includes(lowerTerm));
    }
    if (selectedCampaignTypes.length > 0) {
      result = result.filter(item => 
        selectedCampaignTypes.every(type => item.campaignName.includes(type))
      );
    }
    return result;
  }, [rawData, startDate, endDate, searchTerm, selectedCampaignTypes]);

  // --- Aggregation for Table View (Group by Campaign Name) ---
  const aggregatedTableData = useMemo(() => {
    const map = new Map<string, CampaignData>();
    filteredData.forEach(item => {
      const key = item.campaignName;
      if (!map.has(key)) {
        map.set(key, { 
            ...item, 
            id: key, 
            date: 'Range', 
            spent: 0, 
            revenue: 0, 
            momoClicks: 0, 
            momoConversions: 0, 
            impressions: 0, 
            fbLinkClicks: 0,
            fbPurchase: 0
        });
      }
      const agg = map.get(key)!;
      agg.spent += item.spent;
      agg.revenue += item.revenue;
      agg.momoClicks += item.momoClicks;
      agg.momoConversions += item.momoConversions;
      agg.impressions = (agg.impressions || 0) + (item.impressions || 0);
      agg.fbLinkClicks = (agg.fbLinkClicks || 0) + (item.fbLinkClicks || 0);
      agg.fbPurchase = (agg.fbPurchase || 0) + (item.fbPurchase || 0);
    });

    const aggregatedList = Array.from(map.values()).map(item => ({
        ...item,
        roas: item.spent > 0 ? item.revenue / item.spent : 0,
        momoCpc: item.momoClicks > 0 ? item.spent / item.momoClicks : 0,
        momoCvr: item.momoClicks > 0 ? item.momoConversions / item.momoClicks : 0,
        momoCpa: item.momoConversions > 0 ? item.spent / item.momoConversions : 0,
        
        fbCpc: (item.fbLinkClicks || 0) > 0 ? item.spent / (item.fbLinkClicks || 0) : 0,
        cpm: (item.impressions || 0) > 0 ? item.spent / ((item.impressions || 0) / 1000) : 0,
        fbCtr: (item.impressions || 0) > 0 ? (item.fbLinkClicks || 0) / (item.impressions || 0) : 0,
        fbCpa: (item.fbPurchase || 0) > 0 ? item.spent / (item.fbPurchase || 0) : 0,
        fbCvr: (item.fbLinkClicks || 0) > 0 ? (item.fbPurchase || 0) / (item.fbLinkClicks || 0) : 0,
    }));

    return aggregatedList.sort((a, b) => {
      const aVal = a[sortField as keyof typeof a];
      const bVal = b[sortField as keyof typeof b];
      if (typeof aVal === 'string' && typeof bVal === 'string') return sortOrder === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      if (typeof aVal === 'number' && typeof bVal === 'number') return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
      return 0;
    });
  }, [filteredData, sortField, sortOrder]);


  // --- Data for Charts (Group by Date) ---
  const chartData = useMemo(() => {
    // Corrected: Use filteredData so charts respect Search Term and Campaign Type filters
    let base = filteredData;
    
    if (selectedCampaign) {
      base = base.filter(item => item.campaignName === selectedCampaign);
    }
    
    const map = new Map<string, Partial<CampaignData>>();
    base.forEach(item => {
      if (!map.has(item.date)) {
        map.set(item.date, { date: item.date, spent: 0, revenue: 0, momoClicks: 0, momoConversions: 0, impressions: 0, fbLinkClicks: 0, fbPurchase: 0 });
      }
      const entry = map.get(item.date)!;
      entry.spent = (entry.spent || 0) + item.spent;
      entry.revenue = (entry.revenue || 0) + item.revenue;
      entry.momoClicks = (entry.momoClicks || 0) + item.momoClicks;
      entry.momoConversions = (entry.momoConversions || 0) + item.momoConversions;
      entry.impressions = (entry.impressions || 0) + (item.impressions || 0);
      entry.fbLinkClicks = (entry.fbLinkClicks || 0) + (item.fbLinkClicks || 0);
      entry.fbPurchase = (entry.fbPurchase || 0) + (item.fbPurchase || 0);
    });
    return Array.from(map.values()).sort((a, b) => a.date!.localeCompare(b.date!)).map(d => ({
      ...d,
      roas: d.spent! > 0 ? d.revenue! / d.spent! : 0,
      momoCpc: d.momoClicks! > 0 ? d.spent! / d.momoClicks! : 0,
      momoCpa: d.momoConversions! > 0 ? d.spent! / d.momoConversions! : 0,
      momoCvr: d.momoClicks! > 0 ? d.momoConversions! / d.momoClicks! : 0,
      
      fbCpc: d.fbLinkClicks! > 0 ? d.spent! / d.fbLinkClicks! : 0,
      fbCtr: d.impressions! > 0 ? d.fbLinkClicks! / d.impressions! : 0,
      fbCpa: d.fbPurchase! > 0 ? d.spent! / d.fbPurchase! : 0,
      fbCvr: d.fbLinkClicks! > 0 ? d.fbPurchase! / d.fbLinkClicks! : 0,
    }));
  }, [filteredData, selectedCampaign]);

  // --- Metrics for Summary Cards ---
  const metrics: DashboardMetrics = useMemo(() => {
    let dataForMetrics = aggregatedTableData;
    
    // If a specific campaign is selected, filter summary metrics to show only that campaign's data
    if (selectedCampaign) {
      dataForMetrics = dataForMetrics.filter(item => item.campaignName === selectedCampaign);
    }

    const totalSpent = dataForMetrics.reduce((sum, item) => sum + item.spent, 0);
    const totalRevenue = dataForMetrics.reduce((sum, item) => sum + item.revenue, 0);
    const totalMomoClicks = dataForMetrics.reduce((sum, item) => sum + item.momoClicks, 0);
    const totalMomoConversions = dataForMetrics.reduce((sum, item) => sum + item.momoConversions, 0);
    const totalImpressions = dataForMetrics.reduce((sum, item) => sum + (item.impressions || 0), 0);
    const totalFbLinkClicks = dataForMetrics.reduce((sum, item) => sum + (item.fbLinkClicks || 0), 0);
    const totalFbPurchase = dataForMetrics.reduce((sum, item) => sum + (item.fbPurchase || 0), 0);

    return {
      totalSpent,
      avgRoas: totalSpent > 0 ? totalRevenue / totalSpent : 0,
      
      avgMomoCpc: totalMomoClicks > 0 ? totalSpent / totalMomoClicks : 0,
      avgMomoCpa: totalMomoConversions > 0 ? totalSpent / totalMomoConversions : 0,
      avgMomoCvr: totalMomoClicks > 0 ? totalMomoConversions / totalMomoClicks : 0,
      
      totalImpressions,
      avgCpm: totalImpressions > 0 ? totalSpent / (totalImpressions / 1000) : 0,
      avgFbCtr: totalImpressions > 0 ? totalFbLinkClicks / totalImpressions : 0,
      avgFbCpc: totalFbLinkClicks > 0 ? totalSpent / totalFbLinkClicks : 0,
      
      totalFbPurchase,
      avgFbCpa: totalFbPurchase > 0 ? totalSpent / totalFbPurchase : 0,
      avgFbCvr: totalFbLinkClicks > 0 ? totalFbPurchase / totalFbLinkClicks : 0,
    };
  }, [aggregatedTableData, selectedCampaign]);

  // --- Handlers ---
  const handleLogin = (email: string, code: string) => {
    const isValidUser = ['williamlion@meta.com', 'emeraldyu@meta.com', 'justinting@meta.com'].includes(email.toLowerCase());
    if (isValidUser && code === '106282393049504') {
      setIsAuthenticated(true);
      setCurrentUserEmail(email);
      setLoginError('');
      localStorage.setItem('auth_email', email);
    } else {
      setLoginError('Invalid email or access code.');
    }
  };

  const handleBiometricLogin = async () => { 
      const credId = await getPasskey();
      if (credId) {
          setIsAuthenticated(true);
      }
  };

  const handleUpload = async (file: File) => {
    try {
      const newData = await readExcelFile(file);
      const merged = mergeCampaignData(rawData, newData);
      setRawData(merged);
      await executeSaveToSheet(merged);
      setNotification({ message: `Imported ${newData.length} rows and saved to Sheet.`, type: 'success' });
      
      // Also trigger FB update for this new date range
      if (FACEBOOK_ACCESS_TOKEN) {
          const dates = newData.map(d => d.date).sort();
          const start = dates[0];
          const end = dates[dates.length - 1];
          try {
             const fbData = await fetchFacebookInsights(FACEBOOK_ACCESS_TOKEN, FACEBOOK_AD_ACCOUNT_ID, start, end);
             const fullyMerged = mergeFacebookData(merged, fbData);
             setRawData(fullyMerged);
             await executeSaveToSheet(fullyMerged);
             setNotification({ message: `Imported and synced with Facebook.`, type: 'success' });
          } catch (e) {
             console.warn("FB Sync after upload failed", e);
          }
      }

    } catch (e) {
      setNotification({ message: 'Error parsing file.', type: 'error' });
    }
  };
  
  const handleManualFbLoad = async () => {
    if (!FACEBOOK_ACCESS_TOKEN) return;
    setIsFetchingFbData(true);
    try {
      const fbData = await fetchFacebookInsights(FACEBOOK_ACCESS_TOKEN, FACEBOOK_AD_ACCOUNT_ID, startDate, endDate);
      const mergedData = mergeFacebookData(rawData, fbData);
      setRawData(mergedData);
      await executeSaveToSheet(mergedData); 
      setNotification({message: `Synced ${fbData.length} records.`, type: "success"});
    } catch (error: any) {
      setNotification({message: `Sync Failed: ${error.message}`, type: "error"});
    } finally {
      setIsFetchingFbData(false);
    }
  };
  
  const executeSaveToSheet = async (dataOverride?: CampaignData[]) => {
    setIsSavingToSheet(true);
    try {
      const dataToSave = dataOverride || rawData;
      
      // Save both Momo and Facebook metrics to ensure complete data persistence
      const header = [
        "Date", "Campaign Name", "Spent", "ROAS", "CPC", "CPA", "CVR",
        "FB Purchases", "FB CPA", "FB CVR", "FB CPC", "FB CTR", "CPM", "FB Link Clicks", "Impressions"
      ];
      const values = dataToSave.map(row => [
        row.date,
        row.campaignName,
        row.spent,
        row.roas,
        row.momoCpc,
        row.momoCpa,
        row.momoCvr,
        // FB Metrics
        row.fbPurchase || 0,
        row.fbCpa || 0,
        row.fbCvr || 0,
        row.fbCpc || 0,
        row.fbCtr || 0,
        row.cpm || 0,
        row.fbLinkClicks || 0,
        row.impressions || 0
      ]);

      const response = await fetch(GOOGLE_APPS_SCRIPT_URL, {
        method: 'POST',
        mode: 'cors',
        body: JSON.stringify({
          sheetTitle: 'Dashboard Data',
          values: [header, ...values]
        })
      });

      const result = await response.json();
      if (result.status !== 'success') throw new Error(result.message);
      
      if (!dataOverride) {
        setNotification({ message: 'Saved to Google Sheet.', type: 'success' });
      }

    } catch (error: any) {
      setNotification({ message: `Save failed: ${error.message}`, type: 'error' });
    } finally {
      setIsSavingToSheet(false);
    }
  };

  const handlePresetChange = (val: string, data = rawData) => {
    if (data.length === 0) return;
    const dates = data.map(d => new Date(d.date).getTime()).filter(t => !isNaN(t));
    if (dates.length === 0) return;
    const maxDate = new Date(Math.max(...dates));
    let minDate = new Date(maxDate);

    switch (val) {
      case '7d':
        minDate.setDate(minDate.getDate() - 6);
        break;
      case '14d':
        minDate.setDate(minDate.getDate() - 13);
        break;
      case 'month':
        minDate = new Date(maxDate.getFullYear(), maxDate.getMonth(), 1);
        break;
      case 'quarter':
        const quarter = Math.floor(maxDate.getMonth() / 3);
        minDate = new Date(maxDate.getFullYear(), quarter * 3, 1);
        break;
      case 'custom':
      default:
        return; 
    }
    
    setStartDate(minDate.toISOString().split('T')[0]);
    setEndDate(maxDate.toISOString().split('T')[0]);
  };
  
  const handleDateClick = (date: string) => setSelectedDates(p => p.includes(date) ? p.filter(d => d !== date) : [...p, date]);
  const toggleCampaignType = (type: string) => setSelectedCampaignTypes(p => p.includes(type) ? p.filter(t => t !== type) : [...p, type]);

  if (!isAuthenticated) {
    return <LoginScreen onLogin={handleLogin} onBiometricLogin={handleBiometricLogin} error={loginError} />;
  }

  return (
    <div className="min-h-screen flex flex-col font-sans text-slate-800 bg-slate-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2">
              <div className="bg-blue-600 p-1.5 rounded-lg"><LayoutDashboard className="h-5 w-5 text-white" /></div>
              <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-700 to-indigo-700">Meta x momo Dashboard</h1>
            </div>
            <div className="flex items-center gap-3">
              <MetricSourceToggle source={metricSource} onSourceChange={setMetricSource} />
              <div className="h-6 w-px bg-gray-200 mx-1"></div>
              {/* Manual refresh optional */}
              <LoadFacebookDataButton onClick={handleManualFbLoad} isLoading={isFetchingFbData} />
              <DataUploadButton onUpload={handleUpload} />
              <SaveToSheetButton onSave={() => executeSaveToSheet()} isSaving={isSavingToSheet} />
            </div>
          </div>
        </div>
      </header>
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        {isLoadingData ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3 text-gray-500"><Loader2 className="h-8 w-8 animate-spin text-blue-500" /><p>Loading data...</p></div>
        ) : (
          <>
            <SummaryCards metrics={metrics} source={metricSource} />
            <FilterBar
              startDate={startDate} endDate={endDate} onStartDateChange={setStartDate} onEndDateChange={setEndDate}
              searchTerm={searchTerm} onSearchChange={setSearchTerm}
              selectedDates={selectedDates} selectedCampaign={selectedCampaign}
              onClearDate={() => setSelectedDates([])} onClearCampaign={() => setSelectedCampaign(null)}
              onPresetChange={(val) => handlePresetChange(val, rawData)} selectedCampaignTypes={selectedCampaignTypes} onToggleCampaignType={toggleCampaignType}
            />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <MainChart data={chartData} onDateClick={handleDateClick} selectedDates={selectedDates} source={metricSource} />
              <CostChart data={chartData} onDateClick={handleDateClick} selectedDates={selectedDates} source={metricSource} />
            </div>
            <DataTable
              data={aggregatedTableData}
              sortField={sortField} sortOrder={sortOrder}
              onSort={(field) => {
                if (field === sortField) setSortOrder(p => p === 'asc' ? 'desc' : 'asc');
                else { setSortField(field); setSortOrder('desc'); }
              }}
              selectedCampaign={selectedCampaign}
              onRowClick={(campaign) => setSelectedCampaign(p => p === campaign ? null : campaign)}
              source={metricSource}
            />
          </>
        )}
      </main>
      {notification && <Toast message={notification.message} type={notification.type} onClose={() => setNotification(null)} />}
    </div>
  );
};
export default App;
