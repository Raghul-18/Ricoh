import { z } from 'zod';

// ── Registration ───────────────────────────────────────────
export const registrationSchema = z.object({
  companyName: z.string().min(2, 'Company name is required'),
  companyRegNumber: z.string()
    .min(6, 'Companies House number must be at least 6 characters')
    .max(10, 'Invalid Companies House number'),
  companyType: z.string().min(1, 'Company type is required'),
  registeredAddress: z.string().min(5, 'Registered address is required'),
  contactFirstName: z.string().min(1, 'First name is required'),
  contactLastName: z.string().min(1, 'Last name is required'),
  contactEmail: z.string().email('Valid email is required'),
  contactJobTitle: z.string().optional(),
  productLines: z.array(z.string()).min(1, 'Select at least one product line'),
});

// ── Deal Initiation ────────────────────────────────────────
export const dealInitiationSchema = z.object({
  customerName: z.string().min(2, 'Customer name is required'),
  customerEmail: z.string().email('Must be a valid email').optional().or(z.literal('')),
  productType: z.string().min(1, 'Product type is required'),
  originatorReference: z.string().optional(),
  preferredStartDate: z.string().optional(),
  notes: z.string().optional(),
});

// ── Asset Details ──────────────────────────────────────────
export const assetDetailsSchema = z.object({
  assetType: z.string().min(1, 'Asset type is required'),
  make: z.string().min(1, 'Make is required'),
  model: z.string().min(1, 'Model is required'),
  year: z.number().min(1990).max(new Date().getFullYear() + 1),
  assetValue: z.number().min(1000, 'Asset value must be at least £1,000'),
  termMonths: z.number().min(6).max(120),
  deposit: z.number().min(0),
  balloon: z.number().min(0),
  rateType: z.enum(['Fixed', 'Variable']),
}).refine(data => data.deposit + data.balloon < data.assetValue, {
  message: 'Deposit and balloon cannot exceed asset value',
  path: ['deposit'],
});

// ── Prospect ───────────────────────────────────────────────
export const prospectSchema = z.object({
  companyName: z.string().min(2, 'Company name is required'),
  city: z.string().optional(),
  industry: z.string().optional(),
  annualTurnover: z.number().optional().nullable(),
  employeeCount: z.number().optional().nullable(),
  contactName: z.string().min(1, 'Contact name is required'),
  contactEmail: z.string().email('Valid email required').optional().or(z.literal('')),
  contactPhone: z.string().optional(),
  pipelineStage: z.enum(['New lead', 'Qualified', 'Proposal', 'Negotiation', 'Won', 'Lost']),
  productInterest: z.string().optional(),
  estimatedValue: z.number().optional().nullable(),
  notes: z.string().optional(),
});

// ── Login ──────────────────────────────────────────────────
export const loginSchema = z.object({
  email: z.string().email('Valid email is required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

// ── Signup ─────────────────────────────────────────────────
export const signupSchema = z.object({
  fullName: z.string().min(2, 'Full name is required'),
  companyName: z.string().min(2, 'Company name is required'),
  email: z.string().email('Valid email is required'),
  password: z.string().min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Must contain at least one number'),
  confirmPassword: z.string(),
}).refine(d => d.password === d.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});
