import { BlacklistRule, BlacklistSettings } from '@/app/api/invoice-blacklist/route';

interface UniversalInvoice {
  id: string;
  universalNumber: string;
  storeInvoiceNumber: string;
  storeName: string;
  amount: number;
  status: 'paid' | 'unpaid' | 'overdue';
  customerName: string;
  customerEmail?: string;
  createdAt: string;
  dueDate: string;
  orderStatus?: string;
  paymentMethod?: string;
  items?: Array<{
    name: string;
    quantity: number;
    price: number;
  }>;
  billingAddress?: {
    address_1?: string;
    address_2?: string;
    city?: string;
    state?: string;
    postcode?: string;
    country?: string;
  };
}

export function applyBlacklistFilter(
  invoices: UniversalInvoice[], 
  blacklistSettings: BlacklistSettings
): { 
  filteredInvoices: UniversalInvoice[], 
  excludedInvoices: UniversalInvoice[] 
} {
  if (!blacklistSettings.enabled || !blacklistSettings.rules.length) {
    return { filteredInvoices: invoices, excludedInvoices: [] };
  }

  const excludedInvoices: UniversalInvoice[] = [];
  const filteredInvoices = invoices.filter(invoice => {
    for (const rule of blacklistSettings.rules) {
      if (!rule.enabled) continue;
      
      if (shouldExcludeInvoice(invoice, rule)) {
        excludedInvoices.push(invoice);
        return false; // Exclude this invoice
      }
    }
    return true; // Keep this invoice
  });

  return { filteredInvoices, excludedInvoices };
}

function shouldExcludeInvoice(invoice: UniversalInvoice, rule: BlacklistRule): boolean {
  let invoiceValue: string | number | Date;
  
  // Extract the value from the invoice based on the rule type
  switch (rule.type) {
    case 'customerName':
      invoiceValue = invoice.customerName || '';
      break;
    case 'customerEmail':
      invoiceValue = invoice.customerEmail || '';
      break;
    case 'storeName':
      invoiceValue = invoice.storeName || '';
      break;
    case 'invoiceNumber':
      invoiceValue = invoice.universalNumber || invoice.storeInvoiceNumber || '';
      break;
    case 'amount':
      invoiceValue = invoice.amount;
      break;
    case 'status':
      invoiceValue = invoice.status;
      break;
    case 'dateRange':
      invoiceValue = new Date(invoice.createdAt);
      break;
    default:
      return false;
  }

  // Apply the condition based on rule type
  if (rule.type === 'dateRange') {
    return evaluateDateCondition(invoiceValue as Date, rule);
  } else if (rule.type === 'amount') {
    return evaluateNumericCondition(invoiceValue as number, rule);
  } else {
    return evaluateStringCondition(invoiceValue as string, rule);
  }
}

function evaluateStringCondition(invoiceValue: string, rule: BlacklistRule): boolean {
  const ruleValue = String(rule.value);
  const compareValue = rule.caseSensitive ? invoiceValue : invoiceValue.toLowerCase();
  const ruleCompareValue = rule.caseSensitive ? ruleValue : ruleValue.toLowerCase();

  switch (rule.condition) {
    case 'contains':
      return compareValue.includes(ruleCompareValue);
    case 'equals':
      return compareValue === ruleCompareValue;
    case 'startsWith':
      return compareValue.startsWith(ruleCompareValue);
    case 'endsWith':
      return compareValue.endsWith(ruleCompareValue);
    default:
      return false;
  }
}

function evaluateNumericCondition(invoiceValue: number, rule: BlacklistRule): boolean {
  const ruleValue = Number(rule.value);
  const ruleValue2 = rule.value2 ? Number(rule.value2) : undefined;

  switch (rule.condition) {
    case 'equals':
      return invoiceValue === ruleValue;
    case 'greaterThan':
      return invoiceValue > ruleValue;
    case 'lessThan':
      return invoiceValue < ruleValue;
    case 'between':
      return ruleValue2 !== undefined && 
             invoiceValue >= Math.min(ruleValue, ruleValue2) && 
             invoiceValue <= Math.max(ruleValue, ruleValue2);
    default:
      return false;
  }
}

function evaluateDateCondition(invoiceDate: Date, rule: BlacklistRule): boolean {
  const ruleDate = new Date(String(rule.value));
  const ruleDate2 = rule.value2 ? new Date(String(rule.value2)) : undefined;

  switch (rule.condition) {
    case 'equals':
      return invoiceDate.toDateString() === ruleDate.toDateString();
    case 'greaterThan':
      return invoiceDate > ruleDate;
    case 'lessThan':
      return invoiceDate < ruleDate;
    case 'between':
      return ruleDate2 !== undefined && 
             invoiceDate >= new Date(Math.min(ruleDate.getTime(), ruleDate2.getTime())) && 
             invoiceDate <= new Date(Math.max(ruleDate.getTime(), ruleDate2.getTime()));
    default:
      return false;
  }
}

export function generateBlacklistRuleId(): string {
  return 'rule_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}
