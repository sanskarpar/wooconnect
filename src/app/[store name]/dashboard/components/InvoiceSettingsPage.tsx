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
  approvedBy: string;
  invoiceStatus: boolean;
  showPaymentTerms: boolean;
  multiLanguage: boolean;
  language: string;
}

const defaultSettings: InvoiceSettings = {
  // Basic Info
  logoUrl: '',
  colorScheme: '#000000',
  accentColor: '#000000',
  
  // Company Details
  companyName: 'Max Mustermann',
  companyRegNumber: '',
  vatNumber: '122173244432',
  companyAddress: 'Straße 232',
  companyCity: 'Berlin',
  companyPostcode: '10115',
  companyCountry: 'Deutschland',
  companyEmail: '',
  companyPhone: '',
  companyWebsite: '',
  
  // Invoice Configuration
  invoicePrefix: '',
  invoiceNumberFormat: '{YYYY} - {###}',
  dueDays: 30,
  lateFeePercentage: 0,
  discountType: 'percentage',
  
  // Layout & Styling
  fontSize: 'medium',
  showLogo: false,
  logoPosition: 'left',
  headerHeight: 80,
  showWatermark: false,
  watermarkText: 'RECHNUNG',
  watermarkOpacity: 0.1,
  
  // Content
  footerText: 'Steuerbefreit nach § 19 UStG',
  terms: '',
  privacyPolicy: '',
  bankDetails: '',
  paymentInstructions: '',
  
  // Tax Settings
  defaultTaxRate: 0,
  showTaxBreakdown: false,
  taxLabel: 'MwSt.',
  
  // Currency & Formatting
  currency: 'EUR',
  currencySymbol: '€',
  dateFormat: 'DD.MM.YYYY',
  numberFormat: 'DE',
  
  // Additional Fields
  purchaseOrderRef: false,
  projectRef: false,
  deliveryDate: true,
  notes: '',
  
  // Professional Features
  approvedBy: '',
  invoiceStatus: false,
  showPaymentTerms: false,
  multiLanguage: false,
  language: 'de-DE',
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

  // Preview handler (stub)
  const handlePreview = () => {
    // You can implement preview logic here, e.g., open a modal or generate a PDF preview
    setNotification({ type: 'success', message: 'Preview not implemented yet.' });
  };

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
      <div>
        <p>Loading invoice settings...</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen p-4">
      {/* Notification Toast */}
      {notification && (
        <div
          style={{
            position: 'fixed',
            top: 16,
            right: 16,
            zIndex: 50,
            padding: 16,
            borderRadius: 4,
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            background: notification.type === 'success' ? '#d1fae5' : '#fee2e2',
            color: '#000',
            fontSize: 14,
            fontWeight: 400,
          }}
        >
          <span style={{ color: '#000' }}>{notification.message}</span>
          <button
            onClick={() => setNotification(null)}
            style={{
              marginLeft: 8,
              background: 'none',
              border: 'none',
              color: '#000',
              cursor: 'pointer',
              fontSize: 16,
            }}
          >
            ×
          </button>
        </div>
      )}

      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <div style={{ border: '1px solid #e5e7eb', background: '#fff', padding: 0 }}>
          {/* Header */}
          <div style={{ borderBottom: '1px solid #e5e7eb', padding: '16px 24px' }}>
            <h1 style={{ fontSize: 22, fontWeight: 500, marginBottom: 4, color: '#000' }}>
              Professional Invoice Settings
            </h1>
            <p style={{ fontSize: 14, color: '#000' }}>
              Create professional invoices that reflect your brand
            </p>
          </div>

          <div style={{ padding: 24 }}>
            {/* Tabs Navigation */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ borderBottom: '1px solid #e5e7eb' }}>
                <div style={{ display: 'flex', gap: 8 }}>
                  {[
                    {
                      id: 'general',
                      label: 'General',
                    },
                    {
                      id: 'company',
                      label: 'Company',
                    },
                    {
                      id: 'tax-currency',
                      label: 'Tax & Currency',
                    },
                    {
                      id: 'advanced',
                      label: 'Advanced',
                    }
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      style={{
                        background: activeTab === tab.id ? '#f3f4f6' : 'none',
                        border: 'none',
                        borderBottom: activeTab === tab.id ? '2px solid #2563eb' : '2px solid transparent',
                        color: activeTab === tab.id ? '#2563eb' : '#374151',
                        fontWeight: 400,
                        fontSize: 14,
                        padding: '8px 16px',
                        cursor: 'pointer',
                      }}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
              {/* General Tab */}
              {activeTab === 'general' && (
                <div>
                  <h2 style={{ fontSize: 18, fontWeight: 500, marginBottom: 16, color: '#000' }}>General Settings</h2>
                  <div style={{ display: 'flex', gap: 32 }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontWeight: 400, marginBottom: 8, display: 'block', color: '#000' }}>Primary Color</label>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <input
                          type="color"
                          name="colorScheme"
                          value={settings.colorScheme}
                          onChange={handleChange}
                          style={{ color: '#000' }}
                        />
                        <input
                          type="text"
                          name="colorScheme"
                          value={settings.colorScheme}
                          onChange={handleChange}
                          style={{ color: '#000' }}
                        />
                      </div>
                      <p style={{ fontSize: 12, color: '#000', marginTop: 4 }}>Primary brand color</p>
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontWeight: 400, marginBottom: 8, display: 'block', color: '#000' }}>Accent Color</label>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <input
                          type="color"
                          name="accentColor"
                          value={settings.accentColor}
                          onChange={handleChange}
                          style={{ color: '#000' }}
                        />
                        <input
                          type="text"
                          name="accentColor"
                          value={settings.accentColor}
                          onChange={handleChange}
                          style={{ color: '#000' }}
                        />
                      </div>
                      <p style={{ fontSize: 12, color: '#000', marginTop: 4 }}>Secondary color</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Company Tab */}
              {activeTab === 'company' && (
                <div>
                  <h2 style={{ fontSize: 18, fontWeight: 500, marginBottom: 16, color: '#000' }}>Company Information</h2>
                  <div style={{ display: 'flex', gap: 32 }}>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
                      <div>
                        <label style={{ fontWeight: 400, marginBottom: 4, display: 'block', color: '#000' }}>
                          Company Name <span style={{ color: '#000' }}>*</span>
                        </label>
                        <input
                          name="companyName"
                          value={settings.companyName}
                          onChange={handleChange}
                          style={{
                            width: '100%',
                            border: errors.companyName ? '1px solid #dc2626' : '1px solid #d1d5db',
                            padding: '8px',
                            fontSize: 14,
                            color: '#000',
                          }}
                          placeholder="Your Company Ltd"
                          required
                        />
                        {errors.companyName && (
                          <p style={{ color: '#000', fontSize: 12, marginTop: 2 }}>{errors.companyName}</p>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <div style={{ flex: 1 }}>
                          <label style={{ fontWeight: 400, marginBottom: 4, display: 'block', color: '#000' }}>Company Registration</label>
                          <input
                            name="companyRegNumber"
                            value={settings.companyRegNumber}
                            onChange={handleChange}
                            style={{ width: '100%', border: '1px solid #d1d5db', padding: '8px', fontSize: 14, color: '#000' }}
                            placeholder="12345678"
                          />
                        </div>
                      </div>
                      <div>
                        <label style={{ fontWeight: 400, marginBottom: 4, display: 'block', color: '#000' }}>VAT Number</label>
                        <input
                          name="vatNumber"
                          value={settings.vatNumber}
                          onChange={handleChange}
                          style={{ width: '100%', border: '1px solid #d1d5db', padding: '8px', fontSize: 14, color: '#000' }}
                          placeholder="GB123456789"
                        />
                      </div>
                      <div>
                        <label style={{ fontWeight: 400, marginBottom: 4, display: 'block', color: '#000' }}>Website</label>
                        <input
                          name="companyWebsite"
                          value={settings.companyWebsite}
                          onChange={handleChange}
                          style={{
                            width: '100%',
                            border: errors.companyWebsite ? '1px solid #dc2626' : '1px solid #d1d5db',
                            padding: '8px',
                            fontSize: 14,
                            color: '#000',
                          }}
                          placeholder="www.yourcompany.com"
                        />
                        {errors.companyWebsite && (
                          <p style={{ color: '#000', fontSize: 12, marginTop: 2 }}>{errors.companyWebsite}</p>
                        )}
                      </div>
                    </div>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
                      <div>
                        <label style={{ fontWeight: 400, marginBottom: 4, display: 'block', color: '#000' }}>Complete Address</label>
                        <input
                          name="companyAddress"
                          value={settings.companyAddress}
                          onChange={handleChange}
                          style={{ width: '100%', border: '1px solid #d1d5db', padding: '8px', fontSize: 14, marginBottom: 8, color: '#000' }}
                          placeholder="123 Business Street"
                        />
                        <div style={{ display: 'flex', gap: 8 }}>
                          <input
                            name="companyCity"
                            value={settings.companyCity}
                            onChange={handleChange}
                            style={{ flex: 1, border: '1px solid #d1d5db', padding: '8px', fontSize: 14, color: '#000' }}
                            placeholder="London"
                          />
                          <input
                            name="companyPostcode"
                            value={settings.companyPostcode}
                            onChange={handleChange}
                            style={{ flex: 1, border: '1px solid #d1d5db', padding: '8px', fontSize: 14, color: '#000' }}
                            placeholder="SW1A 1AA"
                          />
                          <input
                            name="companyCountry"
                            value={settings.companyCountry}
                            onChange={handleChange}
                            style={{ flex: 1, border: '1px solid #d1d5db', padding: '8px', fontSize: 14, color: '#000' }}
                            placeholder="United Kingdom"
                          />
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <div style={{ flex: 1 }}>
                          <label style={{ fontWeight: 400, marginBottom: 4, display: 'block', color: '#000' }}>Email</label>
                          <input
                            name="companyEmail"
                            type="email"
                            value={settings.companyEmail}
                            onChange={handleChange}
                            style={{
                              width: '100%',
                              border: errors.companyEmail ? '1px solid #dc2626' : '1px solid #d1d5db',
                              padding: '8px',
                              fontSize: 14,
                              color: '#000',
                            }}
                            placeholder="info@yourcompany.com"
                          />
                          {errors.companyEmail && (
                            <p style={{ color: '#000', fontSize: 12, marginTop: 2 }}>{errors.companyEmail}</p>
                          )}
                        </div>
                        <div style={{ flex: 1 }}>
                          <label style={{ fontWeight: 400, marginBottom: 4, display: 'block', color: '#000' }}>Phone</label>
                          <input
                            name="companyPhone"
                            value={settings.companyPhone}
                            onChange={handleChange}
                            style={{ width: '100%', border: '1px solid #d1d5db', padding: '8px', fontSize: 14, color: '#000' }}
                            placeholder="+44 20 1234 5678"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Tax & Currency Tab */}
              {activeTab === 'tax-currency' && (
                <div>
                  <h2 style={{ fontSize: 18, fontWeight: 500, marginBottom: 16, color: '#000' }}>Tax & Currency Settings</h2>
                  <div style={{ display: 'flex', gap: 32 }}>
                    {/* Currency Settings */}
                    <div style={{ flex: 1, border: '1px solid #e5e7eb', padding: 16 }}>
                      <h3 style={{ fontWeight: 500, fontSize: 15, marginBottom: 12, color: '#000' }}>Currency Configuration</h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <div>
                          <label style={{ fontWeight: 400, marginBottom: 4, display: 'block', color: '#000' }}>Currency</label>
                          <select
                            name="currency"
                            value={settings.currency}
                            onChange={handleChange}
                            style={{ width: '100%', padding: '8px', fontSize: 14, border: '1px solid #d1d5db', color: '#000' }}
                          >
                            <option value="GBP">British Pound (£)</option>
                            <option value="USD">US Dollar ($)</option>
                            <option value="EUR">Euro (€)</option>
                            <option value="CAD">Canadian Dollar (C$)</option>
                            <option value="AUD">Australian Dollar (A$)</option>
                          </select>
                        </div>
                        <div>
                          <label style={{ fontWeight: 400, marginBottom: 4, display: 'block', color: '#000' }}>Currency Symbol</label>
                          <input
                            name="currencySymbol"
                            value={settings.currencySymbol}
                            onChange={handleChange}
                            style={{ width: '100%', padding: '8px', fontSize: 14, border: '1px solid #d1d5db', color: '#000' }}
                            placeholder="£"
                            maxLength={3}
                          />
                        </div>
                        <div>
                          <label style={{ fontWeight: 400, marginBottom: 4, display: 'block', color: '#000' }}>Number Format</label>
                          <select
                            name="numberFormat"
                            value={settings.numberFormat}
                            onChange={handleChange}
                            style={{ width: '100%', padding: '8px', fontSize: 14, border: '1px solid #d1d5db', color: '#000' }}
                          >
                            <option value="UK">UK (1,234.56)</option>
                            <option value="EU">EU (1.234,56)</option>
                            <option value="US">US (1,234.56)</option>
                          </select>
                        </div>
                      </div>
                    </div>
                    {/* Tax Settings */}
                    <div style={{ flex: 1, border: '1px solid #e5e7eb', padding: 16 }}>
                      <h3 style={{ fontWeight: 500, fontSize: 15, marginBottom: 12, color: '#000' }}>Tax Configuration</h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <div>
                          <label style={{ fontWeight: 400, marginBottom: 4, display: 'block', color: '#000' }}>Default Tax Rate (%)</label>
                          <input
                            type="number"
                            name="defaultTaxRate"
                            value={settings.defaultTaxRate}
                            onChange={handleChange}
                            style={{
                              width: '100%',
                              padding: '8px',
                              fontSize: 14,
                              border: errors.defaultTaxRate ? '1px solid #dc2626' : '1px solid #d1d5db',
                              color: '#000',
                            }}
                            min="0"
                            max="100"
                            step="0.1"
                          />
                          {errors.defaultTaxRate && (
                            <p style={{ color: '#000', fontSize: 12, marginTop: 2 }}>{errors.defaultTaxRate}</p>
                          )}
                          <p style={{ fontSize: 12, color: '#000', marginTop: 4 }}>
                            Current: {settings.defaultTaxRate}% - Standard VAT rate for your region
                          </p>
                        </div>
                        <div>
                          <label style={{ fontWeight: 400, marginBottom: 4, display: 'block', color: '#000' }}>Tax Label</label>
                          <input
                            name="taxLabel"
                            value={settings.taxLabel}
                            onChange={handleChange}
                            style={{ width: '100%', padding: '8px', fontSize: 14, border: '1px solid #d1d5db', color: '#000' }}
                            placeholder="VAT"
                          />
                          <p style={{ fontSize: 12, color: '#000', marginTop: 4 }}>
                            How tax appears on invoices: "{settings.taxLabel || 'VAT'}"
                          </p>
                        </div>
                        <div>
                          <label style={{ fontWeight: 400, marginBottom: 4, display: 'block', color: '#000' }}>
                            <input
                              type="checkbox"
                              name="showTaxBreakdown"
                              checked={settings.showTaxBreakdown}
                              onChange={handleToggle}
                              style={{ marginRight: 8 }}
                            />
                            Show Tax Breakdown
                          </label>
                          <label style={{ fontWeight: 400, marginBottom: 4, display: 'block', color: '#000' }}>
                            <input
                              type="checkbox"
                              name="showPaymentTerms"
                              checked={settings.showPaymentTerms}
                              onChange={handleToggle}
                              style={{ marginRight: 8 }}
                            />
                            Display Payment Terms
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Advanced Tab */}
              {activeTab === 'advanced' && (
                <div>
                  <h2 style={{ fontSize: 18, fontWeight: 500, marginBottom: 16, color: '#000' }}>Advanced Features</h2>
                  <div style={{ border: '1px solid #e5e7eb', padding: 16, maxWidth: 400 }}>
                    <h3 style={{ fontWeight: 500, fontSize: 15, marginBottom: 12, color: '#000' }}>Issuing Authority</h3>
                    <label style={{ fontWeight: 400, marginBottom: 4, display: 'block', color: '#000' }}>Authorized By</label>
                    <input
                      name="approvedBy"
                      value={settings.approvedBy}
                      onChange={handleChange}
                      style={{ width: '100%', padding: '8px', fontSize: 14, border: '1px solid #d1d5db', color: '#000' }}
                      placeholder="John Smith, Director"
                    />
                    <p style={{ fontSize: 12, color: '#000', marginTop: 4 }}>Name and title of authorized person</p>
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div style={{ marginTop: 32, paddingTop: 24, borderTop: '1px solid #e5e7eb' }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  style={{
                    padding: '8px 24px',
                    borderRadius: 4,
                    fontWeight: 500,
                    fontSize: 14,
                    background: hasUnsavedChanges ? '#e0cbb4ff' : '#85c5e0ff', // sky blue
                    color: '#000',
                    border: 'none',
                    cursor: saving ? 'not-allowed' : 'pointer',
                    opacity: saving ? 0.6 : 1,
                  }}
                >
                  {saving ? 'Saving...' : hasUnsavedChanges ? 'Save Changes' : 'Save Settings'}
                </button>
                <button
                  onClick={handleReset}
                  style={{
                    padding: '8px 24px',
                    borderRadius: 4,
                    fontWeight: 500,
                    fontSize: 14,
                    background: '#e5e7eb',
                    color: '#000',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  Reset to Defaults
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}







