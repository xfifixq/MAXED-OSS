'use client';

import { useEffect, useState } from 'react';
import { apiUrl, serviceHeaders } from '@/lib/api';
import { useFirmReady } from '@/lib/useFirmReady';

interface Contact {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  company?: string;
  createdAt: string;
}

interface Company {
  id: string;
  name: string;
  domainName?: string;
  employees?: number;
  address?: string;
  createdAt: string;
}

const TABS = ['Contacts', 'Companies'] as const;
type Tab = typeof TABS[number];

const PLACEHOLDER_CONTACTS: Contact[] = [
  { id: '1', firstName: 'John', lastName: 'Smith', email: 'john@acmecorp.com', phone: '(555) 100-2001', company: 'Acme Corporation', createdAt: '2026-01-15T10:00:00Z' },
  { id: '2', firstName: 'Sarah', lastName: 'Williams', email: 'sarah@techstart.io', phone: '(555) 100-2002', company: 'TechStart Inc', createdAt: '2026-02-01T09:00:00Z' },
  { id: '3', firstName: 'James', lastName: 'Baker', email: 'jbaker@bakerllc.com', phone: '(555) 100-2003', company: 'Baker & Associates', createdAt: '2026-02-10T14:00:00Z' },
  { id: '4', firstName: 'Emily', lastName: 'Chen', email: 'emily@summitpartners.com', phone: '(555) 100-2004', company: 'Summit Partners', createdAt: '2026-02-20T11:00:00Z' },
  { id: '5', firstName: 'Michael', lastName: 'Roberts', email: 'michael@greenleaf.co', phone: '(555) 100-2005', company: 'GreenLeaf Organic', createdAt: '2026-03-01T08:00:00Z' },
  { id: '6', firstName: 'Lisa', lastName: 'Park', email: 'lisa@novahealth.com', company: 'Nova Health', createdAt: '2026-03-05T16:00:00Z' },
];

const PLACEHOLDER_COMPANIES: Company[] = [
  { id: '1', name: 'Acme Corporation', domainName: 'acmecorp.com', employees: 250, address: 'New York, NY', createdAt: '2026-01-10T09:00:00Z' },
  { id: '2', name: 'TechStart Inc', domainName: 'techstart.io', employees: 45, address: 'San Francisco, CA', createdAt: '2026-01-20T10:00:00Z' },
  { id: '3', name: 'Baker & Associates', domainName: 'bakerllc.com', employees: 12, address: 'Chicago, IL', createdAt: '2026-02-05T11:00:00Z' },
  { id: '4', name: 'Summit Partners', domainName: 'summitpartners.com', employees: 80, address: 'Boston, MA', createdAt: '2026-02-15T14:00:00Z' },
];

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function CRMPage() {
  const { isReady } = useFirmReady();
  const [tab, setTab] = useState<Tab>('Contacts');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showAddContact, setShowAddContact] = useState(false);
  const [showAddCompany, setShowAddCompany] = useState(false);
  const [contactForm, setContactForm] = useState({ firstName: '', lastName: '', email: '', phone: '', company: '' });
  const [companyForm, setCompanyForm] = useState({ name: '', domainName: '', employees: '', address: '' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isReady) return;
    async function fetchData() {
      try {
        const [cRes, coRes] = await Promise.all([
          fetch(apiUrl('/api/services/twenty/people'), { headers: serviceHeaders() }),
          fetch(apiUrl('/api/services/twenty/companies'), { headers: serviceHeaders() }),
        ]);
        if (cRes.ok) {
          const d = await cRes.json();
          const list = d.data?.people || d.data || (Array.isArray(d) ? d : []);
          if (list.length > 0) {
            setContacts(list.map((p: Record<string, unknown>) => ({
              id: p.id as string,
              firstName: (p.name as Record<string, string>)?.firstName || (p as Record<string, string>).firstName || '',
              lastName: (p.name as Record<string, string>)?.lastName || (p as Record<string, string>).lastName || '',
              email: ((p.emails as Record<string, string>)?.primaryEmail || (p as Record<string, string>).email || '') as string,
              phone: ((p.phones as Record<string, string>)?.primaryPhoneNumber || (p as Record<string, string>).phone || '') as string,
              company: ((p.company as Record<string, string>)?.name || '') as string,
              createdAt: (p.createdAt as string) || new Date().toISOString(),
            })));
          } else setContacts(PLACEHOLDER_CONTACTS);
        } else setContacts(PLACEHOLDER_CONTACTS);

        if (coRes.ok) {
          const d = await coRes.json();
          const list = d.data?.companies || d.data || (Array.isArray(d) ? d : []);
          if (list.length > 0) {
            setCompanies(list.map((c: Record<string, unknown>) => ({
              id: c.id as string,
              name: (c.name as string) || '',
              domainName: (c.domainName as string) || '',
              employees: (c.employees as number) || 0,
              address: ((c.address as Record<string, string>)?.addressCity || (c as Record<string, string>).address || '') as string,
              createdAt: (c.createdAt as string) || new Date().toISOString(),
            })));
          } else setCompanies(PLACEHOLDER_COMPANIES);
        } else setCompanies(PLACEHOLDER_COMPANIES);
      } catch {
        setContacts(PLACEHOLDER_CONTACTS);
        setCompanies(PLACEHOLDER_COMPANIES);
      }
      setLoading(false);
    }
    fetchData();
  }, [isReady]);

  const filteredContacts = contacts.filter(c =>
    `${c.firstName} ${c.lastName} ${c.email} ${c.company}`.toLowerCase().includes(search.toLowerCase())
  );

  const filteredCompanies = companies.filter(c =>
    `${c.name} ${c.domainName}`.toLowerCase().includes(search.toLowerCase())
  );

  const handleAddContact = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await fetch(apiUrl('/api/services/twenty/people'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...serviceHeaders() },
        body: JSON.stringify(contactForm),
      });
    } catch { /* silent */ }
    setContacts(prev => [...prev, { id: `new-${Date.now()}`, ...contactForm, createdAt: new Date().toISOString() }]);
    setShowAddContact(false);
    setContactForm({ firstName: '', lastName: '', email: '', phone: '', company: '' });
    setSubmitting(false);
  };

  const handleAddCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await fetch(apiUrl('/api/services/twenty/companies'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...serviceHeaders() },
        body: JSON.stringify({ ...companyForm, employees: parseInt(companyForm.employees) || 0 }),
      });
    } catch { /* silent */ }
    setCompanies(prev => [...prev, { id: `new-${Date.now()}`, ...companyForm, employees: parseInt(companyForm.employees) || 0, createdAt: new Date().toISOString() }]);
    setShowAddCompany(false);
    setCompanyForm({ name: '', domainName: '', employees: '', address: '' });
    setSubmitting(false);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">CRM</h1>
          <p className="text-gray-500 text-sm mt-1">Manage contacts and relationships</p>
        </div>
        <button
          onClick={() => tab === 'Contacts' ? setShowAddContact(true) : setShowAddCompany(true)}
          className="btn-primary"
        >
          <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          {tab === 'Contacts' ? 'Add Contact' : 'Add Company'}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="stat-card">
          <p className="text-sm font-medium text-gray-500">Total Contacts</p>
          {loading ? <div className="skeleton h-8 w-12 mt-1" /> : <p className="text-2xl font-bold text-gray-900 mt-1">{contacts.length}</p>}
        </div>
        <div className="stat-card">
          <p className="text-sm font-medium text-gray-500">Companies</p>
          {loading ? <div className="skeleton h-8 w-12 mt-1" /> : <p className="text-2xl font-bold text-gray-900 mt-1">{companies.length}</p>}
        </div>
        <div className="stat-card">
          <p className="text-sm font-medium text-gray-500">New This Month</p>
          {loading ? <div className="skeleton h-8 w-12 mt-1" /> : (
            <p className="text-2xl font-bold text-green-600 mt-1">
              {contacts.filter(c => new Date(c.createdAt).getMonth() === new Date().getMonth()).length}
            </p>
          )}
        </div>
        <div className="stat-card">
          <p className="text-sm font-medium text-gray-500">Active Relationships</p>
          {loading ? <div className="skeleton h-8 w-12 mt-1" /> : <p className="text-2xl font-bold text-brand-600 mt-1">{contacts.length + companies.length}</p>}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-6">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                tab === t ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t}
            </button>
          ))}
        </nav>
      </div>

      {/* Search */}
      <div className="card p-4">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder={tab === 'Contacts' ? 'Search contacts...' : 'Search companies...'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-9"
          />
        </div>
      </div>

      {/* Contacts Table */}
      {tab === 'Contacts' && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="table-header">Name</th>
                  <th className="table-header">Email</th>
                  <th className="table-header">Phone</th>
                  <th className="table-header">Company</th>
                  <th className="table-header">Added</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      <td className="table-cell"><div className="skeleton h-4 w-32" /></td>
                      <td className="table-cell"><div className="skeleton h-4 w-36" /></td>
                      <td className="table-cell"><div className="skeleton h-4 w-28" /></td>
                      <td className="table-cell"><div className="skeleton h-4 w-28" /></td>
                      <td className="table-cell"><div className="skeleton h-4 w-20" /></td>
                    </tr>
                  ))
                ) : filteredContacts.length > 0 ? (
                  filteredContacts.map((c) => (
                    <tr key={c.id} className="hover:bg-gray-50">
                      <td className="table-cell">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center">
                            <span className="text-xs font-medium text-brand-700">
                              {c.firstName?.[0]}{c.lastName?.[0]}
                            </span>
                          </div>
                          <span className="font-medium text-gray-900">{c.firstName} {c.lastName}</span>
                        </div>
                      </td>
                      <td className="table-cell text-gray-500">{c.email}</td>
                      <td className="table-cell text-gray-500">{c.phone || '-'}</td>
                      <td className="table-cell text-gray-500">{c.company || '-'}</td>
                      <td className="table-cell text-gray-400 text-sm">{formatDate(c.createdAt)}</td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan={5} className="px-6 py-8 text-center text-sm text-gray-500">No contacts found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Companies Table */}
      {tab === 'Companies' && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="table-header">Company</th>
                  <th className="table-header">Domain</th>
                  <th className="table-header">Employees</th>
                  <th className="table-header">Location</th>
                  <th className="table-header">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i}>
                      <td className="table-cell"><div className="skeleton h-4 w-36" /></td>
                      <td className="table-cell"><div className="skeleton h-4 w-28" /></td>
                      <td className="table-cell"><div className="skeleton h-4 w-12" /></td>
                      <td className="table-cell"><div className="skeleton h-4 w-24" /></td>
                      <td className="table-cell"><div className="skeleton h-4 w-20" /></td>
                    </tr>
                  ))
                ) : filteredCompanies.length > 0 ? (
                  filteredCompanies.map((c) => (
                    <tr key={c.id} className="hover:bg-gray-50">
                      <td className="table-cell font-medium text-gray-900">{c.name}</td>
                      <td className="table-cell text-brand-600 text-sm">{c.domainName || '-'}</td>
                      <td className="table-cell text-gray-500">{c.employees || '-'}</td>
                      <td className="table-cell text-gray-500">{c.address || '-'}</td>
                      <td className="table-cell text-gray-400 text-sm">{formatDate(c.createdAt)}</td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan={5} className="px-6 py-8 text-center text-sm text-gray-500">No companies found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Contact Modal */}
      {showAddContact && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowAddContact(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md p-6 mx-4">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-gray-900">Add Contact</h2>
              <button onClick={() => setShowAddContact(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleAddContact} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                  <input className="input" value={contactForm.firstName} onChange={(e) => setContactForm({ ...contactForm, firstName: e.target.value })} required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                  <input className="input" value={contactForm.lastName} onChange={(e) => setContactForm({ ...contactForm, lastName: e.target.value })} required />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input className="input" type="email" value={contactForm.email} onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })} required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input className="input" value={contactForm.phone} onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Company</label>
                <input className="input" value={contactForm.company} onChange={(e) => setContactForm({ ...contactForm, company: e.target.value })} />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowAddContact(false)} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={submitting} className="btn-primary flex-1 disabled:opacity-50">{submitting ? 'Adding...' : 'Add Contact'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Company Modal */}
      {showAddCompany && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowAddCompany(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md p-6 mx-4">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-gray-900">Add Company</h2>
              <button onClick={() => setShowAddCompany(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleAddCompany} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
                <input className="input" value={companyForm.name} onChange={(e) => setCompanyForm({ ...companyForm, name: e.target.value })} required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Domain</label>
                <input className="input" value={companyForm.domainName} onChange={(e) => setCompanyForm({ ...companyForm, domainName: e.target.value })} placeholder="example.com" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Employees</label>
                <input className="input" type="number" value={companyForm.employees} onChange={(e) => setCompanyForm({ ...companyForm, employees: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                <input className="input" value={companyForm.address} onChange={(e) => setCompanyForm({ ...companyForm, address: e.target.value })} placeholder="City, State" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowAddCompany(false)} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={submitting} className="btn-primary flex-1 disabled:opacity-50">{submitting ? 'Adding...' : 'Add Company'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
