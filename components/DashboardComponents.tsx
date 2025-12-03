
import React, { useState, useRef, useEffect } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Line,
  ComposedChart,
  Area,
  Cell,
} from 'recharts';
import { CampaignData, DashboardMetrics, SortField, SortOrder } from '../types';
import { formatCurrency, formatNumber, formatPercentage, formatDecimal } from '../utils';
import { ArrowUpDown, ArrowUp, ArrowDown, Search, FilterX, Calendar, Tag, Lock, Upload, Loader2, FileSpreadsheet, X, CheckCircle, AlertCircle, Fingerprint, Facebook } from 'lucide-react';

// --- Summary Cards ---
interface SummaryCardsProps {
  metrics: DashboardMetrics;
}

export const SummaryCards: React.FC<SummaryCardsProps> = ({ metrics }) => {
  const cards = [
    { title: 'Total Spent', value: formatCurrency(metrics.totalSpent), color: 'border-l-blue-500' },
    { title: 'Avg ROAS', value: formatDecimal(metrics.avgRoas), color: 'border-l-green-500' },
    { title: 'Avg CPA', value: formatDecimal(metrics.avgCpa), color: 'border-l-orange-500' },
    { title: 'Avg CPC', value: formatDecimal(metrics.avgCpc), color: 'border-l-indigo-500' },
    { title: 'Avg CVR', value: formatPercentage(metrics.avgCvr), color: 'border-l-purple-500' },
    // Facebook Metrics
    { title: 'Reach', value: metrics.totalReach ? formatNumber(metrics.totalReach) : '-', color: 'border-l-cyan-500' },
    { title: 'Impressions', value: metrics.totalImpressions ? formatNumber(metrics.totalImpressions) : '-', color: 'border-l-pink-500' },
    { title: 'Avg CPM', value: metrics.avgCpm ? formatNumber(metrics.avgCpm) : '-', color: 'border-l-teal-500' },
    { title: 'Avg CTR', value: metrics.avgCtr ? formatPercentage(metrics.avgCtr) : '-', color: 'border-l-rose-500' },
    { title: 'Freq', value: metrics.avgFrequency ? formatDecimal(metrics.avgFrequency) : '-', color: 'border-l-yellow-500' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
      {cards.map((card, idx) => (
        <div key={idx} className={`bg-white p-3 rounded-lg shadow-sm border border-gray-100 border-l-4 ${card.color}`}>
          <p className="text-gray-500 text-xs font-medium uppercase truncate" title={card.title}>{card.title}</p>
          <p className="text-lg font-bold text-gray-800 mt-1 truncate" title={card.value}>{card.value}</p>
        </div>
      ))}
    </div>
  );
};

// --- Facebook Token Button ---
interface FacebookTokenButtonProps {
  onConnect: (token: string) => Promise<void>;
}

export const FacebookTokenButton: React.FC<FacebookTokenButtonProps> = ({ onConnect }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [token, setToken] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleConnect = async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      await onConnect(token);
      setIsOpen(false);
      setToken('');
    } catch (e) {
      // Error handled by parent toast
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 bg-[#1877F2] text-white px-3 py-1.5 rounded-md text-xs font-medium hover:bg-[#166fe5] transition-colors"
      >
        <Facebook className="h-3.5 w-3.5" />
        Sync Insights
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Connect Facebook Insights</h3>
            <p className="text-sm text-gray-500 mb-4">
              Enter your User Access Token to fetch campaign performance data (Reach, Impressions, CTR, etc.) matching your campaign names.
            </p>
            <input
              type="text"
              placeholder="Paste Access Token..."
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 mb-4"
              value={token}
              onChange={(e) => setToken(e.target.value)}
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setIsOpen(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded"
              >
                Cancel
              </button>
              <button
                onClick={handleConnect}
                disabled={isLoading}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                Fetch Data
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

// --- Data Upload Button ---
interface DataUploadButtonProps {
  onUpload: (file: File) => Promise<void>;
}

export const DataUploadButton: React.FC<DataUploadButtonProps> = ({ onUpload }) => {
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    try {
      await onUpload(file);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (error) {
      console.error("Upload failed", error);
      alert("Failed to upload file. Please ensure it is a valid Excel (.xlsx) file.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <>
      <input
        type="file"
        accept=".xlsx, .xls"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
      />
      <button
        onClick={handleButtonClick}
        disabled={isLoading}
        className="flex items-center gap-2 bg-emerald-600 text-white px-3 py-1.5 rounded-md text-xs font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50"
      >
        {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
        Import Data
      </button>
    </>
  );
};

// --- Save to Sheet Button ---
interface SaveToSheetButtonProps {
  onSave: () => void;
  isSaving: boolean;
}

export const SaveToSheetButton: React.FC<SaveToSheetButtonProps> = ({ onSave, isSaving }) => {
  return (
    <button
      onClick={onSave}
      disabled={isSaving}
      className="flex items-center gap-2 bg-green-600 text-white px-3 py-1.5 rounded-md text-xs font-medium hover:bg-green-700 transition-colors disabled:opacity-50"
    >
      {isSaving ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <FileSpreadsheet className="h-3.5 w-3.5" />
      )}
      {isSaving ? 'Saving...' : 'Save to Sheet'}
    </button>
  );
};

// --- Toast Notification ---
interface ToastProps {
  message: string;
  type: 'success' | 'error';
  onClose: () => void;
}

export const Toast: React.FC<ToastProps> = ({ message, type, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className={`fixed top-20 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg border transform transition-all duration-500 ease-in-out animate-in slide-in-from-right max-w-sm ${
      type === 'success' ? 'bg-white border-green-200' : 'bg-white border-red-200'
    }`}>
      <div className={`flex-shrink-0 ${type === 'success' ? 'text-green-500' : 'text-red-500'}`}>
        {type === 'success' ? <CheckCircle className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
      </div>
      <div className="flex-1">
        <p className={`text-sm font-medium ${type === 'success' ? 'text-green-800' : 'text-red-800'}`}>
          {message}
        </p>
      </div>
      <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
};

// --- Filter Bar ---
interface FilterBarProps {
  startDate: string;
  endDate: string;
  onStartDateChange: (val: string) => void;
  onEndDateChange: (val: string) => void;
  searchTerm: string;
  onSearchChange: (val: string) => void;
  selectedDates: string[];
  selectedCampaign: string | null;
  onClearDate: () => void;
  onClearCampaign: () => void;
  onPresetChange: (val: string) => void;
  selectedCampaignTypes: string[];
  onToggleCampaignType: (type: string) => void;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  searchTerm,
  onSearchChange,
  selectedDates,
  selectedCampaign,
  onClearDate,
  onClearCampaign,
  onPresetChange,
  selectedCampaignTypes,
  onToggleCampaignType,
}) => {
  const CAMPAIGN_TYPES = ['DABA', 'DPA', '導購', '導流'];

  return (
    <div className="flex flex-col gap-4 mb-6">
      {/* Main Controls */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <div className="flex flex-col lg:flex-row gap-6 justify-between">
          {/* Top Row: Dates and Search */}
          <div className="flex flex-col md:flex-row gap-4 w-full">
            
            <div className="flex flex-wrap gap-4 items-end">
              <div className="flex flex-col">
                <label className="text-xs text-gray-500 font-semibold mb-1">Date Range Preset</label>
                <div className="relative">
                    <select 
                      className="appearance-none border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 pr-8 bg-white w-full md:w-auto"
                      onChange={(e) => onPresetChange(e.target.value)}
                      defaultValue="7d"
                    >
                      <option value="custom">Custom Range</option>
                      <option value="7d">Last 7 Days</option>
                      <option value="14d">Last 14 Days</option>
                      <option value="month">This Month</option>
                      <option value="quarter">This Quarter</option>
                    </select>
                    <Calendar className="absolute right-2 top-2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
                </div>
              </div>

              <div className="flex gap-2 items-center">
                <div className="flex flex-col">
                  <label className="text-xs text-gray-500 font-semibold mb-1">Start</label>
                  <input
                    type="date"
                    className="border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={startDate}
                    onChange={(e) => onStartDateChange(e.target.value)}
                  />
                </div>
                <span className="mb-1 text-gray-400">-</span>
                <div className="flex flex-col">
                  <label className="text-xs text-gray-500 font-semibold mb-1">End</label>
                  <input
                    type="date"
                    className="border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={endDate}
                    onChange={(e) => onEndDateChange(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="flex-grow">
               <label className="text-xs text-gray-500 font-semibold mb-1 block">Search Campaigns</label>
               <div className="relative w-full">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 text-gray-400" />
                </div>
                <input
                  type="text"
                  placeholder="Search by name..."
                  className="pl-10 w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={searchTerm}
                  onChange={(e) => onSearchChange(e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Second Row: Campaign Tags */}
        <div className="mt-4 flex flex-col sm:flex-row gap-3 items-start sm:items-center border-t border-gray-100 pt-4">
          <span className="text-xs text-gray-500 font-semibold flex items-center gap-1">
            <Tag className="h-3 w-3" /> Filter Types:
          </span>
          <div className="flex flex-wrap gap-2">
            {CAMPAIGN_TYPES.map((type) => {
              const isSelected = selectedCampaignTypes.includes(type);
              return (
                <button
                  key={type}
                  onClick={() => onToggleCampaignType(type)}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-all duration-200 ${
                    isSelected
                      ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                      : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400 hover:text-blue-500'
                  }`}
                >
                  {type}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Active Selection Tags */}
      {(selectedDates.length > 0 || selectedCampaign) && (
        <div className="flex gap-2 items-center flex-wrap">
          <span className="text-sm text-gray-500 font-medium">Active Selection:</span>
          {selectedDates.length > 0 && (
            <button
              onClick={onClearDate}
              className="flex items-center gap-1 bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm hover:bg-blue-200 transition-colors"
            >
              {selectedDates.length === 1 ? `Date: ${selectedDates[0]}` : `${selectedDates.length} Dates Selected`} <FilterX className="h-3 w-3" />
            </button>
          )}
          {selectedCampaign && (
            <button
              onClick={onClearCampaign}
              className="flex items-center gap-1 bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm hover:bg-green-200 transition-colors max-w-xs truncate"
              title={selectedCampaign}
            >
              Campaign: {selectedCampaign} <FilterX className="h-3 w-3" />
            </button>
          )}
        </div>
      )}
    </div>
  );
};

// --- Main Chart ---
interface ChartProps {
  data: any[];
  onDateClick: (date: string) => void;
  selectedDates: string[];
}

export const MainChart: React.FC<ChartProps> = ({ data, onDateClick, selectedDates }) => {
  const [metric2, setMetric2] = useState<'roas' | 'cvr' | 'cpa'>('roas');

  const metricConfig = {
    roas: { label: 'ROAS', color: '#10b981', formatter: (v: number) => v.toFixed(1) },
    cvr: { label: 'CVR', color: '#8b5cf6', formatter: formatPercentage },
    cpa: { label: 'CPA', color: '#f97316', formatter: (v: number) => v.toFixed(1) },
  };

  return (
    <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mb-6 h-96">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-800">Performance Trends</h3>
        <div className="flex items-center gap-2">
           <span className="text-sm text-gray-500">Secondary Metric:</span>
           <select 
             className="border border-gray-300 rounded text-sm p-1 focus:ring-2 focus:ring-blue-500 focus:outline-none"
             value={metric2}
             onChange={(e) => setMetric2(e.target.value as any)}
           >
             <option value="roas">ROAS</option>
             <option value="cvr">CVR</option>
             <option value="cpa">CPA</option>
           </select>
        </div>
      </div>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart 
          data={data} 
          margin={{ top: 5, right: 20, bottom: 5, left: 0 }}
          onClick={(state) => {
            if (state && state.activeLabel) {
              onDateClick(state.activeLabel as string);
            }
          }}
        >
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
          <XAxis 
            dataKey="date" 
            tick={{ fontSize: 12, fill: '#6b7280' }} 
            tickLine={false} 
            axisLine={false}
            minTickGap={30}
          />
          <YAxis 
            yAxisId="left" 
            tick={{ fontSize: 12, fill: '#6b7280' }} 
            tickLine={false} 
            axisLine={false} 
            tickFormatter={(val) => `${val/1000}k`}
            label={{ value: 'Spent', angle: -90, position: 'insideLeft', style: { fill: '#3b82f6' } }}
          />
          <YAxis 
            yAxisId="right" 
            orientation="right" 
            tick={{ fontSize: 12, fill: '#6b7280' }} 
            tickLine={false} 
            axisLine={false}
            label={{ value: metricConfig[metric2].label, angle: 90, position: 'insideRight', style: { fill: metricConfig[metric2].color } }}
          />
          <Tooltip 
            cursor={{ fill: '#f3f4f6' }}
            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
            formatter={(value: number, name: string) => {
              if (name === 'Spent') return formatCurrency(value);
              if (name === 'ROAS') return value.toFixed(1);
              if (name === 'CVR') return formatPercentage(value);
              if (name === 'CPA') return value.toFixed(1);
              return value;
            }}
            labelStyle={{ color: '#111827', fontWeight: 600 }}
          />
          <Legend />
          <Bar 
            yAxisId="left" 
            dataKey="spent" 
            name="Spent" 
            fill="#3b82f6" 
            radius={[4, 4, 0, 0]} 
            barSize={20}
            cursor="pointer"
          >
            {data.map((entry: any, index: number) => (
              <Cell 
                key={`cell-${index}`} 
                fill="#3b82f6"
                opacity={selectedDates.length === 0 || selectedDates.includes(entry.date) ? 1 : 0.4}
              />
            ))}
          </Bar>
          <Line 
            yAxisId="right" 
            type="monotone" 
            dataKey={metric2} 
            name={metricConfig[metric2].label} 
            stroke={metricConfig[metric2].color} 
            strokeWidth={3} 
            dot={false} 
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
};

// --- Cost Chart (CPA & CPC) ---
export const CostChart: React.FC<ChartProps> = ({ data, onDateClick, selectedDates }) => {
  return (
    <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mb-6 h-96">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-800">Cost Efficiency (CPA & CPC)</h3>
      </div>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart 
          data={data} 
          margin={{ top: 5, right: 20, bottom: 5, left: 0 }}
          onClick={(state) => {
            if (state && state.activeLabel) {
              onDateClick(state.activeLabel as string);
            }
          }}
        >
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
          <XAxis 
            dataKey="date" 
            tick={{ fontSize: 12, fill: '#6b7280' }} 
            tickLine={false} 
            axisLine={false}
            minTickGap={30}
          />
          <YAxis 
            yAxisId="left" 
            tick={{ fontSize: 12, fill: '#6b7280' }} 
            tickLine={false} 
            axisLine={false} 
            label={{ value: 'CPA', angle: -90, position: 'insideLeft', style: { fill: '#f97316' } }}
          />
          <YAxis 
            yAxisId="right" 
            orientation="right" 
            tick={{ fontSize: 12, fill: '#6b7280' }} 
            tickLine={false} 
            axisLine={false}
            label={{ value: 'CPC', angle: 90, position: 'insideRight', style: { fill: '#6366f1' } }}
          />
          <Tooltip 
            cursor={{ fill: '#f3f4f6' }}
            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
            formatter={(value: number, name: string) => {
              if (name === 'CPA') return value.toFixed(1);
              if (name === 'CPC') return value.toFixed(1);
              return value;
            }}
            labelStyle={{ color: '#111827', fontWeight: 600 }}
          />
          <Legend />
          <Area
            yAxisId="left"
            type="monotone"
            dataKey="cpa"
            name="CPA"
            fill="#f97316"
            fillOpacity={0.1}
            stroke="#f97316"
            strokeWidth={2}
          />
          <Line 
            yAxisId="right" 
            type="monotone" 
            dataKey="cpc" 
            name="CPC" 
            stroke="#6366f1" 
            strokeWidth={3} 
            dot={true} 
            activeDot={{ r: 6 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
};

// --- Data Table ---
interface DataTableProps {
  data: CampaignData[]; 
  sortField: SortField;
  sortOrder: SortOrder;
  onSort: (field: SortField) => void;
  selectedCampaign: string | null;
  onRowClick: (campaignName: string) => void;
}

export const DataTable: React.FC<DataTableProps> = ({ 
  data, 
  sortField, 
  sortOrder, 
  onSort, 
  selectedCampaign, 
  onRowClick 
}) => {
  const columns: { field: SortField; label: string; align: 'left' | 'right' }[] = [
    { field: 'campaignName', label: 'Campaign Name', align: 'left' },
    { field: 'spent', label: 'Spent', align: 'right' },
    { field: 'roas', label: 'ROAS', align: 'right' },
    { field: 'reach', label: 'Reach', align: 'right' },
    { field: 'impressions', label: 'Impr.', align: 'right' },
    { field: 'cpm', label: 'CPM', align: 'right' },
    { field: 'ctr', label: 'CTR', align: 'right' },
    { field: 'cpa', label: 'CPA', align: 'right' },
    { field: 'frequency', label: 'Freq', align: 'right' },
  ];

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 text-gray-300 ml-1 inline" />;
    return sortOrder === 'asc' ? 
      <ArrowUp className="h-3 w-3 text-blue-500 ml-1 inline" /> : 
      <ArrowDown className="h-3 w-3 text-blue-500 ml-1 inline" />;
  };

  const formatValue = (field: SortField, value: any) => {
      if (value === undefined || value === null) return '-';
      if (field === 'spent') return formatNumber(value);
      if (field === 'cpc' || field === 'cpa' || field === 'roas' || field === 'cpm' || field === 'frequency') return value.toFixed(1);
      if (field === 'cvr' || field === 'ctr') return formatPercentage(value);
      if (field === 'reach' || field === 'impressions' || field === 'linkClicks') return formatNumber(value);
      return value;
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 table-fixed">
          <thead className="bg-gray-50">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.field}
                  scope="col"
                  className={`px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors text-${col.align} ${col.field === 'campaignName' ? 'w-1/3' : 'w-24'}`}
                  onClick={() => onSort(col.field)}
                >
                  {col.label}
                  {renderSortIcon(col.field)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {data.length > 0 ? (
              data.map((row) => (
                <tr 
                  key={row.id} 
                  onClick={() => onRowClick(row.campaignName)}
                  className={`transition-colors group cursor-pointer ${
                    selectedCampaign === row.campaignName 
                      ? 'bg-blue-50 border-l-4 border-l-blue-500' 
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <td className="px-6 py-4 text-sm text-gray-900 break-words">
                    <div className="line-clamp-2 group-hover:line-clamp-none transition-all duration-200" title={row.campaignName}>
                      {row.campaignName}
                    </div>
                  </td>
                  {columns.slice(1).map(col => (
                      <td key={col.field} className={`px-6 py-4 whitespace-nowrap text-sm text-right ${col.field === 'roas' ? 'font-semibold text-green-600' : 'text-gray-500'}`}>
                          {formatValue(col.field, row[col.field as keyof CampaignData])}
                      </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length} className="px-6 py-10 text-center text-sm text-gray-500">
                  No campaigns found for the selected criteria.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="bg-gray-50 px-6 py-3 border-t border-gray-200 text-sm text-gray-500">
        Showing {data.length} Campaigns
      </div>
    </div>
  );
};

// --- Login Screen ---
interface LoginScreenProps {
  onLogin: (email: string, code: string) => void;
  onBiometricLogin: () => void;
  error?: string;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin, onBiometricLogin, error }) => {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onLogin(email, code);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md border border-gray-100">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-100 rounded-full mb-4">
            <Lock className="h-6 w-6 text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">Welcome Back</h1>
          <p className="text-gray-500 text-sm mt-2">Please enter your credentials to access the dashboard.</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
            <input
              type="email"
              required
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@meta.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Access Code</label>
            <input
              type="password"
              required
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="•••••••••••••••"
            />
          </div>
          {error && (
            <div className="text-red-500 text-sm text-center bg-red-50 p-3 rounded-lg border border-red-100">
              {error}
            </div>
          )}
          <button
            type="submit"
            className="w-full bg-blue-600 text-white py-2.5 rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-md hover:shadow-lg active:scale-[0.99] duration-200"
          >
            Secure Login
          </button>
          
          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">Or continue with</span>
            </div>
          </div>

          <button
            type="button"
            onClick={onBiometricLogin}
            className="w-full bg-white border border-gray-300 text-gray-700 py-2.5 rounded-lg hover:bg-gray-50 transition-colors font-medium flex items-center justify-center gap-2"
          >
            <Fingerprint className="h-5 w-5 text-gray-600" />
            Login with Touch ID
          </button>
        </form>
      </div>
    </div>
  );
};
