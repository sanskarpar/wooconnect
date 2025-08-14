'use client';
import { useState, useEffect } from 'react';
import { Plus, Trash2, Save, AlertCircle, CheckCircle, X } from 'lucide-react';
import { BlacklistRule, BlacklistSettings } from '@/app/api/invoice-blacklist/route';
import { generateBlacklistRuleId } from '@/lib/blacklistFilter';

interface BlacklistManagerProps {
  onSettingsChange?: (settings: BlacklistSettings) => void;
}

const RULE_TYPES = [
  { value: 'customerName', label: 'Customer Name' },
  { value: 'customerEmail', label: 'Customer Email' },
  { value: 'storeName', label: 'Store Name' },
  { value: 'invoiceNumber', label: 'Invoice Number' },
  { value: 'amount', label: 'Amount' },
  { value: 'status', label: 'Status' },
  { value: 'dateRange', label: 'Date Range' }
];

const STRING_CONDITIONS = [
  { value: 'contains', label: 'Contains' },
  { value: 'equals', label: 'Equals' },
  { value: 'startsWith', label: 'Starts With' },
  { value: 'endsWith', label: 'Ends With' }
];

const NUMERIC_CONDITIONS = [
  { value: 'equals', label: 'Equals' },
  { value: 'greaterThan', label: 'Greater Than' },
  { value: 'lessThan', label: 'Less Than' },
  { value: 'between', label: 'Between' }
];

const DATE_CONDITIONS = [
  { value: 'equals', label: 'On Date' },
  { value: 'greaterThan', label: 'After Date' },
  { value: 'lessThan', label: 'Before Date' },
  { value: 'between', label: 'Between Dates' }
];

const STATUS_OPTIONS = [
  { value: 'paid', label: 'Paid' },
  { value: 'unpaid', label: 'Unpaid' },
  { value: 'overdue', label: 'Overdue' }
];

export default function BlacklistManager({ onSettingsChange }: BlacklistManagerProps) {
  const [settings, setSettings] = useState<BlacklistSettings>({
    enabled: false,
    rules: [],
    logExcludedInvoices: false
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/invoice-blacklist');
      if (response.ok) {
        const data = await response.json();
        setSettings(data.settings);
      } else {
        setMessage({ type: 'error', text: 'Failed to load blacklist settings.' });
      }
    } catch (error) {
      console.error('Error fetching blacklist settings:', error);
      setMessage({ type: 'error', text: 'Error loading blacklist settings.' });
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/invoice-blacklist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settings),
      });

      if (response.ok) {
        setMessage({ type: 'success', text: 'Blacklist settings saved successfully!' });
        onSettingsChange?.(settings);
      } else {
        const data = await response.json();
        setMessage({ type: 'error', text: data.message || 'Failed to save settings.' });
      }
    } catch (error) {
      console.error('Error saving blacklist settings:', error);
      setMessage({ type: 'error', text: 'Error saving blacklist settings.' });
    } finally {
      setSaving(false);
    }
  };

  const addRule = () => {
    const newRule: BlacklistRule = {
      id: generateBlacklistRuleId(),
      type: 'customerName',
      condition: 'contains',
      value: '',
      enabled: true,
      name: `Rule ${settings.rules.length + 1}`,
      caseSensitive: false
    };

    setSettings(prev => ({
      ...prev,
      rules: [...prev.rules, newRule]
    }));
  };

  const updateRule = (ruleId: string, updates: Partial<BlacklistRule>) => {
    setSettings(prev => ({
      ...prev,
      rules: prev.rules.map(rule => 
        rule.id === ruleId ? { ...rule, ...updates } : rule
      )
    }));
  };

  const deleteRule = (ruleId: string) => {
    setSettings(prev => ({
      ...prev,
      rules: prev.rules.filter(rule => rule.id !== ruleId)
    }));
  };

  const getConditionsForType = (type: string) => {
    if (type === 'amount' || type === 'dateRange') {
      return type === 'amount' ? NUMERIC_CONDITIONS : DATE_CONDITIONS;
    }
    return STRING_CONDITIONS;
  };

  const renderRuleValueInput = (rule: BlacklistRule) => {
    if (rule.type === 'status') {
      return (
        <select
          value={rule.value}
          onChange={(e) => updateRule(rule.id, { value: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Select Status</option>
          {STATUS_OPTIONS.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      );
    }

    if (rule.type === 'amount') {
      return (
        <div className="flex gap-2">
          <input
            type="number"
            step="0.01"
            placeholder="Amount"
            value={rule.value}
            onChange={(e) => updateRule(rule.id, { value: parseFloat(e.target.value) || 0 })}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {rule.condition === 'between' && (
            <input
              type="number"
              step="0.01"
              placeholder="To Amount"
              value={rule.value2 || ''}
              onChange={(e) => updateRule(rule.id, { value2: parseFloat(e.target.value) || 0 })}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          )}
        </div>
      );
    }

    if (rule.type === 'dateRange') {
      return (
        <div className="flex gap-2">
          <input
            type="date"
            value={rule.value}
            onChange={(e) => updateRule(rule.id, { value: e.target.value })}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {rule.condition === 'between' && (
            <input
              type="date"
              value={rule.value2 || ''}
              onChange={(e) => updateRule(rule.id, { value2: e.target.value })}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          )}
        </div>
      );
    }

    // String inputs
    return (
      <input
        type="text"
        placeholder="Enter value"
        value={rule.value}
        onChange={(e) => updateRule(rule.id, { value: e.target.value })}
        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-gray-500">Loading blacklist settings...</div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Invoice Blacklist</h3>
          <p className="text-sm text-gray-600 mt-1">
            Configure rules to automatically exclude certain invoices from being displayed.
          </p>
        </div>
        <label className="flex items-center">
          <input
            type="checkbox"
            checked={settings.enabled}
            onChange={(e) => setSettings(prev => ({ ...prev, enabled: e.target.checked }))}
            className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
          />
          <span className="ml-2 text-sm font-medium text-gray-700">Enable Blacklist</span>
        </label>
      </div>

      {message && (
        <div className={`mb-4 p-3 rounded-md flex items-center gap-2 ${
          message.type === 'success' 
            ? 'bg-green-50 text-green-800 border border-green-200' 
            : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          {message.type === 'success' ? (
            <CheckCircle className="h-4 w-4" />
          ) : (
            <AlertCircle className="h-4 w-4" />
          )}
          <span className="text-sm">{message.text}</span>
          <button
            onClick={() => setMessage(null)}
            className="ml-auto text-gray-400 hover:text-gray-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="space-y-4">
        {settings.rules.map((rule, index) => (
          <div key={rule.id} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
            <div className="flex items-center justify-between mb-4">
              <input
                type="text"
                value={rule.name}
                onChange={(e) => updateRule(rule.id, { name: e.target.value })}
                className="text-sm font-medium bg-transparent border-none outline-none text-gray-900"
                placeholder="Rule name"
              />
              <div className="flex items-center gap-2">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={rule.enabled}
                    onChange={(e) => updateRule(rule.id, { enabled: e.target.checked })}
                    className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="ml-1 text-xs text-gray-600">Enabled</span>
                </label>
                <button
                  onClick={() => deleteRule(rule.id)}
                  className="text-red-600 hover:text-red-800 p-1"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Field</label>
                <select
                  value={rule.type}
                  onChange={(e) => updateRule(rule.id, { 
                    type: e.target.value as BlacklistRule['type'],
                    condition: 'contains', // Reset condition when type changes
                    value: '', // Reset value when type changes
                    value2: undefined
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {RULE_TYPES.map(type => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Condition</label>
                <select
                  value={rule.condition}
                  onChange={(e) => updateRule(rule.id, { 
                    condition: e.target.value as BlacklistRule['condition'],
                    value2: e.target.value !== 'between' ? undefined : rule.value2
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {getConditionsForType(rule.type).map(condition => (
                    <option key={condition.value} value={condition.value}>
                      {condition.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Value</label>
                {renderRuleValueInput(rule)}
              </div>
            </div>

            {(rule.type === 'customerName' || rule.type === 'customerEmail' || rule.type === 'storeName' || rule.type === 'invoiceNumber') && (
              <div className="mt-3">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={rule.caseSensitive || false}
                    onChange={(e) => updateRule(rule.id, { caseSensitive: e.target.checked })}
                    className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="ml-2 text-xs text-gray-600">Case sensitive</span>
                </label>
              </div>
            )}

            {rule.description !== undefined && (
              <div className="mt-3">
                <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
                <input
                  type="text"
                  value={rule.description || ''}
                  onChange={(e) => updateRule(rule.id, { description: e.target.value })}
                  placeholder="Optional description for this rule"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}
          </div>
        ))}

        <button
          onClick={addRule}
          className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-gray-400 hover:text-gray-700 flex items-center justify-center gap-2 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add New Rule
        </button>
      </div>

      <div className="mt-6 pt-6 border-t border-gray-200">
        <label className="flex items-center mb-4">
          <input
            type="checkbox"
            checked={settings.logExcludedInvoices}
            onChange={(e) => setSettings(prev => ({ ...prev, logExcludedInvoices: e.target.checked }))}
            className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
          />
          <span className="ml-2 text-sm text-gray-700">Log excluded invoices for review</span>
        </label>

        <div className="flex justify-end">
          <button
            onClick={saveSettings}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Save className="h-4 w-4" />
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
}
