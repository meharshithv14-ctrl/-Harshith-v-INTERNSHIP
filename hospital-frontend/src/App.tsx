/**
 * Hospital Management System — App.tsx  v3.1
 * ════════════════════════════════════════════════
 *
 * NEW in v3.1
 *  • Lab Tests view — doctor can add, view & update test results per visit
 *  • Chronic Disease Chart — SVG line chart showing score trend over time
 *  • Chronic chart available from doctor panel AND from summary modal
 *  • Notification bell — shows pending prescriptions + pending lab tests count
 *  • .env-aware API_BASE (falls back to localhost:5000 in dev)
 *
 * v3.0 features
 *  • 5-theme runtime switching (Midnight / Aurora / Daybreak / Forest / Ember)
 *  • Doctor: interactive split-panel patient browser with full details
 *  • Doctor: visit history accordions with vital signs
 *  • Doctor: chronic disease progress rings (SVG) + trend mini-bars
 *  • Doctor: progress entry modal — slider 0-100 + vitals logging
 *  • Doctor: summary sheet modal — printable, editable by Doctor & Admin
 *  • All roles: theme preference persisted in localStorage
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Activity, User, Users, FileText, PlusCircle, LogOut,
  Shield, Stethoscope, Heart, Upload, Download, FileImage, UserPlus,
  Pill, CheckCircle, Clock, Calendar, Phone, Mail, MapPin,
  Eye, EyeOff, AlertCircle, Edit2, Trash2, Key, X, Save,
  ClipboardList, ScanLine, ChevronDown, ChevronUp, BookOpen,
  Sun, Moon, Palette, TrendingUp, BarChart2, Zap,
  FlaskConical, Bell, LineChart, RefreshCw, Plus, ChevronLeft, ChevronRight,
} from 'lucide-react';
import './App.css';

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────
// In dev (npm run dev): Vite proxy forwards /api → localhost:5000
// In production (served by Flask): /api hits Flask directly
const API = (import.meta.env.VITE_API_URL as string) || '/api';
const SCAN_TYPES = ['X-Ray','MRI','CT Scan','Ultrasound','PET Scan','Mammography','Fluoroscopy'];

// ─────────────────────────────────────────────
// Theme System
// ─────────────────────────────────────────────
export type ThemeKey = 'midnight' | 'aurora' | 'daybreak' | 'forest' | 'ember';

interface ThemeDef {
  key:   ThemeKey;
  label: string;
  icon:  React.ReactNode;
  swatch: string;  // CSS gradient for the swatch circle
}

const THEMES: ThemeDef[] = [
  { key:'midnight', label:'Midnight',  icon:<Moon   size={13}/>, swatch:'linear-gradient(135deg,#06b6d4,#8b5cf6)' },
  { key:'aurora',   label:'Aurora',    icon:<Zap    size={13}/>, swatch:'linear-gradient(135deg,#c084fc,#f472b6)' },
  { key:'daybreak', label:'Daybreak',  icon:<Sun    size={13}/>, swatch:'linear-gradient(135deg,#0284c7,#7c3aed)' },
  { key:'forest',   label:'Forest',    icon:<Activity size={13}/>, swatch:'linear-gradient(135deg,#10b981,#f59e0b)' },
  { key:'ember',    label:'Ember',     icon:<Zap    size={13}/>, swatch:'linear-gradient(135deg,#f59e0b,#f43f5e)' },
];

function useTheme(): [ThemeKey, (k: ThemeKey) => void] {
  const [theme, setThemeState] = useState<ThemeKey>(
    () => (localStorage.getItem('hms_theme') as ThemeKey) || 'midnight'
  );
  const setTheme = useCallback((k: ThemeKey) => {
    document.documentElement.setAttribute('data-theme', k);
    localStorage.setItem('hms_theme', k);
    setThemeState(k);
  }, []);
  useEffect(() => { document.documentElement.setAttribute('data-theme', theme); }, [theme]);
  return [theme, setTheme];
}

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
interface AuthUser {
  user_id: number; username: string; email: string; role: string;
  patient_id?: number|null; doctor_id?: number|null;
  pharmacist_id?: number|null; radiologist_id?: number|null;
  receptionist_id?: number|null;
}

interface Patient {
  PatientID?: number; PatientName: string; Email: string; Gender: string;
  DateOfBirth: string; PhoneNumber: string; Address: string; BloodGroup: string;
  EmergencyContact?: string; EmergencyContactName?: string;
}

interface Doctor {
  DoctorID: number;
  DoctorName: string;
  Email: string;
  Specialty: string;
  PhoneNumber: string;
  LicenseNumber?: string;
  YearsOfExperience?: number;
}

interface Visit {
  VisitID?: number; PatientID: number; DoctorID: number; ReasonForVisit: string;
  VitalSigns?: string; Notes?: string; Status: string;
  PatientName?: string; DoctorName?: string; VisitDate?: string;
}

interface Prescription {
  PrescriptionID: number; PatientName: string; MedicineName: string; Dosage: string;
  Frequency: string; Duration: string; Instructions?: string;
  IsDispensed: boolean; DispensedDate?: string; DoctorName: string; VisitDate: string;
}

interface MedicalFile {
  FileID: number; FileType: string; FileName: string; FileSize: number;
  Description: string; UploadedAt: string; UploadedByUsername: string;
}

interface DashboardStats {
  total_patients: number; total_doctors: number; total_radiologists: number;
  today_visits: number; pending_prescriptions: number; pending_tests: number;
}

interface DoctorRecord {
  PatientID?: number; PatientName: string; BloodGroup: string;
  DoctorName: string; Specialty: string; VisitID: number; VisitDate: string;
  ReasonForVisit: string; VisitStatus: string; VitalSigns?: string; VisitNotes?: string;
  DiagnosisName?: string; DiagnosisDesc?: string; IsChronic?: boolean; Severity?: string;
  MedicineName?: string; Dosage?: string; Frequency?: string; Duration?: string;
  Instructions?: string; IsDispensed?: boolean;
}

interface PatientNoCreds {
  PatientID: number; PatientName: string; Email: string; Gender: string;
  PhoneNumber: string; BloodGroup: string; CreatedAt: string;
}

interface ScanFile {
  FileID: number; FileType: string; FileName: string; FileSize: number;
  Description: string; UploadedAt: string; UploadedByUsername: string;
  PatientName?: string; BloodGroup?: string;
}

interface PatientSummary {
  patient: Patient & { SummaryNotes: string; NotesUpdatedBy: string; UpdatedAt?: string; };
  visits: Array<{
    VisitID: number; VisitDate: string; ReasonForVisit: string;
    VitalSigns?: string; Notes?: string; Status: string;
    DoctorName: string; Specialty: string;
  }>;
  diagnoses: Array<{
    DiagnosisName: string; Description?: string;
    Severity: string; IsChronic: boolean; VisitDate: string;
  }>;
  prescriptions: Array<{
    MedicineName: string; Dosage: string; Frequency: string; Duration: string;
    Instructions?: string; IsDispensed: boolean; DoctorName: string; VisitDate: string;
  }>;
  files: MedicalFile[];
  chronic_scores?: Array<{ DiagnosisName: string; LatestScore: number; LastUpdated: string; DoctorName: string; }>;
}

interface ChronicEntry {
  ProgressID: number; DiagnosisName: string; RecordDate: string;
  ProgressScore: number; BloodPressure?: string; BloodSugar?: string;
  Weight?: number; Notes?: string; DoctorName: string;
}

interface LabTest {
  TestID: number; VisitID: number; TestName: string; TestType: string;
  Status: string; Results?: string; ResultDate?: string;
  CreatedAt: string; VisitDate?: string; PatientName?: string;
}

interface Appointment {
  AppointmentID: number; RequestedDate: string; TimeSlot: string; Status: string;
  Reason: string; PatientNotes?: string; ReceptionistNotes?: string; CreatedAt: string;
  PatientID?: number; PatientName?: string; PhoneNumber?: string; BloodGroup?: string; Gender?: string;
  DoctorID?: number; DoctorName?: string; Specialty?: string;
  HandledByName?: string;
}

interface AdminPatientFull {
  patient: Record<string,any>;
  visits: Record<string,any>[];
  diagnoses: Record<string,any>[];
  prescriptions: Record<string,any>[];
  lab_tests: Record<string,any>[];
  chronic_progress: Record<string,any>[];
  files: Record<string,any>[];
}

interface RegisterForm {
  username: string; password: string; email: string; name: string;
  gender: string; dob: string; phone: string; address: string;
  blood_group: string; emergency_contact: string; emergency_contact_name: string;
}

interface RoleEntity {
  role: string; color: string; glow: string; bg: string; border: string;
  demoUser: string; demoPass: string; label: string; desc: string;
  icon: React.ReactNode;
}

const ENTITIES: RoleEntity[] = [
  { role:'Doctor',       color:'#06b6d4', glow:'rgba(6,182,212,.35)',   bg:'rgba(6,182,212,.08)',   border:'rgba(6,182,212,.3)',
    demoUser:'dr_anil',    demoPass:'doctor123',   label:'Clinical Staff',   desc:'Manage visits, diagnoses & prescriptions',
    icon:<Stethoscope size={22}/> },
  { role:'Patient',      color:'#8b5cf6', glow:'rgba(139,92,246,.35)',   bg:'rgba(139,92,246,.08)',  border:'rgba(139,92,246,.3)',
    demoUser:'rahul_p',    demoPass:'password123', label:'Patient Portal',   desc:'View records, reports & prescriptions',
    icon:<User size={22}/> },
  { role:'Receptionist', color:'#06d6a0', glow:'rgba(6,214,160,.35)',    bg:'rgba(6,214,160,.08)',   border:'rgba(6,214,160,.3)',
    demoUser:'rec_priya',  demoPass:'recept123',   label:'Front Desk',       desc:'Manage appointments & assign doctors',
    icon:<Calendar size={22}/> },
  { role:'Radiologist',  color:'#f43f5e', glow:'rgba(244,63,94,.35)',    bg:'rgba(244,63,94,.08)',   border:'rgba(244,63,94,.3)',
    demoUser:'rad_priya',  demoPass:'scan1234',    label:'Radiology Dept',   desc:'Upload & manage patient scans',
    icon:<ScanLine size={22}/> },
  { role:'Pharmacist',   color:'#10b981', glow:'rgba(16,185,129,.35)',   bg:'rgba(16,185,129,.08)',  border:'rgba(16,185,129,.3)',
    demoUser:'pharm_amit', demoPass:'pharmacy123', label:'Pharmacy',         desc:'Dispense & track prescriptions',
    icon:<Pill size={22}/> },
  { role:'Admin',        color:'#f59e0b', glow:'rgba(245,158,11,.35)',   bg:'rgba(245,158,11,.08)',  border:'rgba(245,158,11,.3)',
    demoUser:'admin',      demoPass:'admin123',    label:'Administration',   desc:'Manage staff, patients & system data',
    icon:<Shield size={22}/> },
];

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
function decodeJWT(token: string): AuthUser|null {
  try {
    const b64 = token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/');
    return JSON.parse(decodeURIComponent(atob(b64).split('').map(c=>'%'+('00'+c.charCodeAt(0).toString(16)).slice(-2)).join('')));
  } catch { return null; }
}

function scoreColor(s: number): string {
  return s >= 70 ? '#10b981' : s >= 40 ? '#f59e0b' : '#f43f5e';
}

function sevClass(s?: string): string {
  return s === 'Severe' ? 'sev-badge-severe' : s === 'Moderate' ? 'sev-badge-moderate' : 'sev-badge-mild';
}

function fmtDate(d?: string): string {
  return d ? new Date(d).toLocaleDateString() : '---';
}

function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase();
}

function parseVitals(raw?: string): Record<string,string> {
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { return {}; }
}

// ─────────────────────────────────────────────
// ProgressRing SVG Component
// ─────────────────────────────────────────────
function ProgressRing({ score, size = 80, stroke = 8 }: { score: number; size?: number; stroke?: number }) {
  const r    = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const off  = circ - (score / 100) * circ;
  const c    = scoreColor(score);
  const fs   = Math.round(size * 0.20);

  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(148,163,184,0.1)" strokeWidth={stroke}/>
        <circle
          cx={size/2} cy={size/2} r={r} fill="none"
          stroke={c} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={off}
          style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(0.16,1,0.3,1)' }}
        />
      </svg>
      <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' }}>
        <span style={{ fontFamily:"'Syne',sans-serif", fontSize: fs, fontWeight:800, color: c, lineHeight:1 }}>{score}%</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// ThemeSwitcher Component
// ─────────────────────────────────────────────
function ThemeSwitcher({ theme, setTheme }: { theme: ThemeKey; setTheme: (k: ThemeKey) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  const current = THEMES.find(t => t.key === theme)!;

  return (
    <div ref={ref} className="theme-switcher">
      <button className={`theme-toggle-btn ${open ? 'open' : ''}`} onClick={() => setOpen(v => !v)}>
        <Palette size={14}/> {current.label}
        <span className="chevron"><ChevronDown size={12}/></span>
      </button>
      {open && (
        <div className="theme-panel">
          <div className="theme-panel-label">Color Theme</div>
          {THEMES.map(t => (
            <div key={t.key} className={`theme-option ${theme === t.key ? 'active' : ''}`}
              onClick={() => { setTheme(t.key); setOpen(false); }}>
              <span className="theme-swatch" style={{ background: t.swatch }}/>
              {t.icon} {t.label}
              <span className="checkmark"><CheckCircle size={13}/></span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Modal wrapper
// ─────────────────────────────────────────────
function Modal({ title, onClose, wide, xlwide, children, extraHeaderActions }:
  { title: string; onClose: ()=>void; wide?: boolean; xlwide?: boolean; children: React.ReactNode; extraHeaderActions?: React.ReactNode }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className={`modal-box ${xlwide ? 'xlwide' : wide ? 'wide' : ''}`} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">{title}</h3>
          <div style={{ display:'flex', alignItems:'center', gap:'0.5rem' }}>
            {extraHeaderActions}
            <button className="modal-close" onClick={onClose}><X size={18}/></button>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Patient Summary Sheet Modal
// ─────────────────────────────────────────────
function SummaryModal({ patientId, patientName, role, token, onClose }:
  { patientId: number; patientName: string; role: string; token: string; onClose: ()=>void }) {
  const [summary, setSummary] = useState<PatientSummary|null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr]         = useState('');
  const [notes, setNotes]     = useState('');
  const [saving, setSaving]   = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [openVisit, setOpenVisit] = useState<number|null>(null);
  const canEdit = role === 'Admin' || role === 'Doctor';

  useEffect(() => {
    fetch(`${API}/patients/${patientId}/summary`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { setSummary(d); setNotes(d.patient?.SummaryNotes ?? ''); })
      .catch(() => setErr('Failed to load summary'))
      .finally(() => setLoading(false));
  }, [patientId]);

  async function saveNotes() {
    setSaving(true); setSaveMsg('');
    try {
      const res = await fetch(`${API}/patients/${patientId}/summary-notes`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setSaveMsg('Notes saved successfully.');
      if (summary) setSummary({ ...summary, patient: { ...summary.patient, SummaryNotes: notes } });
    } catch (e: any) { setSaveMsg(`Error: ${e.message}`); }
    finally { setSaving(false); }
  }

  const SectionLabel = ({ text }: { text: string }) => (
    <div className="summary-section-label">{text}</div>
  );

  if (loading) return (
    <Modal title="Patient Summary" onClose={onClose} wide>
      <div style={{ textAlign:'center', padding:'3rem', color:'var(--text-dim)' }}>Loading summary...</div>
    </Modal>
  );

  if (err || !summary) return (
    <Modal title="Patient Summary" onClose={onClose} wide>
      <div style={{ color:'var(--rose)', padding:'1rem' }}>{err || 'No data'}</div>
    </Modal>
  );

  const p = summary.patient;

  return (
    <Modal
      title={`Summary Sheet — ${patientName}`}
      onClose={onClose}
      wide
      extraHeaderActions={
        <button className="action-btn" style={{ padding:'0.45rem 0.875rem', fontSize:'0.78rem', marginTop:0 }}
          onClick={() => window.print()}>
          🖨 Print
        </button>
      }
    >
      {!canEdit && (
        <div className="summary-readonly-banner">
          <Eye size={14}/> This summary is read-only. Contact your doctor or administrator to update clinical notes.
        </div>
      )}

      {/* Demographics */}
      <div className="summary-section">
        <SectionLabel text="Patient Demographics"/>
        <div className="demographics-grid">
          {[
            ['Name',          p.PatientName],
            ['Blood Group',   p.BloodGroup],
            ['Gender',        p.Gender],
            ['Date of Birth', fmtDate(p.DateOfBirth)],
            ['Phone',         p.PhoneNumber],
            ['Email',         p.Email],
          ].map(([k,v]) => (
            <div key={k} className="demo-cell">
              <div className="demo-cell-label">{k}</div>
              <div className="demo-cell-value" style={{ fontSize: k === 'Email' ? '0.78rem' : undefined }}>{v}</div>
            </div>
          ))}
          {p.EmergencyContactName && (
            <div className="demo-cell" style={{ gridColumn: 'span 2' }}>
              <div className="demo-cell-label">Emergency Contact</div>
              <div className="demo-cell-value">{p.EmergencyContactName} — {p.EmergencyContact}</div>
            </div>
          )}
          {p.Address && (
            <div className="demo-cell" style={{ gridColumn: 'span 1' }}>
              <div className="demo-cell-label">Address</div>
              <div className="demo-cell-value" style={{ fontSize:'0.82rem' }}>{p.Address}</div>
            </div>
          )}
        </div>
      </div>

      {/* Chronic Progress Rings */}
      {summary.chronic_scores && summary.chronic_scores.length > 0 && (
        <div className="summary-section">
          <SectionLabel text="Chronic Disease Progress"/>
          <div style={{ background:'var(--raised)', border:'1px solid var(--border)', borderRadius:'var(--r-md)', padding:'1rem' }}>
            <div className="chronic-rings-container">
              {summary.chronic_scores.map((cs, i) => (
                <div key={i} className="ring-item">
                  <ProgressRing score={Math.round(cs.LatestScore)} size={70} stroke={7}/>
                  <div className="ring-name">{cs.DiagnosisName}</div>
                  <div className="ring-updated">{fmtDate(cs.LastUpdated)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Clinical Notes */}
      <div className="summary-section">
        <SectionLabel text="Clinical Summary Notes"/>
        {canEdit ? (
          <div>
            <textarea className="summary-notes-area" rows={5} value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Add clinical summary notes here..."/>
            <div style={{ display:'flex', alignItems:'center', gap:'0.75rem', marginTop:'0.5rem' }}>
              <button onClick={saveNotes} disabled={saving} className="submit-btn"
                style={{ width:'auto', padding:'0.55rem 1.25rem', marginTop:0, display:'flex', alignItems:'center', gap:'0.4rem' }}>
                <Save size={14}/> {saving ? 'Saving...' : 'Save Notes'}
              </button>
              {saveMsg && <span style={{ fontSize:'0.82rem', color: saveMsg.startsWith('Error') ? 'var(--rose)' : 'var(--emerald)' }}>{saveMsg}</span>}
              {p.NotesUpdatedBy && <span style={{ fontSize:'0.74rem', color:'var(--text-dim)', marginLeft:'auto' }}>Last by {p.NotesUpdatedBy}</span>}
            </div>
          </div>
        ) : (
          <div style={{ background:'var(--raised)', border:'1px solid var(--border)', borderRadius:'var(--r-md)', padding:'0.875rem 1rem', minHeight:72 }}>
            <p style={{ margin:0, color: notes ? 'var(--text-mid)' : 'var(--text-dim)', fontSize:'0.88rem', lineHeight:1.6, whiteSpace:'pre-wrap' }}>
              {notes || 'No clinical notes recorded.'}
            </p>
          </div>
        )}
      </div>

      {/* Visit Timeline */}
      <div className="summary-section">
        <SectionLabel text={`Visit History (${summary.visits.length})`}/>
        {summary.visits.length === 0
          ? <p style={{ color:'var(--text-dim)', fontSize:'0.85rem' }}>No visits recorded.</p>
          : summary.visits.map((v, i) => {
              const vitals = parseVitals(v.VitalSigns);
              return (
                <div key={i} className="visit-accordion">
                  <div className={`visit-header ${openVisit === i ? 'open' : ''}`}
                    onClick={() => setOpenVisit(openVisit === i ? null : i)}>
                    <div className="visit-header-left">
                      <div className="visit-status-dot"
                        style={{ background: v.Status === 'Completed' ? '#10b981' : v.Status === 'In Progress' ? '#f59e0b' : '#475569' }}/>
                      <div className="visit-header-info">
                        <div className="visit-reason">{v.ReasonForVisit}</div>
                        <div className="visit-meta">{v.DoctorName} · {v.Specialty} · {fmtDate(v.VisitDate)}</div>
                      </div>
                    </div>
                    <span className={`visit-chevron ${openVisit === i ? 'open' : ''}`}><ChevronDown size={16}/></span>
                  </div>
                  {openVisit === i && (
                    <div className="visit-body">
                      {Object.entries(vitals).length > 0 && (
                        <>
                          {vitals.bp     && <div className="vital-item"><div className="vital-label">BP</div>      <div className="vital-value">{vitals.bp}</div></div>}
                          {vitals.temp   && <div className="vital-item"><div className="vital-label">Temp</div>    <div className="vital-value">{vitals.temp}°F</div></div>}
                          {vitals.pulse  && <div className="vital-item"><div className="vital-label">Pulse</div>   <div className="vital-value">{vitals.pulse} bpm</div></div>}
                          {vitals.spo2   && <div className="vital-item"><div className="vital-label">SpO₂</div>    <div className="vital-value">{vitals.spo2}</div></div>}
                          {vitals.weight && <div className="vital-item"><div className="vital-label">Weight</div>  <div className="vital-value">{vitals.weight}</div></div>}
                        </>
                      )}
                      {v.Notes && <div className="visit-notes"><div className="vital-label" style={{ marginBottom:'0.3rem' }}>Clinical Notes</div>{v.Notes}</div>}
                    </div>
                  )}
                </div>
              );
            })
        }
      </div>

      {/* Diagnoses */}
      <div className="summary-section">
        <SectionLabel text={`Diagnoses (${summary.diagnoses.length})`}/>
        {summary.diagnoses.length === 0
          ? <p style={{ color:'var(--text-dim)', fontSize:'0.85rem' }}>No diagnoses recorded.</p>
          : summary.diagnoses.map((d, i) => (
            <div key={i} className="diagnosis-row">
              <div>
                <div className="diagnosis-name">{d.DiagnosisName}</div>
                {d.Description && <div className="diagnosis-desc">{d.Description}</div>}
                <div className="diagnosis-date">{fmtDate(d.VisitDate)}</div>
              </div>
              <div className="diagnosis-badges">
                <span className={`badge ${sevClass(d.Severity)}`}>{d.Severity}</span>
                {d.IsChronic && <span className="badge badge-chronic">Chronic</span>}
              </div>
            </div>
          ))
        }
      </div>

      {/* Prescriptions */}
      <div className="summary-section">
        <SectionLabel text={`Prescriptions (${summary.prescriptions.length})`}/>
        {summary.prescriptions.length === 0
          ? <p style={{ color:'var(--text-dim)', fontSize:'0.85rem' }}>No prescriptions recorded.</p>
          : (
            <div className="table-container" style={{ marginTop:0 }}>
              <table className="data-table">
                <thead><tr>
                  <th>Medicine</th><th>Dosage</th><th>Frequency</th><th>Duration</th><th>Doctor</th><th>Status</th>
                </tr></thead>
                <tbody>{summary.prescriptions.map((rx, i) => (
                  <tr key={i}>
                    <td>
                      <strong>{rx.MedicineName}</strong>
                      {rx.Instructions && <p style={{ margin:'0.1rem 0 0', fontSize:'0.74rem', color:'var(--text-dim)' }}>{rx.Instructions}</p>}
                    </td>
                    <td>{rx.Dosage}</td><td>{rx.Frequency}</td><td>{rx.Duration}</td>
                    <td>{rx.DoctorName}</td>
                    <td>
                      <span className={`status-badge ${rx.IsDispensed ? 'dispensed' : 'pending'}`}>
                        {rx.IsDispensed ? <><CheckCircle size={12}/> Dispensed</> : <><Clock size={12}/> Pending</>}
                      </span>
                    </td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )
        }
      </div>

      {/* Files */}
      <div className="summary-section">
        <SectionLabel text={`Files & Scans (${summary.files.length})`}/>
        {summary.files.length === 0
          ? <p style={{ color:'var(--text-dim)', fontSize:'0.85rem' }}>No files uploaded.</p>
          : (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:'0.6rem' }}>
              {summary.files.map(f => (
                <div key={f.FileID} style={{ background:'var(--raised)', border:'1px solid var(--border)', borderRadius:'var(--r-md)', padding:'0.75rem 1rem', display:'flex', alignItems:'center', gap:'0.75rem' }}>
                  <div style={{ width:36, height:36, borderRadius:9, background:'var(--accent-dim)', border:'1px solid rgba(6,182,212,.2)', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--accent)', flexShrink:0 }}>
                    <FileImage size={16}/>
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <p style={{ margin:0, fontWeight:700, fontSize:'0.82rem', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{f.FileName}</p>
                    <p style={{ margin:0, fontSize:'0.72rem', color:'var(--text-dim)' }}>{f.FileType} · {(f.FileSize/1024/1024).toFixed(1)} MB · {fmtDate(f.UploadedAt)}</p>
                  </div>
                  <a href={`${API}/files/download/${f.FileID}`} download style={{ color:'var(--accent)', display:'flex' }} title="Download"><Download size={15}/></a>
                </div>
              ))}
            </div>
          )
        }
      </div>
    </Modal>
  );
}

// ─────────────────────────────────────────────
// Chronic Progress Modal
// ─────────────────────────────────────────────
function ChronicProgressModal({ patientId, patientName, token, doctorId, onClose }:
  { patientId: number; patientName: string; token: string; doctorId?: number; onClose: ()=>void }) {
  const [entries, setEntries]         = useState<ChronicEntry[]>([]);
  const [loading, setLoading]         = useState(true);
  const [saving, setSaving]           = useState(false);
  const [msg, setMsg]                 = useState('');
  const [selDiag, setSelDiag]         = useState('');
  const [uniqueDiags, setUniqueDiags] = useState<string[]>([]);
  const [form, setForm]               = useState({ diagnosis_name:'', progress_score:50, blood_pressure:'', notes:'' });

  const load = useCallback(() => {
    fetch(`${API}/chronic-progress/${patientId}`, { headers:{ Authorization:`Bearer ${token}` } })
      .then(r => r.json())
      .then((data: ChronicEntry[]) => {
        setEntries(data);
        const diags = [...new Set(data.map(e => e.DiagnosisName))];
        setUniqueDiags(diags);
        if (diags.length > 0 && !selDiag) setSelDiag(diags[0]);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [patientId, token]);

  useEffect(() => { load(); }, [load]);

  async function save() {
    if (!form.diagnosis_name) return setMsg('Please enter a diagnosis name.');
    setSaving(true); setMsg('');
    try {
      const res = await fetch(`${API}/chronic-progress`, {
        method:'POST',
        headers:{ Authorization:`Bearer ${token}`, 'Content-Type':'application/json' },
        body: JSON.stringify({ patient_id: patientId, ...form }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setMsg('✅ Progress entry saved!');
      setForm(f => ({ ...f, blood_pressure:'', notes:'', progress_score:50 }));
      load();
    } catch(e:any) { setMsg(`Error: ${e.message}`); }
    finally { setSaving(false); }
  }

  const filtered = entries.filter(e => !selDiag || e.DiagnosisName === selDiag);

  return (
    <Modal title={`📈 Chronic Progress — ${patientName}`} onClose={onClose} wide>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1.5rem' }}>
        {/* Form */}
        <div>
          <p style={{ fontSize:'0.72rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'.08em', color:'var(--text-dim)', marginBottom:'0.875rem' }}>Record New Entry</p>
          <div className="progress-form">
            <div className="form-group">
              <label>Condition / Diagnosis *</label>
              <input type="text" value={form.diagnosis_name} list="diag-list"
                onChange={e => setForm(f => ({...f, diagnosis_name: e.target.value}))}
                placeholder="e.g. Hypertension"/>
              <datalist id="diag-list">{uniqueDiags.map(d => <option key={d} value={d}/>)}</datalist>
            </div>

            <div>
              <label style={{ fontSize:'0.78rem', fontWeight:600, letterSpacing:'.06em', textTransform:'uppercase', color:'var(--text-mid)', display:'block', marginBottom:'0.5rem' }}>
                Progress Score: <span style={{ color: scoreColor(form.progress_score), fontFamily:"'Syne',sans-serif", fontWeight:800 }}>{form.progress_score}%</span>
              </label>
              <input type="range" className="range-slider" min={0} max={100} value={form.progress_score}
                onChange={e => setForm(f => ({...f, progress_score: parseInt(e.target.value)}))}/>
              <div className="range-labels"><span>0% — Critical</span><span>100% — Resolved</span></div>
            </div>

            <div className="progress-score-display">
              <ProgressRing score={form.progress_score} size={80} stroke={8}/>
              <div className="progress-score-label" style={{ marginTop:'0.5rem' }}>
                {form.progress_score >= 70 ? 'Good Progress' : form.progress_score >= 40 ? 'Moderate Progress' : 'Needs Attention'}
              </div>
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.875rem' }}>
              <div className="form-group">
                <label>Blood Pressure</label>
                <input type="text" value={form.blood_pressure} placeholder="e.g. 130/85"
                  onChange={e => setForm(f => ({...f, blood_pressure: e.target.value}))}/>
              </div>
              <div className="form-group">
                <label>Score (0–100)</label>
                <input type="number" value={form.progress_score} min={0} max={100}
                  onChange={e => setForm(f => ({...f, progress_score: Math.min(100,Math.max(0,parseInt(e.target.value)||0))}))}/>
              </div>
            </div>

            <div className="form-group">
              <label>Clinical Notes</label>
              <textarea value={form.notes} rows={3} placeholder="Observations, symptoms, improvements..."
                onChange={e => setForm(f => ({...f, notes: e.target.value}))}/>
            </div>

            <button className="submit-btn" onClick={save} disabled={saving}>
              <TrendingUp size={15}/> {saving ? 'Saving...' : 'Save Progress Entry'}
            </button>
            {msg && <p style={{ fontSize:'0.82rem', textAlign:'center', color: msg.startsWith('Error') ? 'var(--rose)' : 'var(--emerald)', margin:0 }}>{msg}</p>}
          </div>
        </div>

        {/* History */}
        <div>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'0.875rem' }}>
            <p style={{ fontSize:'0.72rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'.08em', color:'var(--text-dim)', margin:0 }}>Progress History</p>
            {uniqueDiags.length > 1 && (
              <select value={selDiag} onChange={e => setSelDiag(e.target.value)}
                style={{ fontSize:'0.78rem', background:'var(--bg-3)', border:'1px solid var(--border)', borderRadius:'var(--r-sm)', color:'var(--text-mid)', padding:'0.25rem 0.5rem' }}>
                {uniqueDiags.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            )}
          </div>

          {loading ? (
            <p style={{ color:'var(--text-dim)', fontSize:'0.85rem' }}>Loading...</p>
          ) : filtered.length === 0 ? (
            <div className="empty-state" style={{ padding:'2rem' }}>
              <BarChart2 size={36} style={{ opacity:0.3 }}/>
              <p style={{ color:'var(--text-dim)', fontSize:'0.85rem' }}>No entries yet</p>
            </div>
          ) : (
            <div className="progress-history">
              {filtered.map((e, i) => (
                <div key={e.ProgressID} className="progress-entry">
                  <div className="pe-score" style={{ color: scoreColor(e.ProgressScore) }}>{Math.round(e.ProgressScore)}%</div>
                  <div className="pe-info">
                    <div className="pe-note">{e.Notes || 'No notes'}</div>
                    <div className="pe-date">{fmtDate(e.RecordDate)} · {e.DoctorName}</div>
                    {(e.BloodPressure || e.BloodSugar) && (
                      <div className="pe-vitals">
                        {e.BloodPressure && `BP: ${e.BloodPressure}`}
                        {e.BloodPressure && e.BloodSugar && ' · '}
                        {e.BloodSugar && `Sugar: ${e.BloodSugar}`}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

// ─────────────────────────────────────────────
// Chronic Charts — fetches & renders per-disease line charts
// ─────────────────────────────────────────────
function ChronicChartsInline({ patientId, token }: { patientId: number; token: string }) {
  const [entriesByDiag, setEntriesByDiag] = useState<Record<string, ChronicEntry[]>>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch(`${API}/chronic-progress/${patientId}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then((data: ChronicEntry[]) => {
        const grouped: Record<string, ChronicEntry[]> = {};
        data.forEach(e => {
          if (!grouped[e.DiagnosisName]) grouped[e.DiagnosisName] = [];
          grouped[e.DiagnosisName].push(e);
        });
        setEntriesByDiag(grouped);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, [patientId, token]);

  if (!loaded || Object.keys(entriesByDiag).length === 0) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.75rem' }}>
      {Object.entries(entriesByDiag).map(([diag, entries]) =>
        entries.length >= 2 ? (
          <ChronicLineChart key={diag} diagName={diag} entries={entries}/>
        ) : null
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Doctor Patient Detail Panel
// ─────────────────────────────────────────────
function PatientDetailPanel({ patient, records, token, role, onOpenSummary, onOpenProgress }:
  { patient: Patient & { PatientID: number }; records: DoctorRecord[]; token: string; role: string;
    onOpenSummary: () => void; onOpenProgress: () => void }) {
  const [openVisit, setOpenVisit] = useState<number|null>(null);

  const patientRecords = records.filter(r => r.PatientID === patient.PatientID || r.PatientName === patient.PatientName);

  const age = new Date().getFullYear() - new Date(patient.DateOfBirth).getFullYear();

  // Derived: unique visits
  const visitMap = new Map<number, DoctorRecord>();
  patientRecords.forEach(r => { if (r.VisitID && !visitMap.has(r.VisitID)) visitMap.set(r.VisitID, r); });
  const visits = [...visitMap.values()];

  // Visit frequency per month
  const freqMap: Record<string, number> = {};
  visits.forEach(v => {
    const d = new Date(v.VisitDate);
    const k = `${d.getMonth()+1}/${String(d.getFullYear()).slice(2)}`;
    freqMap[k] = (freqMap[k] || 0) + 1;
  });
  const freqEntries = Object.entries(freqMap).slice(-6);
  const maxFreq = Math.max(...freqEntries.map(([,c]) => c), 1);

  // Unique diagnoses
  const diagMap = new Map<string, DoctorRecord>();
  patientRecords.forEach(r => { if (r.DiagnosisName && !diagMap.has(r.DiagnosisName)) diagMap.set(r.DiagnosisName, r); });
  const diagnoses = [...diagMap.values()];

  const chronicDiags = diagnoses.filter(d => d.IsChronic);

  // Unique prescriptions
  const rxMap = new Map<string, DoctorRecord>();
  patientRecords.forEach(r => { if (r.MedicineName && !rxMap.has(r.MedicineName)) rxMap.set(r.MedicineName, r); });
  const prescriptions = [...rxMap.values()];

  return (
    <>
      {/* Header */}
      <div className="patient-detail-header">
        <div className="patient-detail-identity">
          <div className="patient-avatar">{getInitials(patient.PatientName)}</div>
          <div>
            <div className="patient-detail-name">{patient.PatientName}</div>
            <div className="patient-detail-meta">{patient.Gender} · {age} yrs · DOB: {fmtDate(patient.DateOfBirth)}</div>
            <div style={{ display:'flex', gap:'0.35rem', marginTop:'0.35rem', flexWrap:'wrap' }}>
              <span className="badge badge-blood">{patient.BloodGroup}</span>
              {chronicDiags.length > 0 && <span className="badge badge-chronic">⚕ Chronic</span>}
              <span className="badge badge-accent">{visits.length} Visit{visits.length!==1?'s':''}</span>
            </div>
          </div>
        </div>
        <div className="patient-action-btns">
          {chronicDiags.length > 0 && (
            <button className="pab pab-progress" onClick={onOpenProgress}>
              <TrendingUp size={13}/> Record Progress
            </button>
          )}
          <button className="pab pab-summary" onClick={onOpenSummary}>
            <BookOpen size={13}/> Summary Sheet
          </button>
        </div>
      </div>

      {/* Info Grid */}
      <div className="info-grid-3">
        <div className="info-card">
          <div className="info-card-title">Contact</div>
          <div className="kv-pair"><div className="kv-label">Phone</div><div className="kv-value">{patient.PhoneNumber}</div></div>
          <div className="kv-pair"><div className="kv-label">Email</div><div className="kv-value" style={{ fontSize:'0.78rem' }}>{patient.Email}</div></div>
          <div className="kv-pair"><div className="kv-label">Address</div><div className="kv-value">{patient.Address}</div></div>
        </div>
        <div className="info-card">
          <div className="info-card-title">Emergency</div>
          <div className="kv-pair"><div className="kv-label">Name</div><div className="kv-value">{patient.EmergencyContactName || '—'}</div></div>
          <div className="kv-pair"><div className="kv-label">Phone</div><div className="kv-value">{patient.EmergencyContact || '—'}</div></div>
          <div className="kv-pair"><div className="kv-label">Blood</div><div className="kv-value" style={{ color:'var(--rose)', fontWeight:700 }}>{patient.BloodGroup}</div></div>
        </div>
        <div className="info-card">
          <div className="info-card-title">Visit Frequency</div>
          <div className="freq-bars">
            {freqEntries.map(([mo, cnt]) => (
              <div key={mo} className="freq-bar-group">
                <div className="freq-bar" style={{ height: Math.max(6, (cnt/maxFreq)*46) }}/>
                <span className="freq-label">{mo}</span>
              </div>
            ))}
            {freqEntries.length === 0 && <p style={{ fontSize:'0.75rem', color:'var(--text-dim)', margin:'auto' }}>No data</p>}
          </div>
          <p style={{ fontSize:'0.75rem', color:'var(--text-dim)', marginTop:'0.5rem' }}>{visits.length} total visit{visits.length!==1?'s':''}</p>
        </div>
      </div>

      {/* Chronic Progress Rings */}
      {chronicDiags.length > 0 && (
        <div className="section-block">
          <div className="section-header"><div className="section-title">Chronic Disease Progress</div></div>
          <div className="info-card" style={{ display:'flex', alignItems:'flex-start', gap:'1.5rem', flexWrap:'wrap' }}>
            <div className="chronic-rings-container">
              {chronicDiags.map((d, i) => (
                <div key={i} className="ring-item">
                  <ProgressRing score={50} size={72} stroke={7}/>
                  <div className="ring-name">{d.DiagnosisName}</div>
                  <div className="ring-updated">{fmtDate(d.VisitDate)}</div>
                </div>
              ))}
            </div>
            <button className="pab pab-progress" onClick={onOpenProgress} style={{ alignSelf:'center' }}>
              <TrendingUp size={13}/> Record Progress
            </button>
          </div>
          {/* Inline chart per chronic condition */}
          <ChronicChartsInline patientId={patient.PatientID} token={token}/>
        </div>
      )}

      {/* Diagnoses */}
      <div className="section-block">
        <div className="section-header"><div className="section-title">Diagnoses ({diagnoses.length})</div></div>
        {diagnoses.length === 0
          ? <p style={{ color:'var(--text-dim)', fontSize:'0.85rem' }}>No diagnoses recorded.</p>
          : diagnoses.map((d, i) => (
            <div key={i} className="diagnosis-row">
              <div>
                <div className="diagnosis-name">{d.DiagnosisName}</div>
                {d.DiagnosisDesc && <div className="diagnosis-desc">{d.DiagnosisDesc}</div>}
                <div className="diagnosis-date">{fmtDate(d.VisitDate)}</div>
              </div>
              <div className="diagnosis-badges">
                {d.Severity && <span className={`badge ${sevClass(d.Severity)}`}>{d.Severity}</span>}
                {d.IsChronic && <span className="badge badge-chronic">Chronic</span>}
              </div>
            </div>
          ))
        }
      </div>

      {/* Visit History */}
      <div className="section-block">
        <div className="section-header"><div className="section-title">Visit History ({visits.length})</div></div>
        {visits.length === 0
          ? <p style={{ color:'var(--text-dim)', fontSize:'0.85rem' }}>No visits recorded.</p>
          : visits.map((v, i) => {
              const vitals = parseVitals(v.VitalSigns);
              return (
                <div key={i} className="visit-accordion">
                  <div className={`visit-header ${openVisit === i ? 'open' : ''}`}
                    onClick={() => setOpenVisit(openVisit === i ? null : i)}>
                    <div className="visit-header-left">
                      <div className="visit-status-dot"
                        style={{ background: v.VisitStatus==='Completed' ? '#10b981' : v.VisitStatus==='In Progress' ? '#f59e0b' : '#475569' }}/>
                      <div className="visit-header-info">
                        <div className="visit-reason">{v.ReasonForVisit}</div>
                        <div className="visit-meta">{v.DoctorName} · {v.Specialty} · {fmtDate(v.VisitDate)}</div>
                      </div>
                    </div>
                    <span className={`visit-chevron ${openVisit === i ? 'open' : ''}`}><ChevronDown size={16}/></span>
                  </div>
                  {openVisit === i && (
                    <div className="visit-body">
                      {vitals.bp    && <div className="vital-item"><div className="vital-label">Blood Pressure</div><div className="vital-value">{vitals.bp}</div></div>}
                      {vitals.temp  && <div className="vital-item"><div className="vital-label">Temperature</div><div className="vital-value">{vitals.temp}°F</div></div>}
                      {vitals.pulse && <div className="vital-item"><div className="vital-label">Pulse</div><div className="vital-value">{vitals.pulse} bpm</div></div>}
                      {vitals.spo2  && <div className="vital-item"><div className="vital-label">SpO₂</div><div className="vital-value">{vitals.spo2}</div></div>}
                      {v.VisitNotes && <div className="visit-notes"><div className="vital-label" style={{ marginBottom:'0.3rem' }}>Clinical Notes</div>{v.VisitNotes}</div>}
                    </div>
                  )}
                </div>
              );
            })
        }
      </div>

      {/* Prescriptions */}
      <div className="section-block">
        <div className="section-header"><div className="section-title">Prescriptions ({prescriptions.length})</div></div>
        {prescriptions.length === 0
          ? <p style={{ color:'var(--text-dim)', fontSize:'0.85rem' }}>No prescriptions recorded.</p>
          : (
            <div className="table-container">
              <table className="data-table">
                <thead><tr><th>Medicine</th><th>Dosage</th><th>Frequency</th><th>Duration</th><th>Status</th></tr></thead>
                <tbody>{prescriptions.map((rx, i) => (
                  <tr key={i}>
                    <td><strong>{rx.MedicineName}</strong>{rx.Instructions && <p style={{ margin:'0.1rem 0 0', fontSize:'0.74rem', color:'var(--text-dim)' }}>{rx.Instructions}</p>}</td>
                    <td>{rx.Dosage}</td><td>{rx.Frequency}</td><td>{rx.Duration}</td>
                    <td><span className={`status-badge ${rx.IsDispensed ? 'dispensed' : 'pending'}`}>
                      {rx.IsDispensed ? <><CheckCircle size={12}/> Dispensed</> : <><Clock size={12}/> Pending</>}
                    </span></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )
        }
      </div>
    </>
  );
}

// ─────────────────────────────────────────────
// Chronic Disease Line Chart (SVG)
// ─────────────────────────────────────────────
function ChronicLineChart({ entries, diagName }: { entries: ChronicEntry[]; diagName: string }) {
  const sorted = [...entries].sort((a, b) => new Date(a.RecordDate).getTime() - new Date(b.RecordDate).getTime());
  if (sorted.length === 0) return <p style={{ color:'var(--text-dim)', fontSize:'0.85rem' }}>No data to chart.</p>;

  const W = 480; const H = 160; const PL = 36; const PR = 16; const PT = 12; const PB = 28;
  const iW = W - PL - PR; const iH = H - PT - PB;
  const scores = sorted.map(e => e.ProgressScore);
  const minS = 0; const maxS = 100;

  const toX = (i: number) => PL + (sorted.length < 2 ? iW / 2 : (i / (sorted.length - 1)) * iW);
  const toY = (s: number) => PT + iH - ((s - minS) / (maxS - minS)) * iH;

  const pathD = sorted.map((e, i) => `${i === 0 ? 'M' : 'L'} ${toX(i).toFixed(1)} ${toY(e.ProgressScore).toFixed(1)}`).join(' ');
  const areaD = `${pathD} L ${toX(sorted.length - 1).toFixed(1)} ${(PT + iH).toFixed(1)} L ${toX(0).toFixed(1)} ${(PT + iH).toFixed(1)} Z`;

  const gridLines = [0, 25, 50, 75, 100];

  return (
    <div style={{ background:'var(--raised)', border:'1px solid var(--border)', borderRadius:'var(--r-md)', padding:'0.875rem 1rem' }}>
      <p style={{ margin:'0 0 0.75rem', fontSize:'0.72rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'.08em', color:'var(--text-dim)' }}>
        {diagName} — Progress Over Time
      </p>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width:'100%', height:'auto', overflow:'visible' }}>
        <defs>
          <linearGradient id="chartArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="var(--accent)" stopOpacity="0.22"/>
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.02"/>
          </linearGradient>
        </defs>

        {/* Grid lines */}
        {gridLines.map(g => (
          <g key={g}>
            <line x1={PL} y1={toY(g)} x2={W - PR} y2={toY(g)} stroke="rgba(148,163,184,0.08)" strokeWidth="1"/>
            <text x={PL - 4} y={toY(g) + 4} textAnchor="end" fontSize="9" fill="var(--text-dim)">{g}</text>
          </g>
        ))}

        {/* Area fill */}
        <path d={areaD} fill="url(#chartArea)"/>

        {/* Line */}
        <path d={pathD} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>

        {/* Data points */}
        {sorted.map((e, i) => (
          <g key={i}>
            <circle cx={toX(i)} cy={toY(e.ProgressScore)} r="5" fill="var(--bg-2)" stroke={scoreColor(e.ProgressScore)} strokeWidth="2.5"/>
            {/* Tooltip label on hover via title */}
            <title>{`${fmtDate(e.RecordDate)}: ${e.ProgressScore}%`}</title>
            {/* Date label at bottom */}
            <text x={toX(i)} y={H - 4} textAnchor="middle" fontSize="8" fill="var(--text-dim)">
              {new Date(e.RecordDate).toLocaleDateString('en-GB', { day:'2-digit', month:'short' })}
            </text>
          </g>
        ))}

        {/* Score label above last point */}
        {sorted.length > 0 && (
          <text
            x={toX(sorted.length - 1)}
            y={toY(sorted[sorted.length - 1].ProgressScore) - 9}
            textAnchor="middle"
            fontSize="10"
            fontWeight="700"
            fill={scoreColor(sorted[sorted.length - 1].ProgressScore)}
          >
            {sorted[sorted.length - 1].ProgressScore}%
          </text>
        )}
      </svg>

      {/* Legend row */}
      <div style={{ display:'flex', gap:'1rem', marginTop:'0.5rem', flexWrap:'wrap' }}>
        {sorted.map((e, i) => (
          <div key={i} style={{ display:'flex', alignItems:'center', gap:'0.35rem', fontSize:'0.72rem', color:'var(--text-dim)' }}>
            <div style={{ width:8, height:8, borderRadius:'50%', background: scoreColor(e.ProgressScore), flexShrink:0 }}/>
            {fmtDate(e.RecordDate)}: <strong style={{ color: scoreColor(e.ProgressScore) }}>{e.ProgressScore}%</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Lab Tests Modal — view + add tests for a visit
// ─────────────────────────────────────────────
function LabTestsModal({ token, visits, onClose }:
  { token: string; visits: Visit[]; onClose: ()=>void }) {
  const [tests, setTests]       = useState<LabTest[]>([]);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [msg, setMsg]           = useState('');
  const [updatingId, setUpdatingId] = useState<number|null>(null);
  const [form, setForm]         = useState({ visit_id:'', test_name:'', test_type:'Blood Test' });
  const [resultForm, setResultForm] = useState({ results:'', result_date: new Date().toISOString().split('T')[0] });
  const TEST_TYPES = ['Blood Test','Urine Test','X-Ray','MRI','CT Scan','ECG','Echo','Biopsy','Culture','Other'];

  const load = useCallback(() => {
    fetch(`${API}/lab-tests`, { headers:{ Authorization:`Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { setTests(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [token]);

  useEffect(() => { load(); }, [load]);

  async function addTest() {
    if (!form.visit_id || !form.test_name) return setMsg('Visit and test name are required.');
    setSaving(true); setMsg('');
    try {
      const res = await fetch(`${API}/lab-tests`, {
        method:'POST',
        headers:{ Authorization:`Bearer ${token}`, 'Content-Type':'application/json' },
        body: JSON.stringify({ visit_id: parseInt(form.visit_id), test_name: form.test_name, test_type: form.test_type }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setMsg('✅ Test ordered!');
      setForm(f => ({ ...f, test_name:'', visit_id:'' }));
      load();
    } catch(e:any) { setMsg(`Error: ${e.message}`); }
    finally { setSaving(false); }
  }

  async function saveResult(testId: number) {
    setSaving(true);
    try {
      const res = await fetch(`${API}/lab-tests/${testId}/result`, {
        method:'PUT',
        headers:{ Authorization:`Bearer ${token}`, 'Content-Type':'application/json' },
        body: JSON.stringify({ results: resultForm.results, result_date: resultForm.result_date }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setUpdatingId(null);
      load();
    } catch(e:any) { alert(e.message); }
    finally { setSaving(false); }
  }

  const statusColor = (s: string) => s === 'Completed' ? 'var(--emerald)' : s === 'In Progress' ? 'var(--amber)' : s === 'Cancelled' ? 'var(--rose)' : 'var(--text-dim)';
  const statusBg    = (s: string) => s === 'Completed' ? 'var(--emerald-dim)' : s === 'In Progress' ? 'var(--amber-dim)' : s === 'Cancelled' ? 'var(--rose-dim)' : 'var(--bg-3)';

  return (
    <Modal title="🧪 Lab Tests Management" onClose={onClose} wide>
      {/* Order new test */}
      <div style={{ background:'var(--raised)', border:'1px solid var(--border)', borderRadius:'var(--r-md)', padding:'1rem', marginBottom:'1.25rem' }}>
        <p style={{ fontSize:'0.72rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'.08em', color:'var(--text-dim)', margin:'0 0 0.875rem' }}>Order New Test</p>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr auto', gap:'0.75rem', alignItems:'flex-end' }}>
          <div className="form-group" style={{ margin:0 }}>
            <label>Visit *</label>
            <select value={form.visit_id} onChange={e => setForm(f => ({...f, visit_id: e.target.value}))}>
              <option value="">Select Visit</option>
              {visits.map(v => <option key={v.VisitID} value={v.VisitID}>#{v.VisitID} — {v.PatientName} ({fmtDate(v.VisitDate)})</option>)}
            </select>
          </div>
          <div className="form-group" style={{ margin:0 }}>
            <label>Test Name *</label>
            <input type="text" value={form.test_name} onChange={e => setForm(f => ({...f, test_name: e.target.value}))} placeholder="e.g. CBC, TSH, HbA1c"/>
          </div>
          <div className="form-group" style={{ margin:0 }}>
            <label>Test Type</label>
            <select value={form.test_type} onChange={e => setForm(f => ({...f, test_type: e.target.value}))}>
              {TEST_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <button className="action-btn" onClick={addTest} disabled={saving} style={{ marginTop:0, padding:'0.7rem 1rem', whiteSpace:'nowrap', display:'flex', alignItems:'center', gap:'0.4rem' }}>
            <Plus size={14}/> Order
          </button>
        </div>
        {msg && <p style={{ margin:'0.5rem 0 0', fontSize:'0.82rem', color: msg.startsWith('Error') ? 'var(--rose)' : 'var(--emerald)' }}>{msg}</p>}
      </div>

      {/* Tests list */}
      {loading ? (
        <p style={{ color:'var(--text-dim)', textAlign:'center', padding:'2rem' }}>Loading tests...</p>
      ) : tests.length === 0 ? (
        <div className="empty-state" style={{ padding:'2rem' }}>
          <FlaskConical size={40} style={{ opacity:.3 }}/>
          <p>No lab tests ordered yet.</p>
        </div>
      ) : (
        <div className="table-container">
          <table className="data-table">
            <thead><tr><th>Test</th><th>Type</th><th>Patient</th><th>Ordered</th><th>Status</th><th>Results</th><th>Action</th></tr></thead>
            <tbody>
              {tests.map(t => (
                <React.Fragment key={t.TestID}>
                  <tr>
                    <td><strong>{t.TestName}</strong></td>
                    <td><span style={{ fontSize:'0.76rem', padding:'0.15rem 0.5rem', borderRadius:5, background:'var(--accent-dim)', color:'var(--accent)' }}>{t.TestType}</span></td>
                    <td style={{ fontSize:'0.82rem' }}>{t.PatientName || '—'}</td>
                    <td style={{ fontSize:'0.82rem' }}>{fmtDate(t.CreatedAt)}</td>
                    <td>
                      <span style={{ fontSize:'0.76rem', padding:'0.2rem 0.6rem', borderRadius:5, background: statusBg(t.Status), color: statusColor(t.Status), fontWeight:600 }}>
                        {t.Status}
                      </span>
                    </td>
                    <td style={{ fontSize:'0.82rem', maxWidth:200 }}>
                      {t.Results ? <span title={t.Results} style={{ color:'var(--text-mid)' }}>{t.Results.slice(0,40)}{t.Results.length>40?'…':''}</span> : <span style={{ color:'var(--text-dim)' }}>Pending</span>}
                    </td>
                    <td>
                      {t.Status !== 'Completed' && t.Status !== 'Cancelled' && (
                        <button onClick={() => { setUpdatingId(updatingId === t.TestID ? null : t.TestID); setResultForm({ results:'', result_date: new Date().toISOString().split('T')[0] }); }}
                          style={{ padding:'0.3rem 0.65rem', background:'var(--emerald-dim)', border:'1px solid rgba(16,185,129,.25)', borderRadius:6, color:'var(--emerald)', fontSize:'0.76rem', fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', gap:'0.3rem' }}>
                          <CheckCircle size={12}/> Add Result
                        </button>
                      )}
                    </td>
                  </tr>
                  {updatingId === t.TestID && (
                    <tr>
                      <td colSpan={7} style={{ padding:'0.75rem 1rem', background:'var(--accent-dim)' }}>
                        <div style={{ display:'grid', gridTemplateColumns:'1fr 160px auto', gap:'0.75rem', alignItems:'flex-end' }}>
                          <div className="form-group" style={{ margin:0 }}>
                            <label>Results *</label>
                            <textarea rows={2} value={resultForm.results} onChange={e => setResultForm(f => ({...f, results: e.target.value}))} placeholder="Enter test results / findings..."/>
                          </div>
                          <div className="form-group" style={{ margin:0 }}>
                            <label>Result Date</label>
                            <input type="date" value={resultForm.result_date} onChange={e => setResultForm(f => ({...f, result_date: e.target.value}))}/>
                          </div>
                          <div style={{ display:'flex', gap:'0.5rem' }}>
                            <button className="submit-btn" onClick={() => saveResult(t.TestID)} disabled={saving || !resultForm.results} style={{ width:'auto', padding:'0.6rem 1rem', marginTop:0 }}>
                              <Save size={13}/> Save
                            </button>
                            <button onClick={() => setUpdatingId(null)} style={{ padding:'0.6rem 0.875rem', background:'var(--bg-3)', border:'1px solid var(--border)', borderRadius:'var(--r-sm)', color:'var(--text-dim)', cursor:'pointer' }}>
                              <X size={13}/>
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}

// ─────────────────────────────────────────────
// BookAppointmentModal — Patient books an appointment
// ─────────────────────────────────────────────
function BookAppointmentModal({ token, doctors, onClose, onSaved }:
  { token: string; doctors: Doctor[]; onClose: ()=>void; onSaved: ()=>void }) {
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate()+1);
  const minDate  = tomorrow.toISOString().split('T')[0];

  const [form, setForm] = useState({
    requested_date:      minDate,
    time_slot:           '10:00 AM',
    reason:              '',
    patient_notes:       '',
    preferred_doctor_id: '',
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg]       = useState('');

  const TIME_SLOTS = ['09:00 AM','09:30 AM','10:00 AM','10:30 AM','11:00 AM','11:30 AM',
                      '12:00 PM','02:00 PM','02:30 PM','03:00 PM','03:30 PM','04:00 PM','04:30 PM'];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.reason.trim()) return setMsg('Please describe your reason for the visit.');
    setSaving(true); setMsg('');
    try {
      const res = await fetch(`${API}/appointments`, {
        method:'POST',
        headers:{ Authorization:`Bearer ${token}`, 'Content-Type':'application/json' },
        body: JSON.stringify({
          requested_date:      form.requested_date,
          time_slot:           form.time_slot,
          reason:              form.reason,
          patient_notes:       form.patient_notes,
          preferred_doctor_id: form.preferred_doctor_id || null,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setMsg('✅ Appointment request sent! Our receptionist will confirm shortly.');
      setTimeout(() => { onSaved(); onClose(); }, 1800);
    } catch(e:any) { setMsg(`Error: ${e.message}`); }
    finally { setSaving(false); }
  }

  return (
    <Modal title="📅 Book an Appointment" onClose={onClose}>
      <form onSubmit={submit} className="data-form" style={{ padding:0, background:'none', boxShadow:'none' }}>

        {/* Info banner */}
        <div style={{ display:'flex', alignItems:'flex-start', gap:'0.625rem', padding:'0.75rem 1rem', background:'var(--accent-dim)', border:'1px solid var(--border)', borderRadius:'var(--r-md)', marginBottom:'1.25rem', fontSize:'0.82rem', color:'var(--text-mid)', lineHeight:1.5 }}>
          <Calendar size={15} style={{ color:'var(--accent)', flexShrink:0, marginTop:1 }}/>
          Your request will be reviewed by our front desk team who will assign you the best available doctor and confirm your appointment.
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Preferred Date *</label>
            <input type="date" value={form.requested_date} min={minDate}
              onChange={e => setForm(f => ({...f, requested_date: e.target.value}))} required/>
          </div>
          <div className="form-group">
            <label>Preferred Time Slot</label>
            <select value={form.time_slot} onChange={e => setForm(f => ({...f, time_slot: e.target.value}))}>
              {TIME_SLOTS.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
        </div>

        <div className="form-group">
          <label>Reason for Visit *</label>
          <input type="text" value={form.reason} placeholder="e.g. General check-up, chest pain, follow-up..."
            onChange={e => setForm(f => ({...f, reason: e.target.value}))} required/>
        </div>

        <div className="form-group">
          <label>Describe Your Symptoms <span style={{ color:'var(--text-dim)', fontWeight:400 }}>(optional)</span></label>
          <textarea rows={3} value={form.patient_notes}
            placeholder="Describe how you've been feeling, duration of symptoms, any medications you're taking..."
            onChange={e => setForm(f => ({...f, patient_notes: e.target.value}))}/>
        </div>

        <div className="form-group">
          <label>Preferred Doctor <span style={{ color:'var(--text-dim)', fontWeight:400 }}>(optional — we'll try to accommodate)</span></label>
          <select value={form.preferred_doctor_id} onChange={e => setForm(f => ({...f, preferred_doctor_id: e.target.value}))}>
            <option value="">No preference — assign best available</option>
            {doctors.map(d => <option key={d.DoctorID} value={d.DoctorID}>{d.DoctorName} — {d.Specialty}</option>)}
          </select>
        </div>

        {msg && (
          <div style={{ padding:'0.75rem 1rem', borderRadius:'var(--r-md)', marginBottom:'1rem', fontSize:'0.84rem',
            background: msg.startsWith('Error') ? 'var(--rose-dim)' : 'var(--emerald-dim)',
            color: msg.startsWith('Error') ? 'var(--rose)' : 'var(--emerald)',
            border: `1px solid ${msg.startsWith('Error') ? 'rgba(244,63,94,.25)' : 'rgba(16,185,129,.25)'}`,
            display:'flex', alignItems:'center', gap:'0.5rem' }}>
            {msg.startsWith('Error') ? <AlertCircle size={14}/> : <CheckCircle size={14}/>} {msg}
          </div>
        )}

        <button type="submit" className="submit-btn" disabled={saving} style={{ marginTop:'0.5rem', display:'flex', alignItems:'center', justifyContent:'center', gap:'0.5rem' }}>
          <Calendar size={15}/> {saving ? 'Submitting...' : 'Submit Appointment Request'}
        </button>
      </form>
    </Modal>
  );
}

// ─────────────────────────────────────────────
// PatientProfileDashboard — Full 360° patient home screen
// Layout: profile hero | appointments | records + prescriptions + files
// ─────────────────────────────────────────────
function PatientProfileDashboard({ user, token, records, medFiles, doctors, onBookAppointment, onOpenSummary, onViewRecords, onViewFiles, onViewAppointments }:
  { user: AuthUser; token: string; records: any[]; medFiles: MedicalFile[]; doctors: Doctor[];
    onBookAppointment: ()=>void; onOpenSummary: ()=>void;
    onViewRecords: ()=>void; onViewFiles: ()=>void; onViewAppointments: ()=>void }) {

  const [patientDetail, setPatientDetail] = useState<any>(null);
  const [appointments, setAppointments]   = useState<Appointment[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(true);

  useEffect(() => {
    if (!user.patient_id) return;
    fetch(`${API}/patients/${user.patient_id}/summary`, { headers:{ Authorization:`Bearer ${token}` } })
      .then(r=>r.json()).then(d=>setPatientDetail(d)).catch(()=>{}).finally(()=>setLoadingDetail(false));
    fetch(`${API}/appointments`, { headers:{ Authorization:`Bearer ${token}` } })
      .then(r=>r.json()).then(d=>{ if(Array.isArray(d)) setAppointments(d); }).catch(()=>{});
  }, [user.patient_id, token]);

  const p = patientDetail?.patient || {};
  const visits = patientDetail?.visits || [];
  const diagnoses = patientDetail?.diagnoses || [];
  const prescriptions = patientDetail?.prescriptions || [];
  const initials = (p.PatientName||user.username||'P').split(' ').map((w:string)=>w[0]).join('').slice(0,2).toUpperCase();
  const age = p.DateOfBirth ? new Date().getFullYear() - new Date(p.DateOfBirth).getFullYear() : null;

  const statusColor = (s:string) => s==='Confirmed'?'var(--emerald)':s==='Cancelled'?'var(--rose)':s==='Completed'?'var(--accent)':'var(--amber)';

  async function downloadFile(fid: number, name: string) {
    const res = await fetch(`${API}/files/download/${fid}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return alert('Download failed');
    const a = document.createElement('a'); a.href = URL.createObjectURL(await res.blob()); a.download = name;
    document.body.appendChild(a); a.click(); URL.revokeObjectURL(a.href); document.body.removeChild(a);
  }

  return (
    <div style={{ animation:'gridReveal 0.5s var(--ease-out) both', display:'flex', flexDirection:'column', gap:'1.25rem' }}>

      {/* ── TOP ROW: Profile Hero + Appointments ── */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1.4fr', gap:'1.25rem', alignItems:'start' }}>

        {/* Profile Hero Card */}
        <div style={{ background:'var(--card-bg)', backdropFilter:'blur(20px)', border:'1px solid var(--border-glass)', borderRadius:'var(--r-xl)', overflow:'hidden', boxShadow:'var(--shadow-card)' }}>
          {/* Top gradient banner */}
          <div style={{ height:72, background:'linear-gradient(135deg, var(--accent-dim) 0%, var(--violet-dim) 100%)', position:'relative', overflow:'hidden' }}>
            <div style={{ position:'absolute', inset:0, background:'linear-gradient(135deg, rgba(0,212,255,0.15), rgba(155,125,255,0.12))' }}/>
            {/* Scanline effect */}
            <div style={{ position:'absolute', inset:0, backgroundImage:'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,212,255,0.03) 3px, rgba(0,212,255,0.03) 4px)' }}/>
          </div>

          <div style={{ padding:'0 1.5rem 1.5rem' }}>
            {/* Avatar overlapping banner */}
            <div style={{ marginTop:-36, marginBottom:'0.875rem', display:'flex', alignItems:'flex-end', justifyContent:'space-between' }}>
              <div style={{ width:72, height:72, borderRadius:'var(--r-lg)', background:'linear-gradient(135deg, var(--accent), var(--violet))', border:'3px solid var(--card-bg)', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'Space Grotesk',sans-serif", fontWeight:700, fontSize:'1.4rem', color:'#fff', boxShadow:'0 8px 24px rgba(0,212,255,0.3)', flexShrink:0 }}>
                {initials}
              </div>
              {/* Active badge */}
              <div style={{ display:'flex', alignItems:'center', gap:'0.4rem', padding:'0.32rem 0.75rem', background:'var(--emerald-dim)', border:'1px solid rgba(0,229,160,0.28)', borderRadius:999, marginBottom:4 }}>
                <div style={{ width:7, height:7, borderRadius:'50%', background:'var(--emerald)', animation:'pulse-glow 2s ease-in-out infinite' }}/>
                <span style={{ fontSize:'0.72rem', fontWeight:700, color:'var(--emerald)', letterSpacing:'0.06em', textTransform:'uppercase' }}>Active</span>
              </div>
            </div>

            {/* Name + meta */}
            <div style={{ marginBottom:'1.25rem' }}>
              <h2 style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:'1.25rem', fontWeight:700, color:'var(--text-bright)', margin:'0 0 0.25rem', letterSpacing:'-0.02em' }}>
                {loadingDetail ? user.username : (p.PatientName || user.username)}
              </h2>
              <div style={{ display:'flex', gap:'0.5rem', flexWrap:'wrap' }}>
                {p.BloodGroup && <span className="badge badge-blood">{p.BloodGroup}</span>}
                {age && <span style={{ fontSize:'0.77rem', color:'var(--text-dim)' }}>Age {age}</span>}
                {p.Gender && <span style={{ fontSize:'0.77rem', color:'var(--text-dim)' }}>· {p.Gender}</span>}
              </div>
            </div>

            {/* Info grid */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.625rem', marginBottom:'1.25rem' }}>
              {[
                { label:'Email',       value: p.Email||user.email||'—',       icon:'✉' },
                { label:'Phone',       value: p.PhoneNumber||'—',             icon:'📞' },
                { label:'DOB',         value: p.DateOfBirth ? fmtDate(p.DateOfBirth) : '—', icon:'🎂' },
                { label:'Blood Group', value: p.BloodGroup||'—',              icon:'🩸' },
                { label:'Address',     value: p.Address||'—',                 icon:'📍' },
                { label:'Emergency',   value: p.EmergencyContact||'—',        icon:'🚨' },
              ].map(f=>(
                <div key={f.label} style={{ gridColumn: f.label==='Address'||f.label==='Email'?'1/-1':'auto', padding:'0.6rem 0.75rem', background:'var(--glass)', border:'1px solid var(--border-glass)', borderRadius:'var(--r-sm)' }}>
                  <div style={{ fontSize:'0.62rem', fontWeight:700, letterSpacing:'0.09em', textTransform:'uppercase', color:'var(--text-dim)', marginBottom:'0.18rem' }}>{f.icon} {f.label}</div>
                  <div style={{ fontSize:'0.84rem', color:'var(--text-bright)', fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{f.value}</div>
                </div>
              ))}
            </div>

            {/* Stat pills */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'0.5rem', marginBottom:'1.25rem' }}>
              {[
                { label:'Total Visits',   value: visits.length,                               color:'var(--accent)',   bg:'var(--accent-dim)' },
                { label:'Diagnoses',      value: diagnoses.length,                            color:'var(--violet)',   bg:'var(--violet-dim)' },
                { label:'Prescriptions',  value: prescriptions.length,                        color:'var(--emerald)', bg:'var(--emerald-dim)' },
              ].map(s=>(
                <div key={s.label} style={{ padding:'0.75rem 0.5rem', background:s.bg, border:`1px solid ${s.color}25`, borderRadius:'var(--r-md)', textAlign:'center' }}>
                  <div style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:'1.6rem', fontWeight:700, color:s.color, lineHeight:1 }}>{s.value}</div>
                  <div style={{ fontSize:'0.64rem', color:'var(--text-dim)', marginTop:'0.28rem', fontWeight:600, letterSpacing:'0.05em' }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div style={{ display:'flex', gap:'0.625rem', flexWrap:'wrap' }}>
              <button onClick={onBookAppointment} className="action-btn" style={{ flex:1, justifyContent:'center', padding:'0.7rem 0.875rem', fontSize:'0.82rem' }}>
                <Calendar size={14}/> Book Appointment
              </button>
              <button onClick={onOpenSummary} className="action-btn secondary" style={{ flex:1, justifyContent:'center', padding:'0.7rem 0.875rem', fontSize:'0.82rem' }}>
                <BookOpen size={14}/> My Summary
              </button>
            </div>
          </div>
        </div>

        {/* Appointments Card */}
        <div style={{ background:'var(--card-bg)', backdropFilter:'blur(20px)', border:'1px solid var(--border-glass)', borderRadius:'var(--r-xl)', overflow:'hidden', boxShadow:'var(--shadow-card)' }}>
          <div style={{ padding:'1.25rem 1.5rem', borderBottom:'1px solid var(--border-glass)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div>
              <h3 style={{ fontFamily:"'Space Grotesk',sans-serif", fontWeight:700, fontSize:'1rem', color:'var(--text-bright)', margin:0 }}>📅 Appointments</h3>
              <p style={{ fontSize:'0.75rem', color:'var(--text-dim)', margin:'0.2rem 0 0' }}>{appointments.filter(a=>a.Status==='Pending'||a.Status==='Confirmed').length} upcoming</p>
            </div>
            <button onClick={onViewAppointments} className="action-btn" style={{ padding:'0.45rem 1rem', fontSize:'0.78rem', marginTop:0 }}>Browse All</button>
          </div>
          {appointments.length === 0 ? (
            <div style={{ padding:'3rem', textAlign:'center' }}>
              <Calendar size={36} style={{ color:'var(--border)', marginBottom:'0.75rem' }}/>
              <p style={{ color:'var(--text-dim)', fontSize:'0.84rem' }}>No appointments yet</p>
              <button onClick={onBookAppointment} className="action-btn" style={{ marginTop:'0.875rem', padding:'0.55rem 1.25rem', fontSize:'0.8rem' }}>Book Now</button>
            </div>
          ) : (
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead>
                  <tr style={{ background:'linear-gradient(90deg,rgba(0,212,255,0.05),rgba(155,125,255,0.03))' }}>
                    {['Visit Type','Date','Time','Doctor','Status'].map(h=>(
                      <th key={h} style={{ padding:'0.75rem 1.25rem', textAlign:'left', fontSize:'0.65rem', fontFamily:"'Space Grotesk',sans-serif", fontWeight:700, textTransform:'uppercase', letterSpacing:'0.09em', color:'var(--accent-light)', whiteSpace:'nowrap', borderBottom:'1px solid var(--border-glass)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {appointments.slice(0,5).map(a=>(
                    <tr key={a.AppointmentID} style={{ borderBottom:'1px solid var(--border-glass)', transition:'background var(--t-fast)' }}
                      onMouseEnter={e=>(e.currentTarget.style.background='var(--glass)')}
                      onMouseLeave={e=>(e.currentTarget.style.background='transparent')}>
                      <td style={{ padding:'0.85rem 1.25rem', fontSize:'0.86rem', fontWeight:600, color:'var(--text-bright)' }}>{a.Reason||'Check-up'}</td>
                      <td style={{ padding:'0.85rem 1.25rem', fontSize:'0.82rem', color:'var(--text-mid)', fontFamily:"'JetBrains Mono',monospace" }}>{fmtDate(a.RequestedDate)}</td>
                      <td style={{ padding:'0.85rem 1.25rem', fontSize:'0.82rem', color:'var(--text-dim)' }}>{a.TimeSlot||'—'}</td>
                      <td style={{ padding:'0.85rem 1.25rem', fontSize:'0.82rem', color:'var(--text-mid)' }}>{a.DoctorName||<span style={{ color:'var(--amber)', fontSize:'0.74rem' }}>Pending assign</span>}</td>
                      <td style={{ padding:'0.85rem 1.25rem' }}>
                        <span style={{ padding:'0.2rem 0.6rem', borderRadius:6, fontSize:'0.72rem', fontWeight:700, background:`${statusColor(a.Status)}18`, color:statusColor(a.Status), border:`1px solid ${statusColor(a.Status)}30` }}>{a.Status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── BOTTOM ROW: Medical Records + Prescriptions + Files ── */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'1.25rem' }}>

        {/* Medical Records */}
        <div style={{ background:'var(--card-bg)', backdropFilter:'blur(20px)', border:'1px solid var(--border-glass)', borderRadius:'var(--r-xl)', overflow:'hidden', boxShadow:'var(--shadow-card)' }}>
          <div style={{ padding:'1.125rem 1.375rem', borderBottom:'1px solid var(--border-glass)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <h3 style={{ fontFamily:"'Space Grotesk',sans-serif", fontWeight:700, fontSize:'0.95rem', color:'var(--text-bright)', margin:0 }}>🏥 Medical Records</h3>
            <button onClick={onViewRecords} className="action-btn" style={{ padding:'0.38rem 0.875rem', fontSize:'0.75rem', marginTop:0 }}>Browse All</button>
          </div>
          {records.length === 0 ? (
            <div style={{ padding:'2rem', textAlign:'center', color:'var(--text-dim)', fontSize:'0.84rem' }}>No records yet</div>
          ) : (
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr style={{ background:'rgba(0,212,255,0.03)' }}>
                  {['Date','Diagnosis','Doctor'].map(h=>(
                    <th key={h} style={{ padding:'0.625rem 1.125rem', textAlign:'left', fontSize:'0.62rem', fontFamily:"'Space Grotesk',sans-serif", fontWeight:700, textTransform:'uppercase', letterSpacing:'0.09em', color:'var(--text-dim)', borderBottom:'1px solid var(--border-glass)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {records.slice(0,5).map((r:any,i:number)=>(
                  <tr key={i} style={{ borderBottom:'1px solid var(--border-glass)', transition:'background var(--t-fast)' }}
                    onMouseEnter={e=>(e.currentTarget.style.background='var(--glass)')}
                    onMouseLeave={e=>(e.currentTarget.style.background='transparent')}>
                    <td style={{ padding:'0.7rem 1.125rem', fontSize:'0.78rem', color:'var(--text-dim)', fontFamily:"'JetBrains Mono',monospace', whiteSpace:'nowrap'", whiteSpace:'nowrap' }}>{fmtDate(r.VisitDate)}</td>
                    <td style={{ padding:'0.7rem 1.125rem', fontSize:'0.82rem', color:'var(--text-bright)', fontWeight:500, maxWidth:120, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.DiagnosisName||r.ReasonForVisit||'—'}</td>
                    <td style={{ padding:'0.7rem 1.125rem', fontSize:'0.78rem', color:'var(--text-mid)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.DoctorName||'—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Prescriptions */}
        <div style={{ background:'var(--card-bg)', backdropFilter:'blur(20px)', border:'1px solid var(--border-glass)', borderRadius:'var(--r-xl)', overflow:'hidden', boxShadow:'var(--shadow-card)' }}>
          <div style={{ padding:'1.125rem 1.375rem', borderBottom:'1px solid var(--border-glass)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <h3 style={{ fontFamily:"'Space Grotesk',sans-serif", fontWeight:700, fontSize:'0.95rem', color:'var(--text-bright)', margin:0 }}>💊 Medications</h3>
            <button onClick={onOpenSummary} className="action-btn secondary" style={{ padding:'0.38rem 0.875rem', fontSize:'0.75rem', marginTop:0 }}>View All</button>
          </div>
          {prescriptions.length === 0 ? (
            <div style={{ padding:'2rem', textAlign:'center', color:'var(--text-dim)', fontSize:'0.84rem' }}>No medications on record</div>
          ) : (
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr style={{ background:'rgba(0,229,160,0.03)' }}>
                  {['Medicine','Dose','Freq','Status'].map(h=>(
                    <th key={h} style={{ padding:'0.625rem 1.125rem', textAlign:'left', fontSize:'0.62rem', fontFamily:"'Space Grotesk',sans-serif", fontWeight:700, textTransform:'uppercase', letterSpacing:'0.09em', color:'var(--text-dim)', borderBottom:'1px solid var(--border-glass)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {prescriptions.slice(0,5).map((rx:any,i:number)=>(
                  <tr key={i} style={{ borderBottom:'1px solid var(--border-glass)', transition:'background var(--t-fast)' }}
                    onMouseEnter={e=>(e.currentTarget.style.background='var(--glass)')}
                    onMouseLeave={e=>(e.currentTarget.style.background='transparent')}>
                    <td style={{ padding:'0.7rem 1.125rem', fontSize:'0.82rem', fontWeight:600, color:'var(--text-bright)', maxWidth:100, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{rx.MedicineName}</td>
                    <td style={{ padding:'0.7rem 1.125rem', fontSize:'0.78rem', color:'var(--text-mid)', fontFamily:"'JetBrains Mono',monospace", whiteSpace:'nowrap' }}>{rx.Dosage||'—'}</td>
                    <td style={{ padding:'0.7rem 1.125rem', fontSize:'0.78rem', color:'var(--text-dim)', whiteSpace:'nowrap' }}>{rx.Frequency||'—'}</td>
                    <td style={{ padding:'0.7rem 1.125rem' }}>
                      <span className={`status-badge ${rx.IsDispensed?'dispensed':'pending'}`} style={{ fontSize:'0.68rem', padding:'0.18rem 0.5rem' }}>
                        {rx.IsDispensed?<><CheckCircle size={10}/> Done</>:<><Clock size={10}/> Active</>}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Files */}
        <div style={{ background:'var(--card-bg)', backdropFilter:'blur(20px)', border:'1px solid var(--border-glass)', borderRadius:'var(--r-xl)', overflow:'hidden', boxShadow:'var(--shadow-card)' }}>
          <div style={{ padding:'1.125rem 1.375rem', borderBottom:'1px solid var(--border-glass)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <h3 style={{ fontFamily:"'Space Grotesk',sans-serif", fontWeight:700, fontSize:'0.95rem', color:'var(--text-bright)', margin:0 }}>📂 My Files</h3>
            <button onClick={onViewFiles} className="action-btn secondary" style={{ padding:'0.38rem 0.875rem', fontSize:'0.75rem', marginTop:0 }}>Browse All</button>
          </div>
          {medFiles.length === 0 ? (
            <div style={{ padding:'2rem 1.375rem', textAlign:'center' }}>
              <FileImage size={32} style={{ color:'var(--border)', marginBottom:'0.625rem' }}/>
              <p style={{ color:'var(--text-dim)', fontSize:'0.82rem', marginBottom:'0.875rem' }}>No files uploaded yet</p>
              <button onClick={onViewFiles} className="action-btn" style={{ padding:'0.5rem 1rem', fontSize:'0.78rem', marginTop:0 }}>
                <Upload size={13}/> Upload File
              </button>
            </div>
          ) : (
            <div style={{ padding:'0.5rem 0.75rem', display:'flex', flexDirection:'column', gap:'0.375rem' }}>
              {medFiles.slice(0,5).map((f:any,i:number)=>(
                <div key={i} style={{ display:'flex', alignItems:'center', gap:'0.75rem', padding:'0.625rem 0.75rem', background:'var(--glass)', border:'1px solid var(--border-glass)', borderRadius:'var(--r-sm)', transition:'border-color var(--t-fast)' }}
                  onMouseEnter={e=>(e.currentTarget.style.borderColor='var(--border-hover)')}
                  onMouseLeave={e=>(e.currentTarget.style.borderColor='var(--border-glass)')}>
                  <div style={{ width:32, height:32, borderRadius:8, background:'var(--accent-dim)', display:'grid', placeItems:'center', flexShrink:0 }}>
                    <FileImage size={15} style={{ color:'var(--accent)' }}/>
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <p style={{ margin:0, fontSize:'0.8rem', fontWeight:600, color:'var(--text-bright)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{f.FileName}</p>
                    <p style={{ margin:0, fontSize:'0.69rem', color:'var(--text-dim)', fontFamily:"'JetBrains Mono',monospace" }}>{f.FileType} · {fmtDate(f.UploadedAt)}</p>
                  </div>
                  <button onClick={()=>downloadFile(f.FileID, f.FileName)} style={{ background:'none', border:'none', color:'var(--accent)', cursor:'pointer', padding:'0.25rem', borderRadius:4, display:'flex', transition:'color var(--t-fast)' }}
                    onMouseEnter={e=>(e.currentTarget.style.color='var(--accent-light)')}
                    onMouseLeave={e=>(e.currentTarget.style.color='var(--accent)')}>
                    <Download size={14}/>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// MyAppointments — Patient's appointment history + booking
// ─────────────────────────────────────────────
function MyAppointmentsView({ token, doctors }: { token: string; doctors: Doctor[] }) {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading]           = useState(true);
  const [showBook, setShowBook]         = useState(false);

  const load = useCallback(() => {
    fetch(`${API}/appointments`, { headers:{ Authorization:`Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { setAppointments(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [token]);

  useEffect(() => { load(); }, [load]);

  async function cancel(id: number) {
    if (!window.confirm('Cancel this appointment request?')) return;
    await fetch(`${API}/appointments/${id}/cancel`, { method:'PUT', headers:{ Authorization:`Bearer ${token}` } });
    load();
  }

  const statusColor = (s: string) => s==='Confirmed'?'var(--emerald)':s==='Cancelled'?'var(--rose)':s==='Completed'?'var(--accent)':'var(--amber)';
  const statusBg    = (s: string) => s==='Confirmed'?'var(--emerald-dim)':s==='Cancelled'?'var(--rose-dim)':s==='Completed'?'var(--accent-dim)':'var(--amber-dim)';

  return (
    <div style={{ animation:'gridReveal 0.4s var(--ease-out) both' }}>
      {showBook && <BookAppointmentModal token={token} doctors={doctors} onClose={()=>setShowBook(false)} onSaved={load}/>}

      {/* Header row */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'1.5rem' }}>
        <div>
          <h2 style={{ fontFamily:"'Syne',sans-serif", fontSize:'1.1rem', fontWeight:800, margin:'0 0 0.25rem', color:'var(--text-bright)' }}>My Appointments</h2>
          <p style={{ fontSize:'0.82rem', color:'var(--text-dim)', margin:0 }}>Track your appointment requests and upcoming visits</p>
        </div>
        <button className="action-btn" onClick={()=>setShowBook(true)} style={{ display:'flex', alignItems:'center', gap:'0.5rem' }}>
          <Plus size={15}/> Book Appointment
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign:'center', padding:'3rem', color:'var(--text-dim)' }}>Loading appointments...</div>
      ) : appointments.length === 0 ? (
        <div className="empty-state">
          <Calendar size={56} style={{ opacity:.25 }}/>
          <h3>No appointments yet</h3>
          <p>Book your first appointment and our front desk team will confirm it for you.</p>
          <button className="action-btn" onClick={()=>setShowBook(true)} style={{ marginTop:'0.5rem', display:'flex', alignItems:'center', gap:'0.5rem' }}>
            <Plus size={15}/> Book Appointment
          </button>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:'0.75rem' }}>
          {appointments.map(a => (
            <div key={a.AppointmentID} style={{ background:'var(--card-bg)', border:'1px solid var(--border)', borderRadius:'var(--r-lg)', overflow:'hidden', transition:'border-color var(--t-mid)' }}>
              {/* Top bar colored by status */}
              <div style={{ height:3, background: statusColor(a.Status) }}/>
              <div style={{ padding:'1rem 1.25rem' }}>
                <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:'1rem', flexWrap:'wrap' }}>
                  <div style={{ flex:1 }}>
                    {/* Date + time */}
                    <div style={{ display:'flex', alignItems:'center', gap:'0.75rem', marginBottom:'0.5rem', flexWrap:'wrap' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:'0.4rem' }}>
                        <Calendar size={14} style={{ color:'var(--accent)' }}/>
                        <span style={{ fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:'0.9rem', color:'var(--text-bright)' }}>
                          {new Date(a.RequestedDate).toLocaleDateString('en-GB',{ weekday:'short', day:'2-digit', month:'short', year:'numeric' })}
                        </span>
                      </div>
                      {a.TimeSlot && (
                        <div style={{ display:'flex', alignItems:'center', gap:'0.3rem' }}>
                          <Clock size={13} style={{ color:'var(--text-dim)' }}/>
                          <span style={{ fontSize:'0.82rem', color:'var(--text-mid)' }}>{a.TimeSlot}</span>
                        </div>
                      )}
                      <span style={{ padding:'0.2rem 0.65rem', borderRadius:999, fontSize:'0.72rem', fontWeight:700, background: statusBg(a.Status), color: statusColor(a.Status), border:`1px solid ${statusColor(a.Status)}30` }}>
                        {a.Status}
                      </span>
                    </div>

                    <p style={{ fontWeight:600, color:'var(--text-bright)', margin:'0 0 0.25rem', fontSize:'0.9rem' }}>{a.Reason}</p>
                    {a.PatientNotes && <p style={{ fontSize:'0.8rem', color:'var(--text-dim)', margin:'0 0 0.5rem' }}>{a.PatientNotes}</p>}

                    {/* Doctor assigned / pending */}
                    {a.DoctorName ? (
                      <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', padding:'0.5rem 0.75rem', background:'var(--accent-dim)', borderRadius:'var(--r-sm)', border:'1px solid var(--border)', width:'fit-content' }}>
                        <Stethoscope size={13} style={{ color:'var(--accent)' }}/>
                        <span style={{ fontSize:'0.8rem', color:'var(--text-bright)', fontWeight:600 }}>{a.DoctorName}</span>
                        <span style={{ fontSize:'0.75rem', color:'var(--text-dim)' }}>· {a.Specialty}</span>
                      </div>
                    ) : (
                      <div style={{ display:'flex', alignItems:'center', gap:'0.4rem', fontSize:'0.78rem', color:'var(--amber)', padding:'0.4rem 0.75rem', background:'var(--amber-dim)', borderRadius:'var(--r-sm)', border:'1px solid rgba(217,119,6,.2)', width:'fit-content' }}>
                        <Clock size={12}/> Awaiting doctor assignment by receptionist
                      </div>
                    )}

                    {a.ReceptionistNotes && (
                      <p style={{ fontSize:'0.78rem', color:'var(--text-dim)', margin:'0.5rem 0 0', fontStyle:'italic' }}>
                        📋 Receptionist: {a.ReceptionistNotes}
                      </p>
                    )}
                  </div>

                  {/* Cancel button — only for Pending */}
                  {a.Status === 'Pending' && (
                    <button onClick={() => cancel(a.AppointmentID)}
                      style={{ padding:'0.4rem 0.875rem', background:'var(--rose-dim)', border:'1px solid rgba(244,63,94,.2)', borderRadius:'var(--r-sm)', color:'var(--rose)', fontSize:'0.78rem', fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', gap:'0.3rem', whiteSpace:'nowrap', flexShrink:0 }}>
                      <X size={12}/> Cancel
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// ReceptionistDashboard — assign doctors to pending appointments
// ─────────────────────────────────────────────
function ReceptionistDashboard({ token, doctors }: { token: string; doctors: Doctor[] }) {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading]           = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('Pending');
  const [assigningId, setAssigningId]   = useState<number|null>(null);
  const [assignForm, setAssignForm]     = useState({ doctor_id:'', time_slot:'', receptionist_notes:'' });
  const [saving, setSaving]             = useState(false);
  const [msg, setMsg]                   = useState('');

  const TIME_SLOTS = ['09:00 AM','09:30 AM','10:00 AM','10:30 AM','11:00 AM','11:30 AM',
                      '12:00 PM','02:00 PM','02:30 PM','03:00 PM','03:30 PM','04:00 PM','04:30 PM'];

  const load = useCallback(() => {
    const qs = statusFilter === 'All' ? '' : `?status=${statusFilter}`;
    fetch(`${API}/appointments${qs}`, { headers:{ Authorization:`Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { setAppointments(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [token, statusFilter]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  async function doAssign(aid: number, status: 'Confirmed'|'Cancelled') {
    if (status === 'Confirmed' && !assignForm.doctor_id) { setMsg('Please select a doctor first.'); return; }
    setSaving(true); setMsg('');
    try {
      const res = await fetch(`${API}/appointments/${aid}/assign`, {
        method:'PUT',
        headers:{ Authorization:`Bearer ${token}`, 'Content-Type':'application/json' },
        body: JSON.stringify({ doctor_id: assignForm.doctor_id||null, time_slot: assignForm.time_slot||null, receptionist_notes: assignForm.receptionist_notes, status }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setAssigningId(null);
      setAssignForm({ doctor_id:'', time_slot:'', receptionist_notes:'' });
      load();
    } catch(e:any) { setMsg(`Error: ${e.message}`); }
    finally { setSaving(false); }
  }

  const statusColor = (s: string) => s==='Confirmed'?'var(--emerald)':s==='Cancelled'?'var(--rose)':s==='Completed'?'var(--accent)':'var(--amber)';
  const counts      = { Pending: appointments.filter(a=>a.Status==='Pending').length };

  return (
    <div style={{ animation:'gridReveal 0.4s var(--ease-out) both' }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'1.5rem', flexWrap:'wrap', gap:'0.875rem' }}>
        <div>
          <h2 style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:'1.1rem', margin:'0 0 0.25rem', color:'var(--text-bright)' }}>Appointments Queue</h2>
          <p style={{ fontSize:'0.82rem', color:'var(--text-dim)', margin:0 }}>Review requests and assign doctors to patients</p>
        </div>
        <div style={{ display:'flex', gap:'0.5rem', flexWrap:'wrap' }}>
          {['Pending','Confirmed','Cancelled','All'].map(s => (
            <button key={s} onClick={()=>setStatusFilter(s)}
              style={{ padding:'0.45rem 0.875rem', borderRadius:'var(--r-sm)', border:'1px solid var(--border)', background: statusFilter===s ? 'var(--accent-dim)' : 'var(--raised)', color: statusFilter===s ? 'var(--accent)' : 'var(--text-mid)', fontSize:'0.8rem', fontWeight:600, cursor:'pointer', transition:'all var(--t-fast)', display:'flex', alignItems:'center', gap:'0.35rem' }}>
              {s}{s==='Pending'&&counts.Pending>0&&<span style={{ background:'var(--rose)', color:'white', borderRadius:999, fontSize:'0.62rem', fontWeight:800, padding:'0.05rem 0.4rem', minWidth:16, textAlign:'center' }}>{counts.Pending}</span>}
            </button>
          ))}
          <button onClick={()=>{setLoading(true);load();}} style={{ padding:'0.45rem 0.75rem', borderRadius:'var(--r-sm)', border:'1px solid var(--border)', background:'var(--raised)', color:'var(--text-dim)', cursor:'pointer' }}>
            <RefreshCw size={14}/>
          </button>
        </div>
      </div>

      {msg && <div style={{ padding:'0.75rem 1rem', background:'var(--rose-dim)', border:'1px solid rgba(244,63,94,.25)', borderRadius:'var(--r-md)', color:'var(--rose)', fontSize:'0.84rem', marginBottom:'1rem', display:'flex', alignItems:'center', gap:'0.5rem' }}><AlertCircle size={14}/>{msg}</div>}

      {loading ? (
        <div style={{ textAlign:'center', padding:'3rem', color:'var(--text-dim)' }}>Loading appointments...</div>
      ) : appointments.length === 0 ? (
        <div className="empty-state"><Calendar size={56} style={{ opacity:.25 }}/><h3>No appointments</h3><p>No {statusFilter !== 'All' ? statusFilter.toLowerCase() : ''} appointments at the moment.</p></div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:'0.75rem' }}>
          {appointments.map(a => (
            <div key={a.AppointmentID} style={{ background:'var(--card-bg)', border:'1px solid var(--border)', borderRadius:'var(--r-lg)', overflow:'hidden' }}>
              <div style={{ height:3, background: statusColor(a.Status) }}/>
              <div style={{ padding:'1rem 1.25rem' }}>
                <div style={{ display:'flex', alignItems:'flex-start', gap:'1rem', flexWrap:'wrap' }}>
                  {/* Left: patient info */}
                  <div style={{ flex:1, minWidth:220 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:'0.75rem', marginBottom:'0.625rem' }}>
                      <div style={{ width:40, height:40, borderRadius:10, background:'var(--violet-dim)', border:'1px solid rgba(139,92,246,.2)', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--violet)', flexShrink:0, fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:'0.85rem' }}>
                        {a.PatientName ? a.PatientName.split(' ').map((w:string)=>w[0]).join('').slice(0,2) : '?'}
                      </div>
                      <div>
                        <p style={{ margin:0, fontWeight:700, color:'var(--text-bright)', fontSize:'0.9rem' }}>{a.PatientName || '—'}</p>
                        <p style={{ margin:0, fontSize:'0.74rem', color:'var(--text-dim)' }}>{a.Gender} · {a.BloodGroup} · {a.PhoneNumber}</p>
                      </div>
                    </div>

                    <div style={{ display:'flex', alignItems:'center', gap:'0.625rem', flexWrap:'wrap', marginBottom:'0.5rem' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:'0.35rem', fontSize:'0.82rem', color:'var(--text-mid)' }}>
                        <Calendar size={13} style={{ color:'var(--accent)' }}/>
                        {new Date(a.RequestedDate).toLocaleDateString('en-GB',{ weekday:'short', day:'2-digit', month:'short' })} · {a.TimeSlot}
                      </div>
                      <span style={{ padding:'0.15rem 0.55rem', borderRadius:999, fontSize:'0.7rem', fontWeight:700, background: statusColor(a.Status)+'20', color: statusColor(a.Status) }}>{a.Status}</span>
                    </div>

                    <p style={{ fontWeight:600, fontSize:'0.85rem', color:'var(--text-bright)', margin:'0 0 0.2rem' }}>{a.Reason}</p>
                    {a.PatientNotes && <p style={{ fontSize:'0.78rem', color:'var(--text-dim)', margin:0, fontStyle:'italic' }}>"{a.PatientNotes}"</p>}

                    {a.DoctorName && (
                      <div style={{ marginTop:'0.5rem', display:'flex', alignItems:'center', gap:'0.4rem', fontSize:'0.78rem', color:'var(--accent)' }}>
                        <Stethoscope size={12}/> Assigned: {a.DoctorName} ({a.Specialty})
                      </div>
                    )}
                    {a.HandledByName && <p style={{ margin:'0.25rem 0 0', fontSize:'0.72rem', color:'var(--text-dim)' }}>Handled by {a.HandledByName}</p>}
                  </div>

                  {/* Right: action */}
                  {a.Status === 'Pending' && (
                    <div style={{ flexShrink:0 }}>
                      {assigningId === a.AppointmentID ? (
                        <div style={{ display:'flex', flexDirection:'column', gap:'0.5rem', minWidth:240 }}>
                          <div className="form-group" style={{ margin:0 }}>
                            <label style={{ fontSize:'0.72rem' }}>Assign Doctor *</label>
                            <select value={assignForm.doctor_id} onChange={e=>setAssignForm(f=>({...f,doctor_id:e.target.value}))}>
                              <option value="">Select Doctor</option>
                              {doctors.map(d => <option key={d.DoctorID} value={d.DoctorID}>{d.DoctorName} — {d.Specialty}</option>)}
                            </select>
                          </div>
                          <div className="form-group" style={{ margin:0 }}>
                            <label style={{ fontSize:'0.72rem' }}>Confirm Time Slot</label>
                            <select value={assignForm.time_slot} onChange={e=>setAssignForm(f=>({...f,time_slot:e.target.value}))}>
                              <option value="">Keep patient's preference ({a.TimeSlot})</option>
                              {TIME_SLOTS.map(t => <option key={t}>{t}</option>)}
                            </select>
                          </div>
                          <div className="form-group" style={{ margin:0 }}>
                            <label style={{ fontSize:'0.72rem' }}>Internal Notes</label>
                            <input type="text" value={assignForm.receptionist_notes} placeholder="Optional notes for doctor..." onChange={e=>setAssignForm(f=>({...f,receptionist_notes:e.target.value}))}/>
                          </div>
                          <div style={{ display:'flex', gap:'0.5rem' }}>
                            <button onClick={()=>doAssign(a.AppointmentID,'Confirmed')} disabled={saving} className="submit-btn" style={{ flex:1, padding:'0.6rem', marginTop:0, fontSize:'0.82rem', display:'flex', alignItems:'center', justifyContent:'center', gap:'0.35rem' }}>
                              <CheckCircle size={13}/> Confirm
                            </button>
                            <button onClick={()=>doAssign(a.AppointmentID,'Cancelled')} disabled={saving} style={{ padding:'0.6rem 0.75rem', background:'var(--rose-dim)', border:'1px solid rgba(244,63,94,.2)', borderRadius:'var(--r-sm)', color:'var(--rose)', cursor:'pointer', fontSize:'0.82rem', fontWeight:600 }}>
                              <X size={13}/>
                            </button>
                            <button onClick={()=>setAssigningId(null)} style={{ padding:'0.6rem 0.75rem', background:'var(--raised)', border:'1px solid var(--border)', borderRadius:'var(--r-sm)', color:'var(--text-dim)', cursor:'pointer' }}>
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button onClick={()=>{ setAssigningId(a.AppointmentID); setAssignForm({ doctor_id: a.DoctorID ? String(a.DoctorID):'', time_slot: a.TimeSlot||'', receptionist_notes:'' }); setMsg(''); }}
                          style={{ padding:'0.6rem 1.25rem', background:'linear-gradient(135deg,#06d6a0,#059669)', border:'none', borderRadius:'var(--r-md)', color:'white', fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:'0.82rem', cursor:'pointer', boxShadow:'0 3px 12px rgba(6,214,160,.3)', display:'flex', alignItems:'center', gap:'0.4rem', whiteSpace:'nowrap' }}>
                          <Stethoscope size={13}/> Assign Doctor
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
function NotificationBell({ pending_rx, pending_tests, role }: { pending_rx: number; pending_tests: number; role: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const total = pending_rx + pending_tests;

  useEffect(() => {
    function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  return (
    <div ref={ref} style={{ position:'relative' }}>
      <button onClick={() => setOpen(v => !v)}
        style={{ position:'relative', background:'var(--bg-3)', border:'1px solid var(--border)', borderRadius:'var(--r-md)', width:38, height:38, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text-mid)', cursor:'pointer', transition:'all var(--t-mid)' }}>
        <Bell size={16}/>
        {total > 0 && (
          <span style={{ position:'absolute', top:-4, right:-4, background:'var(--rose)', color:'white', borderRadius:999, fontSize:'0.6rem', fontWeight:800, padding:'0.1rem 0.35rem', minWidth:16, textAlign:'center', lineHeight:1.4 }}>{total}</span>
        )}
      </button>

      {open && (
        <div style={{ position:'absolute', top:'calc(100% + 8px)', right:0, background:'var(--bg-2)', border:'1px solid var(--border)', borderRadius:'var(--r-lg)', padding:'0.75rem', minWidth:240, zIndex:300, boxShadow:'0 16px 48px rgba(0,0,0,.5)', animation:'dropIn .2s var(--ease-out)' }}>
          <p style={{ fontSize:'0.68rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'.08em', color:'var(--text-dim)', margin:'0 0 0.625rem 0.25rem' }}>Notifications</p>
          {total === 0 ? (
            <p style={{ fontSize:'0.85rem', color:'var(--text-dim)', padding:'0.5rem 0.25rem' }}>All clear! No pending items.</p>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:'0.4rem' }}>
              {pending_rx > 0 && (
                <div style={{ display:'flex', alignItems:'center', gap:'0.625rem', padding:'0.625rem 0.75rem', background:'var(--amber-dim)', border:'1px solid rgba(245,158,11,.2)', borderRadius:'var(--r-sm)' }}>
                  <Pill size={14} color="var(--amber)"/>
                  <div>
                    <p style={{ margin:0, fontSize:'0.82rem', fontWeight:600, color:'var(--text-bright)' }}>{pending_rx} Pending Prescription{pending_rx>1?'s':''}</p>
                    <p style={{ margin:0, fontSize:'0.72rem', color:'var(--text-dim)' }}>Awaiting dispensing</p>
                  </div>
                </div>
              )}
              {pending_tests > 0 && (
                <div style={{ display:'flex', alignItems:'center', gap:'0.625rem', padding:'0.625rem 0.75rem', background:'var(--violet-dim)', border:'1px solid rgba(139,92,246,.2)', borderRadius:'var(--r-sm)' }}>
                  <FlaskConical size={14} color="var(--violet)"/>
                  <div>
                    <p style={{ margin:0, fontSize:'0.82rem', fontWeight:600, color:'var(--text-bright)' }}>{pending_tests} Pending Lab Test{pending_tests>1?'s':''}</p>
                    <p style={{ margin:0, fontSize:'0.72rem', color:'var(--text-dim)' }}>Results not yet entered</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// EditPatientModal
// ─────────────────────────────────────────────
function EditPatientModal({ patient, token, onClose, onSaved }:
  { patient: Patient; token: string; onClose: ()=>void; onSaved: ()=>void }) {
  const [form, setForm] = useState({
    name: patient.PatientName, gender: patient.Gender,
    dob: patient.DateOfBirth?.split('T')[0] ?? '', phone: patient.PhoneNumber,
    address: patient.Address, blood_group: patient.BloodGroup,
    emergency_contact: patient.EmergencyContact ?? '',
    emergency_contact_name: patient.EmergencyContactName ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr]       = useState('');

  async function save(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setErr('');
    try {
      const res = await fetch(`${API}/patients/${(patient as any).PatientID}`, {
        method:'PUT', headers:{ Authorization:`Bearer ${token}`, 'Content-Type':'application/json' },
        body: JSON.stringify(form),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      onSaved();
    } catch(ex: any) { setErr(ex.message); }
    finally { setSaving(false); }
  }

  return (
    <Modal title={`Edit — ${patient.PatientName}`} onClose={onClose}>
      {err && <div className="form-error"><AlertCircle size={14}/> {err}</div>}
      <form onSubmit={save} className="data-form" style={{ padding:0, background:'none', boxShadow:'none' }}>
        <div className="form-row">
          <div className="form-group"><label>Full Name *</label><input type="text" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} required/></div>
          <div className="form-group"><label>Gender *</label>
            <select value={form.gender} onChange={e=>setForm({...form,gender:e.target.value})}>
              <option>Male</option><option>Female</option><option>Other</option>
            </select>
          </div>
        </div>
        <div className="form-row">
          <div className="form-group"><label>Date of Birth *</label><input type="date" value={form.dob} onChange={e=>setForm({...form,dob:e.target.value})}/></div>
          <div className="form-group"><label>Blood Group *</label>
            <select value={form.blood_group} onChange={e=>setForm({...form,blood_group:e.target.value})}>
              {['A+','A-','B+','B-','O+','O-','AB+','AB-'].map(g=><option key={g}>{g}</option>)}
            </select>
          </div>
        </div>
        <div className="form-row">
          <div className="form-group"><label>Phone *</label><input type="tel" value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})}/></div>
          <div className="form-group"><label>Address *</label><input type="text" value={form.address} onChange={e=>setForm({...form,address:e.target.value})}/></div>
        </div>
        <div className="form-row">
          <div className="form-group"><label>Emergency Contact Name</label><input type="text" value={form.emergency_contact_name} onChange={e=>setForm({...form,emergency_contact_name:e.target.value})}/></div>
          <div className="form-group"><label>Emergency Contact Phone</label><input type="tel" value={form.emergency_contact} onChange={e=>setForm({...form,emergency_contact:e.target.value})}/></div>
        </div>
        <button type="submit" className="submit-btn" disabled={saving} style={{ marginTop:'0.5rem' }}>
          <Save size={15}/> {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </form>
    </Modal>
  );
}

// ─────────────────────────────────────────────
// AssignCredsModal
// ─────────────────────────────────────────────
function AssignCredsModal({ patient, token, onClose, onSaved }:
  { patient: PatientNoCreds; token: string; onClose: ()=>void; onSaved: ()=>void }) {
  const [form, setForm] = useState({ username:'', password:'' });
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr]       = useState('');

  async function save(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setErr('');
    try {
      const res = await fetch(`${API}/admin/assign-credentials`, {
        method:'POST', headers:{ Authorization:`Bearer ${token}`, 'Content-Type':'application/json' },
        body: JSON.stringify({ patient_id: patient.PatientID, ...form }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      onSaved();
    } catch(ex: any) { setErr(ex.message); }
    finally { setSaving(false); }
  }

  return (
    <Modal title={`Assign Credentials — ${patient.PatientName}`} onClose={onClose}>
      <p style={{ color:'var(--text-dim)', fontSize:'0.85rem', marginBottom:'1.25rem' }}>This patient was imported via CSV and has no login account yet.</p>
      {err && <div className="form-error"><AlertCircle size={14}/> {err}</div>}
      <form onSubmit={save} className="data-form" style={{ padding:0, background:'none', boxShadow:'none' }}>
        <div className="form-group"><label>Username *</label><input type="text" value={form.username} minLength={3} required onChange={e=>setForm({...form,username:e.target.value})} placeholder="Min 3 characters"/></div>
        <div className="form-group">
          <label>Password *</label>
          <div style={{ position:'relative' }}>
            <input type={show?'text':'password'} value={form.password} minLength={6} required
              onChange={e=>setForm({...form,password:e.target.value})} placeholder="Min 6 characters"
              style={{ paddingRight:'2.5rem' }}/>
            <button type="button" onClick={()=>setShow(v=>!v)}
              style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', color:'var(--text-dim)', cursor:'pointer', display:'flex' }}>
              {show ? <EyeOff size={15}/> : <Eye size={15}/>}
            </button>
          </div>
        </div>
        <div style={{ background:'var(--accent-dim)', border:'1px solid rgba(6,182,212,.15)', borderRadius:'var(--r-md)', padding:'0.75rem 1rem', marginBottom:'1rem', fontSize:'0.82rem', color:'var(--accent-light)' }}>
          <strong>{patient.PatientName}</strong> · Blood: {patient.BloodGroup} · {patient.Email}
        </div>
        <button type="submit" className="submit-btn" disabled={saving}>
          <Key size={15}/> {saving ? 'Assigning...' : 'Assign Credentials'}
        </button>
      </form>
    </Modal>
  );
}

// ─────────────────────────────────────────────
// ScansModal
// ─────────────────────────────────────────────
function ScansModal({ patientId, patientName, token, onClose }:
  { patientId: number; patientName: string; token: string; onClose: ()=>void }) {
  const [scans, setScans]   = useState<ScanFile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/scans/patient/${patientId}`, { headers:{ Authorization:`Bearer ${token}` } })
      .then(r=>r.json()).then(setScans).catch(console.error).finally(()=>setLoading(false));
  }, [patientId]);

  return (
    <Modal title={`Scans — ${patientName}`} onClose={onClose} wide>
      {loading ? <div style={{ textAlign:'center', padding:'2rem', color:'var(--text-dim)' }}>Loading scans...</div>
      : scans.length === 0 ? (
        <div className="empty-state" style={{ padding:'2rem' }}>
          <ScanLine size={48} style={{ opacity:0.3 }}/>
          <p>No scans uploaded for this patient yet.</p>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:'0.75rem' }}>
          {scans.map(s => (
            <div key={s.FileID} style={{ background:'var(--rose-dim)', border:'1px solid rgba(244,63,94,.14)', borderRadius:'var(--r-lg)', padding:'0.875rem 1.25rem', display:'flex', alignItems:'center', gap:'1rem' }}>
              <div style={{ width:44, height:44, borderRadius:11, background:'rgba(244,63,94,.1)', border:'1px solid rgba(244,63,94,.2)', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--rose)', flexShrink:0 }}><ScanLine size={20}/></div>
              <div style={{ flex:1, minWidth:0 }}>
                <p style={{ margin:0, fontWeight:700, fontSize:'0.9rem' }}>{s.FileName}</p>
                <p style={{ margin:'0.15rem 0 0', fontSize:'0.78rem', color:'var(--text-dim)' }}>{s.FileType} · {(s.FileSize/1024/1024).toFixed(2)} MB · {fmtDate(s.UploadedAt)} · <strong>{s.UploadedByUsername}</strong></p>
                {s.Description && <p style={{ margin:'0.2rem 0 0', fontSize:'0.78rem', color:'var(--text-mid)' }}>{s.Description}</p>}
              </div>
              <a href={`${API}/files/download/${s.FileID}`} target="_blank" rel="noreferrer"
                style={{ background:'rgba(244,63,94,.12)', border:'1px solid rgba(244,63,94,.25)', borderRadius:9, padding:'0.45rem 0.875rem', color:'var(--rose)', display:'flex', alignItems:'center', gap:'0.35rem', fontSize:'0.8rem', fontWeight:700, textDecoration:'none' }}>
                <Download size={14}/> Download
              </a>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}


// ─────────────────────────────────────────────
// PatientTimeline — 12-month chronological event feed
// ─────────────────────────────────────────────
type TLEvent = {
  date: Date; type: 'visit'|'diagnosis'|'rx'|'lab'|'file';
  title: string; subtitle?: string;
  severity?: string; isChronic?: boolean; status?: string;
  color: string; bg: string;
};

function PatientTimeline({ visits, diagnoses, prescriptions, labTests, files }:
  { visits:any[]; diagnoses:any[]; prescriptions:any[]; labTests:any[]; files:any[] }) {
  const oneYearAgo = new Date(); oneYearAgo.setFullYear(oneYearAgo.getFullYear()-1);

  const events: TLEvent[] = [
    ...visits.map(v=>({ date:new Date(v.VisitDate||v.visitDate||''), type:'visit' as const,
      title:v.ReasonForVisit||'Visit', subtitle:`${v.DoctorName||''} · ${v.Status||''}`,
      status:v.Status, color:'#06b6d4', bg:'var(--accent-dim)' })),
    ...diagnoses.map(d=>({ date:new Date(d.VisitDate||''), type:'diagnosis' as const,
      title:d.DiagnosisName||'Diagnosis', subtitle:d.Description,
      severity:d.Severity, isChronic:!!d.IsChronic,
      color:d.IsChronic?'#8b5cf6':'#10b981',
      bg:d.IsChronic?'var(--violet-dim)':'var(--emerald-dim)' })),
    ...prescriptions.map(rx=>({ date:new Date(rx.VisitDate||''), type:'rx' as const,
      title:`${rx.MedicineName||''} ${rx.Dosage||''}`.trim()||'Prescription',
      subtitle:`${rx.Frequency||''} · ${rx.Duration||''}`.replace(/^ · | · $/,''),
      status:rx.IsDispensed?'Dispensed':'Pending',
      color:'#10b981', bg:'var(--emerald-dim)' })),
    ...labTests.map(t=>({ date:new Date(t.CreatedAt||''), type:'lab' as const,
      title:t.TestName||'Lab Test', subtitle:t.TestType,
      status:t.Status, color:'#06d6a0', bg:'rgba(6,214,160,0.1)' })),
    ...files.map(f=>({ date:new Date(f.UploadedAt||''), type:'file' as const,
      title:f.FileName||'File', subtitle:`${f.FileType||''} · ${((f.FileSize||0)/1024/1024).toFixed(1)} MB`,
      color:'#f59e0b', bg:'var(--amber-dim)' })),
  ].filter(e => !isNaN(e.date.getTime()) && e.date >= oneYearAgo)
   .sort((a,b) => b.date.getTime() - a.date.getTime());

  const typeIcon:Record<string,string> = { visit:'🏥', diagnosis:'🩺', rx:'💊', lab:'🧪', file:'📄' };
  const typeLabel:Record<string,string> = { visit:'VISIT', diagnosis:'DIAGNOSIS', rx:'PRESCRIPTION', lab:'LAB TEST', file:'FILE' };

  const byMonth: Record<string,TLEvent[]> = {};
  events.forEach(e => {
    const k = e.date.toLocaleDateString('en-GB',{month:'long',year:'numeric'});
    if (!byMonth[k]) byMonth[k]=[];
    byMonth[k].push(e);
  });

  if (events.length===0) return (
    <div className="empty-state">
      <div style={{ fontSize:36,opacity:.25,marginBottom:'0.5rem' }}>📅</div>
      <h3>No activity in the last 12 months</h3>
      <p>Visits, diagnoses, prescriptions, lab tests and files all appear here chronologically.</p>
    </div>
  );

  return (
    <div>
      {/* Summary pills */}
      <div style={{ display:'flex',gap:'0.5rem',flexWrap:'wrap',marginBottom:'1.5rem' }}>
        {[
          { label:'Total Events', count:events.length,                                        color:'var(--text-bright)' },
          { label:'Visits',       count:events.filter(e=>e.type==='visit').length,       color:'#06b6d4' },
          { label:'Diagnoses',    count:events.filter(e=>e.type==='diagnosis').length,  color:'#8b5cf6' },
          { label:'Prescriptions',count:events.filter(e=>e.type==='rx').length,         color:'#10b981' },
          { label:'Lab Tests',    count:events.filter(e=>e.type==='lab').length,        color:'#06d6a0' },
          { label:'Files',        count:events.filter(e=>e.type==='file').length,       color:'#f59e0b' },
        ].map(s=>(
          <div key={s.label} style={{ padding:'0.35rem 0.875rem',borderRadius:999,border:'1px solid var(--border)',background:'var(--raised)',fontSize:'0.77rem',color:'var(--text-mid)',display:'flex',gap:'0.4rem',alignItems:'center' }}>
            <strong style={{ color:s.color,fontFamily:"'Syne',sans-serif",fontWeight:800 }}>{s.count}</strong>{' '}{s.label}
          </div>
        ))}
      </div>

      {/* Vertical timeline */}
      <div style={{ position:'relative' }}>
        <div style={{ position:'absolute',left:19,top:0,bottom:0,width:2,background:'var(--border)',borderRadius:2 }}/>
        {Object.entries(byMonth).map(([month,evts])=>(
          <div key={month} style={{ marginBottom:'1.75rem' }}>
            {/* Month marker */}
            <div style={{ display:'flex',alignItems:'center',gap:'0.875rem',marginBottom:'0.875rem',position:'relative' }}>
              <div style={{ width:40,height:40,borderRadius:'50%',background:'var(--card-bg)',border:'2px solid var(--accent)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'0.58rem',fontWeight:800,fontFamily:"'Syne',sans-serif",color:'var(--accent)',flexShrink:0,zIndex:1,lineHeight:1.2,textAlign:'center',padding:'0.25rem' }}>
                {month.split(' ')[0].slice(0,3).toUpperCase()}<br/>{month.split(' ')[1].slice(2)}
              </div>
              <span style={{ fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:'0.88rem',color:'var(--text-bright)' }}>{month}</span>
              <span style={{ fontSize:'0.72rem',color:'var(--text-dim)',padding:'0.15rem 0.5rem',borderRadius:999,background:'var(--raised)',border:'1px solid var(--border)' }}>
                {evts.length} event{evts.length!==1?'s':''}
              </span>
            </div>
            {/* Events */}
            <div style={{ marginLeft:56,display:'flex',flexDirection:'column',gap:'0.5rem' }}>
              {evts.map((e,i)=>(
                <div key={i} style={{ background:e.bg,border:`1px solid ${e.color}30`,borderRadius:'var(--r-md)',padding:'0.75rem 1rem',display:'flex',alignItems:'flex-start',gap:'0.75rem' }}>
                  <span style={{ fontSize:'1rem',flexShrink:0,marginTop:1 }}>{typeIcon[e.type]}</span>
                  <div style={{ flex:1,minWidth:0 }}>
                    <div style={{ display:'flex',alignItems:'center',gap:'0.5rem',flexWrap:'wrap',marginBottom:'0.2rem' }}>
                      <span style={{ fontWeight:600,fontSize:'0.875rem',color:'var(--text-bright)' }}>{e.title}</span>
                      {e.severity && <span className={`badge ${e.severity==='Severe'?'sev-badge-severe':e.severity==='Moderate'?'sev-badge-moderate':'sev-badge-mild'}`}>{e.severity}</span>}
                      {e.isChronic && <span className="badge badge-chronic">Chronic</span>}
                      {e.status && <span style={{ fontSize:'0.7rem',padding:'0.15rem 0.5rem',borderRadius:4,fontWeight:700,
                        background:e.status==='Completed'||e.status==='Dispensed'?'var(--emerald-dim)':e.status==='Cancelled'?'var(--rose-dim)':'var(--amber-dim)',
                        color:e.status==='Completed'||e.status==='Dispensed'?'var(--emerald)':e.status==='Cancelled'?'var(--rose)':'var(--amber)' }}>{e.status}</span>}
                    </div>
                    {e.subtitle && <p style={{ margin:0,fontSize:'0.78rem',color:'var(--text-dim)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{e.subtitle}</p>}
                    <p style={{ margin:'0.2rem 0 0',fontSize:'0.68rem',color:'var(--text-dim)',fontFamily:"'JetBrains Mono',monospace" }}>
                      {e.date.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})} · <span style={{ color:e.color,fontWeight:700 }}>{typeLabel[e.type]}</span>
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// AdminPatientDetailPane
// Full in-depth view of a patient for admin:
// stats summary → visits → diagnoses → prescriptions → lab tests → files
// Plus 1-year data retention management
// ─────────────────────────────────────────────
function AdminPatientDetailPane({ patient, token, onEdit, onDelete }:
  { patient: Patient & { PatientID: number }; token: string; onEdit:()=>void; onDelete:()=>void }) {

  const [detail, setDetail]     = useState<AdminPatientFull|null>(null);
  const [loading, setLoading]   = useState(true);
  const [err, setErr]           = useState('');
  const [activeTab, setActiveTab] = useState<'overview'|'timeline'|'visits'|'diagnoses'|'prescriptions'|'labs'|'files'>('overview');
  const [diagSummary, setDiagSummary] = useState<any[]>([]);
  const [openVisit, setOpenVisit] = useState<number|null>(null);
  const [purging, setPurging]   = useState(false);
  const [purgeMsg, setPurgeMsg] = useState('');

  useEffect(() => {
    setLoading(true); setErr(''); setDetail(null); setDiagSummary([]);
    fetch(`${API}/patients/${patient.PatientID}/full-details`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(d => { if (d.error) setErr(d.error); else setDetail(d); })
      .catch(() => setErr('Failed to load patient details'))
      .finally(() => setLoading(false));
    // Top diagnoses analytics
    fetch(`${API}/analytics/patient-diagnosis-summary/${patient.PatientID}`, {
      headers: { Authorization: `Bearer ${token}` }
    }).then(r=>r.json()).then(d=>{ if(Array.isArray(d)) setDiagSummary(d); }).catch(()=>{});
  }, [patient.PatientID, token]);

  async function purgeOldData() {
    if (!window.confirm(`This will permanently delete all records for ${patient.PatientName} older than 1 year. Continue?`)) return;
    setPurging(true); setPurgeMsg('');
    try {
      const res = await fetch(`${API}/admin/patients/${patient.PatientID}/purge-old-data`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setPurgeMsg(`✅ ${d.message}`);
      // reload detail
      const r2 = await fetch(`${API}/patients/${patient.PatientID}/full-details`, { headers: { Authorization: `Bearer ${token}` } });
      const d2 = await r2.json();
      setDetail(d2);
    } catch(e:any) { setPurgeMsg(`Error: ${e.message}`); }
    finally { setPurging(false); }
  }

  async function downloadFile(fid: number, name: string) {
    const res = await fetch(`${API}/files/download/${fid}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return alert('Download failed');
    const a = document.createElement('a'); a.href = URL.createObjectURL(await res.blob()); a.download = name;
    document.body.appendChild(a); a.click(); URL.revokeObjectURL(a.href); document.body.removeChild(a);
  }

  const age = new Date().getFullYear() - new Date(patient.DateOfBirth).getFullYear();
  const oneYearAgo = new Date(); oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

  // Stats
  const thisYearVisits = detail?.visits.filter(v => new Date(v.VisitDate) >= oneYearAgo).length ?? 0;
  const totalVisits    = detail?.visits.length ?? 0;
  const chronicCount   = detail?.diagnoses.filter(d => d.IsChronic).length ?? 0;
  const pendingRx      = detail?.prescriptions.filter(p => !p.IsDispensed).length ?? 0;
  const oldRecords     = detail?.visits.filter(v => new Date(v.VisitDate) < oneYearAgo).length ?? 0;

  const TABS = [
    { key:'overview',      label:'Overview',      count: null },
    { key:'timeline',      label:'Timeline ✦',    count: null },
    { key:'visits',        label:'Visits',        count: totalVisits },
    { key:'diagnoses',     label:'Diagnoses',     count: detail?.diagnoses.length },
    { key:'prescriptions', label:'Prescriptions', count: detail?.prescriptions.length },
    { key:'labs',          label:'Lab Tests',     count: detail?.lab_tests.length },
    { key:'files',         label:'Files',         count: detail?.files.length },
  ] as const;

  return (
    <div style={{ height:'100%', display:'flex', flexDirection:'column', overflow:'hidden' }}>
      {/* ── Patient Header ── */}
      <div style={{ padding:'1.25rem 1.5rem', background:'var(--card-bg)', borderBottom:'1px solid var(--border)', flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:'1rem', flexWrap:'wrap' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'1rem' }}>
            <div style={{ width:52, height:52, borderRadius:'var(--r-lg)', background:'linear-gradient(135deg,var(--accent-dim),var(--violet-dim))', border:'1px solid rgba(6,182,212,.25)', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:'1.1rem', color:'var(--accent)', flexShrink:0 }}>
              {getInitials(patient.PatientName)}
            </div>
            <div>
              <div style={{ fontFamily:"'Syne',sans-serif", fontSize:'1.15rem', fontWeight:800, color:'var(--text-bright)', marginBottom:'0.2rem' }}>{patient.PatientName}</div>
              <div style={{ fontSize:'0.8rem', color:'var(--text-dim)' }}>
                {patient.Gender} · {age} yrs · {fmtDate(patient.DateOfBirth)} · {patient.PhoneNumber}
              </div>
              <div style={{ display:'flex', gap:'0.35rem', marginTop:'0.35rem', flexWrap:'wrap' }}>
                <span className="badge badge-blood">{patient.BloodGroup}</span>
                {chronicCount > 0 && <span className="badge badge-chronic">⚕ {chronicCount} Chronic</span>}
                <span className="badge badge-accent">{thisYearVisits} visits this year</span>
              </div>
            </div>
          </div>
          <div style={{ display:'flex', gap:'0.5rem', flexWrap:'wrap' }}>
            <button onClick={onEdit} className="pab pab-summary"><Edit2 size={13}/> Edit</button>
            <button onClick={()=>onDelete()} className="pab" style={{ background:'var(--rose-dim)', border:'1px solid rgba(244,63,94,.2)', color:'var(--rose)' }}><Trash2 size={13}/> Deactivate</button>
          </div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div style={{ display:'flex', gap:0, borderBottom:'1px solid var(--border)', background:'var(--card-bg)', flexShrink:0, overflowX:'auto' }}>
        {TABS.map(t => (
          <button key={t.key} onClick={()=>setActiveTab(t.key as any)}
            style={{ padding:'0.75rem 1.125rem', border:'none', borderBottom: activeTab===t.key ? '2px solid var(--accent)' : '2px solid transparent', background:'none', color: activeTab===t.key ? 'var(--accent)' : 'var(--text-dim)', fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:'0.8rem', cursor:'pointer', display:'flex', alignItems:'center', gap:'0.4rem', whiteSpace:'nowrap', transition:'color var(--t-fast)', letterSpacing:'0.02em' }}>
            {t.label}
            {t.count != null && <span style={{ padding:'0.1rem 0.4rem', borderRadius:999, fontSize:'0.65rem', background: activeTab===t.key ? 'var(--accent-dim)' : 'var(--raised)', color: activeTab===t.key ? 'var(--accent)' : 'var(--text-dim)', fontWeight:700 }}>{t.count}</span>}
          </button>
        ))}
      </div>

      {/* ── Tab Body ── */}
      <div style={{ flex:1, overflowY:'auto', padding:'1.25rem 1.5rem' }}>
        {loading && <div style={{ textAlign:'center', padding:'3rem', color:'var(--text-dim)' }}>Loading patient details...</div>}
        {err     && <div style={{ color:'var(--rose)', padding:'1rem' }}>{err}</div>}

        {!loading && detail && (<>

          {/* ══ OVERVIEW TAB ══ */}
          {activeTab === 'overview' && (
            <div>
              {/* Stat cards */}
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))', gap:'0.875rem', marginBottom:'1.25rem' }}>
                {[
                  { label:'Total Visits',       value: totalVisits,                  color:'var(--accent)',   bg:'var(--accent-dim)' },
                  { label:'Visits This Year',   value: thisYearVisits,               color:'var(--emerald)',  bg:'var(--emerald-dim)' },
                  { label:'Chronic Conditions', value: chronicCount,                 color:'var(--violet)',   bg:'var(--violet-dim)' },
                  { label:'Pending Rx',         value: pendingRx,                    color:'var(--amber)',    bg:'var(--amber-dim)' },
                  { label:'Lab Tests',          value: detail.lab_tests.length,      color:'#06d6a0',        bg:'rgba(6,214,160,.1)' },
                  { label:'Files Uploaded',     value: detail.files.length,          color:'var(--text-mid)', bg:'var(--raised)' },
                ].map(s => (
                  <div key={s.label} style={{ padding:'0.875rem 1rem', background: s.bg, border:'1px solid var(--border)', borderRadius:'var(--r-md)' }}>
                    <div style={{ fontFamily:"'Syne',sans-serif", fontSize:'1.6rem', fontWeight:800, color: s.color, lineHeight:1 }}>{s.value}</div>
                    <div style={{ fontSize:'0.75rem', color:'var(--text-dim)', marginTop:'0.3rem' }}>{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Demographics */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.875rem', marginBottom:'1.25rem' }}>
                <div className="info-card">
                  <div className="info-card-title">Contact Details</div>
                  <div className="kv-pair"><div className="kv-label">Email</div><div className="kv-value" style={{ fontSize:'0.82rem' }}>{patient.Email}</div></div>
                  <div className="kv-pair"><div className="kv-label">Phone</div><div className="kv-value">{patient.PhoneNumber}</div></div>
                  <div className="kv-pair"><div className="kv-label">Address</div><div className="kv-value">{patient.Address}</div></div>
                </div>
                <div className="info-card">
                  <div className="info-card-title">Emergency Contact</div>
                  <div className="kv-pair"><div className="kv-label">Name</div><div className="kv-value">{patient.EmergencyContactName||'—'}</div></div>
                  <div className="kv-pair"><div className="kv-label">Phone</div><div className="kv-value">{patient.EmergencyContact||'—'}</div></div>
                  <div className="kv-pair"><div className="kv-label">Blood Group</div><div className="kv-value" style={{ color:'var(--rose)', fontWeight:700 }}>{patient.BloodGroup}</div></div>
                </div>
              </div>

              {/* Visit frequency bar chart (last 12 months) */}
              <div className="info-card" style={{ marginBottom:'1.25rem' }}>
                <div className="info-card-title">Visit Frequency — Last 12 Months</div>
                {(() => {
                  const months: Record<string,number> = {};
                  for (let i = 11; i >= 0; i--) {
                    const d = new Date(); d.setMonth(d.getMonth() - i);
                    const k = d.toLocaleDateString('en-GB',{month:'short',year:'2-digit'});
                    months[k] = 0;
                  }
                  detail.visits.forEach(v => {
                    if (new Date(v.VisitDate) >= oneYearAgo) {
                      const k = new Date(v.VisitDate).toLocaleDateString('en-GB',{month:'short',year:'2-digit'});
                      if (k in months) months[k]++;
                    }
                  });
                  const entries = Object.entries(months);
                  const maxC = Math.max(...entries.map(([,c])=>c), 1);
                  return (
                    <div style={{ display:'flex', alignItems:'flex-end', gap:4, height:60, marginTop:'0.5rem' }}>
                      {entries.map(([mo,cnt])=>(
                        <div key={mo} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:3, flex:1 }}>
                          <div title={`${mo}: ${cnt} visit${cnt!==1?'s':''}`} style={{ width:'100%', minHeight:4, height: Math.max(4,(cnt/maxC)*48), background: cnt>0 ? 'linear-gradient(180deg,var(--accent),var(--violet))' : 'var(--border)', borderRadius:'3px 3px 0 0', transition:'height .5s ease' }}/>
                          <span style={{ fontSize:7, color:'var(--text-dim)', fontFamily:"'JetBrains Mono',monospace", whiteSpace:'nowrap' }}>{mo}</span>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>

              {/* 1-Year Data Retention Policy */}
              <div style={{ background: oldRecords>0 ? 'var(--amber-dim)' : 'var(--raised)', border:`1px solid ${oldRecords>0?'rgba(245,158,11,.25)':'var(--border)'}`, borderRadius:'var(--r-lg)', padding:'1.25rem 1.5rem' }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:'1rem', flexWrap:'wrap' }}>
                  <div>
                    <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', marginBottom:'0.35rem' }}>
                      <Clock size={16} style={{ color: oldRecords>0 ? 'var(--amber)' : 'var(--text-dim)' }}/>
                      <span style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:'0.9rem', color:'var(--text-bright)' }}>1-Year Data Retention Policy</span>
                    </div>
                    <p style={{ fontSize:'0.82rem', color:'var(--text-dim)', margin:0 }}>
                      {oldRecords > 0
                        ? <><strong style={{ color:'var(--amber)' }}>{oldRecords} visit record{oldRecords!==1?'s':''}</strong> older than 1 year found. You can purge them to free storage and stay compliant.</>
                        : 'All records are within the 1-year retention window. No cleanup needed.'
                      }
                    </p>
                    {purgeMsg && <p style={{ margin:'0.5rem 0 0', fontSize:'0.82rem', color: purgeMsg.startsWith('Error') ? 'var(--rose)' : 'var(--emerald)', fontWeight:600 }}>{purgeMsg}</p>}
                  </div>
                  {oldRecords > 0 && (
                    <button onClick={purgeOldData} disabled={purging}
                      style={{ padding:'0.6rem 1.25rem', background:'var(--amber)', border:'none', borderRadius:'var(--r-md)', color:'#fff', fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:'0.82rem', cursor:purging?'wait':'pointer', opacity:purging?0.65:1, whiteSpace:'nowrap', display:'flex', alignItems:'center', gap:'0.4rem' }}>
                      <Trash2 size={14}/> {purging ? 'Purging...' : `Purge ${oldRecords} Old Record${oldRecords!==1?'s':''}`}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ══ VISITS TAB ══ */}
          {activeTab === 'visits' && (
            <div>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'0.875rem' }}>
                <p style={{ margin:0, fontSize:'0.82rem', color:'var(--text-dim)' }}>{totalVisits} total · <strong style={{ color:'var(--accent)' }}>{thisYearVisits}</strong> in last 12 months · <strong style={{ color:'var(--amber)' }}>{oldRecords}</strong> older than 1 year</p>
              </div>
              {detail.visits.length === 0
                ? <div className="empty-state"><Calendar size={40} style={{ opacity:.3 }}/><p>No visits recorded</p></div>
                : detail.visits.map((v, i) => {
                    const vitals = parseVitals(v.VitalSigns);
                    const isOld  = new Date(v.VisitDate) < oneYearAgo;
                    return (
                      <div key={i} className="visit-accordion" style={{ opacity: isOld ? 0.7 : 1 }}>
                        <div className={`visit-header ${openVisit===i?'open':''}`} onClick={()=>setOpenVisit(openVisit===i?null:i)}>
                          <div className="visit-header-left">
                            <div className="visit-status-dot" style={{ background: v.Status==='Completed'?'#10b981':v.Status==='In Progress'?'#f59e0b':'#475569' }}/>
                            <div className="visit-header-info">
                              <div className="visit-reason">{v.ReasonForVisit}</div>
                              <div className="visit-meta">{v.DoctorName} · {fmtDate(v.VisitDate)} {isOld && <span style={{ color:'var(--amber)', fontSize:'0.7rem', fontWeight:700 }}>· &gt;1yr old</span>}</div>
                            </div>
                          </div>
                          <div style={{ display:'flex', alignItems:'center', gap:'0.5rem' }}>
                            <span style={{ fontSize:'0.72rem', padding:'0.15rem 0.5rem', borderRadius:4, background: v.Status==='Completed'?'var(--emerald-dim)':'var(--amber-dim)', color: v.Status==='Completed'?'var(--emerald)':'var(--amber)', fontWeight:600 }}>{v.Status}</span>
                            <span className={`visit-chevron ${openVisit===i?'open':''}`}><ChevronDown size={16}/></span>
                          </div>
                        </div>
                        {openVisit===i && (
                          <div className="visit-body">
                            {vitals.bp    && <div className="vital-item"><div className="vital-label">Blood Pressure</div><div className="vital-value">{vitals.bp}</div></div>}
                            {vitals.temp  && <div className="vital-item"><div className="vital-label">Temperature</div><div className="vital-value">{vitals.temp}°F</div></div>}
                            {vitals.pulse && <div className="vital-item"><div className="vital-label">Pulse</div><div className="vital-value">{vitals.pulse} bpm</div></div>}
                            {vitals.spo2  && <div className="vital-item"><div className="vital-label">SpO₂</div><div className="vital-value">{vitals.spo2}</div></div>}
                            {v.Notes      && <div className="visit-notes"><div className="vital-label" style={{ marginBottom:'0.3rem' }}>Notes</div>{v.Notes}</div>}
                          </div>
                        )}
                      </div>
                    );
                  })
              }
            </div>
          )}

          {/* ══ DIAGNOSES TAB ══ */}
          {activeTab === 'diagnoses' && (
            detail.diagnoses.length === 0
              ? <div className="empty-state"><Stethoscope size={40} style={{ opacity:.3 }}/><p>No diagnoses recorded</p></div>
              : detail.diagnoses.map((d, i) => (
                <div key={i} className="diagnosis-row">
                  <div>
                    <div className="diagnosis-name">{d.DiagnosisName}</div>
                    {d.Description && <div className="diagnosis-desc">{d.Description}</div>}
                    <div className="diagnosis-date">{fmtDate(d.VisitDate)} · {d.DoctorName}</div>
                  </div>
                  <div className="diagnosis-badges">
                    {d.Severity && <span className={`badge ${sevClass(d.Severity)}`}>{d.Severity}</span>}
                    {d.IsChronic && <span className="badge badge-chronic">Chronic</span>}
                  </div>
                </div>
              ))
          )}

          {/* ══ PRESCRIPTIONS TAB ══ */}
          {activeTab === 'prescriptions' && (
            detail.prescriptions.length === 0
              ? <div className="empty-state"><Pill size={40} style={{ opacity:.3 }}/><p>No prescriptions recorded</p></div>
              : <div className="table-container">
                  <table className="data-table">
                    <thead><tr><th>Medicine</th><th>Dosage</th><th>Frequency</th><th>Duration</th><th>Doctor</th><th>Date</th><th>Status</th></tr></thead>
                    <tbody>{detail.prescriptions.map((rx, i) => (
                      <tr key={i}>
                        <td><strong>{rx.MedicineName}</strong>{rx.Instructions&&<p style={{ margin:'0.1rem 0 0', fontSize:'0.73rem', color:'var(--text-dim)' }}>{rx.Instructions}</p>}</td>
                        <td>{rx.Dosage}</td><td>{rx.Frequency}</td><td>{rx.Duration}</td>
                        <td>{rx.DoctorName}</td><td>{fmtDate(rx.VisitDate)}</td>
                        <td><span className={`status-badge ${rx.IsDispensed?'dispensed':'pending'}`}>{rx.IsDispensed?<><CheckCircle size={12}/> Dispensed</>:<><Clock size={12}/> Pending</>}</span></td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
          )}

          {/* ══ LAB TESTS TAB ══ */}
          {activeTab === 'labs' && (
            detail.lab_tests.length === 0
              ? <div className="empty-state"><FlaskConical size={40} style={{ opacity:.3 }}/><p>No lab tests recorded</p></div>
              : <div className="table-container">
                  <table className="data-table">
                    <thead><tr><th>Test</th><th>Type</th><th>Ordered</th><th>Status</th><th>Results</th></tr></thead>
                    <tbody>{detail.lab_tests.map((t, i) => (
                      <tr key={i}>
                        <td><strong>{t.TestName}</strong></td>
                        <td><span style={{ fontSize:'0.76rem', padding:'0.15rem 0.5rem', borderRadius:5, background:'var(--accent-dim)', color:'var(--accent)' }}>{t.TestType}</span></td>
                        <td>{fmtDate(t.CreatedAt)}</td>
                        <td><span style={{ fontSize:'0.76rem', padding:'0.2rem 0.6rem', borderRadius:5, fontWeight:600, background: t.Status==='Completed'?'var(--emerald-dim)':'var(--amber-dim)', color: t.Status==='Completed'?'var(--emerald)':'var(--amber)' }}>{t.Status}</span></td>
                        <td style={{ fontSize:'0.82rem', color:'var(--text-mid)', maxWidth:200 }}>{t.Results||<span style={{ color:'var(--text-dim)', fontStyle:'italic' }}>Pending</span>}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
          )}

          {/* ══ FILES TAB ══ */}
          {activeTab === 'files' && (
            detail.files.length === 0
              ? <div className="empty-state"><FileImage size={40} style={{ opacity:.3 }}/><p>No files uploaded</p></div>
              : <div className="files-grid">
                  {detail.files.map((f: any) => (
                    <div key={f.FileID} className="file-card">
                      <div className="file-icon"><FileImage size={28}/></div>
                      <div className="file-details">
                        <h4>{f.FileType}</h4>
                        <p className="file-name">{f.FileName}</p>
                        <p className="file-size">{(f.FileSize/1024/1024).toFixed(2)} MB</p>
                        <p className="file-date">{fmtDate(f.UploadedAt)} · {f.UploadedByUsername}</p>
                        {f.Description && <p className="file-desc">{f.Description}</p>}
                      </div>
                      <button className="download-btn" onClick={()=>downloadFile(f.FileID, f.FileName)}><Download size={16}/> Download</button>
                    </div>
                  ))}
                </div>
          )}

          {/* ══ TIMELINE TAB ══ */}
          {activeTab === 'timeline' && detail && (
            <PatientTimeline
              visits={detail.visits}
              diagnoses={detail.diagnoses}
              prescriptions={detail.prescriptions}
              labTests={detail.lab_tests}
              files={detail.files}
            />
          )}

          {/* ══ DIAGNOSIS ANALYTICS — shown at bottom of overview ══ */}
          {activeTab === 'overview' && diagSummary.length > 0 && (
            <div className="info-card" style={{ marginTop:'1.25rem' }}>
              <div className="info-card-title">🔬 Top Diagnoses — Last 12 Months</div>
              {diagSummary.slice(0,6).map((d:any,i:number)=>(
                <div key={i} style={{ display:'flex',alignItems:'center',gap:'0.75rem',padding:'0.5rem 0',borderBottom:i<Math.min(diagSummary.length,6)-1?'1px solid var(--border)':'none' }}>
                  <div style={{ width:30,height:30,borderRadius:7,background:d.IsChronic?'var(--violet-dim)':'var(--accent-dim)',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:'0.72rem',color:d.IsChronic?'var(--violet)':'var(--accent)',flexShrink:0 }}>
                    {d.Frequency}×
                  </div>
                  <div style={{ flex:1 }}>
                    <span style={{ fontWeight:600,fontSize:'0.875rem',color:'var(--text-bright)' }}>{d.DiagnosisName}</span>
                    {d.IsChronic && <span className="badge badge-chronic" style={{ marginLeft:'0.4rem',fontSize:'0.65rem' }}>Chronic</span>}
                    {d.WorstSeverity && <span className={`badge ${d.WorstSeverity==='Severe'?'sev-badge-severe':d.WorstSeverity==='Moderate'?'sev-badge-moderate':'sev-badge-mild'}`} style={{ marginLeft:'0.3rem',fontSize:'0.65rem' }}>{d.WorstSeverity}</span>}
                  </div>
                  <span style={{ fontSize:'0.72rem',color:'var(--text-dim)',fontFamily:"'JetBrains Mono',monospace" }}>Last: {fmtDate(d.LastSeen)}</span>
                </div>
              ))}
            </div>
          )}
        </>)}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// LoginScreen  — Linways-style split layout
// Left: full visual panel  |  Right: role list → login form
// ─────────────────────────────────────────────
function LoginScreen({ onLogin, onShowRegister, formErr, loading, theme, setTheme }:
  { onLogin:(u:string,p:string)=>Promise<void>; onShowRegister:()=>void; formErr:string; loading:boolean; theme:ThemeKey; setTheme:(k:ThemeKey)=>void }) {
  const [selectedRole, setSelectedRole] = useState<string|null>(null);
  const [username, setUsername]         = useState(''  );
  const [password, setPassword]         = useState(''  );
  const [showPass, setShowPass]         = useState(false);
  const [panel, setPanel]               = useState<'roles'|'form'>('roles');
  const entity = ENTITIES.find(e => e.role === selectedRole) ?? null;

  function handleRoleClick(role: string) {
    setSelectedRole(role);
    setUsername(''); setPassword('');
    setTimeout(() => setPanel('form'), 80);
  }

  function handleBack() {
    setPanel('roles');
    setTimeout(() => setSelectedRole(null), 300);
  }

  return (
    <div style={{ display:'flex', height:'100vh', overflow:'hidden', fontFamily:"'DM Sans','Segoe UI',sans-serif", background:'var(--bg)' }}>

      {/* LEFT VISUAL PANEL */}
      <div style={{ flex:1, position:'relative', overflow:'hidden', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minWidth:0 }}>
        <div style={{ position:'absolute', inset:0, background:'linear-gradient(135deg, var(--bg-1) 0%, var(--bg) 40%, var(--bg-1) 100%)' }}/>
        <div style={{ position:'absolute', top:'-10%', left:'-5%', width:600, height:600, borderRadius:'50%', background:'radial-gradient(circle, var(--accent-glow) 0%, transparent 65%)', filter:'blur(40px)', animation:'blobFloat1 18s ease-in-out infinite' }}/>
        <div style={{ position:'absolute', bottom:'-15%', right:'-8%', width:500, height:500, borderRadius:'50%', background:'radial-gradient(circle, var(--violet-dim) 0%, transparent 65%)', filter:'blur(50px)', animation:'blobFloat2 22s ease-in-out infinite 3s' }}/>
        <div style={{ position:'absolute', top:'40%', left:'55%', width:320, height:320, borderRadius:'50%', background:'radial-gradient(circle, var(--emerald-dim) 0%, transparent 65%)', filter:'blur(40px)', animation:'blobFloat1 15s ease-in-out infinite 6s' }}/>
        <div style={{ position:'absolute', inset:0, backgroundImage:'linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)', backgroundSize:'48px 48px', opacity:.5 }}/>

        {/* Theme switcher — top-left corner of the page */}
        <div style={{ position:'absolute', top:'1rem', left:'1rem', zIndex:10 }}>
          <ThemeSwitcher theme={theme} setTheme={setTheme}/>
        </div>

        <div style={{ position:'relative', zIndex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:'2.5rem', padding:'2rem' }}>
          {/* Medical cross SVG illustration */}
          <svg viewBox="0 0 300 300" style={{ width:'min(260px,32vw)', height:'auto', filter:'drop-shadow(0 0 40px var(--accent-glow))' }}>
            <circle cx="150" cy="150" r="130" fill="none" stroke="var(--accent)" strokeWidth="1" strokeDasharray="6 4" opacity=".25"/>
            <circle cx="150" cy="150" r="90" fill="var(--accent-glow)"/>
            <rect x="118" y="70" width="64" height="160" rx="20" fill="var(--accent)" opacity=".85"/>
            <rect x="70" y="118" width="160" height="64" rx="20" fill="var(--accent)" opacity=".85"/>
            <rect x="134" y="86" width="32" height="128" rx="10" fill="white" opacity=".2"/>
            <rect x="86" y="134" width="128" height="32" rx="10" fill="white" opacity=".2"/>
            <polyline points="60,165 85,165 98,138 113,192 128,145 143,165 157,165 170,128 185,196 200,165 240,165" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" opacity=".65"/>
          </svg>

          <div style={{ textAlign:'center' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:'0.75rem', marginBottom:'0.5rem' }}>
              <div style={{ width:44, height:44, borderRadius:13, background:'linear-gradient(135deg,var(--accent),var(--violet))', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 0 24px var(--accent-glow)' }}>
                <Heart size={22} color="white"/>
              </div>
              <h1 style={{ fontFamily:"'Syne',sans-serif", fontSize:'2.1rem', fontWeight:800, letterSpacing:'-0.04em', margin:0, background:'linear-gradient(135deg, var(--accent-light) 0%, var(--text-bright) 60%, var(--violet) 100%)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text' }}>
                MediCare Plus
              </h1>
            </div>
            <p style={{ fontSize:'0.72rem', color:'var(--text-dim)', letterSpacing:'0.18em', textTransform:'uppercase', fontWeight:700, margin:'0 0 1.75rem' }}>
              Hospital Management System
            </p>
            <div style={{ display:'flex', gap:'0.5rem', justifyContent:'center', flexWrap:'wrap' }}>
              {['Multi-Role Access','Chronic Tracking','Lab Tests','Secure & Private'].map(f => (
                <span key={f} style={{ padding:'0.3rem 0.875rem', borderRadius:999, background:'var(--accent-dim)', border:'1px solid var(--border)', fontSize:'0.72rem', color:'var(--text-mid)', fontWeight:500 }}>{f}</span>
              ))}
            </div>
          </div>
        </div>

        <div style={{ position:'absolute', bottom:'1.25rem', left:0, right:0, textAlign:'center', fontSize:'0.7rem', color:'var(--text-dim)', letterSpacing:'0.06em' }}>
          Presidency University · Bengaluru
        </div>
      </div>

      {/* RIGHT PANEL */}
      <div style={{ width:'min(400px,42vw)', minWidth:340, background:'var(--card-bg)', borderLeft:'1px solid var(--border)', display:'flex', flexDirection:'column', position:'relative', overflow:'hidden', boxShadow:'-8px 0 40px rgba(0,0,0,0.12)' }}>

        {/* PANEL A: Role selection */}
        <div className={`ls-panel ${panel==='roles'?'ls-panel-in':'ls-panel-out-left'}`}
          style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', justifyContent:'center', padding:'2.5rem 2rem', overflowY:'auto' }}>

          <div style={{ marginBottom:'2rem' }}>
            <h2 style={{ fontFamily:"'Syne',sans-serif", fontSize:'1.6rem', fontWeight:800, letterSpacing:'-0.03em', color:'var(--text-bright)', margin:'0 0 0.35rem' }}>Welcome back</h2>
            <p style={{ fontSize:'0.88rem', color:'var(--text-dim)', margin:0 }}>Select your role to sign in</p>
          </div>

          <div style={{ display:'flex', flexDirection:'column', gap:'0.625rem' }}>
            {ENTITIES.map((e) => (
              <button key={e.role} onClick={() => handleRoleClick(e.role)}
                style={{ all:'unset', display:'flex', alignItems:'center', gap:'1rem', padding:'1rem 1.25rem', borderRadius:'var(--r-lg)', border:'1px solid var(--border)', background:'var(--raised)', cursor:'pointer', transition:'all 0.2s cubic-bezier(0.16,1,0.3,1)', position:'relative', overflow:'hidden', boxSizing:'border-box' }}
                onMouseEnter={ev => {
                  const b = ev.currentTarget as HTMLButtonElement;
                  b.style.borderColor = e.color; b.style.background = `${e.color}0f`; b.style.transform = 'translateX(4px)';
                }}
                onMouseLeave={ev => {
                  const b = ev.currentTarget as HTMLButtonElement;
                  b.style.borderColor = 'var(--border)'; b.style.background = 'var(--raised)'; b.style.transform = 'translateX(0)';
                }}>
                <div style={{ position:'absolute', left:0, top:0, bottom:0, width:3, borderRadius:'0 3px 3px 0', background:e.color, opacity:0.8 }}/>
                <div style={{ width:40, height:40, borderRadius:10, background:`${e.color}18`, border:`1px solid ${e.color}30`, display:'flex', alignItems:'center', justifyContent:'center', color:e.color, flexShrink:0 }}>{e.icon}</div>
                <div style={{ flex:1 }}>
                  <p style={{ margin:0, fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:'0.95rem', color:'var(--text-bright)' }}>{e.role}</p>
                  <p style={{ margin:'0.1rem 0 0', fontSize:'0.75rem', color:'var(--text-dim)' }}>{e.desc}</p>
                </div>
                <ChevronDown size={16} style={{ color:'var(--text-dim)', transform:'rotate(-90deg)', flexShrink:0 }}/>
              </button>
            ))}
          </div>

          <div style={{ marginTop:'2rem', paddingTop:'1.5rem', borderTop:'1px solid var(--border)', textAlign:'center' }}>
            <p style={{ fontSize:'0.85rem', color:'var(--text-dim)', margin:0 }}>New patient?{' '}
              <button onClick={onShowRegister} style={{ background:'none', border:'none', color:'var(--accent)', cursor:'pointer', fontWeight:700, fontFamily:'inherit', fontSize:'0.85rem' }}>Register here →</button>
            </p>
          </div>
        </div>

        {/* PANEL B: Login form */}
        <div className={`ls-panel ${panel==='form'?'ls-panel-in':'ls-panel-out-right'}`}
          style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', justifyContent:'center', padding:'2.5rem 2rem', overflowY:'auto' }}>
          {entity && (<>
            <button onClick={handleBack}
              style={{ all:'unset', display:'inline-flex', alignItems:'center', gap:'0.4rem', fontSize:'0.8rem', color:'var(--text-dim)', cursor:'pointer', marginBottom:'2rem', fontWeight:600, transition:'color 0.15s' }}
              onMouseEnter={e => (e.currentTarget.style.color='var(--accent)')}
              onMouseLeave={e => (e.currentTarget.style.color='var(--text-dim)'  )}>
              <ChevronDown size={14} style={{ transform:'rotate(90deg)' }}/> All roles
            </button>

            <div style={{ display:'flex', alignItems:'center', gap:'0.875rem', marginBottom:'1.75rem', paddingBottom:'1.5rem', borderBottom:'1px solid var(--border)' }}>
              <div style={{ width:50, height:50, borderRadius:14, background:`${entity.color}18`, border:`1px solid ${entity.color}30`, display:'flex', alignItems:'center', justifyContent:'center', color:entity.color, flexShrink:0 }}>{entity.icon}</div>
              <div>
                <h2 style={{ fontFamily:"'Syne',sans-serif", fontSize:'1.4rem', fontWeight:800, letterSpacing:'-0.02em', color:'var(--text-bright)', margin:'0 0 0.15rem' }}>{entity.role} Login</h2>
                <p style={{ margin:0, fontSize:'0.78rem', color:'var(--text-dim)' }}>{entity.label} · {entity.desc}</p>
              </div>
            </div>

            {formErr && (
              <div style={{ padding:'0.75rem 1rem', background:'var(--rose-dim)', border:'1px solid rgba(220,38,38,0.25)', borderRadius:'var(--r-md)', color:'var(--rose)', fontSize:'0.84rem', marginBottom:'1.25rem', display:'flex', alignItems:'center', gap:'0.5rem', animation:'shake 0.4s ease' }}>
                <AlertCircle size={15}/> {formErr}
              </div>
            )}

            <form onSubmit={async e => { e.preventDefault(); await onLogin(username, password); }}>
              <div className="form-group" style={{ marginBottom:'1.1rem' }}>
                <label>Username</label>
                <input type="text" value={username} onChange={e => setUsername(e.target.value)} required autoComplete="username" placeholder={`Enter ${entity.role.toLowerCase()} username`}/>
              </div>
              <div className="form-group" style={{ marginBottom:'1.5rem' }}>
                <label>Password</label>
                <div style={{ position:'relative' }}>
                  <input type={showPass?'text':'password'} value={password} onChange={e => setPassword(e.target.value)} required autoComplete="current-password" placeholder="Enter your password" style={{ paddingRight:'2.75rem' }}/>
                  <button type="button" onClick={() => setShowPass(v => !v)} style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', color:'var(--text-dim)', cursor:'pointer', display:'flex', alignItems:'center' }}>
                    {showPass ? <EyeOff size={15}/> : <Eye size={15}/>}
                  </button>
                </div>
              </div>
              <button type="submit" disabled={loading}
                style={{ width:'100%', padding:'0.9rem', background:`linear-gradient(135deg,${entity.color},${entity.color}cc)`, border:'none', borderRadius:'var(--r-md)', color:'#fff', fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:'0.9rem', letterSpacing:'0.04em', cursor:loading?'wait':'pointer', opacity:loading?0.65:1, boxShadow:`0 4px 18px ${entity.glow}`, display:'flex', alignItems:'center', justifyContent:'center', gap:'0.5rem' }}>
                {loading ? 'Signing in...' : `Sign in as ${entity.role}`}
              </button>
            </form>

            <div style={{ marginTop:'1.5rem', paddingTop:'1.25rem', borderTop:'1px solid var(--border)', textAlign:'center' }}>
              <p style={{ fontSize:'0.82rem', color:'var(--text-dim)', margin:0 }}>New patient?{'  '}
                <button onClick={onShowRegister} style={{ background:'none', border:'none', color:'var(--accent)', cursor:'pointer', fontWeight:700, fontFamily:'inherit', fontSize:'0.82rem' }}>Register here →</button>
              </p>
            </div>
          </>)}
        </div>
      </div>

      <style>{`
        @keyframes blobFloat1 { 0%,100%{transform:translate(0,0) scale(1)} 33%{transform:translate(30px,-20px) scale(1.05)} 66%{transform:translate(-15px,25px) scale(0.97)} }
        @keyframes blobFloat2 { 0%,100%{transform:translate(0,0) scale(1)} 40%{transform:translate(-25px,15px) scale(1.04)} 70%{transform:translate(20px,-18px) scale(0.98)} }
        .ls-panel { transition: transform 0.35s cubic-bezier(0.16,1,0.3,1), opacity 0.3s ease; will-change: transform, opacity; }
        .ls-panel-in         { transform: translateX(0);    opacity: 1; pointer-events: auto; }
        .ls-panel-out-left   { transform: translateX(-110%); opacity: 0; pointer-events: none; }
        .ls-panel-out-right  { transform: translateX(110%);  opacity: 0; pointer-events: none; }
        @media (max-width: 700px) { .ls-left { display:none!important; } .ls-right { width:100%!important; min-width:0!important; } }
      `}</style>
    </div>
  );
}
// ─────────────────────────────────────────────
// RegisterScreen
// ─────────────────────────────────────────────
function RegisterScreen({ onRegister, onBack, formErr, loading }:
  { onRegister:(e:React.FormEvent,f:RegisterForm)=>Promise<void>; onBack:()=>void; formErr:string; loading:boolean }) {
  const [regF, setRegF] = useState<RegisterForm>({ username:'',password:'',email:'',name:'',gender:'Male',dob:'',phone:'',address:'',blood_group:'O+',emergency_contact:'',emergency_contact_name:'' });
  return (
    <div className="login-container"><div className="login-bg"/>
      <div className="login-card">
        <div className="login-header"><div className="logo-container"><UserPlus className="logo-icon"/></div><h1>Patient Registration</h1><p>Create your account</p></div>
        {formErr && <div className="form-error"><AlertCircle size={15}/> {formErr}</div>}
        <form onSubmit={e=>onRegister(e,regF)} className="register-form">
          <div className="form-row">
            <div className="form-group"><label>Username *</label><input type="text" value={regF.username} onChange={e=>setRegF({...regF,username:e.target.value})} placeholder="Min 3 chars" minLength={3} required/></div>
            <div className="form-group"><label>Password *</label><input type="password" value={regF.password} onChange={e=>setRegF({...regF,password:e.target.value})} placeholder="Min 6 chars" minLength={6} required/></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label>Full Name *</label><input type="text" value={regF.name} onChange={e=>setRegF({...regF,name:e.target.value})} required/></div>
            <div className="form-group"><label>Email *</label><input type="email" value={regF.email} onChange={e=>setRegF({...regF,email:e.target.value})} required/></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label>Gender *</label>
              <select value={regF.gender} onChange={e=>setRegF({...regF,gender:e.target.value})}><option>Male</option><option>Female</option><option>Other</option></select>
            </div>
            <div className="form-group"><label>Date of Birth *</label><input type="date" value={regF.dob} onChange={e=>setRegF({...regF,dob:e.target.value})} max={new Date().toISOString().split('T')[0]} required/></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label>Phone *</label><input type="tel" value={regF.phone} onChange={e=>setRegF({...regF,phone:e.target.value})} pattern="[0-9]{10}" required/></div>
            <div className="form-group"><label>Blood Group *</label>
              <select value={regF.blood_group} onChange={e=>setRegF({...regF,blood_group:e.target.value})}>
                {['A+','A-','B+','B-','O+','O-','AB+','AB-'].map(bg=><option key={bg}>{bg}</option>)}
              </select>
            </div>
          </div>
          <div className="form-group"><label>Address *</label><input type="text" value={regF.address} onChange={e=>setRegF({...regF,address:e.target.value})} required/></div>
          <h4 style={{ color:'var(--text-mid)',margin:'1rem 0 0.5rem',fontSize:'0.9rem' }}>Emergency Contact (Optional)</h4>
          <div className="form-row">
            <div className="form-group"><label>Contact Name</label><input type="text" value={regF.emergency_contact_name} onChange={e=>setRegF({...regF,emergency_contact_name:e.target.value})}/></div>
            <div className="form-group"><label>Contact Phone</label><input type="tel" value={regF.emergency_contact} onChange={e=>setRegF({...regF,emergency_contact:e.target.value})} pattern="[0-9]{10}"/></div>
          </div>
          <button type="submit" className="login-btn" disabled={loading}>{loading ? 'Creating Account...' : 'Register'}</button>
        </form>
        <div className="register-link"><p>Already have an account? <button onClick={onBack} className="link-btn">Login here</button></p></div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Main App
// ─────────────────────────────────────────────
export default function App() {
  const [theme, setTheme] = useTheme();

  const [token, setToken] = useState<string|null>(() => localStorage.getItem('token'));
  const [user, setUser]   = useState<AuthUser|null>(() => { const t=localStorage.getItem('token'); return t?decodeJWT(t):null; });
  const [view, setView]   = useState('dashboard');
  const [navHistory, setNavHistory] = useState<string[]>(['dashboard']);
  const [navIndex, setNavIndex] = useState(0);
  const [showReg, setShowReg] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formErr, setFormErr] = useState('');

  // Data
  const [stats, setStats] = useState<DashboardStats & { pending_appointments?: number }>({ total_patients:0,total_doctors:0,total_radiologists:0,today_visits:0,pending_prescriptions:0,pending_tests:0 });
  const [records, setRecords]           = useState<any[]>([]);
  const [doctorRecords, setDoctorRecords] = useState<DoctorRecord[]>([]);
  const [patients, setPatients]         = useState<Patient[]>([]);
  const [doctors, setDoctors]           = useState<Doctor[]>([]);
  const [visits, setVisits]             = useState<Visit[]>([]);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [medFiles, setMedFiles]         = useState<MedicalFile[]>([]);
  const [myScans, setMyScans]           = useState<ScanFile[]>([]);
  const [importResult, setImportResult] = useState<any>(null);
  const [pendingOnly, setPendingOnly]   = useState(false);
  const [noCreds, setNoCreds]           = useState<PatientNoCreds[]>([]);
  const [patientSearch, setPatientSearch] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<(Patient & { PatientID: number })|null>(null);
  const [patientListTab, setPatientListTab] = useState<'mine'|'other'>('mine');
  const [adminSelectedPatient, setAdminSelectedPatient] = useState<(Patient & { PatientID: number })|null>(null);
  const [adminPatientSearch, setAdminPatientSearch] = useState('');
  const [selectedPatientIds, setSelectedPatientIds] = useState<number[]>([]);
  const [labTests, setLabTests] = useState<LabTest[]>([]);
  const [showLabTests, setShowLabTests] = useState(false);

  // Modal state
  const [editPatient, setEditPatient]         = useState<Patient|null>(null);
  const [assignPatient, setAssignPatient]     = useState<PatientNoCreds|null>(null);
  const [deleteConfirm, setDeleteConfirm]     = useState<Patient|null>(null);
  const [summaryFor, setSummaryFor]           = useState<{id:number;name:string}|null>(null);
  const [scansFor, setScansFor]               = useState<{id:number;name:string}|null>(null);
  // Doctor panel modals (lifted out of PatientDetailPanel to avoid overflow:hidden trap)
  const [showDoctorSummary, setShowDoctorSummary]   = useState(false);
  const [showDoctorProgress, setShowDoctorProgress] = useState(false);

  // Forms
  const [visitF, setVisitF]   = useState({ PatientID:0,DoctorID:0,ReasonForVisit:'',VitalSigns:'',Notes:'',Status:'Scheduled' });
  const [diagF, setDiagF]     = useState({ VisitID:0,DiagnosisName:'',Description:'',IsChronic:false,Severity:'Mild' });
  const [rxF, setRxF]         = useState({ visit_id:0,medicine:'',dosage:'',frequency:'',duration:'',instructions:'' });
  const [fileF, setFileF]     = useState({ file:null as File|null, file_type:'X-Ray', description:'' });
  const [scanF, setScanF]     = useState({ file:null as File|null, patient_id:'', scan_type:'X-Ray', description:'' });
  const [newDoctorF, setNewDoctorF] = useState({
    doctor_name: '',
    email: '',
    specialty: '',
    phone_number: '',
    license_number: '',
    years_of_experience: ''
  });
  const [impFile, setImpFile] = useState<File|null>(null);
  const [impVisitFile, setImpVisitFile]       = useState<File|null>(null);
  const [importVisitResult, setImportVisitResult] = useState<any>(null);
  const [frequentFlyers, setFrequentFlyers]   = useState<any[]>([]);
  const [ffLoaded, setFfLoaded]               = useState(false);

  // Navigation history functions
  const navigateTo = useCallback((newView: string) => {
    setNavHistory(prev => {
      // If we're not at the end of history, truncate future entries
      const truncated = prev.slice(0, navIndex + 1);
      // Add new view
      const updated = [...truncated, newView];
      // Update index
      setNavIndex(updated.length - 1);
      return updated;
    });
    setView(newView);
  }, [navIndex]);

  const canGoBack = navIndex > 0;
  const canGoForward = navIndex < navHistory.length - 1;

  const goBack = useCallback(() => {
    if (canGoBack) {
      const newIndex = navIndex - 1;
      setNavIndex(newIndex);
      setView(navHistory[newIndex]);
    }
  }, [navIndex, navHistory, canGoBack]);

  const goForward = useCallback(() => {
    if (canGoForward) {
      const newIndex = navIndex + 1;
      setNavIndex(newIndex);
      setView(navHistory[newIndex]);
    }
  }, [navIndex, navHistory, canGoForward]);

  const authHdr = useCallback(() => ({ Authorization:`Bearer ${token}`, 'Content-Type':'application/json' }), [token]);

  async function apiFetch(path: string, opts: RequestInit = {}) {
    const res  = await fetch(`${API}${path}`, { ...opts, headers: { ...authHdr(), ...(opts.headers ?? {}) } });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
    return json;
  }

  const loadStats       = useCallback(() => apiFetch('/dashboard/stats').then(setStats).catch(console.error), [token]);
  const loadRecords     = useCallback(() => apiFetch('/records/all').then(setRecords).catch(console.error), [token]);
  const loadMyRecords   = useCallback(() => apiFetch('/records/my').then(setRecords).catch(console.error), [token]);
  const loadDoctorRecs  = useCallback(() => apiFetch('/records/doctor').then(setDoctorRecords).catch(console.error), [token]);
  const loadPatients    = useCallback(() => apiFetch('/patients').then(setPatients).catch(console.error), [token]);
  const loadDoctors     = useCallback(() => apiFetch('/doctors').then(setDoctors).catch(console.error), [token]);
  const loadVisits      = useCallback(() => apiFetch('/visits').then(setVisits).catch(console.error), [token]);
  const loadRx          = useCallback(() => apiFetch(`/prescriptions${pendingOnly?'?pending=1':''}`).then(setPrescriptions).catch(console.error), [token, pendingOnly]);
  const loadFiles       = useCallback(() => { if (user?.patient_id) apiFetch(`/files/patient/${user.patient_id}`).then(setMedFiles).catch(console.error); }, [token, user]);
  const loadMyScans     = useCallback(() => apiFetch('/scans/mine').then(setMyScans).catch(console.error), [token]);
  const loadNoCreds     = useCallback(() => apiFetch('/admin/patients-without-credentials').then(setNoCreds).catch(console.error), [token]);
  const loadLabTests    = useCallback(() => apiFetch('/lab-tests').then(setLabTests).catch(console.error), [token]);
  const loadAppointments = useCallback(() => apiFetch('/appointments').catch(console.error), [token]);

  useEffect(() => {
    if (!user || !token) return;
    loadStats();
    if (user.role === 'Doctor')       { loadDoctorRecs(); loadDoctors(); loadPatients(); loadVisits(); loadRecords(); loadLabTests(); }
    if (user.role === 'Patient')      { loadMyRecords(); loadFiles(); loadDoctors(); }
    if (user.role === 'Admin')        {
      loadPatients(); loadNoCreds();
      if (!ffLoaded) {
        fetch(`${API}/analytics/frequent-flyers`, { headers:{ Authorization:`Bearer ${token}` } })
          .then(r=>r.json()).then(d=>{ if(Array.isArray(d)){ setFrequentFlyers(d); setFfLoaded(true); } }).catch(()=>{});
      }
    }
    if (user.role === 'Pharmacist')   { loadRx(); }
    if (user.role === 'Radiologist')  { loadPatients(); loadMyScans(); }
    if (user.role === 'Receptionist') { loadPatients(); loadDoctors(); }
  }, [user, token, view]);

  const doLogin = async (username: string, password: string) => {
    setLoading(true); setFormErr('');
    try {
      const res  = await fetch(`${API}/auth/login`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({username,password}) });
      const data = await res.json();
      if (!data.token) throw new Error(data.error || 'Login failed');
      localStorage.setItem('token', data.token);
      setToken(data.token);
      setUser(decodeJWT(data.token));
    } catch(e:any) { setFormErr(e.message); }
    finally { setLoading(false); }
  };

  const doRegister = async (e: React.FormEvent, regF: RegisterForm) => {
    e.preventDefault(); setLoading(true); setFormErr('');
    try { await apiFetch('/auth/register', { method:'POST', body: JSON.stringify(regF) }); setShowReg(false); setFormErr(''); }
    catch(e:any) { setFormErr(e.message); }
    finally { setLoading(false); }
  };

  const doLogout = () => { localStorage.removeItem('token'); setToken(null); setUser(null); navigateTo('dashboard'); };

  const submitVisit = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true);
    // Always use the logged-in doctor's own ID — never allow substitution
    const doctorId = user?.doctor_id ?? visitF.DoctorID;
    try {
      await apiFetch('/visits', { method:'POST', body: JSON.stringify({ patient_id:visitF.PatientID, doctor_id:doctorId, reason:visitF.ReasonForVisit, vital_signs:visitF.VitalSigns, notes:visitF.Notes, status:visitF.Status }) });
      setVisitF({ PatientID:0, DoctorID: doctorId as number, ReasonForVisit:'', VitalSigns:'', Notes:'', Status:'Scheduled' });
      loadVisits();
    } catch(e:any) { alert(e.message); }
    finally { setLoading(false); }
  };

  const submitDiag = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true);
    try {
      await apiFetch('/diagnosis', { method:'POST', body: JSON.stringify({ visit_id:diagF.VisitID, name:diagF.DiagnosisName, description:diagF.Description, is_chronic:diagF.IsChronic, severity:diagF.Severity }) });
      setDiagF({ VisitID:0,DiagnosisName:'',Description:'',IsChronic:false,Severity:'Mild' });
      loadRecords();
    } catch(e:any) { alert(e.message); }
    finally { setLoading(false); }
  };

  const submitRx = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true);
    try {
      await apiFetch('/prescriptions', { method:'POST', body: JSON.stringify(rxF) });
      setRxF({ visit_id:0,medicine:'',dosage:'',frequency:'',duration:'',instructions:'' });
      loadRecords();
    } catch(e:any) { alert(e.message); }
    finally { setLoading(false); }
  };

  const dispense = async (id: number) => {
    try { await apiFetch(`/prescriptions/${id}/dispense`, { method:'POST' }); loadRx(); }
    catch(e:any) { alert(e.message); }
  };

  const submitUpload = async (e: React.FormEvent) => {
    e.preventDefault(); if (!fileF.file) return; setLoading(true);
    try {
      const fd = new FormData(); fd.append('file',fileF.file); fd.append('patient_id',String(user?.patient_id??'')); fd.append('file_type',fileF.file_type); fd.append('description',fileF.description);
      const res = await fetch(`${API}/files/upload`, { method:'POST', headers:{Authorization:`Bearer ${token}`}, body:fd });
      const d = await res.json(); if (!res.ok) throw new Error(d.error);
      setFileF({ file:null, file_type:'X-Ray', description:'' }); loadFiles();
    } catch(e:any) { alert(e.message); }
    finally { setLoading(false); }
  };

  const downloadFile = async (fid: number, name: string) => {
    const res = await fetch(`${API}/files/download/${fid}`, { headers:{ Authorization:`Bearer ${token}` } });
    if (!res.ok) return alert('Download failed');
    const a = document.createElement('a'); a.href = URL.createObjectURL(await res.blob()); a.download = name;
    document.body.appendChild(a); a.click(); URL.revokeObjectURL(a.href); document.body.removeChild(a);
  };

  const submitImport = async (e: React.FormEvent) => {
    e.preventDefault(); if (!impFile) return; setLoading(true);
    try {
      const fd = new FormData(); fd.append('file', impFile);
      const res = await fetch(`${API}/admin/import-patients`, { method:'POST', headers:{Authorization:`Bearer ${token}`}, body:fd });
      const d = await res.json(); if (!res.ok) throw new Error(d.error);
      setImportResult(d); setImpFile(null); loadPatients(); loadNoCreds();
    } catch(e:any) { alert(e.message); }
    finally { setLoading(false); }
  };

  const doDeletePatient = async (p: Patient) => {
    try { await apiFetch(`/patients/${(p as any).PatientID}`, { method:'DELETE' }); setDeleteConfirm(null); loadPatients(); loadNoCreds(); }
    catch(e:any) { alert(e.message); }
  };


  const submitImportVisits = async (e: React.FormEvent) => {
    e.preventDefault(); if (!impVisitFile) return; setLoading(true);
    try {
      const fd = new FormData(); fd.append('file', impVisitFile);
      const res = await fetch(`${API}/admin/import-visits`, {
        method:'POST', headers:{ Authorization:`Bearer ${token}` }, body:fd
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setImportVisitResult(d); setImpVisitFile(null); loadPatients(); loadNoCreds();
    } catch(e:any) { alert(e.message); }
    finally { setLoading(false); }
  };

  const submitScanUpload = async (e: React.FormEvent) => {
    e.preventDefault(); if (!scanF.file || !scanF.patient_id) return; setLoading(true);
    try {
      const fd = new FormData(); fd.append('file',scanF.file); fd.append('patient_id',scanF.patient_id); fd.append('scan_type',scanF.scan_type); fd.append('description',scanF.description);
      const res = await fetch(`${API}/scans/upload`, { method:'POST', headers:{Authorization:`Bearer ${token}`}, body:fd });
      const d = await res.json(); if (!res.ok) throw new Error(d.error);
      setScanF({ file:null, patient_id:'', scan_type:'X-Ray', description:'' }); loadMyScans(); alert('Scan uploaded successfully!');
    } catch(e:any) { alert(e.message); }
    finally { setLoading(false); }
  };

  const addDoctor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDoctorF.doctor_name || !newDoctorF.email || !newDoctorF.specialty || !newDoctorF.phone_number) {
      alert('Please fill required fields: Name, Email, Specialty, Phone');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API}/doctors`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          doctor_name: newDoctorF.doctor_name,
          email: newDoctorF.email,
          specialty: newDoctorF.specialty,
          phone_number: newDoctorF.phone_number,
          license_number: newDoctorF.license_number || '',
          years_of_experience: newDoctorF.years_of_experience ? parseInt(newDoctorF.years_of_experience) : null
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add doctor');
      alert(`Doctor added successfully! Username: ${data.username}, Temporary password: ${data.temp_password}`);
      setNewDoctorF({
        doctor_name: '',
        email: '',
        specialty: '',
        phone_number: '',
        license_number: '',
        years_of_experience: ''
      });
      loadDoctors();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const titles: Record<string,string> = {
    dashboard:'Dashboard', records:'All Medical Records', 'my-records':'My Medical Records',
    'doctor-reports':'Patient Reports', 'create-visit':'Create New Visit',
    'add-diagnosis':'Add Diagnosis', 'add-rx':'Add Prescription',
    'my-files':'My Medical Files', 'upload-file':'Upload Medical File',
    prescriptions:'Prescriptions Management', patients:'Patient Management',
    import:'Import Patients', 'assign-creds':'Assign Credentials',
    'upload-scan':'Upload Scan', 'my-uploads':'My Scan Uploads',
    'my-appointments':'My Appointments', 'appointment-queue':'Appointment Queue',
    'manage-doctors':'Manage Doctors',
  };

  if (!token || !user) {
    if (showReg) return <RegisterScreen onRegister={doRegister} onBack={()=>{setShowReg(false);setFormErr('');}} formErr={formErr} loading={loading}/>;
    return <LoginScreen onLogin={doLogin} onShowRegister={()=>{setShowReg(true);setFormErr('');}} formErr={formErr} loading={loading} theme={theme} setTheme={setTheme}/>;
  }

  // IDs of patients who have visited THIS doctor
  const myPatientIds = new Set(doctorRecords.map(r => r.PatientID).filter(Boolean));

  const search = patientSearch.toLowerCase();
  const myPatients    = patients.filter(p => myPatientIds.has((p as any).PatientID) && (!search || p.PatientName.toLowerCase().includes(search)));
  const otherPatients = patients.filter(p => !myPatientIds.has((p as any).PatientID) && (!search || p.PatientName.toLowerCase().includes(search)));
  // keep legacy for admin/other views
  const filteredPatients = patients.filter(p => !search || p.PatientName.toLowerCase().includes(search));

  return (
    <div className="dashboard">
      {/* ── Global Modals ── */}
      {summaryFor && <SummaryModal patientId={summaryFor.id} patientName={summaryFor.name} role={user.role} token={token} onClose={()=>setSummaryFor(null)}/>}
      {scansFor   && <ScansModal   patientId={scansFor.id}   patientName={scansFor.name}   token={token} onClose={()=>setScansFor(null)}/>}
      {editPatient  && <EditPatientModal patient={editPatient} token={token} onClose={()=>setEditPatient(null)} onSaved={()=>{ setEditPatient(null); loadPatients(); }}/>}
      {assignPatient && <AssignCredsModal patient={assignPatient} token={token} onClose={()=>setAssignPatient(null)} onSaved={()=>{ setAssignPatient(null); loadNoCreds(); loadPatients(); }}/>}

      {/* Doctor panel modals — rendered at root level to escape overflow:hidden ancestors */}
      {showDoctorSummary && selectedPatient && (
        <SummaryModal patientId={selectedPatient.PatientID} patientName={selectedPatient.PatientName}
          role={user.role} token={token} onClose={() => setShowDoctorSummary(false)}/>
      )}
      {showDoctorProgress && selectedPatient && (
        <ChronicProgressModal patientId={selectedPatient.PatientID} patientName={selectedPatient.PatientName}
          token={token} onClose={() => setShowDoctorProgress(false)}/>
      )}
      {showLabTests && (
        <LabTestsModal token={token} visits={visits} onClose={() => { setShowLabTests(false); loadLabTests(); loadStats(); }}/>
      )}

      {deleteConfirm && (
        <Modal title="Confirm Deletion" onClose={()=>setDeleteConfirm(null)}>
          <p style={{ color:'var(--text-mid)', marginBottom:'1.5rem', lineHeight:1.6 }}>Deactivate <strong style={{ color:'var(--text-bright)' }}>{deleteConfirm.PatientName}</strong>? Their login will also be disabled.</p>
          <div style={{ display:'flex', gap:'0.75rem' }}>
            <button onClick={()=>setDeleteConfirm(null)} className="action-btn secondary" style={{ flex:1 }}>Cancel</button>
            <button onClick={()=>doDeletePatient(deleteConfirm)} style={{ flex:1,padding:'0.75rem',background:'linear-gradient(135deg,var(--rose),#e11d48)',border:'none',borderRadius:10,color:'white',fontWeight:700,cursor:'pointer',fontFamily:"'Syne',sans-serif",display:'flex',alignItems:'center',justifyContent:'center',gap:'0.4rem' }}>
              <Trash2 size={15}/> Confirm Delete
            </button>
          </div>
        </Modal>
      )}

      {/* ── Sidebar ── */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <Heart className="sidebar-logo"/>
          <div><h2>MediCare</h2><p className="sidebar-subtitle">{user.role}</p></div>
        </div>
        <nav className="sidebar-nav">
          <button className={view==='dashboard'?'active':''} onClick={()=>setView('dashboard')}><Activity/> Dashboard</button>

          {user.role==='Doctor'&&<>
            <button className={view==='doctor-reports'?'active':''} onClick={()=>setView('doctor-reports')}><ClipboardList/> My Patients</button>
            <button className={view==='records'?'active':''} onClick={()=>setView('records')}><FileText/> All Records</button>
            <button className={view==='create-visit'?'active':''} onClick={()=>setView('create-visit')}><PlusCircle/> Create Visit</button>
            <button className={view==='add-diagnosis'?'active':''} onClick={()=>setView('add-diagnosis')}><Stethoscope/> Add Diagnosis</button>
            <button className={view==='add-rx'?'active':''} onClick={()=>setView('add-rx')}><Pill/> Add Prescription</button>
            <button onClick={()=>setShowLabTests(true)} style={{ display:'flex',alignItems:'center',gap:'0.75rem',padding:'0.75rem 1rem',background:'transparent',border:'none',borderRadius:'var(--r-md)',color:'var(--text-mid)',fontFamily:'inherit',fontSize:'0.9rem',fontWeight:500,cursor:'pointer',width:'100%',position:'relative',transition:'all var(--t-mid)' }}
              onMouseEnter={e=>(e.currentTarget.style.background='var(--accent-dim)',e.currentTarget.style.color='var(--accent-light)')}
              onMouseLeave={e=>(e.currentTarget.style.background='transparent',e.currentTarget.style.color='var(--text-mid)')}>
              <FlaskConical size={18}/> Lab Tests
              {stats.pending_tests > 0 && <span style={{ marginLeft:'auto',background:'var(--violet)',color:'white',borderRadius:999,fontSize:'0.65rem',fontWeight:700,padding:'0.1rem 0.45rem' }}>{stats.pending_tests}</span>}
            </button>
          </>}

          {user.role==='Patient'&&<>
            <button className={view==='dashboard'?'active':''} onClick={()=>setView('dashboard')}><User/> My Profile</button>
            <button className={view==='my-appointments'?'active':''} onClick={()=>setView('my-appointments')}><Calendar/> Appointments</button>
            <button className={view==='my-records'?'active':''} onClick={()=>setView('my-records')}><FileText/> Medical Records</button>
            <button className={view==='my-files'?'active':''} onClick={()=>setView('my-files')}><FileImage/> My Files</button>
            <button className={view==='upload-file'?'active':''} onClick={()=>setView('upload-file')}><Upload/> Upload File</button>
            <button onClick={()=>{ if(user.patient_id) setSummaryFor({id:user.patient_id,name:user.username}); }} style={{ all:'unset',display:'flex',alignItems:'center',gap:'0.75rem',padding:'0.7rem 0.9rem',borderRadius:'var(--r-md)',cursor:'pointer',color:'var(--text-mid)',width:'100%',boxSizing:'border-box',fontSize:'0.875rem',fontFamily:"'Plus Jakarta Sans',sans-serif",fontWeight:500,transition:'all var(--t-mid) var(--ease-out)' }} onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background='var(--glass-2)';(e.currentTarget as HTMLElement).style.color='var(--accent)';}} onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background='transparent';(e.currentTarget as HTMLElement).style.color='var(--text-mid)';}}>
              <BookOpen size={17} style={{ flexShrink:0 }}/> Summary Sheet
            </button>
          </>}

          {user.role==='Receptionist'&&<>
            <button className={view==='appointment-queue'?'active':''} onClick={()=>setView('appointment-queue')}>
              <Calendar/> Appointment Queue
              {(stats as any).pending_appointments > 0 && <span style={{ marginLeft:'auto',background:'var(--rose)',color:'white',borderRadius:999,fontSize:'0.65rem',fontWeight:700,padding:'0.1rem 0.45rem' }}>{(stats as any).pending_appointments}</span>}
            </button>
            <button className={view==='patients'?'active':''} onClick={()=>setView('patients')}><Users/> All Patients</button>
          </>}

          {user.role==='Radiologist'&&<>
            <button className={view==='upload-scan'?'active':''} onClick={()=>setView('upload-scan')}><Upload/> Upload Scan</button>
            <button className={view==='my-uploads'?'active':''} onClick={()=>setView('my-uploads')}><ScanLine/> My Uploads</button>
          </>}

          {user.role==='Pharmacist'&&<button className={view==='prescriptions'?'active':''} onClick={()=>setView('prescriptions')}><Pill/> Prescriptions</button>}

          {user.role==='Admin'&&<>
            <button className={view==='patients'?'active':''} onClick={()=>setView('patients')}><Users/> Patients</button>
            <button className={view==='manage-doctors'?'active':''} onClick={()=>setView('manage-doctors')}><Stethoscope/> Manage Doctors</button>
            <button className={view==='assign-creds'?'active':''} onClick={()=>setView('assign-creds')}>
              <Key/> Assign Credentials
              {noCreds.length>0&&<span style={{ marginLeft:'auto',background:'var(--rose)',color:'white',borderRadius:999,fontSize:'0.65rem',fontWeight:700,padding:'0.1rem 0.45rem' }}>{noCreds.length}</span>}
            </button>
            <button className={view==='import'?'active':''} onClick={()=>setView('import')}><Upload/> Import Patients</button>
          </>}
        </nav>
        <div className="sidebar-footer">
          <div className="user-info"><User size={16}/><span>{user.username}</span></div>
          <button className="logout-btn" onClick={doLogout}><LogOut/> Logout</button>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="main-content">
        <header className="content-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <button
                onClick={goBack}
                disabled={!canGoBack}
                style={{
                  background: 'var(--raised)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--r-sm)',
                  width: 32,
                  height: 32,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: canGoBack ? 'var(--text-mid)' : 'var(--text-dim)',
                  cursor: canGoBack ? 'pointer' : 'not-allowed',
                  opacity: canGoBack ? 1 : 0.5,
                  transition: 'all var(--t-fast)'
                }}
                onMouseEnter={e => {
                  if (canGoBack) {
                    e.currentTarget.style.background = 'var(--accent-dim)';
                    e.currentTarget.style.borderColor = 'var(--accent)';
                    e.currentTarget.style.color = 'var(--accent)';
                  }
                }}
                onMouseLeave={e => {
                  if (canGoBack) {
                    e.currentTarget.style.background = 'var(--raised)';
                    e.currentTarget.style.borderColor = 'var(--border)';
                    e.currentTarget.style.color = 'var(--text-mid)';
                  }
                }}
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={goForward}
                disabled={!canGoForward}
                style={{
                  background: 'var(--raised)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--r-sm)',
                  width: 32,
                  height: 32,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: canGoForward ? 'var(--text-mid)' : 'var(--text-dim)',
                  cursor: canGoForward ? 'pointer' : 'not-allowed',
                  opacity: canGoForward ? 1 : 0.5,
                  transition: 'all var(--t-fast)'
                }}
                onMouseEnter={e => {
                  if (canGoForward) {
                    e.currentTarget.style.background = 'var(--accent-dim)';
                    e.currentTarget.style.borderColor = 'var(--accent)';
                    e.currentTarget.style.color = 'var(--accent)';
                  }
                }}
                onMouseLeave={e => {
                  if (canGoForward) {
                    e.currentTarget.style.background = 'var(--raised)';
                    e.currentTarget.style.borderColor = 'var(--border)';
                    e.currentTarget.style.color = 'var(--text-mid)';
                  }
                }}
              >
                <ChevronRight size={16} />
              </button>
            </div>
            <div>
              <h1>{titles[view] ?? 'Dashboard'}</h1>
              <p className="subtitle">Welcome back, {user.username}</p>
            </div>
          </div>
          <div className="header-right">
            {(user.role === 'Doctor' || user.role === 'Pharmacist') && (
              <NotificationBell
                pending_rx={stats.pending_prescriptions}
                pending_tests={stats.pending_tests}
                role={user.role}
              />
            )}
            <ThemeSwitcher theme={theme} setTheme={setTheme}/>
            <div className="user-badge">
              {user.role==='Doctor'&&<Stethoscope/>}{user.role==='Patient'&&<User/>}
              {user.role==='Pharmacist'&&<Pill/>}{user.role==='Admin'&&<Shield/>}
              {user.role==='Radiologist'&&<ScanLine/>}{user.role==='Receptionist'&&<Calendar/>}
              <span>{user.role}</span>
            </div>
          </div>
        </header>

        <div className="content-body">

          {/* ── Dashboard ── */}
          {view==='dashboard'&&(
            user.role==='Patient' ? (
              /* ── Patient gets the full Profile Dashboard ── */
              <PatientProfileDashboard
                user={user} token={token} records={records} medFiles={medFiles}
                doctors={doctors}
                onBookAppointment={()=>setView('my-appointments')}
                onOpenSummary={()=>{ if(user.patient_id) setSummaryFor({id:user.patient_id,name:user.username}); }}
                onViewRecords={()=>setView('my-records')}
                onViewFiles={()=>setView('my-files')}
                onViewAppointments={()=>setView('my-appointments')}
              />
            ) : (
            <div className="dashboard-grid">
              <div className="stat-card stat-primary"><div className="stat-icon"><Users/></div><div className="stat-details"><h3>{stats.total_patients}</h3><p>Total Patients</p></div></div>
              <div className="stat-card stat-success"><div className="stat-icon"><Stethoscope/></div><div className="stat-details"><h3>{stats.total_doctors}</h3><p>Total Doctors</p></div></div>
              <div className="stat-card stat-warning"><div className="stat-icon"><Calendar/></div><div className="stat-details"><h3>{stats.today_visits}</h3><p>Today's Visits</p></div></div>
              <div className="stat-card stat-danger"><div className="stat-icon"><Pill/></div><div className="stat-details"><h3>{stats.pending_prescriptions}</h3><p>Pending Rx</p></div></div>
              <div className="welcome-card">
                <h2>Welcome to MediCare Plus 🏥</h2>
                <p>Your comprehensive hospital management solution. Use the sidebar to navigate.</p>
                {user.role==='Admin'&&noCreds.length>0&&(
                  <div style={{ background:'var(--rose-dim)',border:'1px solid rgba(244,63,94,.2)',borderRadius:12,padding:'0.875rem 1rem',marginBottom:'1rem',display:'flex',alignItems:'center',justifyContent:'space-between' }}>
                    <div style={{ display:'flex',alignItems:'center',gap:'0.6rem' }}><Key size={18} color="var(--rose)"/><span style={{ color:'#fda4af',fontSize:'0.88rem',fontWeight:600 }}>{noCreds.length} patient{noCreds.length>1?'s':''} need login credentials</span></div>
                    <button onClick={()=>setView('assign-creds')} className="action-btn" style={{ padding:'0.4rem 0.875rem',fontSize:'0.8rem',marginTop:0 }}>Assign Now</button>
                  </div>
                )}
                <div className="quick-actions">
                  {user.role==='Doctor'&&<><button onClick={()=>setView('create-visit')} className="action-btn">Create Visit</button><button onClick={()=>setView('doctor-reports')} className="action-btn secondary">My Patients</button></>}
                  {user.role==='Receptionist'&&<>
                    <button onClick={()=>setView('appointment-queue')} className="action-btn" style={{ display:'flex', alignItems:'center', gap:'0.5rem' }}>
                      <Calendar size={15}/> Appointment Queue
                      {(stats as any).pending_appointments > 0 && <span style={{ background:'rgba(255,255,255,0.3)', borderRadius:999, fontSize:'0.7rem', fontWeight:800, padding:'0.1rem 0.4rem' }}>{(stats as any).pending_appointments}</span>}
                    </button>
                    <button onClick={()=>setView('patients')} className="action-btn secondary">All Patients</button>
                  </>}
                  {user.role==='Pharmacist'&&<button onClick={()=>setView('prescriptions')} className="action-btn">View Prescriptions</button>}
                  {user.role==='Admin'&&<><button onClick={()=>setView('patients')} className="action-btn">Manage Patients</button><button onClick={()=>setView('import')} className="action-btn secondary">Import Patients</button></>}
                  {user.role==='Radiologist'&&<><button onClick={()=>setView('upload-scan')} className="action-btn">Upload Scan</button><button onClick={()=>setView('my-uploads')} className="action-btn secondary">My Uploads</button></>}
                </div>
              </div>

              {/* ── Frequent Flyers (Admin) ── */}
              {user.role==='Admin' && frequentFlyers.length>0 && (
                <div style={{ gridColumn:'1/-1',background:'var(--card-bg)',border:'1px solid var(--border-glass)',borderRadius:'var(--r-xl)',padding:'1.5rem',boxShadow:'var(--shadow-card)' }}>
                  <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'1.25rem',flexWrap:'wrap',gap:'0.5rem' }}>
                    <div>
                      <h3 style={{ fontFamily:"'Space Grotesk',sans-serif",fontWeight:700,fontSize:'1rem',margin:'0 0 0.2rem',color:'var(--text-bright)',display:'flex',alignItems:'center',gap:'0.5rem' }}>
                        🚨 Frequent Flyers
                        <span style={{ background:'var(--rose-dim)',border:'1px solid rgba(255,77,109,.25)',color:'var(--rose)',borderRadius:999,fontSize:'0.68rem',fontWeight:700,padding:'0.15rem 0.55rem' }}>{frequentFlyers.length}</span>
                      </h3>
                      <p style={{ fontSize:'0.78rem',color:'var(--text-dim)',margin:0 }}>Patients with &gt;3 visits in 6 months — may need care management review</p>
                    </div>
                    <button onClick={()=>setView('patients')} className="action-btn secondary" style={{ padding:'0.45rem 0.875rem',fontSize:'0.8rem',marginTop:0 }}>View All Patients →</button>
                  </div>
                  <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))',gap:'0.75rem' }}>
                    {frequentFlyers.slice(0,6).map((ff:any,i:number)=>(
                      <div key={i} style={{ display:'flex',alignItems:'center',gap:'0.875rem',padding:'0.875rem 1rem',background:'var(--raised)',border:'1px solid var(--border-glass)',borderRadius:'var(--r-md)',cursor:'pointer',transition:'border-color var(--t-mid)' }}
                        onClick={()=>{ setAdminSelectedPatient(ff as any); setView('patients'); }}
                        onMouseEnter={e=>(e.currentTarget.style.borderColor='var(--border-hover)')}
                        onMouseLeave={e=>(e.currentTarget.style.borderColor='var(--border-glass)')}>
                        <div style={{ width:40,height:40,borderRadius:10,background:'var(--rose-dim)',border:'1px solid rgba(255,77,109,.2)',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:"'Space Grotesk',sans-serif",fontWeight:700,fontSize:'0.85rem',color:'var(--rose)',flexShrink:0 }}>
                          {(ff.PatientName||'?').split(' ').map((w:string)=>w[0]).join('').slice(0,2)}
                        </div>
                        <div style={{ flex:1,minWidth:0 }}>
                          <p style={{ margin:0,fontWeight:700,fontSize:'0.875rem',color:'var(--text-bright)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{ff.PatientName}</p>
                          <p style={{ margin:'0.15rem 0 0',fontSize:'0.75rem',color:'var(--text-dim)' }}>{ff.Gender} · {ff.BloodGroup}</p>
                          {ff.MostFrequentComplaint && <p style={{ margin:'0.1rem 0 0',fontSize:'0.72rem',color:'var(--accent)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>↪ {ff.MostFrequentComplaint}</p>}
                        </div>
                        <div style={{ textAlign:'right',flexShrink:0 }}>
                          <div style={{ fontFamily:"'Space Grotesk',sans-serif",fontWeight:700,fontSize:'1.4rem',color:'var(--rose)',lineHeight:1 }}>{ff.VisitCount}</div>
                          <div style={{ fontSize:'0.65rem',color:'var(--text-dim)',marginTop:'0.1rem' }}>visits/6mo</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            )
          )}

          {/* ── Doctor Reports — Split Panel ── */}
          {view==='doctor-reports'&&(
            <div style={{ display:'flex', height:'calc(100vh - 140px)', margin:'-2rem -2.5rem', overflow:'hidden' }}>

              {/* ── LEFT COLUMN: My Patients ───────────────── */}
              <div style={{ width:230, flexShrink:0, borderRight:'1px solid var(--border)', display:'flex', flexDirection:'column', background:'var(--bg-1)' }}>
                {/* Header */}
                <div style={{ padding:'0.875rem 0.875rem 0.5rem', borderBottom:'1px solid var(--border)' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', marginBottom:'0.625rem' }}>
                    <div style={{ width:6, height:6, borderRadius:'50%', background:'var(--accent)', boxShadow:'0 0 6px var(--accent-glow)', flexShrink:0 }}/>
                    <span style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:'0.72rem', textTransform:'uppercase', letterSpacing:'0.08em', color:'var(--accent)' }}>My Patients</span>
                    <span style={{ marginLeft:'auto', background:'var(--accent-dim)', border:'1px solid var(--border)', borderRadius:999, fontSize:'0.65rem', fontWeight:700, padding:'0.1rem 0.45rem', color:'var(--accent)' }}>{myPatients.length}</span>
                  </div>
                  <input className="patient-list-search" placeholder="Search..." value={patientSearch} onChange={e=>{ setPatientSearch(e.target.value); }} style={{ marginBottom:0 }}/>
                </div>
                {/* My patients list */}
                <div style={{ flex:1, overflowY:'auto', padding:'0.625rem' }}>
                  {myPatients.length === 0
                    ? <p style={{ fontSize:'0.78rem', color:'var(--text-dim)', textAlign:'center', padding:'1.5rem 0.5rem' }}>
                        {patientSearch ? 'No matches' : 'No patients assigned yet'}
                      </p>
                    : myPatients.map(p => {
                        const hasChron = doctorRecords.some(r => r.PatientName === p.PatientName && r.IsChronic);
                        const visitCount = doctorRecords.filter(r => r.PatientName === p.PatientName).length;
                        const isActive = selectedPatient?.PatientID === (p as any).PatientID && patientListTab === 'mine';
                        return (
                          <div key={(p as any).PatientID}
                            className={`patient-tile ${isActive ? 'active' : ''}`}
                            onClick={() => { setSelectedPatient(p as any); setPatientListTab('mine'); }}>
                            <div className="pt-name">{p.PatientName}</div>
                            <div className="pt-meta">{p.Gender} · {visitCount} visit{visitCount!==1?'s':''}</div>
                            <div className="pt-badges">
                              <span className="badge badge-blood" style={{ fontSize:'0.65rem',padding:'0.1rem 0.4rem' }}>{p.BloodGroup}</span>
                              {hasChron && <span className="badge badge-chronic" style={{ fontSize:'0.65rem',padding:'0.1rem 0.4rem' }}>Chronic</span>}
                            </div>
                          </div>
                        );
                      })
                  }
                </div>
              </div>

              {/* ── MIDDLE COLUMN: Other Patients ─────────── */}
              <div style={{ width:210, flexShrink:0, borderRight:'1px solid var(--border)', display:'flex', flexDirection:'column', background:'var(--bg)' }}>
                {/* Header */}
                <div style={{ padding:'0.875rem 0.875rem 0.5rem', borderBottom:'1px solid var(--border)' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', marginBottom:'0.625rem' }}>
                    <div style={{ width:6, height:6, borderRadius:'50%', background:'var(--text-dim)', flexShrink:0 }}/>
                    <span style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:'0.72rem', textTransform:'uppercase', letterSpacing:'0.08em', color:'var(--text-dim)' }}>Other Patients</span>
                    <span style={{ marginLeft:'auto', background:'var(--raised)', border:'1px solid var(--border)', borderRadius:999, fontSize:'0.65rem', fontWeight:700, padding:'0.1rem 0.45rem', color:'var(--text-dim)' }}>{otherPatients.length}</span>
                  </div>
                  <p style={{ fontSize:'0.68rem', color:'var(--text-dim)', margin:0, lineHeight:1.4 }}>All other registered patients</p>
                </div>
                {/* Other patients list */}
                <div style={{ flex:1, overflowY:'auto', padding:'0.625rem' }}>
                  {otherPatients.length === 0
                    ? <p style={{ fontSize:'0.78rem', color:'var(--text-dim)', textAlign:'center', padding:'1.5rem 0.5rem' }}>
                        {patientSearch ? 'No matches' : 'No other patients'}
                      </p>
                    : otherPatients.map(p => {
                        const isActive = selectedPatient?.PatientID === (p as any).PatientID && patientListTab === 'other';
                        return (
                          <div key={(p as any).PatientID}
                            onClick={() => { setSelectedPatient(p as any); setPatientListTab('other'); }}
                            style={{ padding:'0.75rem 0.875rem', borderRadius:'var(--r-md)', border:'1px solid var(--border)', cursor:'pointer', marginBottom:'0.4rem', background: isActive ? 'var(--raised)' : 'transparent', borderColor: isActive ? 'var(--border-hover)' : 'var(--border)', transition:'all 0.18s' }}
                            onMouseEnter={e => { if (!isActive) { (e.currentTarget as HTMLDivElement).style.background='var(--raised)'; (e.currentTarget as HTMLDivElement).style.borderColor='var(--border-hover)'; } }}
                            onMouseLeave={e => { if (!isActive) { (e.currentTarget as HTMLDivElement).style.background='transparent'; (e.currentTarget as HTMLDivElement).style.borderColor='var(--border)'; } }}>
                            <div style={{ fontWeight:600, fontSize:'0.82rem', color:'var(--text-bright)', marginBottom:'0.15rem', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.PatientName}</div>
                            <div style={{ fontSize:'0.72rem', color:'var(--text-dim)' }}>{p.Gender} · {p.BloodGroup}</div>
                            <span style={{ display:'inline-block', marginTop:'0.3rem', fontSize:'0.62rem', padding:'0.1rem 0.4rem', borderRadius:4, background:'var(--amber-dim)', color:'var(--amber)', border:'1px solid rgba(217,119,6,0.2)', fontWeight:600 }}>
                              View only
                            </span>
                          </div>
                        );
                      })
                  }
                </div>
              </div>

              {/* ── RIGHT: Detail pane ────────────────────── */}
              <div className="patient-detail-pane" style={{ flex:1, minWidth:0 }}>
                {selectedPatient ? (
                  <>
                    {/* "View only" banner for other patients */}
                    {patientListTab === 'other' && (
                      <div style={{ display:'flex', alignItems:'center', gap:'0.625rem', padding:'0.625rem 1rem', background:'var(--amber-dim)', borderBottom:'1px solid rgba(217,119,6,0.2)', fontSize:'0.82rem', color:'var(--amber)', flexShrink:0 }}>
                        <AlertCircle size={14}/>
                        <span>This patient has not visited your clinic. Viewing public profile only — you can still record a visit.</span>
                        <button onClick={()=>setView('create-visit')} style={{ marginLeft:'auto', padding:'0.3rem 0.75rem', background:'var(--amber)', border:'none', borderRadius:6, color:'white', fontSize:'0.75rem', fontWeight:700, cursor:'pointer', fontFamily:"'Syne',sans-serif", whiteSpace:'nowrap' }}>
                          + Create Visit
                        </button>
                      </div>
                    )}
                    <PatientDetailPanel
                      patient={selectedPatient}
                      records={patientListTab === 'mine' ? doctorRecords : []}
                      token={token}
                      role={user.role}
                      onOpenSummary={() => setShowDoctorSummary(true)}
                      onOpenProgress={() => setShowDoctorProgress(true)}
                    />
                  </>
                ) : (
                  <div className="empty-state">
                    <div style={{ fontSize:40, opacity:.25, marginBottom:'0.5rem' }}>👈</div>
                    <h3>Select a patient</h3>
                    <p>Choose from <strong>My Patients</strong> to see full records,<br/>or browse <strong>Other Patients</strong> to view their profile.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── All / My Records ── */}
          {(view==='records'||view==='my-records')&&(
            <div className="records-container">
              {records.length===0
                ? <div className="empty-state"><FileText size={64}/><h3>No records found</h3></div>
                : <div className="table-container"><table className="data-table"><thead><tr><th>Patient</th><th>Doctor</th><th>Visit Date</th><th>Diagnosis</th><th>Medicine</th><th>Status</th></tr></thead>
                    <tbody>{records.map((r,i)=>(
                      <tr key={i}>
                        <td><div className="patient-cell"><strong>{r.PatientName}</strong><span className="badge badge-blood">{r.BloodGroup}</span></div></td>
                        <td><div className="doctor-cell"><strong>{r.DoctorName}</strong><small>{r.Specialty}</small></div></td>
                        <td>{fmtDate(r.VisitDate)}</td>
                        <td>{r.DiagnosisName||'---'}</td>
                        <td>{r.MedicineName||'---'}</td>
                        <td><span className={`status-badge ${r.IsDispensed?'dispensed':'pending'}`}>{r.IsDispensed?'Dispensed':'Pending'}</span></td>
                      </tr>
                    ))}</tbody>
                  </table></div>
              }
            </div>
          )}

          {/* ── Create Visit ── */}
          {view==='create-visit'&&(
            <div className="form-container"><form onSubmit={submitVisit} className="data-form"><h3>📋 Visit Information</h3>
              <div className="form-row">
                <div className="form-group"><label>Patient *</label><select value={visitF.PatientID||''} onChange={e=>setVisitF({...visitF,PatientID:Number(e.target.value)})} required><option value="">Select Patient</option>{patients.map(p=><option key={(p as any).PatientID} value={(p as any).PatientID}>{p.PatientName} — {p.BloodGroup}</option>)}</select></div>
                <div className="form-group">
                  <label>Doctor</label>
                  {(() => {
                    const myDoc = doctors.find(d => d.DoctorID === user.doctor_id);
                    // ensure visitF always has this doctor's ID
                    if (myDoc && visitF.DoctorID !== myDoc.DoctorID) {
                      setTimeout(() => setVisitF(f => ({ ...f, DoctorID: myDoc.DoctorID })), 0);
                    }
                    return (
                      <div style={{ display:'flex', alignItems:'center', gap:'0.75rem', padding:'0.875rem 1rem', background:'var(--accent-dim)', border:'1px solid var(--border)', borderRadius:'var(--r-md)', cursor:'not-allowed' }}>
                        <div style={{ width:32, height:32, borderRadius:8, background:'linear-gradient(135deg,var(--accent),var(--violet))', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                          <Stethoscope size={15} color="white"/>
                        </div>
                        <div style={{ flex:1 }}>
                          <p style={{ margin:0, fontWeight:700, fontSize:'0.9rem', color:'var(--text-bright)' }}>{myDoc ? myDoc.DoctorName : user.username}</p>
                          <p style={{ margin:0, fontSize:'0.75rem', color:'var(--text-dim)' }}>{myDoc ? myDoc.Specialty : 'Doctor'}</p>
                        </div>
                        <span style={{ fontSize:'0.68rem', padding:'0.2rem 0.5rem', borderRadius:4, background:'var(--accent)', color:'#fff', fontWeight:700, letterSpacing:'0.06em' }}>YOU</span>
                      </div>
                    );
                  })()}
                </div>
              </div>
              <div className="form-group"><label>Reason for Visit *</label><input type="text" value={visitF.ReasonForVisit} onChange={e=>setVisitF({...visitF,ReasonForVisit:e.target.value})} required/></div>
              <div className="form-group"><label>Vital Signs (JSON)</label><textarea value={visitF.VitalSigns} onChange={e=>setVisitF({...visitF,VitalSigns:e.target.value})} placeholder='{"bp":"120/80","temp":"98.6","pulse":"72","spo2":"99%","weight":"70kg"}' rows={3}/></div>
              <div className="form-group"><label>Notes</label><textarea value={visitF.Notes} onChange={e=>setVisitF({...visitF,Notes:e.target.value})} rows={4}/></div>
              <div className="form-group"><label>Status</label><select value={visitF.Status} onChange={e=>setVisitF({...visitF,Status:e.target.value})}><option>Scheduled</option><option>In Progress</option><option>Completed</option></select></div>
              <button type="submit" className="submit-btn" disabled={loading}>{loading?'Creating...':'Create Visit'}</button>
            </form></div>
          )}

          {/* ── Add Diagnosis ── */}
          {view==='add-diagnosis'&&(
            <div className="form-container"><form onSubmit={submitDiag} className="data-form"><h3>🩺 Diagnosis Information</h3>
              <div className="form-row">
                <div className="form-group"><label>Visit *</label><select value={diagF.VisitID||''} onChange={e=>setDiagF({...diagF,VisitID:Number(e.target.value)})} required><option value="">Select Visit</option>{visits.map(v=><option key={v.VisitID} value={v.VisitID}>#{v.VisitID} — {v.PatientName} ({fmtDate(v.VisitDate)})</option>)}</select></div>
                <div className="form-group"><label>Severity *</label><select value={diagF.Severity} onChange={e=>setDiagF({...diagF,Severity:e.target.value})}><option>Mild</option><option>Moderate</option><option>Severe</option></select></div>
              </div>
              <div className="form-group"><label>Diagnosis Name *</label><input type="text" value={diagF.DiagnosisName} onChange={e=>setDiagF({...diagF,DiagnosisName:e.target.value})} required/></div>
              <div className="form-group"><label>Description</label><textarea value={diagF.Description} onChange={e=>setDiagF({...diagF,Description:e.target.value})} rows={4}/></div>
              <div className="form-group checkbox-group"><label><input type="checkbox" checked={diagF.IsChronic} onChange={e=>setDiagF({...diagF,IsChronic:e.target.checked})}/><span>Chronic Condition</span></label></div>
              <button type="submit" className="submit-btn" disabled={loading}>{loading?'Adding...':'Add Diagnosis'}</button>
            </form></div>
          )}

          {/* ── Add Prescription ── */}
          {view==='add-rx'&&(
            <div className="form-container"><form onSubmit={submitRx} className="data-form"><h3>💊 Prescription Information</h3>
              <div className="form-group"><label>Visit *</label><select value={rxF.visit_id||''} onChange={e=>setRxF({...rxF,visit_id:Number(e.target.value)})} required><option value="">Select Visit</option>{visits.map(v=><option key={v.VisitID} value={v.VisitID}>#{v.VisitID} — {v.PatientName} ({fmtDate(v.VisitDate)})</option>)}</select></div>
              <div className="form-row">
                <div className="form-group"><label>Medicine *</label><input type="text" value={rxF.medicine} onChange={e=>setRxF({...rxF,medicine:e.target.value})} required/></div>
                <div className="form-group"><label>Dosage *</label><input type="text" value={rxF.dosage} onChange={e=>setRxF({...rxF,dosage:e.target.value})} required/></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label>Frequency *</label><input type="text" value={rxF.frequency} onChange={e=>setRxF({...rxF,frequency:e.target.value})} required/></div>
                <div className="form-group"><label>Duration *</label><input type="text" value={rxF.duration} onChange={e=>setRxF({...rxF,duration:e.target.value})} required/></div>
              </div>
              <div className="form-group"><label>Instructions</label><textarea value={rxF.instructions} onChange={e=>setRxF({...rxF,instructions:e.target.value})} rows={3}/></div>
              <button type="submit" className="submit-btn" disabled={loading}>{loading?'Adding...':'Add Prescription'}</button>
            </form></div>
          )}

          {/* ── My Files (Patient) ── */}
          {view==='my-files'&&(
            <div className="files-container">
              {medFiles.length===0
                ? <div className="empty-state"><FileImage size={64}/><h3>No files uploaded</h3><button onClick={()=>setView('upload-file')} className="action-btn">Upload File</button></div>
                : <div className="files-grid">{medFiles.map(f=>(
                  <div key={f.FileID} className="file-card">
                    <div className="file-icon"><FileImage size={40}/></div>
                    <div className="file-details"><h4>{f.FileType}</h4><p className="file-name">{f.FileName}</p><p className="file-size">{(f.FileSize/1024/1024).toFixed(2)} MB</p><p className="file-date">{fmtDate(f.UploadedAt)}</p>{f.Description&&<p className="file-desc">{f.Description}</p>}</div>
                    <button className="download-btn" onClick={()=>downloadFile(f.FileID,f.FileName)}><Download size={20}/> Download</button>
                  </div>
                ))}</div>
              }
            </div>
          )}

          {/* ── Upload File (Patient) ── */}
          {view==='upload-file'&&(
            <div className="form-container"><form onSubmit={submitUpload} className="data-form"><h3>📤 Upload Medical File</h3>
              <div className="form-group"><label>File Type *</label><select value={fileF.file_type} onChange={e=>setFileF({...fileF,file_type:e.target.value})}>{['X-Ray','MRI','CT Scan','Blood Test','Report','Prescription','Other'].map(t=><option key={t}>{t}</option>)}</select></div>
              <div className="form-group"><label>Select File *</label><div className="file-input-wrapper"><input type="file" onChange={e=>setFileF({...fileF,file:e.target.files?.[0]||null})} accept=".jpg,.jpeg,.png,.pdf,.dcm" required/>{fileF.file&&<p className="file-selected">Selected: {fileF.file.name}</p>}</div><small>JPG, PNG, PDF, DICOM · max 50 MB</small></div>
              <div className="form-group"><label>Description</label><textarea value={fileF.description} onChange={e=>setFileF({...fileF,description:e.target.value})} rows={3}/></div>
              <button type="submit" className="submit-btn" disabled={loading||!fileF.file}>{loading?'Uploading...':'Upload File'}</button>
            </form></div>
          )}

          {/* ── My Appointments (Patient) ── */}
          {view==='my-appointments'&&(
            <MyAppointmentsView token={token} doctors={doctors}/>
          )}

          {/* ── Appointment Queue (Receptionist) ── */}
          {view==='appointment-queue'&&(
            <ReceptionistDashboard token={token} doctors={doctors}/>
          )}

          {/* ── Prescriptions (Pharmacist) ── */}
          {view==='prescriptions'&&(
            <div className="prescriptions-container">
              <div className="prescriptions-header">
                <label className="filter-checkbox"><input type="checkbox" checked={pendingOnly} onChange={e=>{setPendingOnly(e.target.checked);setTimeout(loadRx,0);}}/><span>Show Pending Only</span></label>
              </div>
              {prescriptions.length===0
                ? <div className="empty-state"><Pill size={64}/><h3>No prescriptions</h3></div>
                : <div className="table-container"><table className="data-table"><thead><tr><th>Patient</th><th>Medicine</th><th>Dosage</th><th>Frequency</th><th>Duration</th><th>Doctor</th><th>Status</th><th>Action</th></tr></thead>
                    <tbody>{prescriptions.map(p=>(
                      <tr key={p.PrescriptionID}>
                        <td><strong>{p.PatientName}</strong></td><td><strong>{p.MedicineName}</strong></td>
                        <td>{p.Dosage}</td><td>{p.Frequency}</td><td>{p.Duration}</td><td>{p.DoctorName}</td>
                        <td><span className={`status-badge ${p.IsDispensed?'dispensed':'pending'}`}>{p.IsDispensed?<><CheckCircle size={14}/> Dispensed</>:<><Clock size={14}/> Pending</>}</span></td>
                        <td>{!p.IsDispensed&&<button className="dispense-btn" onClick={()=>dispense(p.PrescriptionID)}>Dispense</button>}</td>
                      </tr>
                    ))}</tbody>
                  </table></div>
              }
            </div>
          )}

          {/* ── Upload Scan (Radiologist) ── */}
          {view==='upload-scan'&&(
            <div className="form-container"><form onSubmit={submitScanUpload} className="data-form"><h3>🩻 Upload Patient Scan</h3>
              <div className="form-row">
                <div className="form-group"><label>Patient *</label><select value={scanF.patient_id} onChange={e=>setScanF({...scanF,patient_id:e.target.value})} required><option value="">Select Patient</option>{patients.map(p=><option key={(p as any).PatientID} value={(p as any).PatientID}>{p.PatientName} — {p.BloodGroup}</option>)}</select></div>
                <div className="form-group"><label>Scan Type *</label><select value={scanF.scan_type} onChange={e=>setScanF({...scanF,scan_type:e.target.value})}>{SCAN_TYPES.map(t=><option key={t}>{t}</option>)}</select></div>
              </div>
              <div className="form-group"><label>Scan File *</label><div className="file-input-wrapper"><input type="file" onChange={e=>setScanF({...scanF,file:e.target.files?.[0]||null})} accept=".jpg,.jpeg,.png,.pdf,.dcm" required/>{scanF.file&&<p className="file-selected">Selected: {scanF.file.name}</p>}</div><small>JPG, PNG, PDF, DICOM · max 50 MB</small></div>
              <div className="form-group"><label>Description / Findings</label><textarea value={scanF.description} onChange={e=>setScanF({...scanF,description:e.target.value})} rows={4} placeholder="e.g. Chest X-Ray — No consolidation seen. Normal cardiac silhouette."/></div>
              <button type="submit" className="submit-btn" disabled={loading||!scanF.file||!scanF.patient_id}>{loading?'Uploading...':'Upload Scan'}</button>
            </form></div>
          )}

          {/* ── My Uploads (Radiologist) ── */}
          {view==='my-uploads'&&(
            <div className="files-container">
              {myScans.length===0
                ? <div className="empty-state"><ScanLine size={64}/><h3>No scans uploaded yet</h3><button onClick={()=>setView('upload-scan')} className="action-btn">Upload Scan</button></div>
                : <div style={{ display:'flex',flexDirection:'column',gap:'0.75rem' }}>{myScans.map(s=>(
                  <div key={s.FileID} style={{ background:'var(--card-bg)',border:'1px solid rgba(244,63,94,.14)',borderRadius:14,padding:'1rem 1.25rem',display:'flex',alignItems:'center',gap:'1rem' }}>
                    <div style={{ width:44,height:44,borderRadius:11,background:'rgba(244,63,94,.1)',border:'1px solid rgba(244,63,94,.2)',display:'flex',alignItems:'center',justifyContent:'center',color:'var(--rose)',flexShrink:0 }}><ScanLine size={20}/></div>
                    <div style={{ flex:1,minWidth:0 }}>
                      <div style={{ display:'flex',alignItems:'center',gap:'0.6rem',marginBottom:'0.2rem' }}><p style={{ margin:0,fontWeight:700,fontSize:'0.9rem' }}>{s.FileName}</p><span style={{ fontSize:'0.7rem',padding:'0.12rem 0.5rem',borderRadius:999,background:'rgba(244,63,94,.1)',color:'var(--rose)',fontWeight:700 }}>{s.FileType}</span></div>
                      <p style={{ margin:0,fontSize:'0.78rem',color:'var(--text-dim)' }}>Patient: <strong style={{ color:'var(--text-mid)' }}>{s.PatientName}</strong> · {s.BloodGroup} · {(s.FileSize/1024/1024).toFixed(2)} MB · {fmtDate(s.UploadedAt)}</p>
                      {s.Description&&<p style={{ margin:'0.25rem 0 0',fontSize:'0.78rem',color:'var(--text-mid)' }}>{s.Description}</p>}
                    </div>
                    <button onClick={()=>downloadFile(s.FileID,s.FileName)} className="download-btn" style={{ whiteSpace:'nowrap' }}><Download size={16}/> Download</button>
                  </div>
                ))}</div>
              }
            </div>
          )}

          {/* ── Patients (Admin) — Split Panel ── */}
          {view==='patients'&&(
            <div style={{ display:'flex', height:'calc(100vh - 140px)', margin:'-2rem -2.5rem', overflow:'hidden' }}>

              {/* Left: patient list */}
              <div style={{ width:260, flexShrink:0, borderRight:'1px solid var(--border)', display:'flex', flexDirection:'column', background:'var(--bg-1)' }}>
                <div style={{ padding:'0.875rem', borderBottom:'1px solid var(--border)' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', marginBottom:'0.5rem' }}>
                    <Users size={14} style={{ color:'var(--accent)' }}/>
                    <span style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:'0.72rem', textTransform:'uppercase', letterSpacing:'0.08em', color:'var(--text-dim)' }}>All Patients</span>
                    <span style={{ marginLeft:'auto', background:'var(--accent-dim)', border:'1px solid var(--border)', borderRadius:999, fontSize:'0.65rem', fontWeight:700, padding:'0.1rem 0.4rem', color:'var(--accent)' }}>{patients.length}</span>
                  </div>
                  <input className="patient-list-search" style={{ marginBottom:0 }} placeholder="Search patients..."
                    value={adminPatientSearch} onChange={e=>setAdminPatientSearch(e.target.value)}/>
                </div>

                {/* Bulk action toolbar */}
                {selectedPatientIds.length > 0 && (
                  <div style={{ padding:'0.625rem', borderBottom:'1px solid var(--border)', background:'var(--amber-dim)', display:'flex', alignItems:'center', justifyContent:'space-between', gap:'0.5rem' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:'0.5rem' }}>
                      <input type="checkbox" checked={selectedPatientIds.length > 0} onChange={(e) => {
                        if (e.target.checked) {
                          // Select all visible patients
                          const visiblePatients = patients.filter(p => !adminPatientSearch || p.PatientName.toLowerCase().includes(adminPatientSearch.toLowerCase()));
                          setSelectedPatientIds(visiblePatients.map(p => (p as any).PatientID));
                        } else {
                          setSelectedPatientIds([]);
                        }
                      }} style={{ cursor:'pointer' }}/>
                      <span style={{ fontSize:'0.75rem', fontWeight:700, color:'var(--amber)' }}>{selectedPatientIds.length} selected</span>
                    </div>
                    <button onClick={async () => {
                      if (!window.confirm(`Are you sure you want to deactivate ${selectedPatientIds.length} patient(s)? This action cannot be undone.`)) return;
                      try {
                        const res = await fetch(`${API}/patients/bulk-delete`, {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json',
                            Authorization: `Bearer ${token}`
                          },
                          body: JSON.stringify({ patient_ids: selectedPatientIds })
                        });
                        const data = await res.json();
                        if (!res.ok) throw new Error(data.error || 'Bulk deletion failed');
                        alert(`Successfully deactivated ${data.deactivated_count} patient(s)`);
                        // Refresh patient list
                        loadPatients();
                        // Clear selection
                        setSelectedPatientIds([]);
                        // Clear selected patient if it was among the deleted ones
                        if (adminSelectedPatient && selectedPatientIds.includes(adminSelectedPatient.PatientID)) {
                          setAdminSelectedPatient(null);
                        }
                      } catch (err: any) {
                        alert(`Error: ${err.message}`);
                      }
                    }} style={{ background:'var(--rose)', color:'white', border:'none', borderRadius:'var(--r-sm)', padding:'0.3rem 0.6rem', fontSize:'0.7rem', fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', gap:'0.3rem' }}>
                      <Trash2 size={11}/> Delete Selected
                    </button>
                  </div>
                )}

                <div style={{ flex:1, overflowY:'auto', padding:'0.625rem' }}>
                  {patients.filter(p=>!adminPatientSearch||p.PatientName.toLowerCase().includes(adminPatientSearch.toLowerCase())).map(p => {
                    const patientId = (p as any).PatientID;
                    const isActive = adminSelectedPatient?.PatientID === patientId;
                    const isSelected = selectedPatientIds.includes(patientId);
                    return (
                      <div key={patientId}
                        className={`patient-tile ${isActive?'active':''} ${isSelected?'selected':''}`}
                        onClick={(e) => {
                          // Don't change selection if clicking on checkbox
                          if ((e.target as HTMLElement).tagName === 'INPUT') return;
                          setAdminSelectedPatient(p as any);
                        }}>
                        <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', width:'100%' }}>
                          <input type="checkbox" checked={isSelected} onChange={(e) => {
                            e.stopPropagation();
                            if (e.target.checked) {
                              setSelectedPatientIds([...selectedPatientIds, patientId]);
                            } else {
                              setSelectedPatientIds(selectedPatientIds.filter(id => id !== patientId));
                            }
                          }} style={{ cursor:'pointer', flexShrink:0 }}/>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div className="pt-name">{p.PatientName}</div>
                            <div className="pt-meta">{p.Gender} · {p.BloodGroup}</div>
                            <div className="pt-badges">
                              <span className="badge badge-blood" style={{ fontSize:'0.65rem',padding:'0.1rem 0.4rem' }}>{p.BloodGroup}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {/* Assign Credentials shortcut */}
                {noCreds.length>0&&(
                  <div style={{ padding:'0.75rem', borderTop:'1px solid var(--border)', background:'var(--amber-dim)' }}>
                    <button onClick={()=>setView('assign-creds')} style={{ width:'100%', padding:'0.6rem', background:'var(--amber)', border:'none', borderRadius:'var(--r-md)', color:'white', fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:'0.78rem', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:'0.4rem' }}>
                      <Key size={13}/> {noCreds.length} Need Credentials
                    </button>
                  </div>
                )}
              </div>

              {/* Right: patient detail pane */}
              <div style={{ flex:1, minWidth:0, overflow:'hidden', display:'flex', flexDirection:'column' }}>
                {adminSelectedPatient ? (
                  <AdminPatientDetailPane
                    key={adminSelectedPatient.PatientID}
                    patient={adminSelectedPatient}
                    token={token}
                    onEdit={()=>setEditPatient(adminSelectedPatient)}
                    onDelete={()=>setDeleteConfirm(adminSelectedPatient)}
                  />
                ) : (
                  <div className="empty-state">
                    <div style={{ fontSize:40, opacity:.2, marginBottom:'0.5rem' }}>👈</div>
                    <h3>Select a patient</h3>
                    <p>Click any patient from the list to view their complete profile, visit history, diagnoses, prescriptions, lab tests, and files.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Manage Doctors (Admin) ── */}
          {view==='manage-doctors'&&(
            <div className="patients-container">
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1.5rem' }}>
                <h2 style={{ fontFamily:"'Space Grotesk',sans-serif", fontWeight:800, fontSize:'1.4rem', color:'var(--text-bright)', margin:0 }}>Manage Doctors</h2>
                <span style={{ background:'var(--accent-dim)', border:'1px solid var(--border)', borderRadius:999, fontSize:'0.75rem', fontWeight:700, padding:'0.2rem 0.75rem', color:'var(--accent)' }}>{doctors.length} doctors</span>
              </div>

              {/* Add Doctor Form */}
              <div style={{ background:'var(--card-bg)', border:'1px solid var(--border-glass)', borderRadius:'var(--r-lg)', padding:'1.5rem', marginBottom:'2rem', boxShadow:'var(--shadow-card)' }}>
                <h3 style={{ fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:'1rem', color:'var(--accent)', marginTop:0, marginBottom:'1rem', display:'flex', alignItems:'center', gap:'0.5rem' }}><UserPlus size={18}/> Add New Doctor</h3>
                <form onSubmit={addDoctor} style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))', gap:'1rem' }}>
                  <div className="form-group">
                    <label>Full Name *</label>
                    <input type="text" value={newDoctorF.doctor_name} onChange={e=>setNewDoctorF({...newDoctorF, doctor_name:e.target.value})} placeholder="Dr. John Doe" required/>
                  </div>
                  <div className="form-group">
                    <label>Email *</label>
                    <input type="email" value={newDoctorF.email} onChange={e=>setNewDoctorF({...newDoctorF, email:e.target.value})} placeholder="doctor@hospital.com" required/>
                  </div>
                  <div className="form-group">
                    <label>Specialty *</label>
                    <input type="text" value={newDoctorF.specialty} onChange={e=>setNewDoctorF({...newDoctorF, specialty:e.target.value})} placeholder="Cardiology" required/>
                  </div>
                  <div className="form-group">
                    <label>Phone Number *</label>
                    <input type="tel" value={newDoctorF.phone_number} onChange={e=>setNewDoctorF({...newDoctorF, phone_number:e.target.value})} placeholder="+1234567890" required/>
                  </div>
                  <div className="form-group">
                    <label>License Number</label>
                    <input type="text" value={newDoctorF.license_number} onChange={e=>setNewDoctorF({...newDoctorF, license_number:e.target.value})} placeholder="Optional"/>
                  </div>
                  <div className="form-group">
                    <label>Years of Experience</label>
                    <input type="number" min="0" max="50" value={newDoctorF.years_of_experience} onChange={e=>setNewDoctorF({...newDoctorF, years_of_experience:e.target.value})} placeholder="Optional"/>
                  </div>
                  <div style={{ gridColumn:'1/-1', display:'flex', justifyContent:'flex-end', gap:'0.75rem', marginTop:'0.5rem' }}>
                    <button type="button" className="action-btn secondary" onClick={()=>setNewDoctorF({ doctor_name:'', email:'', specialty:'', phone_number:'', license_number:'', years_of_experience:'' })}>Clear</button>
                    <button type="submit" className="action-btn" disabled={loading}>{loading ? 'Adding...' : 'Add Doctor'}</button>
                  </div>
                </form>
              </div>

              {/* Doctors Table */}
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Specialty</th>
                      <th>Phone</th>
                      <th>License</th>
                      <th>Experience</th>
                    </tr>
                  </thead>
                  <tbody>
                    {doctors.length === 0 ? (
                      <tr><td colSpan={7} style={{ textAlign:'center', padding:'2rem', color:'var(--text-dim)' }}>No doctors found. Add a doctor using the form above.</td></tr>
                    ) : doctors.map(d => (
                      <tr key={d.DoctorID}>
                        <td><strong>#{d.DoctorID}</strong></td>
                        <td><strong>{d.DoctorName}</strong></td>
                        <td><div className="contact-cell"><Mail size={14}/><span>{d.Email}</span></div></td>
                        <td><span className="badge badge-blood" style={{ background:'var(--accent-dim)', color:'var(--accent)' }}>{d.Specialty}</span></td>
                        <td><div className="contact-cell"><Phone size={14}/><span>{d.PhoneNumber}</span></div></td>
                        <td>{d.LicenseNumber || '—'}</td>
                        <td>{d.YearsOfExperience ? `${d.YearsOfExperience} years` : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Assign Credentials (Admin) ── */}
          {view==='assign-creds'&&(
            <div className="patients-container">
              {noCreds.length===0
                ? <div className="empty-state"><Key size={64}/><h3>All patients have credentials</h3></div>
                : <>
                  <div style={{ marginBottom:'1rem',padding:'0.875rem 1.25rem',background:'var(--amber-dim)',border:'1px solid rgba(245,158,11,.18)',borderRadius:12,display:'flex',alignItems:'center',gap:'0.6rem' }}>
                    <AlertCircle size={16} color="var(--amber)"/>
                    <p style={{ margin:0,color:'#fbbf24',fontSize:'0.85rem' }}><strong>{noCreds.length}</strong> patient{noCreds.length>1?'s':''} imported via CSV need login credentials.</p>
                  </div>
                  <div className="table-container"><table className="data-table"><thead><tr><th>Name</th><th>Email</th><th>Gender</th><th>Blood Group</th><th>Phone</th><th>Imported On</th><th style={{ textAlign:'center' }}>Action</th></tr></thead>
                    <tbody>{noCreds.map(p=>(
                      <tr key={p.PatientID}>
                        <td><strong>{p.PatientName}</strong></td>
                        <td><div className="contact-cell"><Mail size={14}/><span>{p.Email}</span></div></td>
                        <td>{p.Gender}</td>
                        <td><span className="badge badge-blood">{p.BloodGroup}</span></td>
                        <td><div className="contact-cell"><Phone size={14}/><span>{p.PhoneNumber}</span></div></td>
                        <td>{fmtDate(p.CreatedAt)}</td>
                        <td style={{ textAlign:'center' }}>
                          <button onClick={()=>setAssignPatient(p)} style={{ background:'linear-gradient(135deg,var(--amber),#d97706)',border:'none',borderRadius:8,padding:'0.4rem 0.875rem',color:'white',cursor:'pointer',display:'inline-flex',alignItems:'center',gap:'0.35rem',fontSize:'0.8rem',fontWeight:700,fontFamily:"'Syne',sans-serif" }}>
                            <Key size={13}/> Assign
                          </button>
                        </td>
                      </tr>
                    ))}</tbody>
                  </table></div>
                </>
              }
            </div>
          )}

          {/* ── Import (Admin) ── */}
          {view==='import'&&(
            <div className="import-container" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1.5rem', alignItems:'start' }}>

              {/* ══ PANEL 1: Import New Patients ══ */}
              <div className="import-section">
                <h3>📥 Import New Patients</h3>

                <div className="import-instructions">
                  <h4>Required Columns:</h4>
                  <p>Name, Email, Gender, DOB, Phone, Address, BloodGroup</p>
                  <div style={{ marginTop:'0.625rem', paddingTop:'0.625rem', borderTop:'1px solid var(--border-glass)' }}>
                    <p style={{ fontSize:'0.8rem', color:'var(--emerald)', fontWeight:600, marginBottom:'0.22rem', display:'flex', alignItems:'center', gap:'0.4rem' }}>🔑 Optional — auto-create login credentials:</p>
                    <p style={{ fontSize:'0.78rem', color:'var(--text-dim)' }}>
                      <strong>Username, Password</strong> — if provided, a Patient login is created immediately (no separate "Assign Credentials" step).
                    </p>
                    <p style={{ fontSize:'0.78rem', color:'var(--text-dim)', marginTop:'0.25rem' }}>Also optional: EmergencyContactName, EmergencyContact</p>
                  </div>
                  <a href={`${API}/admin/import-template?type=patients`} className="download-template-btn" download>
                    <Download size={15}/> Download Patient Template
                  </a>
                </div>

                <form onSubmit={submitImport} className="import-form">
                  <div className="form-group">
                    <label>Select Excel / CSV File</label>
                    <div className="file-input-wrapper">
                      <input type="file" onChange={e=>setImpFile(e.target.files?.[0]||null)} accept=".xlsx,.xls,.csv" required/>
                      {impFile && <p className="file-selected">📎 {impFile.name}</p>}
                    </div>
                    <small>Supports .xlsx, .xls, .csv · max 50 MB</small>
                  </div>
                  <button type="submit" className="submit-btn" disabled={loading||!impFile} style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:'0.5rem' }}>
                    {loading ? 'Importing...' : <><Upload size={15}/> Import Patients</>}
                  </button>
                </form>

                {importResult && (
                  <div style={{ marginTop:'1.25rem', padding:'1.25rem', background:'var(--glass)', border:'1px solid var(--border-glass)', borderRadius:'var(--r-lg)' }}>
                    <p style={{ fontFamily:"'Space Grotesk',sans-serif", fontWeight:700, fontSize:'0.78rem', textTransform:'uppercase', letterSpacing:'0.07em', color:'var(--text-mid)', marginBottom:'0.875rem' }}>Import Results</p>
                    <div className="result-stats">
                      <div className="result-stat success"><strong>{importResult.successful}</strong><span>Patients Imported</span></div>
                      <div className="result-stat error"><strong>{importResult.failed}</strong><span>Failed</span></div>
                      <div className="result-stat total"><strong>{importResult.total}</strong><span>Total Rows</span></div>
                    </div>
                    {(importResult.creds_created??0) > 0 && (
                      <div style={{ marginTop:'0.875rem', padding:'0.7rem 1rem', background:'var(--emerald-dim)', border:'1px solid rgba(0,229,160,0.22)', borderRadius:'var(--r-md)', fontSize:'0.82rem', color:'var(--emerald)', display:'flex', alignItems:'center', gap:'0.5rem' }}>
                        <CheckCircle size={14}/> {importResult.creds_created} login account{importResult.creds_created!==1?'s':''} created from CSV credentials.
                      </div>
                    )}
                    {importResult.successful > 0 && (importResult.creds_created??0) < importResult.successful && (
                      <div style={{ marginTop:'0.875rem', padding:'0.7rem 1rem', background:'var(--amber-dim)', border:'1px solid rgba(255,189,46,0.2)', borderRadius:'var(--r-md)', display:'flex', alignItems:'center', justifyContent:'space-between', gap:'0.75rem', flexWrap:'wrap' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', fontSize:'0.82rem', color:'var(--amber)' }}>
                          <Key size={14}/> {importResult.successful-(importResult.creds_created??0)} patient{(importResult.successful-(importResult.creds_created??0))!==1?'s':''} still need login credentials.
                        </div>
                        <button onClick={()=>setView('assign-creds')} className="action-btn" style={{ padding:'0.4rem 0.875rem', fontSize:'0.78rem', marginTop:0 }}>Assign Credentials →</button>
                      </div>
                    )}
                    {importResult.errors?.length > 0 && (
                      <div className="error-log" style={{ marginTop:'0.75rem' }}><h5>Errors ({importResult.errors.length}):</h5><ul>{importResult.errors.map((e:string,i:number)=><li key={i}>{e}</li>)}</ul></div>
                    )}
                  </div>
                )}
              </div>

              {/* ══ PANEL 2: Import Visit History ══ */}
              <div className="import-section">
                <h3>📋 Import Visit History</h3>

                <div className="import-instructions">
                  <h4>Required Columns:</h4>
                  <p>Email, VisitDate, ReasonForVisit, DoctorName</p>
                  <div style={{ marginTop:'0.625rem', paddingTop:'0.625rem', borderTop:'1px solid var(--border-glass)' }}>
                    <p style={{ fontSize:'0.8rem', color:'var(--emerald)', fontWeight:600, marginBottom:'0.22rem', display:'flex', alignItems:'center', gap:'0.4rem' }}>🔑 Optional — import credentials alongside visits:</p>
                    <p style={{ fontSize:'0.78rem', color:'var(--text-dim)', marginBottom:'0.25rem' }}><strong>Username, Password</strong> — creates a login for new patients during visit import.</p>
                    <p style={{ fontSize:'0.78rem', color:'var(--text-dim)' }}>Also optional: Name, DOB, DiagnosisName, MedicineName, BP, HeartRate, Temp, SpO2, Notes, IsChronic, Severity, Dosage, Frequency, Duration</p>
                  </div>
                  <a href={`${API}/admin/import-template?type=visits`} className="download-template-btn" style={{ marginTop:'0.5rem' }} download>
                    <Download size={15}/> Download Visit Template
                  </a>
                </div>

                <div style={{ padding:'0.75rem 1rem', background:'var(--accent-dim)', border:'1px solid var(--border-glass)', borderRadius:'var(--r-md)', marginBottom:'1rem', fontSize:'0.8rem', color:'var(--text-mid)', lineHeight:1.5 }}>
                  <strong style={{ color:'var(--accent)', display:'flex', alignItems:'center', gap:'0.4rem', marginBottom:'0.25rem' }}><Shield size={12}/> Deduplication enabled</strong>
                  Patients matched by Email → Name+DOB fallback. Duplicate visits (same patient+doctor+date+reason) and duplicate usernames are skipped automatically.
                </div>

                <form onSubmit={submitImportVisits} className="import-form">
                  <div className="form-group">
                    <label>Select Excel / CSV File</label>
                    <div className="file-input-wrapper">
                      <input type="file" onChange={e=>setImpVisitFile(e.target.files?.[0]||null)} accept=".xlsx,.xls,.csv" required/>
                      {impVisitFile && <p className="file-selected">📎 {impVisitFile.name}</p>}
                    </div>
                    <small>Supports .xlsx, .xls, .csv · max 50 MB</small>
                  </div>
                  <button type="submit" className="submit-btn" disabled={loading||!impVisitFile} style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:'0.5rem' }}>
                    {loading ? 'Importing...' : <><Upload size={15}/> Import Visit History</>}
                  </button>
                </form>

                {importVisitResult && (
                  <div style={{ marginTop:'1.25rem', padding:'1.25rem', background:'var(--glass)', border:'1px solid var(--border-glass)', borderRadius:'var(--r-lg)' }}>
                    <p style={{ fontFamily:"'Space Grotesk',sans-serif", fontWeight:700, fontSize:'0.78rem', textTransform:'uppercase', letterSpacing:'0.07em', color:'var(--text-mid)', marginBottom:'0.875rem' }}>Import Results</p>
                    <div className="result-stats">
                      <div className="result-stat success"><strong>{importVisitResult.successful}</strong><span>Visits Imported</span></div>
                      <div className="result-stat error"><strong>{importVisitResult.failed}</strong><span>Failed</span></div>
                      <div className="result-stat total"><strong>{importVisitResult.total}</strong><span>Total Rows</span></div>
                    </div>
                    <div style={{ display:'flex', gap:'0.5rem', flexWrap:'wrap', marginTop:'0.875rem' }}>
                      {(importVisitResult.patients_created??0) > 0 && (
                        <div style={{ padding:'0.38rem 0.75rem', borderRadius:999, background:'var(--violet-dim)', border:'1px solid rgba(155,125,255,0.22)', fontSize:'0.78rem', color:'var(--violet)', fontWeight:600 }}>
                          👤 {importVisitResult.patients_created} new patient profile{importVisitResult.patients_created!==1?'s':''} created
                        </div>
                      )}
                      {(importVisitResult.creds_created??0) > 0 && (
                        <div style={{ padding:'0.38rem 0.75rem', borderRadius:999, background:'var(--emerald-dim)', border:'1px solid rgba(0,229,160,0.22)', fontSize:'0.78rem', color:'var(--emerald)', fontWeight:600 }}>
                          🔑 {importVisitResult.creds_created} login account{importVisitResult.creds_created!==1?'s':''} created
                        </div>
                      )}
                      {(importVisitResult.diagnoses_added??0) > 0 && (
                        <div style={{ padding:'0.38rem 0.75rem', borderRadius:999, background:'var(--amber-dim)', border:'1px solid rgba(255,189,46,0.22)', fontSize:'0.78rem', color:'var(--amber)', fontWeight:600 }}>
                          🩺 {importVisitResult.diagnoses_added} diagnoses added
                        </div>
                      )}
                      {(importVisitResult.rx_added??0) > 0 && (
                        <div style={{ padding:'0.38rem 0.75rem', borderRadius:999, background:'var(--accent-dim)', border:'1px solid rgba(0,212,255,0.22)', fontSize:'0.78rem', color:'var(--accent)', fontWeight:600 }}>
                          💊 {importVisitResult.rx_added} prescriptions added
                        </div>
                      )}
                    </div>
                    {importVisitResult.errors?.length > 0 && (
                      <div className="error-log" style={{ marginTop:'0.875rem' }}><h5>Errors ({importVisitResult.errors.length}):</h5><ul>{importVisitResult.errors.map((e:string,i:number)=><li key={i}>{e}</li>)}</ul></div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}