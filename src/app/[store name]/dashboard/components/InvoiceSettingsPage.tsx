"use client";
import React, { useState, useEffect } from 'react';
import { getSampleInvoiceData, downloadInvoicePDF } from '@/lib/invoicePdfGenerator';
import '@/styles/invoice-settings.css';

interface InvoiceSettings {
  // Basic Info
  logoUrl: string;
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
  invoicePrefix: string;
  invoiceNumberFormat: string;
  dueDays: number;
  lateFeePercentage: number;
  discountType: 'percentage' | 'fixed';
  
  // Layout & Styling
  fontSize: 'small' | 'medium' | 'large';
  showLogo: boolean;
  logoPosition: 'left' | 'center' | 'right';
  headerHeight: number;
  showWatermark: boolean;
  watermarkText: string;
  watermarkOpacity: number;
  
  // Content
  footerText: string;
  terms: string;
  privacyPolicy: string;
  bankDetails: string;
  paymentInstructions: string;
  
  // Tax Settings
  defaultTaxRate: number;
  showTaxBreakdown: boolean;
  taxLabel: string;
  
  // Currency & Formatting
  currency: string;
  currencySymbol: string;
  dateFormat: string;
  numberFormat: string;
  
  // Additional Fields
  purchaseOrderRef: boolean;
  projectRef: boolean;
  deliveryDate: boolean;
  notes: string;
  
  // Professional Features
  digitalSignature: string;
  approvedBy: string;
  invoiceStatus: boolean;
  showPaymentTerms: boolean;
  multiLanguage: boolean;
  language: string;
}

const defaultSettings: InvoiceSettings = {
  // Basic Info
  logoUrl: '',
  colorScheme: '#1e293b',
  accentColor: '#0f172a',
  
  // Company Details
  companyName: '',
  companyRegNumber: '',
  vatNumber: '',
  companyAddress: '',
  companyCity: '',
  companyPostcode: '',
  companyCountry: 'United Kingdom',
  companyEmail: '',
  companyPhone: '',
  companyWebsite: '',
  
  // Invoice Configuration
  invoicePrefix: 'INV',
  invoiceNumberFormat: 'INV-{YYYY}{MM}{DD}-{###}',
  dueDays: 30,
  lateFeePercentage: 2.5,
  discountType: 'percentage',
  
  // Layout & Styling
  fontSize: 'medium',
  showLogo: true,
  logoPosition: 'left',
  headerHeight: 120,
  showWatermark: false,
  watermarkText: 'INVOICE',
  watermarkOpacity: 0.1,
  
  // Content
  footerText: 'Thank you for your business!',
  terms: 'Payment is due within 30 days of invoice date. Late payments may incur additional charges.',
  privacyPolicy: '',
  bankDetails: '',
  paymentInstructions: 'Please reference the invoice number when making payment.',
  
  // Tax Settings
  defaultTaxRate: 20,
  showTaxBreakdown: true,
  taxLabel: 'VAT',
  
  // Currency & Formatting
  currency: 'GBP',
  currencySymbol: '£',
  dateFormat: 'DD/MM/YYYY',
  numberFormat: 'UK',
  
  // Additional Fields
  purchaseOrderRef: true,
  projectRef: false,
  deliveryDate: false,
  notes: '',
  
  // Professional Features
  digitalSignature: '',
  approvedBy: '',
  invoiceStatus: true,
  showPaymentTerms: true,
  multiLanguage: false,
  language: 'en-GB',
};

export default function InvoiceSettingsPage() {
  const [settings, setSettings] = useState<InvoiceSettings>(defaultSettings);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [activeTab, setActiveTab] = useState('general');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [notification, setNotification] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Validation function
  const validateSettings = (settings: InvoiceSettings): Record<string, string> => {
    const errors: Record<string, string> = {};
    
    // Required fields
    if (!settings.companyName?.trim()) {
      errors.companyName = 'Company name is required';
    }
    
    // Validate numeric ranges
    if (settings.dueDays < 0 || settings.dueDays > 365) {
      errors.dueDays = 'Due days must be between 0 and 365';
    }
    
    if (settings.lateFeePercentage < 0 || settings.lateFeePercentage > 50) {
      errors.lateFeePercentage = 'Late fee must be between 0% and 50%';
    }
    
    if (settings.defaultTaxRate < 0 || settings.defaultTaxRate > 100) {
      errors.defaultTaxRate = 'Tax rate must be between 0% and 100%';
    }
    
    // Validate email format
    if (settings.companyEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(settings.companyEmail)) {
      errors.companyEmail = 'Please enter a valid email address';
    }
    
    // Validate website URL
    if (settings.companyWebsite && !/^https?:\/\/.+/.test(settings.companyWebsite)) {
      errors.companyWebsite = 'Please enter a valid website URL (starting with http:// or https://)';
    }
    
    return errors;
  };

  // Show notification for 3 seconds
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => {
        setNotification(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // Warn user about unsaved changes when navigating away
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
        return 'You have unsaved changes. Are you sure you want to leave?';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+S or Cmd+S to save
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
      // Ctrl+P or Cmd+P to preview
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault();
        handlePreview();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [settings]);

  useEffect(() => {
    const fetchSettings = async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/invoice-settings');
        if (!res.ok) {
          throw new Error('Failed to fetch settings');
        }
        const data = await res.json();
        if (data.settings) {
          // Ensure all numeric fields are properly typed
          const processedSettings = {
            ...defaultSettings,
            ...data.settings,
            dueDays: Number(data.settings.dueDays) || defaultSettings.dueDays,
            lateFeePercentage: Number(data.settings.lateFeePercentage) || defaultSettings.lateFeePercentage,
            defaultTaxRate: Number(data.settings.defaultTaxRate) || defaultSettings.defaultTaxRate,
            headerHeight: Number(data.settings.headerHeight) || defaultSettings.headerHeight,
            watermarkOpacity: Number(data.settings.watermarkOpacity) || defaultSettings.watermarkOpacity,
          };
          setSettings(processedSettings);
        }
      } catch (error) {
        console.error('Error fetching settings:', error);
        // Use default settings on error
        setSettings(defaultSettings);
      } finally {
        setLoading(false);
      }
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
    if (['dueDays', 'lateFeePercentage', 'defaultTaxRate', 'headerHeight', 'watermarkOpacity'].includes(name)) {
      processedValue = parseFloat(value) || 0;
    }
    
    // Validate color hex values
    if (['colorScheme', 'accentColor'].includes(name) && value) {
      if (!/^#[0-9A-F]{6}$/i.test(value)) {
        return;
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

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setLogoFile(file);
      
      // Convert to base64 for immediate preview and storage
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64String = event.target?.result as string;
        setSettings(prev => ({ ...prev, logoUrl: base64String }));
        setHasUnsavedChanges(true);
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePreview = async () => {
    try {
      // Validate required fields before generating preview
      if (!settings.companyName?.trim()) {
        setNotification({ type: 'error', message: 'Please enter a company name before previewing.' });
        return;
      }
      
      const sampleInvoice = getSampleInvoiceData();
      await downloadInvoicePDF(sampleInvoice, settings, settings.companyName || 'Your Company');
      setNotification({ type: 'success', message: 'Preview generated successfully! 📄' });
    } catch (error) {
      console.error('Preview error:', error);
      setNotification({ 
        type: 'error', 
        message: 'Error generating preview. Please check your settings and try again.' 
      });
    }
  };

  const handleReset = () => {
    if (confirm('Are you sure you want to reset all settings to defaults? This action cannot be undone.')) {
      setSettings(defaultSettings);
      setErrors({});
      setLogoFile(null);
      setNotification({ type: 'success', message: 'Settings have been reset to defaults.' });
      setHasUnsavedChanges(false);
    }
  };

  const handleSave = async () => {
    // Validate settings before saving
    const validationErrors = validateSettings(settings);
    setErrors(validationErrors);
    
    if (Object.keys(validationErrors).length > 0) {
      setNotification({ type: 'error', message: 'Please fix the validation errors before saving.' });
      return;
    }
    
    setSaving(true);
    try {
      // Ensure all numeric values are properly typed and VAT settings are included
      const sanitizedSettings = {
        ...settings,
        dueDays: Number(settings.dueDays) || 30,
        lateFeePercentage: Number(settings.lateFeePercentage) || 0,
        defaultTaxRate: Number(settings.defaultTaxRate) || 20,
        headerHeight: Number(settings.headerHeight) || 140,
        watermarkOpacity: Number(settings.watermarkOpacity) || 0.1,
        // Ensure VAT settings are properly saved
        taxLabel: settings.taxLabel || 'VAT',
        showTaxBreakdown: Boolean(settings.showTaxBreakdown),
      };
      
      const res = await fetch('/api/invoice-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sanitizedSettings),
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Failed to save settings');
      }
      
      const responseData = await res.json();
      
      // Update local state with saved settings
      if (responseData.settings) {
        setSettings(responseData.settings);
      }
      
      setErrors({});
      setNotification({ type: 'success', message: 'Settings saved successfully! 🎉' });
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error('Save error:', error);
      setNotification({ 
        type: 'error', 
        message: 'Error saving settings: ' + (error instanceof Error ? error.message : 'Unknown error')
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="p-8 flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
        <p className="text-gray-600">Loading invoice settings...</p>
      </div>
    </div>
  );

  return (
    <div className="invoice-settings-container min-h-screen p-4">
      {/* Notification Toast */}
      {notification && (
        <div className={`fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg transition-all duration-300 ${
          notification.type === 'success' 
            ? 'bg-green-500 text-white' 
            : 'bg-red-500 text-white'
        }`}>
          <div className="flex items-center space-x-2">
            <span>{notification.type === 'success' ? '✅' : '❌'}</span>
            <span>{notification.message}</span>
            <button 
              onClick={() => setNotification(null)}
              className="ml-2 text-white hover:text-gray-200"
            >
              ✕
            </button>
          </div>
        </div>
      )}
      
      <div className="max-w-6xl mx-auto">
        <div className="settings-card rounded-2xl shadow-2xl overflow-hidden">
          {/* Enhanced Header */}
          <div className="settings-header">
            <div className="relative z-10">
              <h1 className="text-4xl font-bold mb-2 flex items-center justify-center">
                <span className="mr-4 text-5xl">🧾</span> 
                Professional Invoice Settings
              </h1>
              <p className="text-blue-100 text-lg">
                Create stunning, professional invoices that reflect your brand
              </p>
              <div className="mt-4 flex justify-center space-x-4">
                <span className="feature-badge">🇬🇧 UK Standards</span>
                <span className="feature-badge">📊 VAT Compliant</span>
                <span className="feature-badge">🎨 Customizable</span>
                <span className="feature-badge">📱 Responsive</span>
              </div>
            </div>
          </div>

          <div className="p-8">
            {/* Enhanced Tabs Navigation */}
            <div className="mb-8">
              <div className="border-b border-gray-200">
                <nav className="-mb-px flex space-x-2 overflow-x-auto">
                  {[
                    { id: 'general', label: 'General', icon: '⚙️' },
                    { id: 'company', label: 'Company', icon: '🏢' },
                    { id: 'layout', label: 'Layout', icon: '🎨' },
                    { id: 'content', label: 'Content', icon: '📝' },
                    { id: 'tax-currency', label: 'Tax & Currency', icon: '💰' },
                    { id: 'advanced', label: 'Advanced', icon: '🚀' }
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`tab-button py-3 px-6 border-b-2 font-medium text-sm whitespace-nowrap flex items-center space-x-2 rounded-t-lg ${
                        activeTab === tab.id
                          ? 'active border-blue-500 text-white'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <span>{tab.icon}</span>
                      <span>{tab.label}</span>
                    </button>
                  ))}
                </nav>
              </div>
            </div>

            <div className="space-y-8">
              {/* General Tab */}
              {activeTab === 'general' && (
                <div className="settings-section">
                  <h2 className="text-2xl font-semibold text-gray-900 mb-6 flex items-center">
                    <span className="mr-3">⚙️</span> General Settings
                  </h2>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div className="space-y-6">
                      <div>
                        <label className="block font-semibold mb-3 text-gray-700">Professional UK Invoice Template</label>
                        <div className="bg-gradient-to-r from-slate-50 to-blue-50 rounded-xl p-6 border border-slate-200">
                          <div className="flex items-center space-x-3 mb-3">
                            <div className="w-12 h-12 bg-slate-800 rounded-lg flex items-center justify-center">
                              <span className="text-white font-bold text-lg">UK</span>
                            </div>
                            <div>
                              <h3 className="font-semibold text-slate-800">UK Professional Standard</h3>
                              <p className="text-sm text-slate-600">VAT compliant • HMRC approved • Modern design</p>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">✓ VAT Ready</span>
                            <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">✓ Professional</span>
                            <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">✓ Customizable</span>
                          </div>
                        </div>
                      </div>
                      
                      <div>
                        <label className="block font-semibold mb-3 text-gray-700">Logo Upload</label>
                        <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center hover:border-blue-400 transition-colors">
                          <input 
                            type="file" 
                            accept="image/*" 
                            onChange={handleLogoUpload} 
                            className="hidden" 
                            id="logoUpload"
                          />
                          <label htmlFor="logoUpload" className="cursor-pointer">
                            {settings.logoUrl ? (
                              <div className="space-y-3">
                                <img src={settings.logoUrl} alt="Logo" className="h-20 mx-auto border rounded-lg shadow-sm" />
                                <p className="text-sm text-blue-600">Click to change logo</p>
                              </div>
                            ) : (
                              <div className="space-y-3">
                                <div className="text-4xl">📷</div>
                                <p className="text-gray-600">Click to upload your logo</p>
                                <p className="text-xs text-gray-400">PNG, JPG up to 2MB</p>
                              </div>
                            )}
                          </label>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div>
                        <label className="block font-semibold mb-3 text-gray-700">Primary Color</label>
                        <div className="flex space-x-4">
                          <div className="color-picker-wrapper w-16 h-12 rounded-lg overflow-hidden">
                            <input type="color" name="colorScheme" value={settings.colorScheme} onChange={handleChange} className="w-full h-full border-none" />
                          </div>
                          <input type="text" name="colorScheme" value={settings.colorScheme} onChange={handleChange} className="form-input flex-1 border rounded-lg px-4 py-3 text-gray-700" placeholder="#2563eb" />
                        </div>
                        <p className="text-sm text-gray-500 mt-2">Primary brand color for headers and accents</p>
                      </div>
                      
                      <div>
                        <label className="block font-semibold mb-3 text-gray-700">Accent Color</label>
                        <div className="flex space-x-4">
                          <div className="color-picker-wrapper w-16 h-12 rounded-lg overflow-hidden">
                            <input type="color" name="accentColor" value={settings.accentColor} onChange={handleChange} className="w-full h-full border-none" />
                          </div>
                          <input type="text" name="accentColor" value={settings.accentColor} onChange={handleChange} className="form-input flex-1 border rounded-lg px-4 py-3 text-gray-700" placeholder="#1e40af" />
                        </div>
                        <p className="text-sm text-gray-500 mt-2">Secondary color for highlights and buttons</p>
                      </div>

                      <div className="preview-box">
                        <h3 className="font-semibold text-gray-700 mb-2">✨ Live Preview</h3>
                        <p className="text-sm text-gray-600 mb-4">See how your settings will look</p>
                        <button 
                          onClick={handlePreview}
                          className="btn-primary px-6 py-2 rounded-lg font-semibold"
                        >
                          Generate Preview PDF
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Company Tab - Enhanced */}
              {activeTab === 'company' && (
                <div className="settings-section">
                  <h2 className="text-2xl font-semibold text-gray-900 mb-6 flex items-center">
                    <span className="mr-3">🏢</span> Company Information
                  </h2>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div className="space-y-6">
                      <div>
                        <label className="block font-semibold mb-3 text-gray-700">
                          Company Name <span className="text-red-500">*</span>
                        </label>
                        <input 
                          name="companyName" 
                          value={settings.companyName} 
                          onChange={handleChange} 
                          className={`form-input w-full border rounded-xl px-4 py-3 text-gray-700 ${
                            errors.companyName ? 'border-red-500 bg-red-50' : ''
                          }`} 
                          placeholder="Your Company Ltd" 
                          required
                        />
                        {errors.companyName && (
                          <p className="text-red-500 text-sm mt-1">{errors.companyName}</p>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block font-semibold mb-3 text-gray-700">Company Registration</label>
                          <input 
                            name="companyRegNumber" 
                            value={settings.companyRegNumber} 
                            onChange={handleChange} 
                            className="form-input w-full border rounded-xl px-4 py-3 text-gray-700" 
                            placeholder="12345678" 
                          />
                        </div>
                        
                        <div>
                          <label className="block font-semibold mb-3 text-gray-700">VAT Number</label>
                          <input 
                            name="vatNumber" 
                            value={settings.vatNumber} 
                            onChange={handleChange} 
                            className="form-input w-full border rounded-xl px-4 py-3 text-gray-700" 
                            placeholder="GB123456789" 
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block font-semibold mb-3 text-gray-700">Website</label>
                        <input 
                          name="companyWebsite" 
                          value={settings.companyWebsite} 
                          onChange={handleChange} 
                          className={`form-input w-full border rounded-xl px-4 py-3 text-gray-700 ${
                            errors.companyWebsite ? 'border-red-500 bg-red-50' : ''
                          }`} 
                          placeholder="www.yourcompany.com" 
                        />
                        {errors.companyWebsite && (
                          <p className="text-red-500 text-sm mt-1">{errors.companyWebsite}</p>
                        )}
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div>
                        <label className="block font-semibold mb-3 text-gray-700">Complete Address</label>
                        <div className="space-y-4">
                          <input 
                            name="companyAddress" 
                            value={settings.companyAddress} 
                            onChange={handleChange} 
                            className="form-input w-full border rounded-xl px-4 py-3 text-gray-700" 
                            placeholder="123 Business Street" 
                          />
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <input 
                              name="companyCity" 
                              value={settings.companyCity} 
                              onChange={handleChange} 
                              className="form-input border rounded-xl px-4 py-3 text-gray-700" 
                              placeholder="London" 
                            />
                            <input 
                              name="companyPostcode" 
                              value={settings.companyPostcode} 
                              onChange={handleChange} 
                              className="form-input border rounded-xl px-4 py-3 text-gray-700" 
                              placeholder="SW1A 1AA" 
                            />
                            <input 
                              name="companyCountry" 
                              value={settings.companyCountry} 
                              onChange={handleChange} 
                              className="form-input border rounded-xl px-4 py-3 text-gray-700" 
                              placeholder="United Kingdom" 
                            />
                          </div>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block font-semibold mb-3 text-gray-700">Email</label>
                          <input 
                            name="companyEmail" 
                            type="email"
                            value={settings.companyEmail} 
                            onChange={handleChange} 
                            className={`form-input w-full border rounded-xl px-4 py-3 text-gray-700 ${
                              errors.companyEmail ? 'border-red-500 bg-red-50' : ''
                            }`} 
                            placeholder="info@yourcompany.com" 
                          />
                          {errors.companyEmail && (
                            <p className="text-red-500 text-sm mt-1">{errors.companyEmail}</p>
                          )}
                        </div>
                        
                        <div>
                          <label className="block font-semibold mb-3 text-gray-700">Phone</label>
                          <input 
                            name="companyPhone" 
                            value={settings.companyPhone} 
                            onChange={handleChange} 
                            className="form-input w-full border rounded-xl px-4 py-3 text-gray-700" 
                            placeholder="+44 20 1234 5678" 
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Layout Tab */}
              {activeTab === 'layout' && (
                <div className="settings-section">
                  <h2 className="text-2xl font-semibold text-gray-900 mb-6 flex items-center">
                    <span className="mr-3">🎨</span> Layout & Design
                  </h2>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div className="space-y-6">
                      <div>
                        <label className="block font-semibold mb-3 text-gray-700">Font Size</label>
                        <select 
                          name="fontSize" 
                          value={settings.fontSize} 
                          onChange={handleChange} 
                          className="form-input w-full border rounded-xl px-4 py-3 text-gray-700"
                        >
                          <option value="small">Small (10pt) - Compact</option>
                          <option value="medium">Medium (12pt) - Standard</option>
                          <option value="large">Large (14pt) - Readable</option>
                        </select>
                        <p className="text-sm text-gray-500 mt-2">Choose font size for better readability</p>
                      </div>
                      
                      <div>
                        <label className="block font-semibold mb-3 text-gray-700">Logo Position</label>
                        <div className="grid grid-cols-3 gap-3">
                          {['left', 'center', 'right'].map((position) => (
                            <label key={position} className="relative">
                              <input
                                type="radio"
                                name="logoPosition"
                                value={position}
                                checked={settings.logoPosition === position}
                                onChange={handleChange}
                                className="sr-only"
                              />
                              <div className={`border-2 rounded-xl p-4 text-center cursor-pointer transition-all ${
                                settings.logoPosition === position 
                                  ? 'border-blue-500 bg-blue-50 text-blue-700' 
                                  : 'border-gray-300 hover:border-blue-300'
                              }`}>
                                <div className="text-2xl mb-2">
                                  {position === 'left' ? '⬅️' : position === 'center' ? '⬆️' : '➡️'}
                                </div>
                                <span className="capitalize font-medium">{position}</span>
                              </div>
                            </label>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="block font-semibold mb-3 text-gray-700">Header Height</label>
                        <div className="space-y-3">
                          <input 
                            type="range" 
                            name="headerHeight" 
                            min="80" 
                            max="200" 
                            value={settings.headerHeight} 
                            onChange={handleChange} 
                            className="w-full accent-blue-500"
                          />
                          <div className="flex justify-between text-sm text-gray-500">
                            <span>80px (Compact)</span>
                            <span className="font-semibold text-blue-600">{settings.headerHeight}px</span>
                            <span>200px (Spacious)</span>
                          </div>
                        </div>
                      </div>

                      <div>
                        <label className="block font-semibold mb-3 text-gray-700">Date Format</label>
                        <select 
                          name="dateFormat" 
                          value={settings.dateFormat} 
                          onChange={handleChange} 
                          className="form-input w-full border rounded-xl px-4 py-3 text-gray-700"
                        >
                          <option value="DD/MM/YYYY">DD/MM/YYYY (UK Standard)</option>
                          <option value="MM/DD/YYYY">MM/DD/YYYY (US Format)</option>
                          <option value="YYYY-MM-DD">YYYY-MM-DD (ISO Format)</option>
                          <option value="DD MMM YYYY">DD MMM YYYY (Readable)</option>
                        </select>
                        <p className="text-sm text-gray-500 mt-2">
                          Preview: {new Date().toLocaleDateString('en-GB', { 
                            day: '2-digit', 
                            month: settings.dateFormat.includes('MMM') ? 'short' : '2-digit', 
                            year: 'numeric' 
                          })}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div className="bg-gray-50 rounded-xl p-6">
                        <h3 className="font-semibold text-gray-700 mb-4">Visual Features</h3>
                        <div className="checkbox-group space-y-3">
                          <label className="checkbox-item">
                            <input 
                              type="checkbox" 
                              name="showLogo" 
                              checked={settings.showLogo} 
                              onChange={handleToggle} 
                            />
                            <span>Show Company Logo</span>
                          </label>
                        </div>
                      </div>

                      <div className="preview-box">
                        <h3 className="font-semibold text-gray-700 mb-2">✨ Live Preview</h3>
                        <p className="text-sm text-gray-600 mb-4">See how your settings will look</p>
                        <button 
                          onClick={handlePreview}
                          className="btn-primary px-6 py-2 rounded-lg font-semibold"
                        >
                          Generate Preview PDF
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Content Tab */}
              {activeTab === 'content' && (
                <div className="settings-section">
                  <h2 className="text-2xl font-semibold text-gray-900 mb-6 flex items-center">
                    <span className="mr-3">📝</span> Content & Text
                  </h2>
                  <div className="space-y-8">
                    {/* Text Content */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                      <div className="space-y-6">
                        <div>
                          <label className="block font-semibold mb-3 text-gray-700">Footer Message</label>
                          <input 
                            name="footerText" 
                            value={settings.footerText} 
                            onChange={handleChange} 
                            className="form-input w-full border rounded-xl px-4 py-3 text-gray-700" 
                            placeholder="Thank you for your business!" 
                          />
                          <p className="text-sm text-gray-500 mt-2">Friendly message at the bottom of invoice</p>
                        </div>
                        
                        <div>
                          <label className="block font-semibold mb-3 text-gray-700">Payment Instructions</label>
                          <textarea 
                            name="paymentInstructions" 
                            value={settings.paymentInstructions} 
                            onChange={handleChange} 
                            className="form-input w-full border rounded-xl px-4 py-3 text-gray-700 h-24 resize-none" 
                            placeholder="Please reference the invoice number when making payment." 
                          />
                          <p className="text-sm text-gray-500 mt-2">Clear instructions for customers (leave empty to hide)</p>
                        </div>

                        <div>
                          <label className="block font-semibold mb-3 text-gray-700">Additional Notes</label>
                          <textarea 
                            name="notes" 
                            value={settings.notes} 
                            onChange={handleChange} 
                            className="form-input w-full border rounded-xl px-4 py-3 text-gray-700 h-20 resize-none" 
                            placeholder="Additional information or special instructions..." 
                          />
                        </div>
                      </div>

                      <div className="space-y-6">
                        <div>
                          <label className="block font-semibold mb-3 text-gray-700">Terms & Conditions</label>
                          <textarea 
                            name="terms" 
                            value={settings.terms} 
                            onChange={handleChange} 
                            className="form-input w-full border rounded-xl px-4 py-3 text-gray-700 h-32 resize-none" 
                            placeholder="Payment is due within 30 days of invoice date. Late payments may incur additional charges." 
                          />
                          <p className="text-sm text-gray-500 mt-2">Legal terms and payment conditions (leave empty to hide)</p>
                        </div>
                        
                        <div>
                          <label className="block font-semibold mb-3 text-gray-700">Bank Details</label>
                          <textarea 
                            name="bankDetails" 
                            value={settings.bankDetails} 
                            onChange={handleChange} 
                            className="form-input w-full border rounded-xl px-4 py-3 text-gray-700 h-24 resize-none" 
                            placeholder="Bank Name: Your Bank&#10;Sort Code: 12-34-56&#10;Account: 12345678&#10;IBAN: GB29 NWBK 1234 5612 3456 78" 
                          />
                          <p className="text-sm text-gray-500 mt-2">Payment details for bank transfers (leave empty to hide)</p>
                        </div>
                      </div>
                    </div>

                    {/* Invoice Configuration - Moved to General Tab */}
                    <div className="bg-blue-50 rounded-xl p-6 border border-blue-200">
                      <h3 className="font-semibold text-gray-700 mb-4 flex items-center">
                        <span className="mr-2">⚙️</span> Basic Invoice Settings
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div>
                          <label className="block font-semibold mb-3 text-gray-700">Invoice Prefix</label>
                          <input 
                            name="invoicePrefix" 
                            value={settings.invoicePrefix} 
                            onChange={handleChange} 
                            className="form-input w-full border rounded-xl px-4 py-3 text-gray-700" 
                            placeholder="INV" 
                          />
                          <p className="text-xs text-gray-500 mt-1">e.g., INV, BILL, DOC</p>
                        </div>
                        
                        <div>
                          <label className="block font-semibold mb-3 text-gray-700">Payment Due (Days)</label>
                          <input 
                            type="number" 
                            name="dueDays" 
                            value={settings.dueDays} 
                            onChange={handleChange} 
                            className={`form-input w-full border rounded-xl px-4 py-3 text-gray-700 ${
                              errors.dueDays ? 'border-red-500 bg-red-50' : ''
                            }`} 
                            min="0" 
                            max="365" 
                          />
                          {errors.dueDays && (
                            <p className="text-red-500 text-sm mt-1">{errors.dueDays}</p>
                          )}
                          <p className="text-xs text-gray-500 mt-1">Days until payment is due</p>
                        </div>

                        <div>
                          <label className="block font-semibold mb-3 text-gray-700">Late Fee (%)</label>
                          <input 
                            type="number" 
                            name="lateFeePercentage" 
                            value={settings.lateFeePercentage} 
                            onChange={handleChange} 
                            className={`form-input w-full border rounded-xl px-4 py-3 text-gray-700 ${
                              errors.lateFeePercentage ? 'border-red-500 bg-red-50' : ''
                            }`} 
                            min="0" 
                            max="50" 
                            step="0.1" 
                          />
                          {errors.lateFeePercentage && (
                            <p className="text-red-500 text-sm mt-1">{errors.lateFeePercentage}</p>
                          )}
                          <p className="text-xs text-gray-500 mt-1">Percentage for late payments</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Tax & Currency Tab */}
              {activeTab === 'tax-currency' && (
                <div className="settings-section">
                  <h2 className="text-2xl font-semibold text-gray-900 mb-6 flex items-center">
                    <span className="mr-3">💰</span> Tax & Currency Settings
                  </h2>
                  <div className="space-y-8">
                    {/* Currency Settings */}
                    <div className="bg-gradient-to-r from-yellow-50 to-amber-50 rounded-xl p-6 border border-yellow-200">
                      <h3 className="font-semibold text-gray-700 mb-4 flex items-center">
                        <span className="mr-2">💱</span> Currency Configuration
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div>
                          <label className="block font-semibold mb-3 text-gray-700">Currency</label>
                          <select 
                            name="currency" 
                            value={settings.currency} 
                            onChange={handleChange} 
                            className="form-input w-full border rounded-xl px-4 py-3 text-gray-700"
                          >
                            <option value="GBP">🇬🇧 British Pound (£)</option>
                            <option value="USD">🇺🇸 US Dollar ($)</option>
                            <option value="EUR">🇪🇺 Euro (€)</option>
                            <option value="CAD">🇨🇦 Canadian Dollar (C$)</option>
                            <option value="AUD">🇦🇺 Australian Dollar (A$)</option>
                          </select>
                        </div>
                        
                        <div>
                          <label className="block font-semibold mb-3 text-gray-700">Currency Symbol</label>
                          <input 
                            name="currencySymbol" 
                            value={settings.currencySymbol} 
                            onChange={handleChange} 
                            className="form-input w-full border rounded-xl px-4 py-3 text-gray-700 text-center text-2xl" 
                            placeholder="£" 
                            maxLength={3}
                          />
                        </div>
                        
                        <div>
                          <label className="block font-semibold mb-3 text-gray-700">Number Format</label>
                          <select 
                            name="numberFormat" 
                            value={settings.numberFormat} 
                            onChange={handleChange} 
                            className="form-input w-full border rounded-xl px-4 py-3 text-gray-700"
                          >
                            <option value="UK">UK (1,234.56)</option>
                            <option value="EU">EU (1.234,56)</option>
                            <option value="US">US (1,234.56)</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Tax Settings */}
                    <div className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl p-6 border border-blue-200">
                      <h3 className="font-semibold text-gray-700 mb-4 flex items-center">
                        <span className="mr-2">📊</span> Tax Configuration
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-6">
                          <div>
                            <label className="block font-semibold mb-3 text-gray-700">Default Tax Rate (%)</label>
                            <div className="relative">
                              <input 
                                type="number" 
                                name="defaultTaxRate" 
                                value={settings.defaultTaxRate} 
                                onChange={handleChange} 
                                className={`form-input w-full border rounded-xl px-4 py-3 text-gray-700 pr-12 ${
                                  errors.defaultTaxRate ? 'border-red-500 bg-red-50' : ''
                                }`} 
                                min="0" 
                                max="100" 
                                step="0.1" 
                              />
                              <span className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-500">%</span>
                            </div>
                            {errors.defaultTaxRate && (
                              <p className="text-red-500 text-sm mt-1">{errors.defaultTaxRate}</p>
                            )}
                            <p className="text-sm text-gray-500 mt-2">
                              Current: {settings.defaultTaxRate}% - Standard VAT rate for your region
                            </p>
                          </div>
                          
                          <div>
                            <label className="block font-semibold mb-3 text-gray-700">Tax Label</label>
                            <input 
                              name="taxLabel" 
                              value={settings.taxLabel} 
                              onChange={handleChange} 
                              className="form-input w-full border rounded-xl px-4 py-3 text-gray-700" 
                              placeholder="VAT" 
                            />
                            <p className="text-sm text-gray-500 mt-2">
                              How tax appears on invoices: "{settings.taxLabel || 'VAT'}" (VAT, GST, Tax, Sales Tax)
                            </p>
                          </div>
                        </div>

                        <div className="space-y-6">
                          <div className="bg-white rounded-lg p-4 border border-gray-200">
                            <h4 className="font-semibold text-gray-700 mb-3">Tax Display Options</h4>
                            <div className="space-y-3">
                              <label className="checkbox-item">
                                <input 
                                  type="checkbox" 
                                  name="showTaxBreakdown" 
                                  checked={settings.showTaxBreakdown} 
                                  onChange={handleToggle} 
                                />
                                <span>Show Tax Breakdown</span>
                              </label>
                              <label className="checkbox-item">
                                <input 
                                  type="checkbox" 
                                  name="showPaymentTerms" 
                                  checked={settings.showPaymentTerms} 
                                  onChange={handleToggle} 
                                />
                                <span>Display Payment Terms</span>
                              </label>
                            </div>
                            
                            {settings.showTaxBreakdown && (
                              <div className="mt-4 p-3 bg-green-50 rounded-lg border border-green-200">
                                <h5 className="text-sm font-medium text-green-800 mb-2">Tax Preview</h5>
                                <div className="text-xs space-y-1 text-green-700">
                                  <div>Subtotal: £100.00</div>
                                  <div>{settings.taxLabel} ({settings.defaultTaxRate}%): £{(100 * (settings.defaultTaxRate / 100)).toFixed(2)}</div>
                                  <div className="font-bold border-t border-green-300 pt-1">
                                    Total: £{(100 + (100 * (settings.defaultTaxRate / 100))).toFixed(2)}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>

                          <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
                            <h4 className="font-semibold text-amber-700 mb-2">💡 Tax Tips</h4>
                            <ul className="text-sm text-amber-600 space-y-1">
                              <li>• UK Standard VAT: 20%</li>
                              <li>• EU VAT: varies by country</li>
                              <li>• US Sales Tax: varies by state</li>
                              <li>• Always check local regulations</li>
                            </ul>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Advanced Tab */}
              {activeTab === 'advanced' && (
                <div className="settings-section">
                  <h2 className="text-2xl font-semibold text-gray-900 mb-6 flex items-center">
                    <span className="mr-3">🚀</span> Advanced Features
                  </h2>
                  <div className="space-y-8">
                    {/* Language & Localization */}
                    <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl p-6 border border-purple-200">
                      <h3 className="font-semibold text-gray-700 mb-4 flex items-center">
                        <span className="mr-2">🌍</span> Language & Localization
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <label className="block font-semibold mb-3 text-gray-700">Language</label>
                          <select 
                            name="language" 
                            value={settings.language} 
                            onChange={handleChange} 
                            className="form-input w-full border rounded-xl px-4 py-3 text-gray-700"
                          >
                            <option value="en-GB">🇬🇧 English (UK)</option>
                            <option value="en-US">🇺🇸 English (US)</option>
                            <option value="fr-FR">🇫🇷 Français</option>
                            <option value="de-DE">🇩🇪 Deutsch</option>
                            <option value="es-ES">🇪🇸 Español</option>
                          </select>
                        </div>
                        
                        <div>
                          <label className="block font-semibold mb-3 text-gray-700">Invoice Number Format</label>
                          <input 
                            name="invoiceNumberFormat" 
                            value={settings.invoiceNumberFormat} 
                            onChange={handleChange} 
                            className="form-input w-full border rounded-xl px-4 py-3 text-gray-700" 
                            placeholder="INV-{YYYY}{MM}{DD}-{###}" 
                          />
                          <p className="text-sm text-gray-500 mt-2">
                            Use {`{YYYY}, {MM}, {DD}, {###}`} for date and sequence
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Digital Signature */}
                    <div className="bg-gradient-to-r from-green-50 to-teal-50 rounded-xl p-6 border border-green-200">
                      <h3 className="font-semibold text-gray-700 mb-4 flex items-center">
                        <span className="mr-2">✍️</span> Digital Signature
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <label className="block font-semibold mb-3 text-gray-700">Signature Upload</label>
                          <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center hover:border-green-400 transition-colors">
                            <input 
                              type="file" 
                              accept="image/*" 
                              onChange={(e) => {
                                if (e.target.files && e.target.files[0]) {
                                  const file = e.target.files[0];
                                  const url = URL.createObjectURL(file);
                                  setSettings(prev => ({ ...prev, digitalSignature: url }));
                                }
                              }} 
                              className="hidden" 
                              id="signatureUpload"
                            />
                            <label htmlFor="signatureUpload" className="cursor-pointer">
                              {settings.digitalSignature ? (
                                <div className="space-y-3">
                                  <img src={settings.digitalSignature} alt="Signature" className="h-16 mx-auto border rounded-lg shadow-sm" />
                                  <p className="text-sm text-green-600">Click to change signature</p>
                                </div>
                              ) : (
                                <div className="space-y-3">
                                  <div className="text-4xl">✍️</div>
                                  <p className="text-gray-600">Upload your signature</p>
                                  <p className="text-xs text-gray-400">PNG, JPG recommended</p>
                                </div>
                              )}
                            </label>
                          </div>
                        </div>
                        
                        <div>
                          <label className="block font-semibold mb-3 text-gray-700">Authorized By</label>
                          <input 
                            name="approvedBy" 
                            value={settings.approvedBy} 
                            onChange={handleChange} 
                            className="form-input w-full border rounded-xl px-4 py-3 text-gray-700" 
                            placeholder="John Smith, Director" 
                          />
                          <p className="text-sm text-gray-500 mt-2">Name and title of authorized person</p>
                          
                          <div className="mt-4">
                            <label className="block font-semibold mb-3 text-gray-700">Privacy Policy</label>
                            <textarea 
                              name="privacyPolicy" 
                              value={settings.privacyPolicy} 
                              onChange={handleChange} 
                              className="form-input w-full border rounded-xl px-4 py-3 text-gray-700 h-24 resize-none" 
                              placeholder="Brief privacy policy or data protection notice..." 
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Additional Features */}
                    <div className="bg-gray-50 rounded-xl p-6">
                      <h3 className="font-semibold text-gray-700 mb-4 flex items-center">
                        <span className="mr-2">⚡</span> Additional Features
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div>
                          <h4 className="font-medium text-gray-700 mb-3">Invoice Fields</h4>
                          <div className="checkbox-group space-y-3">
                            <label className="checkbox-item">
                              <input 
                                type="checkbox" 
                                name="purchaseOrderRef" 
                                checked={settings.purchaseOrderRef} 
                                onChange={handleToggle} 
                              />
                              <span>Purchase Order Reference</span>
                            </label>
                            <label className="checkbox-item">
                              <input 
                                type="checkbox" 
                                name="projectRef" 
                                checked={settings.projectRef} 
                                onChange={handleToggle} 
                              />
                              <span>Project Reference</span>
                            </label>
                            <label className="checkbox-item">
                              <input 
                                type="checkbox" 
                                name="deliveryDate" 
                                checked={settings.deliveryDate} 
                                onChange={handleToggle} 
                              />
                              <span>Delivery Date</span>
                            </label>
                            <label className="checkbox-item">
                              <input 
                                type="checkbox" 
                                name="invoiceStatus" 
                                checked={settings.invoiceStatus} 
                                onChange={handleToggle} 
                              />
                              <span>Show Invoice Status Badge</span>
                            </label>
                          </div>
                        </div>
                        
                        <div>
                          <h4 className="font-medium text-gray-700 mb-3">Advanced Options</h4>
                          <div className="checkbox-group space-y-3">
                            <label className="checkbox-item">
                              <input 
                                type="checkbox" 
                                name="multiLanguage" 
                                checked={settings.multiLanguage} 
                                onChange={handleToggle} 
                              />
                              <span>Multi-language Support</span>
                            </label>
                          </div>
                          
                          <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                            <h5 className="font-medium text-blue-800 mb-2">🔮 Coming Soon</h5>
                            <ul className="text-sm text-blue-600 space-y-1">
                              <li>• Auto currency conversion</li>
                              <li>• Electronic signatures</li>
                              <li>• Payment gateway integration</li>
                              <li>• Advanced templates</li>
                            </ul>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Enhanced Action Buttons */}
            <div className="action-buttons mt-12 pt-8 border-t">
              <div className="flex flex-col sm:flex-row justify-between items-center space-y-4 sm:space-y-0 sm:space-x-4">
                <button 
                  onClick={handleReset} 
                  className="btn-secondary px-6 py-3 rounded-xl font-semibold transition-all hover:scale-105"
                >
                  🔄 Reset to Defaults
                </button>
                
                <div className="flex space-x-4">
                  <button 
                    onClick={handlePreview} 
                    className="px-8 py-3 bg-gradient-to-r from-gray-600 to-gray-700 text-white rounded-xl font-semibold transition-all hover:scale-105 hover:shadow-lg"
                  >
                    👁️ Preview Invoice
                  </button>
                  <button 
                    onClick={handleSave} 
                    disabled={saving} 
                    className={`btn-primary px-10 py-3 rounded-xl font-semibold transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed ${
                      hasUnsavedChanges ? 'bg-orange-500 hover:bg-orange-600' : ''
                    }`}
                  >
                    {saving ? (
                      <span className="flex items-center">
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Saving...
                      </span>
                    ) : (
                      `💾 ${hasUnsavedChanges ? 'Save Changes' : 'Save Settings'}`
                    )}
                  </button>
                </div>
              </div>
              
              <div className="mt-6 text-center">
                <p className="text-sm text-gray-500">
                  💡 Tip: Use the preview feature to see how your invoice will look before saving
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

