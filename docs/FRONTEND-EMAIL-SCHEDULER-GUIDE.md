# 📧 Custom Email Scheduler - Frontend Integration Guide

## 📋 Table of Contents
1. [Overview](#overview)
2. [API Endpoints](#api-endpoints)
3. [Data Models](#data-models)
4. [UI Requirements](#ui-requirements)
5. [Implementation Guide](#implementation-guide)
6. [Code Examples](#code-examples)
7. [User Flows](#user-flows)
8. [Validation Rules](#validation-rules)
9. [Best Practices](#best-practices)

---

## 🧭 Overview

The Custom Email Scheduler allows admins to create automated email campaigns based on booking events. The frontend needs to provide:

1. **Scheduler Management** - CRUD interface for email schedulers
2. **Email Templates** - Rich text editor for email content with placeholder support
3. **Email Logs** - History of sent emails
4. **Test Email** - Send test emails before activating schedulers

**Base URL:** `/api/custom-email`

---

## 🔌 API Endpoints

### Email Scheduler Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `GET` | `/api/custom-email` | Get all schedulers | Yes (Admin) |
| `GET` | `/api/custom-email/:id` | Get single scheduler | Yes (Admin) |
| `POST` | `/api/custom-email` | Create new scheduler | Yes (Admin) |
| `PUT` | `/api/custom-email/:id` | Update scheduler | Yes (Admin) |
| `DELETE` | `/api/custom-email/:id` | Delete scheduler | Yes (Admin) |
| `POST` | `/api/custom-email/run` | Manually trigger email job | Yes (Admin) |
| `POST` | `/api/custom-email/test` | Send test email | Yes (Admin) |

### Email Log Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `GET` | `/api/email-logs` | Get all sent email logs | Yes (Admin) |
| `GET` | `/api/email-logs/:id` | Get specific log | Yes (Admin) |
| `DELETE` | `/api/email-logs/:id` | Delete specific log | Yes (Admin) |
| `DELETE` | `/api/email-logs` | Clear all logs | Yes (Admin) |

---

## 📊 Data Models

### CustomEmailScheduler

```typescript
interface CustomEmailScheduler {
  id: number;
  name: string;                    // Scheduler name (e.g., "Payment Reminder 1hr")
  subject: string;                 // Email subject
  body: string;                    // HTML email body with placeholders
  delay_minutes: number;           // Minutes after booking creation
  is_active: boolean;              // Active/inactive status
  booking_status: BookingStatus;   // Filter by booking status
  payment_method: PaymentMethod | null;  // Filter by payment method (optional)
  target_type: TargetType;         // Who receives the email
  send_once: boolean;              // Send only once per booking
  repeatable: boolean;             // Allow repeated sending
  repeat_interval_minutes: number | null;  // Repeat interval (if repeatable)
  template_type: TemplateType;     // Template category
  notes: string | null;            // Admin notes
  last_sent_at: string | null;     // ISO timestamp of last execution
  created_at: string;              // ISO timestamp
  updated_at: string;              // ISO timestamp
  SendLogs?: EmailSendLog[];       // Related send logs
}
```

### EmailSendLog

```typescript
interface EmailSendLog {
  id: number;
  scheduler_id: number;
  booking_id: number;
  sent_to: string;                 // Recipient email
  sent_at: string;                 // ISO timestamp
}
```

### Enums

```typescript
enum BookingStatus {
  PENDING = 'pending',
  PAID = 'paid',
  CANCELLED = 'cancelled',
  ABANDONED = 'abandoned',
  COMPLETED = 'completed'
}

enum PaymentMethod {
  MIDTRANS = 'midtrans',
  PAYPAL = 'paypal',
  MANUAL = 'manual',
  DOKU = 'doku'
}

enum TargetType {
  CUSTOMER = 'customer',
  AGENT = 'agent',
  ALL = 'all'
}

enum TemplateType {
  REMINDER = 'reminder',
  FOLLOW_UP = 'follow_up',
  CUSTOM = 'custom',
  MARKETING = 'marketing'
}
```

---

## 🎨 UI Requirements

### 1. Scheduler List Page

**Features Needed:**
- Table/List displaying all schedulers
- Filter by `is_active`, `template_type`, `booking_status`
- Search by name or subject
- Sort by `created_at`, `last_sent_at`, `delay_minutes`
- Quick toggle for `is_active` status
- Actions: Edit, Delete, Duplicate, Test Email
- "Create New Scheduler" button
- Statistics: Total schedulers, Active schedulers, Total emails sent

**Columns to Display:**
- Name
- Status (Active/Inactive badge)
- Template Type
- Booking Status filter
- Delay (in hours/minutes)
- Target (Customer/Agent/All)
- Last Sent
- Actions

### 2. Create/Edit Scheduler Form

**Form Fields:**

**Basic Information:**
- Name (text input, required, max 255 chars)
- Template Type (dropdown: reminder, follow_up, custom, marketing)
- Notes (textarea, optional)

**Email Content:**
- Subject (text input, required, max 255 chars)
- Body (rich text editor with HTML support)
  - Provide placeholder insertion buttons
  - Show placeholder guide/help text
  - Preview functionality

**Trigger Settings:**
- Delay Minutes (number input, required, min: 0)
  - Helper: Convert to hours/days for better UX
  - Example: "1 hour", "3 hours", "1 day"
- Is Active (toggle switch, default: false)

**Filters:**
- Booking Status (dropdown, required)
- Payment Method (dropdown, optional)
- Target Type (radio buttons: Customer, Agent, All)

**Sending Rules:**
- Send Once (toggle, default: true)
- Repeatable (toggle, default: false)
- Repeat Interval Minutes (number input, enabled only if repeatable=true)

**Actions:**
- Save Scheduler
- Save & Test Email
- Cancel

### 3. Email Placeholder Helper

**Available Placeholders:**

Create a visual placeholder selector/inserter:

```
%booking_id%       → Booking ticket ID (e.g., GG-RT-776001)
%customer_name%    → Customer full name
%total_price%      → Total booking amount
%schedule_name%    → Schedule/route name
%date%             → Booking date
```

**Implementation Idea:**
- Clickable buttons that insert placeholder at cursor position
- Tooltip showing example value for each placeholder
- Preview pane showing rendered email with sample data

### 4. Test Email Dialog

**Form Fields:**
- Scheduler (dropdown or auto-filled if from scheduler page)
- Booking ID (text input, required, format: GG-RT-XXXXXX)
- Recipient Email (email input, required)
- Send Test Button

**Behavior:**
- Validates booking exists
- Uses real booking data to populate placeholders
- Shows success/error message
- Does NOT create log entry in EmailSendLogs

### 5. Email Logs Page

**Features Needed:**
- Table displaying all sent emails
- Filter by:
  - Scheduler name
  - Date range
  - Recipient email
  - Booking ID
- Search functionality
- Pagination
- Export to CSV
- Clear all logs (with confirmation)

**Columns:**
- Sent At (timestamp)
- Scheduler Name
- Booking ID
- Recipient Email
- Subject (from scheduler)
- Actions (View Details, Delete)

### 6. Dashboard Widgets (Optional)

**Email Performance Stats:**
- Total emails sent (today, this week, this month)
- Active schedulers count
- Recent email activity (last 10 sent)
- Most used scheduler

---

## 💻 Implementation Guide

### Step 1: Setup API Service

```typescript
// services/emailSchedulerApi.ts
import axios from 'axios';

const API_BASE = '/api/custom-email';
const LOGS_BASE = '/api/email-logs';

export const emailSchedulerApi = {
  // Schedulers
  getAllSchedulers: () =>
    axios.get(API_BASE),

  getSchedulerById: (id: number) =>
    axios.get(`${API_BASE}/${id}`),

  createScheduler: (data: Partial<CustomEmailScheduler>) =>
    axios.post(API_BASE, data),

  updateScheduler: (id: number, data: Partial<CustomEmailScheduler>) =>
    axios.put(`${API_BASE}/${id}`, data),

  deleteScheduler: (id: number) =>
    axios.delete(`${API_BASE}/${id}`),

  runEmailJob: () =>
    axios.post(`${API_BASE}/run`),

  sendTestEmail: (data: {
    scheduler_id: number;
    booking_id: string;
    recipient_email: string;
  }) =>
    axios.post(`${API_BASE}/test`, data),

  // Logs
  getAllLogs: (params?: { page?: number; limit?: number }) =>
    axios.get(LOGS_BASE, { params }),

  getLogById: (id: number) =>
    axios.get(`${LOGS_BASE}/${id}`),

  deleteLog: (id: number) =>
    axios.delete(`${LOGS_BASE}/${id}`),

  clearAllLogs: () =>
    axios.delete(LOGS_BASE),
};
```

### Step 2: Create State Management

```typescript
// stores/emailSchedulerStore.ts (Zustand example)
import create from 'zustand';
import { emailSchedulerApi } from '../services/emailSchedulerApi';

interface EmailSchedulerState {
  schedulers: CustomEmailScheduler[];
  loading: boolean;
  error: string | null;

  fetchSchedulers: () => Promise<void>;
  createScheduler: (data: Partial<CustomEmailScheduler>) => Promise<void>;
  updateScheduler: (id: number, data: Partial<CustomEmailScheduler>) => Promise<void>;
  deleteScheduler: (id: number) => Promise<void>;
  toggleActive: (id: number, isActive: boolean) => Promise<void>;
}

export const useEmailSchedulerStore = create<EmailSchedulerState>((set, get) => ({
  schedulers: [],
  loading: false,
  error: null,

  fetchSchedulers: async () => {
    set({ loading: true, error: null });
    try {
      const response = await emailSchedulerApi.getAllSchedulers();
      set({ schedulers: response.data.data, loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
    }
  },

  createScheduler: async (data) => {
    set({ loading: true, error: null });
    try {
      await emailSchedulerApi.createScheduler(data);
      await get().fetchSchedulers();
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  updateScheduler: async (id, data) => {
    set({ loading: true, error: null });
    try {
      await emailSchedulerApi.updateScheduler(id, data);
      await get().fetchSchedulers();
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  deleteScheduler: async (id) => {
    set({ loading: true, error: null });
    try {
      await emailSchedulerApi.deleteScheduler(id);
      await get().fetchSchedulers();
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  toggleActive: async (id, isActive) => {
    await get().updateScheduler(id, { is_active: isActive });
  },
}));
```

### Step 3: Build Scheduler Form Component

```typescript
// components/EmailSchedulerForm.tsx
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';

interface FormData {
  name: string;
  subject: string;
  body: string;
  delay_minutes: number;
  is_active: boolean;
  booking_status: BookingStatus;
  payment_method: PaymentMethod | null;
  target_type: TargetType;
  send_once: boolean;
  repeatable: boolean;
  repeat_interval_minutes: number | null;
  template_type: TemplateType;
  notes: string;
}

export const EmailSchedulerForm: React.FC<{
  initialData?: CustomEmailScheduler;
  onSubmit: (data: FormData) => Promise<void>;
  onCancel: () => void;
}> = ({ initialData, onSubmit, onCancel }) => {
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormData>({
    defaultValues: initialData || {
      is_active: false,
      send_once: true,
      repeatable: false,
      target_type: 'customer',
      template_type: 'custom',
      booking_status: 'pending',
    }
  });

  const repeatable = watch('repeatable');
  const [bodyContent, setBodyContent] = useState(initialData?.body || '');

  const insertPlaceholder = (placeholder: string) => {
    // Insert at cursor position in rich text editor
    setBodyContent(prev => prev + placeholder);
    setValue('body', bodyContent + placeholder);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Basic Info */}
      <section>
        <h3>Basic Information</h3>

        <input
          {...register('name', { required: 'Name is required', maxLength: 255 })}
          placeholder="Scheduler Name"
        />
        {errors.name && <span className="error">{errors.name.message}</span>}

        <select {...register('template_type', { required: true })}>
          <option value="reminder">Reminder</option>
          <option value="follow_up">Follow Up</option>
          <option value="custom">Custom</option>
          <option value="marketing">Marketing</option>
        </select>

        <textarea {...register('notes')} placeholder="Notes (optional)" />
      </section>

      {/* Email Content */}
      <section>
        <h3>Email Content</h3>

        <input
          {...register('subject', { required: 'Subject is required', maxLength: 255 })}
          placeholder="Email Subject"
        />
        {errors.subject && <span className="error">{errors.subject.message}</span>}

        <div className="placeholder-buttons">
          <button type="button" onClick={() => insertPlaceholder('%booking_id%')}>
            Insert Booking ID
          </button>
          <button type="button" onClick={() => insertPlaceholder('%customer_name%')}>
            Insert Customer Name
          </button>
          <button type="button" onClick={() => insertPlaceholder('%total_price%')}>
            Insert Total Price
          </button>
          <button type="button" onClick={() => insertPlaceholder('%schedule_name%')}>
            Insert Schedule Name
          </button>
          <button type="button" onClick={() => insertPlaceholder('%date%')}>
            Insert Date
          </button>
        </div>

        {/* Use your preferred rich text editor */}
        <RichTextEditor
          value={bodyContent}
          onChange={(value) => {
            setBodyContent(value);
            setValue('body', value);
          }}
        />
      </section>

      {/* Trigger Settings */}
      <section>
        <h3>Trigger Settings</h3>

        <input
          type="number"
          {...register('delay_minutes', {
            required: 'Delay is required',
            min: { value: 0, message: 'Must be >= 0' }
          })}
          placeholder="Delay in minutes"
        />
        <span className="helper">
          {watch('delay_minutes') >= 60
            ? `≈ ${Math.floor(watch('delay_minutes') / 60)} hour(s)`
            : ''}
        </span>
        {errors.delay_minutes && <span className="error">{errors.delay_minutes.message}</span>}

        <label>
          <input type="checkbox" {...register('is_active')} />
          Active
        </label>
      </section>

      {/* Filters */}
      <section>
        <h3>Filters</h3>

        <select {...register('booking_status', { required: true })}>
          <option value="pending">Pending</option>
          <option value="paid">Paid</option>
          <option value="cancelled">Cancelled</option>
          <option value="abandoned">Abandoned</option>
          <option value="completed">Completed</option>
        </select>

        <select {...register('payment_method')}>
          <option value="">Any Payment Method</option>
          <option value="midtrans">Midtrans</option>
          <option value="paypal">PayPal</option>
          <option value="manual">Manual</option>
          <option value="doku">DOKU</option>
        </select>

        <div className="radio-group">
          <label>
            <input type="radio" {...register('target_type')} value="customer" />
            Customer
          </label>
          <label>
            <input type="radio" {...register('target_type')} value="agent" />
            Agent
          </label>
          <label>
            <input type="radio" {...register('target_type')} value="all" />
            All
          </label>
        </div>
      </section>

      {/* Sending Rules */}
      <section>
        <h3>Sending Rules</h3>

        <label>
          <input type="checkbox" {...register('send_once')} />
          Send only once per booking
        </label>

        <label>
          <input type="checkbox" {...register('repeatable')} />
          Allow repeated sending
        </label>

        {repeatable && (
          <input
            type="number"
            {...register('repeat_interval_minutes')}
            placeholder="Repeat interval in minutes"
          />
        )}
      </section>

      {/* Actions */}
      <div className="actions">
        <button type="submit">Save Scheduler</button>
        <button type="button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
};
```

### Step 4: Create Scheduler List Component

```typescript
// components/EmailSchedulerList.tsx
import React, { useEffect } from 'react';
import { useEmailSchedulerStore } from '../stores/emailSchedulerStore';

export const EmailSchedulerList: React.FC = () => {
  const { schedulers, loading, fetchSchedulers, deleteScheduler, toggleActive } =
    useEmailSchedulerStore();

  useEffect(() => {
    fetchSchedulers();
  }, []);

  const handleDelete = async (id: number) => {
    if (confirm('Are you sure you want to delete this scheduler?')) {
      await deleteScheduler(id);
    }
  };

  const handleToggleActive = async (id: number, currentStatus: boolean) => {
    await toggleActive(id, !currentStatus);
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <h2>Email Schedulers</h2>

      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Status</th>
            <th>Type</th>
            <th>Booking Status</th>
            <th>Delay</th>
            <th>Target</th>
            <th>Last Sent</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {schedulers.map(scheduler => (
            <tr key={scheduler.id}>
              <td>{scheduler.name}</td>
              <td>
                <span className={scheduler.is_active ? 'badge-active' : 'badge-inactive'}>
                  {scheduler.is_active ? 'Active' : 'Inactive'}
                </span>
              </td>
              <td>{scheduler.template_type}</td>
              <td>{scheduler.booking_status}</td>
              <td>{scheduler.delay_minutes} min</td>
              <td>{scheduler.target_type}</td>
              <td>{scheduler.last_sent_at ? new Date(scheduler.last_sent_at).toLocaleString() : 'Never'}</td>
              <td>
                <button onClick={() => handleToggleActive(scheduler.id, scheduler.is_active)}>
                  {scheduler.is_active ? 'Deactivate' : 'Activate'}
                </button>
                <button onClick={() => handleEdit(scheduler.id)}>Edit</button>
                <button onClick={() => handleDelete(scheduler.id)}>Delete</button>
                <button onClick={() => handleTestEmail(scheduler.id)}>Test</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
```

### Step 5: Test Email Dialog

```typescript
// components/TestEmailDialog.tsx
import React, { useState } from 'react';
import { emailSchedulerApi } from '../services/emailSchedulerApi';

export const TestEmailDialog: React.FC<{
  schedulerId: number;
  onClose: () => void;
}> = ({ schedulerId, onClose }) => {
  const [bookingId, setBookingId] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSend = async () => {
    setLoading(true);
    setError('');
    setSuccess(false);

    try {
      await emailSchedulerApi.sendTestEmail({
        scheduler_id: schedulerId,
        booking_id: bookingId,
        recipient_email: recipientEmail,
      });
      setSuccess(true);
      setTimeout(onClose, 2000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to send test email');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dialog">
      <h3>Send Test Email</h3>

      <input
        type="text"
        placeholder="Booking ID (e.g., GG-RT-776001)"
        value={bookingId}
        onChange={e => setBookingId(e.target.value)}
      />

      <input
        type="email"
        placeholder="Recipient Email"
        value={recipientEmail}
        onChange={e => setRecipientEmail(e.target.value)}
      />

      {error && <div className="error">{error}</div>}
      {success && <div className="success">Test email sent successfully!</div>}

      <div className="actions">
        <button onClick={handleSend} disabled={loading || !bookingId || !recipientEmail}>
          {loading ? 'Sending...' : 'Send Test'}
        </button>
        <button onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
};
```

---

## 🔄 User Flows

### Flow 1: Creating a New Email Scheduler

1. Admin clicks "Create New Scheduler"
2. Form opens with empty fields
3. Admin fills in:
   - Name: "Payment Reminder - 1 Hour"
   - Subject: "Complete Your Booking Payment"
   - Body: HTML with placeholders
   - Delay: 60 minutes
   - Booking Status: "pending"
   - Target: "customer"
4. Admin clicks "Save & Test"
5. Test email dialog opens
6. Admin enters test booking ID and email
7. System sends test email with real booking data
8. Admin receives and verifies email
9. Admin activates scheduler (toggle is_active)
10. System confirms scheduler is active

### Flow 2: Testing an Email Template

1. Admin navigates to scheduler list
2. Clicks "Test" button on a scheduler
3. Test dialog opens with scheduler pre-selected
4. Admin enters:
   - Booking ID: GG-RT-776001
   - Recipient: admin@example.com
5. Clicks "Send Test"
6. Backend fetches booking data
7. Backend replaces placeholders
8. Email sent to recipient
9. Success message shown
10. Dialog closes

### Flow 3: Viewing Email History

1. Admin clicks "Email Logs" in navigation
2. Table loads with all sent emails
3. Admin can:
   - Filter by date range
   - Search by booking ID or email
   - See which scheduler sent each email
4. Admin clicks on a log entry
5. Details modal shows:
   - Full email content
   - Booking details
   - Timestamp
   - Scheduler used

---

## ✅ Validation Rules

### Frontend Validation

```typescript
const validationRules = {
  name: {
    required: 'Name is required',
    maxLength: { value: 255, message: 'Max 255 characters' }
  },
  subject: {
    required: 'Subject is required',
    maxLength: { value: 255, message: 'Max 255 characters' }
  },
  body: {
    required: 'Email body is required',
    validate: (value: string) => {
      // Check if placeholders are used correctly
      const placeholders = value.match(/%\w+%/g) || [];
      const validPlaceholders = [
        '%booking_id%',
        '%customer_name%',
        '%total_price%',
        '%schedule_name%',
        '%date%'
      ];

      const invalidPlaceholders = placeholders.filter(
        p => !validPlaceholders.includes(p)
      );

      if (invalidPlaceholders.length > 0) {
        return `Invalid placeholders: ${invalidPlaceholders.join(', ')}`;
      }

      return true;
    }
  },
  delay_minutes: {
    required: 'Delay is required',
    min: { value: 0, message: 'Must be 0 or greater' },
    validate: (value: number) => {
      if (value > 43200) { // 30 days
        return 'Maximum delay is 30 days (43200 minutes)';
      }
      return true;
    }
  },
  booking_status: {
    required: 'Booking status is required',
    validate: (value: string) => {
      return ['pending', 'paid', 'cancelled', 'abandoned', 'completed'].includes(value)
        || 'Invalid booking status';
    }
  },
  target_type: {
    required: 'Target type is required',
    validate: (value: string) => {
      return ['customer', 'agent', 'all'].includes(value)
        || 'Invalid target type';
    }
  }
};
```

### Backend Validation (Handled Automatically)

The backend validates:
- All required fields present
- Enum values are valid
- Schedule/SubSchedule IDs exist (if provided)
- Booking ID exists for test emails

---

## 🎯 Best Practices

### 1. Email Template Design

```html
<!-- Good: Use inline CSS for email compatibility -->
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h1 style="color: #333;">Hello %customer_name%</h1>
  <p style="color: #666; line-height: 1.6;">
    Your booking <strong>%booking_id%</strong> is confirmed!
  </p>
  <div style="background: #f5f5f5; padding: 20px; margin: 20px 0;">
    <p>Total Amount: <strong>Rp %total_price%</strong></p>
    <p>Schedule: <strong>%schedule_name%</strong></p>
    <p>Date: <strong>%date%</strong></p>
  </div>
</div>
```

### 2. Delay Time Helpers

```typescript
// Helper function to convert minutes to human-readable format
const formatDelay = (minutes: number): string => {
  if (minutes < 60) return `${minutes} minute(s)`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)} hour(s)`;
  return `${Math.floor(minutes / 1440)} day(s)`;
};

// Helper to convert human input to minutes
const parseDelay = (value: number, unit: 'minutes' | 'hours' | 'days'): number => {
  switch (unit) {
    case 'minutes': return value;
    case 'hours': return value * 60;
    case 'days': return value * 1440;
  }
};
```

### 3. Error Handling

```typescript
try {
  await emailSchedulerApi.createScheduler(formData);
  toast.success('Scheduler created successfully');
  navigate('/email-schedulers');
} catch (error: any) {
  if (error.response?.status === 400) {
    // Validation errors
    const errors = error.response.data.errors;
    errors.forEach((err: string) => toast.error(err));
  } else if (error.response?.status === 404) {
    toast.error('Referenced schedule or subschedule not found');
  } else {
    toast.error('Failed to create scheduler. Please try again.');
  }
}
```

### 4. Placeholder Preview

```typescript
// Preview email with sample data
const previewEmail = (template: string) => {
  const sampleData = {
    '%booking_id%': 'GG-RT-776001',
    '%customer_name%': 'John Doe',
    '%total_price%': '750,000',
    '%schedule_name%': 'Bali → Gili Trawangan',
    '%date%': '2025-10-25'
  };

  let preview = template;
  Object.entries(sampleData).forEach(([key, value]) => {
    preview = preview.replace(new RegExp(key, 'g'), value);
  });

  return preview;
};
```

### 5. Confirmation Dialogs

```typescript
// Before deleting
const handleDelete = async (id: number, name: string) => {
  const confirmed = await confirmDialog({
    title: 'Delete Scheduler',
    message: `Are you sure you want to delete "${name}"? This action cannot be undone.`,
    confirmText: 'Delete',
    cancelText: 'Cancel',
    type: 'danger'
  });

  if (confirmed) {
    await deleteScheduler(id);
  }
};

// Before clearing all logs
const handleClearLogs = async () => {
  const confirmed = await confirmDialog({
    title: 'Clear All Logs',
    message: 'This will permanently delete ALL email send logs. Are you absolutely sure?',
    confirmText: 'Yes, Clear All',
    cancelText: 'Cancel',
    type: 'danger',
    requireTyping: 'CLEAR ALL' // Make user type to confirm
  });

  if (confirmed) {
    await emailSchedulerApi.clearAllLogs();
  }
};
```

### 6. Loading States

```typescript
// Show appropriate loading states
const SchedulerList = () => {
  const [loadingStates, setLoadingStates] = useState<Record<number, boolean>>({});

  const handleToggle = async (id: number, currentStatus: boolean) => {
    setLoadingStates(prev => ({ ...prev, [id]: true }));

    try {
      await toggleActive(id, !currentStatus);
    } finally {
      setLoadingStates(prev => ({ ...prev, [id]: false }));
    }
  };

  return (
    <button
      onClick={() => handleToggle(scheduler.id, scheduler.is_active)}
      disabled={loadingStates[scheduler.id]}
    >
      {loadingStates[scheduler.id] ? 'Updating...' : 'Toggle'}
    </button>
  );
};
```

---

## 🚀 Quick Start Checklist

- [ ] Create API service layer (`emailSchedulerApi.ts`)
- [ ] Set up state management (Zustand/Redux/Context)
- [ ] Build scheduler list page
- [ ] Build create/edit form with rich text editor
- [ ] Add placeholder insertion UI
- [ ] Implement test email dialog
- [ ] Build email logs page
- [ ] Add filtering and search
- [ ] Implement confirmation dialogs
- [ ] Add form validation
- [ ] Handle error states
- [ ] Add loading states
- [ ] Test with real booking data
- [ ] Add admin authentication
- [ ] Style components

---

## 📞 Support

If you encounter issues or need clarification:
1. Check the backend documentation (`email-scheduler-documentation.md`)
2. Verify API responses match expected format
3. Test endpoints using Postman/Thunder Client
4. Check browser console for errors
5. Contact backend team for API issues

---

**Last Updated:** 2025-10-20
**Frontend Framework:** React/TypeScript (adaptable)
**Backend API Version:** 1.0
