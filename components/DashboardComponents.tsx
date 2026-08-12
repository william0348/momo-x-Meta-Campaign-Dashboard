
import React, { useState, useRef, useEffect } from 'react';
import {
  ArrowUpDown, ArrowUp, ArrowDown, Upload, Save, Search, X,
  Calendar, DollarSign, MousePointer, Eye, ShoppingCart,
  TrendingUp, Facebook, Lock, RefreshCw, FileSpreadsheet, Loader2, LayoutDashboard,
  Download, Maximize2, FileDown, ShieldCheck, LogOut, Trash2, Plus
} from 'lucide-react';
import {
  ResponsiveContainer, ComposedChart, Line, Bar, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell, LabelList
} from 'recharts';
import { CampaignData, DashboardMetrics, SortField, SortOrder, MetricSource } from '../types';
import { formatNumber, formatDecimal, formatPercentage, formatCurrency, exportChartDataToCSV } from '../utils';

declare global {
  interface Window {
    google?: any;
  }
}

// --- Components ---

export const MetricSourceToggle: React.FC<{ source: MetricSource, onSourceChange: (s: MetricSource) => void }> = ({ source, onSourceChange }) => (
  <div className="flex bg-gray-100 p-1 rounded-lg border border-gray-200">
    <button 
      onClick={() => onSourceChange('momo')}
      className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${source === 'momo' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-900'}`}
    >
      Momo
    </button>
    <button 
      onClick={() => onSourceChange('fb')}
      className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${source === 'fb' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-900'}`}
    >
      Meta (FB)
    </button>
  </div>
);

export const LoadFacebookDataButton: React.FC<{ onClick: () => void, isLoading: boolean }> = ({ onClick, isLoading }) => (
  <button 
    onClick={onClick}
    disabled={isLoading}
    className="flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-50 text-sm font-medium"
  >
    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
    <span>Sync FB</span>
  </button>
);

export const DataUploadButton: React.FC<{ onUpload: (file: File) => void }> = ({ onUpload }) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onUpload(e.target.files[0]);
    }
  };
  return (
    <div className="relative">
      <input 
        type="file" 
        accept=".xlsx,.xls" 
        onChange={handleChange} 
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
      />
      <button className="flex items-center gap-2 px-3 py-2 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 transition-colors text-sm font-medium">
        <Upload className="h-4 w-4" />
        <span>Import Excel</span>
      </button>
    </div>
  );
};

export const DownloadRawDataButton: React.FC<{ onClick: () => void, disabled?: boolean }> = ({ onClick, disabled }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    title="Download filtered raw data as CSV"
    className="flex items-center gap-2 px-3 py-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors disabled:opacity-50 text-sm font-medium"
  >
    <FileDown className="h-4 w-4" />
    <span>Download Raw Data</span>
  </button>
);

export const SaveToSheetButton: React.FC<{ onSave: () => void, isSaving: boolean }> = ({ onSave, isSaving }) => (
  <button 
    onClick={onSave}
    disabled={isSaving}
    className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 text-sm font-medium shadow-sm"
  >
    {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
    <span>Save to Sheet</span>
  </button>
);

const StatCard = ({ title, value, subValue, icon: Icon, color }: any) => {
    const colorClass = color === 'red' ? 'text-red-600 bg-red-50' : 
                       color === 'green' ? 'text-green-600 bg-green-50' :
                       color === 'blue' ? 'text-blue-600 bg-blue-50' :
                       color === 'purple' ? 'text-purple-600 bg-purple-50' :
                       'text-indigo-600 bg-indigo-50';
    
    return (
      <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-between h-full">
        <div className="flex justify-between items-start mb-4">
          <div className={`p-2.5 rounded-lg ${colorClass.split(' ')[1]}`}>
            <Icon className={`h-5 w-5 ${colorClass.split(' ')[0]}`} />
          </div>
          {subValue && (
            <span className={`text-xs font-medium px-2 py-1 rounded-full ${colorClass.split(' ')[1]} ${colorClass.split(' ')[0]}`}>
              {subValue}
            </span>
          )}
        </div>
        <div>
          <p className="text-sm font-medium text-gray-500 mb-1">{title}</p>
          <h3 className="text-2xl font-bold text-gray-900 tracking-tight">{value}</h3>
        </div>
      </div>
    );
};

export const SummaryCards: React.FC<{ metrics: DashboardMetrics, source: MetricSource }> = ({ metrics, source }) => {
  if (source === 'momo') {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <StatCard title="Total Spent" value={formatCurrency(metrics.totalSpent)} icon={DollarSign} color="red" />
        <StatCard title="Avg ROAS" value={formatDecimal(metrics.avgRoas)} subValue={`Rev ${formatCurrency(metrics.totalSpent * metrics.avgRoas)}`} icon={TrendingUp} color="green" />
        <StatCard title="Avg CPC" value={formatCurrency(metrics.avgMomoCpc)} subValue={`Clicks ${formatNumber(metrics.totalSpent / (metrics.avgMomoCpc || 1))}`} icon={MousePointer} color="purple" />
        <StatCard title="Avg CPA" value={formatCurrency(metrics.avgMomoCpa)} subValue={`Conv ${formatNumber(metrics.totalSpent / (metrics.avgMomoCpa || 1))}`} icon={ShoppingCart} color="blue" />
        <StatCard title="Avg CVR" value={formatPercentage(metrics.avgMomoCvr)} icon={ArrowUp} color="indigo" />
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <StatCard title="Total Spent" value={formatCurrency(metrics.totalSpent)} icon={DollarSign} color="red" />
        <StatCard title="FB CPA" value={formatCurrency(metrics.avgFbCpa || 0)} subValue={`Purch ${formatNumber(metrics.totalFbPurchase || 0)}`} icon={ShoppingCart} color="green" />
        <StatCard title="FB CVR" value={formatPercentage(metrics.avgFbCvr || 0)} icon={ArrowUp} color="purple" />
        <StatCard title="FB CPC" value={formatCurrency(metrics.avgFbCpc || 0)} subValue={`Clicks ${formatNumber((metrics.totalImpressions || 0) * (metrics.avgFbCtr || 0))}`} icon={MousePointer} color="blue" />
        <StatCard title="FB CTR" value={formatPercentage(metrics.avgFbCtr || 0)} icon={Eye} color="indigo" />
    </div>
  );
};

export const FilterBar: React.FC<any> = ({ 
    startDate, endDate, onStartDateChange, onEndDateChange, 
    searchTerm, onSearchChange, selectedDates, selectedCampaign, 
    onClearDate, onClearCampaign, onPresetChange, 
    selectedCampaignTypes, onToggleCampaignType 
  }) => {
    return (
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 mb-6 space-y-4 lg:space-y-0 lg:flex lg:items-center lg:justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-gray-50 p-1 rounded-lg border border-gray-200">
             {['7d', '14d', 'month', 'quarter'].map(p => (
                 <button key={p} onClick={() => onPresetChange(p)} className="px-3 py-1 text-xs font-medium text-gray-600 hover:bg-white hover:shadow-sm rounded-md transition-all uppercase">
                     {p}
                 </button>
             ))}
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input type="date" value={startDate} onChange={e => onStartDateChange(e.target.value)} className="pl-9 pr-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <span className="text-gray-400">-</span>
            <div className="relative">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input type="date" value={endDate} onChange={e => onEndDateChange(e.target.value)} className="pl-9 pr-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 bg-gray-50 p-1 rounded-lg border border-gray-200">
                {['DABA', 'DPA', '導購', '導流'].map(type => (
                    <button
                        key={type}
                        onClick={() => onToggleCampaignType(type)}
                        className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                            selectedCampaignTypes.includes(type) 
                            ? 'bg-white shadow-sm text-blue-600 font-bold' 
                            : 'text-gray-500 hover:text-gray-900'
                        }`}
                    >
                        {type}
                    </button>
                ))}
            </div>

            {(selectedDates.length > 0 || selectedCampaign) && (
                <div className="flex items-center gap-2">
                    {selectedDates.length > 0 && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                            {selectedDates.length} days selected
                            <button onClick={onClearDate}><X className="h-3 w-3" /></button>
                        </span>
                    )}
                    {selectedCampaign && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700 max-w-[200px] truncate">
                            Campaign Filter
                            <button onClick={onClearCampaign}><X className="h-3 w-3" /></button>
                        </span>
                    )}
                </div>
            )}

            <div className="relative w-full lg:w-64">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input 
                    type="text" 
                    placeholder="Search campaigns..." 
                    value={searchTerm} 
                    onChange={e => onSearchChange(e.target.value)} 
                    className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" 
                />
            </div>
        </div>
      </div>
    );
};

// --- Chart Card Wrapper: adds "expand" and "download PNG" actions to any chart ---

const ChartCard: React.FC<{
    title: string,
    headerExtra?: React.ReactNode,
    data?: any[],
    onDownloadRawData?: () => void,
    renderChart: (heightPx: number, showLabels: boolean) => React.ReactNode
}> = ({ title, headerExtra, data, onDownloadRawData, renderChart }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);
    const [showLabels, setShowLabels] = useState(false);
    const chartRef = useRef<HTMLDivElement>(null);

    const handleDownloadPng = async () => {
        if (!chartRef.current || isDownloading) return;
        setIsDownloading(true);
        try {
            const { toPng } = await import('html-to-image');
            const dataUrl = await toPng(chartRef.current, { backgroundColor: '#ffffff', pixelRatio: 2 });
            const link = document.createElement('a');
            link.download = `${title.replace(/\s+/g, '_')}.png`;
            link.href = dataUrl;
            link.click();
        } catch (e) {
            console.error('Failed to export chart as PNG', e);
        } finally {
            setIsDownloading(false);
        }
    };

    return (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
                <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
                <div className="flex items-center gap-3 flex-wrap">
                    {headerExtra}
                    <label className="flex items-center gap-1.5 text-xs font-medium text-gray-500 cursor-pointer select-none">
                        <input
                            type="checkbox"
                            checked={showLabels}
                            onChange={(e) => setShowLabels(e.target.checked)}
                            className="h-3.5 w-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        顯示數值標籤
                    </label>
                    <div className="flex items-center gap-1">
                        {onDownloadRawData && (
                            <button
                                onClick={onDownloadRawData}
                                disabled={!data || data.length === 0}
                                title="Download raw data (CSV)"
                                className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors disabled:opacity-50"
                            >
                                <FileDown className="h-4 w-4" />
                            </button>
                        )}
                        <button
                            onClick={handleDownloadPng}
                            disabled={isDownloading}
                            title="Download as PNG"
                            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors disabled:opacity-50"
                        >
                            {isDownloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                        </button>
                        <button
                            onClick={() => setIsExpanded(true)}
                            title="Expand chart"
                            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                        >
                            <Maximize2 className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            </div>
            <div ref={chartRef} className="bg-white">
                {renderChart(320, showLabels)}
            </div>

            {isExpanded && (
                <div
                    className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-6"
                    onClick={() => setIsExpanded(false)}
                >
                    <div
                        className="bg-white rounded-xl p-6 w-full max-w-5xl shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
                            <button
                                onClick={() => setIsExpanded(false)}
                                title="Close"
                                className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        {renderChart(512, showLabels)}
                    </div>
                </div>
            )}
        </div>
    );
};

export const MainChart: React.FC<{ data: any[], onDateClick: (d: string) => void, selectedDates: string[], source: MetricSource }> = ({ data, onDateClick, selectedDates, source }) => {
    return (
        <ChartCard
            title="Performance Trends"
            data={data}
            onDownloadRawData={() => exportChartDataToCSV(data, 'performance_trends_data.csv')}
            renderChart={(heightPx, showLabels) => (
                <div style={{ height: heightPx }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={data} onClick={(e) => e && e.activePayload && onDateClick(e.activePayload[0].payload.date)}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                            <XAxis dataKey="date" tickFormatter={(d) => d.substring(5)} fontSize={12} tickMargin={10} axisLine={false} tickLine={false} />
                            <YAxis yAxisId="left" orientation="left" stroke="#6b7280" fontSize={12} axisLine={false} tickLine={false} tickFormatter={(val) => `$${val}`} />
                            <YAxis yAxisId="right" orientation="right" stroke="#6b7280" fontSize={12} axisLine={false} tickLine={false} />
                            <Tooltip
                                contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                                labelStyle={{ color: '#374151', fontWeight: 600, marginBottom: '4px' }}
                                formatter={(value: number, name: string) => [
                                    name === 'ROAS' ? formatDecimal(value) :
                                    name.toLowerCase().includes('rate') || name === 'momoCvr' || name === 'fbCvr' || name === 'fbCtr' ? formatPercentage(value) :
                                    formatNumber(value),
                                    name === 'spent' ? 'Spent' : name === 'revenue' ? 'Revenue' : name === 'fbPurchase' ? 'Purchases' : name
                                ]}
                            />
                            <Legend wrapperStyle={{ paddingTop: '20px' }} />

                            <Bar yAxisId="left" dataKey="spent" name="Spent" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={50}>
                                {data.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fillOpacity={selectedDates.length === 0 || selectedDates.includes(entry.date) ? 1 : 0.3} />
                                ))}
                                {showLabels && <LabelList dataKey="spent" position="top" formatter={(v: number) => formatNumber(v)} fontSize={10} fill="#1d4ed8" />}
                            </Bar>
                            {source === 'momo' ? (
                                <Line yAxisId="right" type="monotone" dataKey="roas" name="ROAS" stroke="#10b981" strokeWidth={3} dot={false}>
                                    {showLabels && <LabelList dataKey="roas" position="top" formatter={(v: number) => formatDecimal(v)} fontSize={10} fill="#047857" />}
                                </Line>
                            ) : (
                                <Line yAxisId="right" type="monotone" dataKey="fbPurchase" name="Purchases" stroke="#10b981" strokeWidth={3} dot={false}>
                                    {showLabels && <LabelList dataKey="fbPurchase" position="top" formatter={(v: number) => formatNumber(v)} fontSize={10} fill="#047857" />}
                                </Line>
                            )}
                        </ComposedChart>
                    </ResponsiveContainer>
                </div>
            )}
        />
    );
};

type EfficiencyMetricKey = 'cpa' | 'cpc' | 'cvr' | 'ctr';

const EFFICIENCY_METRIC_LABELS: Record<EfficiencyMetricKey, string> = {
    cpa: 'CPA',
    cpc: 'CPC',
    cvr: 'CVR',
    ctr: 'CTR',
};

// Resolve a metric key to the actual field name on chartData, given the current Momo/FB source.
const resolveEfficiencyField = (metric: EfficiencyMetricKey, source: MetricSource): string => {
    if (source === 'momo') {
        if (metric === 'cpa') return 'momoCpa';
        if (metric === 'cpc') return 'momoCpc';
        if (metric === 'ctr') return 'momoCtr';
        return 'momoCvr';
    }
    if (metric === 'cpa') return 'fbCpa';
    if (metric === 'cpc') return 'fbCpc';
    if (metric === 'ctr') return 'fbCtr';
    return 'fbCvr';
};

const isPercentageMetric = (metric: EfficiencyMetricKey) => metric === 'cvr' || metric === 'ctr';

const MetricSelect: React.FC<{ label: string, value: EfficiencyMetricKey, onChange: (v: EfficiencyMetricKey) => void }> = ({ label, value, onChange }) => (
    <label className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
        {label}
        <select
            value={value}
            onChange={(e) => onChange(e.target.value as EfficiencyMetricKey)}
            className="border border-gray-200 rounded-md text-xs px-2 py-1 text-gray-700 focus:ring-2 focus:ring-blue-500 outline-none"
        >
            {(Object.keys(EFFICIENCY_METRIC_LABELS) as EfficiencyMetricKey[]).map(key => (
                <option key={key} value={key}>{EFFICIENCY_METRIC_LABELS[key]}</option>
            ))}
        </select>
    </label>
);

export const CostChart: React.FC<{ data: any[], onDateClick: (d: string) => void, selectedDates: string[], source: MetricSource }> = ({ data, onDateClick, selectedDates, source }) => {
    const [leftMetric, setLeftMetric] = useState<EfficiencyMetricKey>('cpc');
    const [rightMetric, setRightMetric] = useState<EfficiencyMetricKey>('ctr');

    const leftField = resolveEfficiencyField(leftMetric, source);
    const rightField = resolveEfficiencyField(rightMetric, source);
    const formatValue = (metric: EfficiencyMetricKey, value: number) => isPercentageMetric(metric) ? formatPercentage(value) : formatDecimal(value);

    return (
        <ChartCard
            title="Efficiency Metrics"
            data={data}
            onDownloadRawData={() => exportChartDataToCSV(data, 'efficiency_metrics_data.csv')}
            headerExtra={
                <div className="flex items-center gap-3">
                    <MetricSelect label="Area" value={leftMetric} onChange={setLeftMetric} />
                    <MetricSelect label="Line" value={rightMetric} onChange={setRightMetric} />
                </div>
            }
            renderChart={(heightPx, showLabels) => (
                <div style={{ height: heightPx }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={data} onClick={(e) => e && e.activePayload && onDateClick(e.activePayload[0].payload.date)}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                            <XAxis dataKey="date" tickFormatter={(d) => d.substring(5)} fontSize={12} tickMargin={10} axisLine={false} tickLine={false} />
                            <YAxis yAxisId="left" orientation="left" stroke="#6b7280" fontSize={12} axisLine={false} tickLine={false} />
                            <YAxis yAxisId="right" orientation="right" stroke="#6b7280" fontSize={12} axisLine={false} tickLine={false} />
                            <Tooltip
                                contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                                formatter={(value: number, name: string) => [
                                    name === EFFICIENCY_METRIC_LABELS[leftMetric] ? formatValue(leftMetric, value) : formatValue(rightMetric, value),
                                    name
                                ]}
                            />
                            <Legend wrapperStyle={{ paddingTop: '20px' }} />
                            <defs>
                                <linearGradient id="colorLeftMetric" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#f97316" stopOpacity={0.1}/>
                                    <stop offset="95%" stopColor="#f97316" stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <Area yAxisId="left" type="monotone" dataKey={leftField} name={EFFICIENCY_METRIC_LABELS[leftMetric]} stroke="#f97316" fillOpacity={1} fill="url(#colorLeftMetric)" strokeWidth={2}>
                                {showLabels && <LabelList dataKey={leftField} position="top" formatter={(v: number) => formatValue(leftMetric, v)} fontSize={10} fill="#c2410c" />}
                            </Area>
                            <Line yAxisId="right" type="monotone" dataKey={rightField} name={EFFICIENCY_METRIC_LABELS[rightMetric]} stroke="#8b5cf6" strokeWidth={2} dot={true}>
                                {showLabels && <LabelList dataKey={rightField} position="bottom" formatter={(v: number) => formatValue(rightMetric, v)} fontSize={10} fill="#6d28d9" />}
                            </Line>
                        </ComposedChart>
                    </ResponsiveContainer>
                </div>
            )}
        />
    );
};

export const DataTable: React.FC<any> = (props) => {
  const { data, sortField, sortOrder, onSort, selectedCampaign, onRowClick, source } = props;
  
  const momoCols = [
    { field: 'campaignName', label: 'Campaign Name', align: 'left' },
    { field: 'spent', label: 'Spent', align: 'right' },
    { field: 'roas', label: 'ROAS', align: 'right' },
    { field: 'momoCpc', label: 'CPC', align: 'right' },
    { field: 'momoCtr', label: 'CTR', align: 'right' },
    { field: 'momoCvr', label: 'CVR', align: 'right' },
    { field: 'momoCpa', label: 'CPA', align: 'right' },
  ];
  
  const fbCols = [
    { field: 'campaignName', label: 'Campaign Name', align: 'left' },
    { field: 'spent', label: 'Spent', align: 'right' },
    { field: 'fbLinkClicks', label: 'Link Clicks', align: 'right' },
    { field: 'fbCpc', label: 'CPC', align: 'right' },
    { field: 'fbCtr', label: 'CTR', align: 'right' },
    { field: 'fbPurchase', label: 'Purchases', align: 'right' },
    { field: 'fbCpa', label: 'CPA', align: 'right' },
    { field: 'fbCvr', label: 'CVR', align: 'right' },
  ];
  const columns = source === 'fb' ? fbCols : momoCols;

  const renderSortIcon = (field: any) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 text-gray-300 ml-1 inline" />;
    return sortOrder === 'asc' ? 
      <ArrowUp className="h-3 w-3 text-blue-500 ml-1 inline" /> : 
      <ArrowDown className="h-3 w-3 text-blue-500 ml-1 inline" />;
  };

  const formatValue = (field: any, value: any) => {
      if (value === undefined || value === null || isNaN(value)) return '-';
      if (field === 'spent') return formatNumber(value);
      if (['momoCpc', 'momoCpa', 'roas', 'cpm', 'fbCpc', 'fbCpa'].includes(field)) return formatDecimal(value);
      if (['momoCvr', 'momoCtr', 'fbCtr', 'fbCvr'].includes(field)) return formatPercentage(value);
      if (['fbPurchase', 'fbLinkClicks'].includes(field)) return formatNumber(value);
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
              data.map((row: any) => (
                <tr 
                  key={row.id} 
                  onClick={() => onRowClick(row.campaignName)}
                  className={`transition-colors group cursor-pointer ${
                    selectedCampaign === row.campaignName 
                      ? 'bg-blue-50 border-l-4 border-l-blue-500' 
                      : 'hover:bg-gray-50'
                  }`}
                >
                  {columns.map(col => (
                    <td key={col.field} className={`px-6 py-4 whitespace-nowrap text-sm ${col.align === 'right' ? 'text-right' : 'text-left'} ${col.field === 'campaignName' ? 'text-gray-900 break-words' : col.field === 'roas' ? 'font-semibold text-green-600' : 'text-gray-500'}`}>
                      {col.field === 'campaignName' ? (
                         <div className="line-clamp-2 group-hover:line-clamp-none transition-all duration-200" title={row.campaignName}>
                          {row.campaignName}
                        </div>
                      ) : (
                        formatValue(col.field, row[col.field])
                      )}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length} className="px-6 py-10 text-center text-sm text-gray-500">
                  No campaigns found.
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

export const LoginScreen: React.FC<{ onCredential: (idToken: string) => void, error: string, clientId: string }> = ({ onCredential, error, clientId }) => {
    const buttonRef = useRef<HTMLDivElement>(null);
    // Keep the latest callback in a ref instead of the effect's deps — onCredential is a
    // fresh closure every App render (e.g. after a failed-login error), and re-running the
    // effect would call renderButton again on the same node, stacking duplicate buttons.
    const onCredentialRef = useRef(onCredential);
    onCredentialRef.current = onCredential;

    useEffect(() => {
        let cancelled = false;
        let attempts = 0;

        // The GSI script (loaded in index.html) may not be ready yet on first mount — poll briefly.
        const tryInit = () => {
            if (cancelled) return;
            if (window.google?.accounts?.id && buttonRef.current) {
                window.google.accounts.id.initialize({
                    client_id: clientId,
                    callback: (response: { credential: string }) => onCredentialRef.current(response.credential),
                });
                window.google.accounts.id.renderButton(buttonRef.current, {
                    theme: 'outline', size: 'large', width: 300, text: 'signin_with',
                });
                return;
            }
            if (attempts++ < 40) setTimeout(tryInit, 250);
        };
        tryInit();

        return () => { cancelled = true; };
    }, [clientId]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
            <div className="bg-white p-8 rounded-2xl shadow-lg border border-gray-100 max-w-md w-full">
                <div className="text-center mb-8">
                    <div className="bg-blue-600 w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4">
                        <Lock className="text-white h-6 w-6" />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900">Meta x momo Dashboard</h1>
                    <p className="text-gray-500 mt-2">請使用已授權的 Google 帳號登入</p>
                </div>
                {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm mb-6 flex items-center gap-2"><X className="h-4 w-4 flex-shrink-0" />{error}</div>}
                <div className="flex justify-center" ref={buttonRef}></div>
            </div>
        </div>
    );
};

export const AdminButton: React.FC<{ onClick: () => void }> = ({ onClick }) => (
    <button
        onClick={onClick}
        title="Manage authorized accounts"
        className="flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
    >
        <ShieldCheck className="h-4 w-4" />
        <span>Admin</span>
    </button>
);

export const LogoutButton: React.FC<{ email: string, onClick: () => void }> = ({ email, onClick }) => (
    <button
        onClick={onClick}
        title={`Sign out (${email})`}
        className="flex items-center gap-2 px-3 py-2 text-gray-500 rounded-lg hover:bg-gray-100 hover:text-gray-700 transition-colors text-sm font-medium"
    >
        <LogOut className="h-4 w-4" />
        <span className="max-w-[140px] truncate">{email}</span>
    </button>
);

export const AdminPanel: React.FC<{
    emails: string[],
    adminEmail: string,
    isSaving: boolean,
    onSave: (emails: string[]) => void,
    onClose: () => void,
}> = ({ emails, adminEmail, isSaving, onSave, onClose }) => {
    const [localEmails, setLocalEmails] = useState<string[]>(emails);
    const [newEmail, setNewEmail] = useState('');

    const handleAdd = () => {
        const normalized = newEmail.trim().toLowerCase();
        if (!normalized) return;
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) return;
        if (localEmails.includes(normalized)) { setNewEmail(''); return; }
        setLocalEmails(prev => [...prev, normalized]);
        setNewEmail('');
    };

    const handleRemove = (email: string) => {
        if (email === adminEmail.toLowerCase()) return;
        setLocalEmails(prev => prev.filter(e => e !== email));
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-6" onClick={onClose}>
            <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                        <ShieldCheck className="h-5 w-5 text-blue-600" />
                        Authorized Accounts
                    </h3>
                    <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="flex gap-2 mb-4">
                    <input
                        type="email"
                        value={newEmail}
                        onChange={(e) => setNewEmail(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                        placeholder="name@gmail.com"
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                    <button onClick={handleAdd} className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors">
                        <Plus className="h-4 w-4" />
                    </button>
                </div>

                <div className="space-y-1.5 max-h-64 overflow-y-auto mb-6">
                    {localEmails.length === 0 && <p className="text-sm text-gray-400 text-center py-4">No authorized accounts yet.</p>}
                    {localEmails.map(email => {
                        const isAdmin = email === adminEmail.toLowerCase();
                        return (
                            <div key={email} className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg text-sm">
                                <span className="text-gray-700 truncate">{email}</span>
                                {isAdmin ? (
                                    <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full flex-shrink-0">Admin</span>
                                ) : (
                                    <button onClick={() => handleRemove(email)} className="text-gray-400 hover:text-red-600 flex-shrink-0">
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>

                <div className="flex gap-2">
                    <button onClick={onClose} className="flex-1 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                        Cancel
                    </button>
                    <button
                        onClick={() => onSave(localEmails)}
                        disabled={isSaving}
                        className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        Save
                    </button>
                </div>
            </div>
        </div>
    );
};

export const Toast: React.FC<{ message: string, type: 'success' | 'error', onClose: () => void }> = ({ message, type, onClose }) => {
    React.useEffect(() => {
        const timer = setTimeout(onClose, 3000);
        return () => clearTimeout(timer);
    }, [onClose]);
    return (
        <div className={`fixed bottom-4 right-4 px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 z-50 text-white animate-fade-in-up ${type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
            <span>{message}</span>
            <button onClick={onClose}><X className="h-4 w-4 opacity-70 hover:opacity-100" /></button>
        </div>
    );
};
