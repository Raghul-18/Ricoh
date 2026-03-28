import { z } from 'zod';
import { getDefaultApr, getProductFamily } from '../lib/dealConfig';

const currentYear = new Date().getFullYear();

const companyTypes = [
  'Limited company (Ltd)',
  'Public limited company (PLC)',
  'Limited liability partnership (LLP)',
  'Partnership',
  'Sole trader',
];

const productTypes = [
  'Asset Finance - Hire Purchase',
  'Asset Finance - Finance Lease',
  'Asset Finance - Operating Lease',
  'Vehicle Finance - Hire Purchase',
  'Vehicle Finance - PCP',
  'Equipment Leasing',
  'Working Capital Loan',
  'Invoice Finance',
];

const assetTypes = [
  'Commercial vehicle',
  'Plant & machinery',
  'Medical equipment',
  'Catering equipment',
  'IT & technology',
  'Agricultural equipment',
  'Construction equipment',
  'Office furniture & fit-out',
  'Other',
];

const industries = [
  'Construction',
  'Transport & logistics',
  'Manufacturing',
  'Healthcare',
  'Food & agriculture',
  'Technology',
  'Professional services',
  'Retail',
  'Education',
  'Energy',
  'Other',
];

const productInterestOptions = [
  'Asset Finance',
  'Equipment Leasing',
  'Vehicle Finance',
  'Working Capital',
  'Invoice Finance',
];

const trimmedRequired = (label, min = 1) => z.string().trim().min(min, `${label} is required`);
const optionalTrimmed = () => z.string().trim().optional();
const optionalTrimmedMax = (label, max) => z.union([z.literal(''), z.string().trim().max(max, `${label} must be ${max} characters or fewer`)]).optional();
const optionalEnum = (values) => z.union([z.literal(''), z.enum(values)]).optional();
const emailField = (message = 'Valid email is required') => z.string().trim().email(message);
const optionalEmailField = (message = 'Must be a valid email') => z.union([z.literal(''), z.string().trim().email(message)]).optional();

const passwordField = z.string().min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
  .regex(/[0-9]/, 'Must contain at least one number');

const phoneField = z.union([
  z.literal(''),
  z.string().trim()
    .min(7, 'Phone number is too short')
    .max(20, 'Phone number is too long')
    .regex(/^[+\d\s()-]+$/, 'Phone number contains invalid characters'),
]).optional();

const validDateString = (label) =>
  z.union([z.literal(''), z.string().trim()])
    .optional()
    .refine((value) => {
      if (!value) return true;
      return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T00:00:00`).getTime());
    }, `${label} must be a valid date`);

const optionalMoneyField = (label) =>
  z.number({ invalid_type_error: `${label} must be a number` })
    .min(0, `${label} cannot be negative`)
    .optional()
    .nullable();

export const registrationSchema = z.object({
  companyName: trimmedRequired('Company name', 2).max(255, 'Company name is too long'),
  companyRegNumber: z.string().trim()
    .min(6, 'Companies House number must be at least 6 characters')
    .max(10, 'Companies House number must be at most 10 characters')
    .regex(/^[A-Za-z0-9]+$/, 'Companies House number must contain only letters and numbers'),
  companyType: z.enum(companyTypes, { message: 'Company type is required' }),
  registeredAddress: trimmedRequired('Registered address', 5).max(1000, 'Registered address is too long'),
  contactFirstName: trimmedRequired('First name').max(100, 'First name is too long'),
  contactLastName: trimmedRequired('Last name').max(100, 'Last name is too long'),
  contactEmail: emailField(),
  contactJobTitle: optionalTrimmedMax('Job title', 100),
  productLines: z.array(z.string()).min(1, 'Select at least one product line'),
});

export const dealInitiationSchema = z.object({
  customerName: trimmedRequired('Customer name', 2).max(255, 'Customer name is too long'),
  customerEmail: optionalEmailField(),
  productType: z.enum(productTypes, { message: 'Product type is required' }),
  currencyCode: z.enum(['GBP', 'USD', 'INR', 'EUR'], { message: 'Currency is required' }),
  originatorReference: z.union([
    z.literal(''),
    z.string().trim()
      .min(3, 'Reference must be at least 3 characters')
      .max(50, 'Reference must be 50 characters or fewer')
      .regex(/^[A-Za-z0-9/-]+$/, 'Reference may only contain letters, numbers, / and -'),
  ]).optional(),
  preferredStartDate: validDateString('Preferred start date'),
  notes: optionalTrimmed().refine((value) => !value || value.length <= 2000, 'Notes must be 2000 characters or fewer'),
});

export const assetDetailsSchema = z.object({
  productType: z.enum(productTypes, { message: 'Product type is required' }),
  assetType: z.string().trim().optional(),
  make: z.string().trim().optional(),
  model: z.string().trim().optional(),
  year: z.number().int().optional(),
  assetValue: z.number().optional(),
  termMonths: z.number({ invalid_type_error: 'Term is required' }).int('Term must be a whole number').min(6).max(120),
  deposit: z.number().optional(),
  balloon: z.number().optional(),
  rateType: z.enum(['Fixed', 'Variable']),
  apr: z.number().min(1).max(30).default(getDefaultApr('asset_finance')),
  supplierName: z.string().trim().optional(),
  equipmentDescription: z.string().trim().optional(),
  facilityAmount: z.number().optional(),
  purpose: z.string().trim().optional(),
  repaymentFrequency: z.enum(['Monthly', 'Quarterly']).optional(),
  averageMonthlyInvoices: z.number().optional(),
  advanceRatePct: z.number().optional(),
  debtorBookValue: z.number().optional(),
}).superRefine((data, ctx) => {
  const family = getProductFamily(data.productType);
  if (family === 'asset_finance' || family === 'vehicle_finance') {
    if (!assetTypes.includes(data.assetType)) ctx.addIssue({ code: 'custom', path: ['assetType'], message: 'Asset type is required' });
    if (!data.make?.trim()) ctx.addIssue({ code: 'custom', path: ['make'], message: 'Make is required' });
    if (!data.model?.trim()) ctx.addIssue({ code: 'custom', path: ['model'], message: 'Model is required' });
    if (!Number.isFinite(data.year) || data.year < 1990 || data.year > currentYear + 1) ctx.addIssue({ code: 'custom', path: ['year'], message: 'Year is required' });
    if (!Number.isFinite(data.assetValue) || data.assetValue < 1000) ctx.addIssue({ code: 'custom', path: ['assetValue'], message: 'Asset value must be at least 1,000' });
    if ((Number(data.deposit || 0) + Number(data.balloon || 0)) >= Number(data.assetValue || 0)) {
      ctx.addIssue({ code: 'custom', path: ['deposit'], message: 'Deposit and balloon cannot exceed asset value' });
    }
  }
  if (family === 'equipment_leasing') {
    if (!data.equipmentDescription?.trim()) ctx.addIssue({ code: 'custom', path: ['equipmentDescription'], message: 'Equipment description is required' });
    if (!Number.isFinite(data.assetValue) || data.assetValue < 1000) ctx.addIssue({ code: 'custom', path: ['assetValue'], message: 'Equipment value must be at least 1,000' });
  }
  if (family === 'working_capital') {
    if (!Number.isFinite(data.facilityAmount) || data.facilityAmount < 1000) ctx.addIssue({ code: 'custom', path: ['facilityAmount'], message: 'Facility amount must be at least 1,000' });
    if (!data.purpose?.trim()) ctx.addIssue({ code: 'custom', path: ['purpose'], message: 'Purpose is required' });
  }
  if (family === 'invoice_finance') {
    if (!Number.isFinite(data.facilityAmount) || data.facilityAmount < 1000) ctx.addIssue({ code: 'custom', path: ['facilityAmount'], message: 'Facility amount must be at least 1,000' });
    if (!Number.isFinite(data.averageMonthlyInvoices) || data.averageMonthlyInvoices < 0) ctx.addIssue({ code: 'custom', path: ['averageMonthlyInvoices'], message: 'Average monthly invoices is required' });
    if (!Number.isFinite(data.advanceRatePct) || data.advanceRatePct <= 0 || data.advanceRatePct > 100) ctx.addIssue({ code: 'custom', path: ['advanceRatePct'], message: 'Advance rate must be between 1 and 100' });
  }
});

export const prospectSchema = z.object({
  companyName: trimmedRequired('Company name', 2).max(255, 'Company name is too long'),
  city: optionalTrimmedMax('City', 100),
  industry: optionalEnum(industries),
  annualTurnover: optionalMoneyField('Annual turnover'),
  employeeCount: z.number({ invalid_type_error: 'Employee count must be a number' }).int('Employee count must be a whole number').min(0, 'Employee count cannot be negative').optional().nullable(),
  contactName: trimmedRequired('Contact name').max(255, 'Contact name is too long'),
  contactEmail: optionalEmailField('Valid email required'),
  contactPhone: phoneField,
  pipelineStage: z.enum(['New lead', 'Qualified', 'Proposal', 'Negotiation', 'Won', 'Lost']),
  productInterest: optionalEnum(productInterestOptions),
  estimatedValue: optionalMoneyField('Estimated deal value'),
  notes: optionalTrimmed().refine((value) => !value || value.length <= 2000, 'Notes must be 2000 characters or fewer'),
});

export const loginSchema = z.object({
  email: emailField(),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const signupSchema = z.object({
  fullName: trimmedRequired('Full name', 2).max(255, 'Full name is too long'),
  companyName: trimmedRequired('Company name', 2).max(255, 'Company name is too long'),
  email: emailField(),
  password: passwordField,
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

export const profileSchema = z.object({
  full_name: trimmedRequired('Name', 2).max(255, 'Name is too long'),
  company_name: optionalTrimmedMax('Company name', 255),
});

export const passwordSchema = z.object({
  newPassword: passwordField,
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

export const resetPasswordRequestSchema = z.object({
  email: emailField('Enter a valid email address'),
});
