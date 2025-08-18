"use client";
import { useState, useEffect } from 'react';
import { getSampleInvoiceData, downloadInvoicePDF, type InvoiceData } from '@/lib/invoicePdfGenerator';

interface UniversalInvoiceSettings {
  // Basic Info
  colorScheme: string;
  accentColor: string;
  
  // Company Details
  companyName: string;
  companyRegNumber: string;
  vatNumber: string;
  companyAddress: string;
  companyCity: string;
  companyPostcode: string;
  companyCountry: string;
  companyEmail: string;
  companyPhone: string;
  companyWebsite: string;
  
  // Invoice Configuration
  discountType: 'percentage' | 'fixed';
  
  // Tax Settings
  defaultTaxRate: number;
  taxLabel: string;
  kleinunternehmerNote: string;

  // Currency & Formatting
  currencySymbol: string;
  dateFormat: string;
  numberFormat: string;

  // Professional Features
  approvedBy: string;
  invoiceStatus: boolean;
  multiLanguage: boolean;
  language: string;
}

const defaultSettings: UniversalInvoiceSettings = {
  // Basic Info
  colorScheme: '#000000',
  accentColor: '#000000',
  
  // Company Details
  companyName: 'Your Company',
  companyRegNumber: '',
  vatNumber: '',
  companyAddress: '',
  companyCity: '',
  companyPostcode: '',
  companyCountry: '',
  companyEmail: '',
  companyPhone: '',
  companyWebsite: '',
  
  // Invoice Configuration
  discountType: 'percentage',
  
  // Tax Settings
  defaultTaxRate: 0,
  taxLabel: 'Tax',
  kleinunternehmerNote: 'Hinweis: Als Kleinunternehmer im Sinne von § 19 Abs. 1 UStG wird Umsatzsteuer nicht berechnet',

  // Currency & Formatting
  currencySymbol: '€',
  dateFormat: 'DD.MM.YYYY',
  numberFormat: 'DE',

  // Professional Features
  approvedBy: '',
  invoiceStatus: false,
  multiLanguage: false,
  language: 'en-US',
};

interface UniversalInvoiceSettingsProps {
  onSettingsUpdate?: (settings: UniversalInvoiceSettings) => void;
}

export default function UniversalInvoiceSettings({ onSettingsUpdate }: UniversalInvoiceSettingsProps) {
  const [settings, setSettings] = useState<UniversalInvoiceSettings>(defaultSettings);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('general');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [notification, setNotification] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Validation function
  const validateSettings = (settings: UniversalInvoiceSettings): Record<string, string> => {
    const errors: Record<string, string> = {};
    
    // Required fields
    if (!settings.companyName?.trim()) {
      errors.companyName = 'Company name is required';
    }
    
  // Validate numeric ranges
  // ...existing code...
    
    if (settings.defaultTaxRate < 0 || settings.defaultTaxRate > 100) {
      errors.defaultTaxRate = 'Tax rate must be between 0 and 100';
    }
    
    // Validate email format
    if (settings.companyEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(settings.companyEmail)) {
      errors.companyEmail = 'Please enter a valid email address';
    }
    
    // Validate website URL
    if (settings.companyWebsite && !/^https?:\/\/.+/.test(settings.companyWebsite)) {
      errors.companyWebsite = 'Please enter a valid URL (including http:// or https://)';
    }
    
    return errors;
  };

  // Show notification for 3 seconds
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // Warn user about unsaved changes when navigating away
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // Preview handler
  const handlePreview = async () => {
    try {
      const sampleInvoice = getSampleInvoiceData();
      await downloadInvoicePDF(sampleInvoice, settings, "Universal Store");
      setNotification({ type: 'success', message: 'Preview PDF generated successfully!' });
    } catch (error) {
      console.error('Preview error:', error);
      setNotification({ type: 'error', message: 'Failed to generate preview PDF.' });
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 's') {
          e.preventDefault();
          handleSave();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [settings]);

  useEffect(() => {
    const fetchSettings = async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/universal-invoice-settings');
        const data = await res.json();
        if (data.settings) {
          setSettings(data.settings);
        }
      } catch (error) {
        console.error('Failed to fetch settings:', error);
        setNotification({ type: 'error', message: 'Failed to load settings.' });
      }
      setLoading(false);
    };
    
    fetchSettings();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    let processedValue: any = value;
    
    // Handle numeric inputs
    if (type === 'number' || type === 'range') {
      processedValue = parseFloat(value) || 0;
    }
    
    // Handle specific numeric fields that might not have type="number"
    if (['lateFeePercentage', 'defaultTaxRate'].includes(name)) {
      processedValue = parseFloat(value) || 0;
    }
    
    // Validate color hex values
    if (['colorScheme', 'accentColor'].includes(name) && value) {
      if (!/^#[0-9A-F]{6}$/i.test(value)) {
        setErrors(prev => ({ ...prev, [name]: 'Please enter a valid hex color (e.g., #000000)' }));
      } else {
        setErrors(prev => ({ ...prev, [name]: '' }));
      }
    }
    
    setSettings(prev => ({ ...prev, [name]: processedValue }));
    setHasUnsavedChanges(true);
  };

  const handleToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setSettings(prev => ({ ...prev, [name]: checked }));
    setHasUnsavedChanges(true);
  };

  const handleReset = () => {
    if (confirm('Are you sure you want to reset all settings to default values? This action cannot be undone.')) {
      setSettings(defaultSettings);
      setHasUnsavedChanges(true);
      setNotification({ type: 'success', message: 'Settings reset to default values.' });
    }
  };

  const handleSave = async () => {
    const validationErrors = validateSettings(settings);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      setNotification({ type: 'error', message: 'Please fix the validation errors before saving.' });
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/universal-invoice-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      if (res.ok) {
        setHasUnsavedChanges(false);
        setNotification({ type: 'success', message: 'Settings saved successfully!' });
        // Notify parent component about the updated settings
        if (onSettingsUpdate) {
          onSettingsUpdate(settings);
        }
      } else {
        throw new Error('Failed to save settings');
      }
    } catch (error) {
      console.error('Save error:', error);
      setNotification({ type: 'error', message: 'Failed to save settings. Please try again.' });
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500 text-lg">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Notification */}
      {notification && (
        <div className={`p-4 rounded-lg ${
          notification.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {notification.message}
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Universal Invoice Settings</h2>
          <p className="text-gray-600 mt-1">Configure invoice settings that apply to all your universal invoices</p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={handlePreview}
            className="px-4 py-2 text-blue-600 border border-blue-600 rounded-lg hover:bg-blue-50 transition-colors"
          >
            Preview PDF
          </button>
          <button
            onClick={handleReset}
            className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Reset to Default
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'general', label: 'General' },
            { id: 'company', label: 'Company Details' },
            { id: 'advanced', label: 'Advanced' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        {activeTab === 'general' && (
          <div className="space-y-6">
            <h3 className="text-lg font-medium text-gray-900">General Settings</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Currency Symbol
                </label>
                <input
                  type="text"
                  name="currencySymbol"
                  value={settings.currencySymbol}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="€"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Date Format
                </label>
                <select
                  name="dateFormat"
                  value={settings.dateFormat}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="DD.MM.YYYY">DD.MM.YYYY (German)</option>
                  <option value="MM/DD/YYYY">MM/DD/YYYY (US)</option>
                  <option value="DD/MM/YYYY">DD/MM/YYYY (UK)</option>
                  <option value="YYYY-MM-DD">YYYY-MM-DD (ISO)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Default Tax Rate (%)
                </label>
                <input
                  type="number"
                  name="defaultTaxRate"
                  value={settings.defaultTaxRate}
                  onChange={handleChange}
                  min="0"
                  max="100"
                  step="0.01"
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    errors.defaultTaxRate ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {errors.defaultTaxRate && <p className="text-red-500 text-sm mt-1">{errors.defaultTaxRate}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tax Label
                </label>
                <input
                  type="text"
                  name="taxLabel"
                  value={settings.taxLabel}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Tax, VAT, MwSt., etc."
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Kleinunternehmer Note
                </label>
                <textarea
                  name="kleinunternehmerNote"
                  value={settings.kleinunternehmerNote}
                  onChange={handleChange}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Hinweis: Als Kleinunternehmer im Sinne von § 19 Abs. 1 UStG wird Umsatzsteuer nicht berechnet"
                />
                <p className="text-sm text-gray-500 mt-1">
                  Custom note for small business tax regulation (leave empty to hide)
                </p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'company' && (
          <div className="space-y-6">
            <h3 className="text-lg font-medium text-gray-900">Company Details</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Company Name *
                </label>
                <input
                  type="text"
                  name="companyName"
                  value={settings.companyName}
                  onChange={handleChange}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    errors.companyName ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="Your Company Name"
                />
                {errors.companyName && <p className="text-red-500 text-sm mt-1">{errors.companyName}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Registration Number
                </label>
                <input
                  type="text"
                  name="companyRegNumber"
                  value={settings.companyRegNumber}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Company registration number"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  VAT Number
                </label>
                <input
                  type="text"
                  name="vatNumber"
                  value={settings.vatNumber}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="VAT registration number"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Address
                </label>
                <input
                  type="text"
                  name="companyAddress"
                  value={settings.companyAddress}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Street address"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  City
                </label>
                <input
                  type="text"
                  name="companyCity"
                  value={settings.companyCity}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="City"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Postal Code
                </label>
                <input
                  type="text"
                  name="companyPostcode"
                  value={settings.companyPostcode}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Postal code"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Country
                </label>
                <input
                  type="text"
                  name="companyCountry"
                  value={settings.companyCountry}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Country"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  name="companyEmail"
                  value={settings.companyEmail}
                  onChange={handleChange}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    errors.companyEmail ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="contact@company.com"
                />
                {errors.companyEmail && <p className="text-red-500 text-sm mt-1">{errors.companyEmail}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Phone
                </label>
                <input
                  type="tel"
                  name="companyPhone"
                  value={settings.companyPhone}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="+1 (555) 123-4567"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Website
                </label>
                <input
                  type="url"
                  name="companyWebsite"
                  value={settings.companyWebsite}
                  onChange={handleChange}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    errors.companyWebsite ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="https://www.company.com"
                />
                {errors.companyWebsite && <p className="text-red-500 text-sm mt-1">{errors.companyWebsite}</p>}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'advanced' && (
          <div className="space-y-6">
            <h3 className="text-lg font-medium text-gray-900">Advanced Settings</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Color Scheme
                </label>
                <div className="flex space-x-2">
                  <input
                    type="color"
                    name="colorScheme"
                    value={settings.colorScheme}
                    onChange={handleChange}
                    className="w-12 h-10 border border-gray-300 rounded cursor-pointer"
                  />
                  <input
                    type="text"
                    name="colorScheme"
                    value={settings.colorScheme}
                    onChange={handleChange}
                    className={`flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                      errors.colorScheme ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="#000000"
                  />
                </div>
                {errors.colorScheme && <p className="text-red-500 text-sm mt-1">{errors.colorScheme}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Accent Color
                </label>
                <div className="flex space-x-2">
                  <input
                    type="color"
                    name="accentColor"
                    value={settings.accentColor}
                    onChange={handleChange}
                    className="w-12 h-10 border border-gray-300 rounded cursor-pointer"
                  />
                  <input
                    type="text"
                    name="accentColor"
                    value={settings.accentColor}
                    onChange={handleChange}
                    className={`flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                      errors.accentColor ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="#000000"
                  />
                </div>
                {errors.accentColor && <p className="text-red-500 text-sm mt-1">{errors.accentColor}</p>}
              </div>

              {/* ...existing code... */}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Approved By
                </label>
                <input
                  type="text"
                  name="approvedBy"
                  value={settings.approvedBy}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Name of approving authority"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
