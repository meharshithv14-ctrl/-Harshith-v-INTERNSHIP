import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Activity, User, Users, FileText, PlusCircle, LogOut,
  Shield, Stethoscope, Heart, Upload, Download, FileImage, UserPlus,
  Pill, CheckCircle, Clock, Calendar, Phone, Mail, MapPin,
  Eye, EyeOff, AlertCircle, Edit2, Trash2, Key, X, Save,
  ClipboardList, ScanLine, ChevronDown, ChevronUp, BookOpen,
  ArrowLeft, TrendingUp, Microscope, Layers, Zap, Info,
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, ReferenceLine,
} from 'recharts';
import './App.css';

// ─────────────────────────────────────────────
//  Types
// ─────────────────────────────────────────────
interface AuthUser {
  user_id: number; username: string; email: string; role: string;
  patient_id?: number | null; doctor_id?: number | null;
  pharmacist_id?: number | null;
}
interface Patient {
  PatientID?: number; PatientName: string; Email: string; Gender: string;
  DateOfBirth: string; PhoneNumber: string; Address: string; BloodGroup: string;
  EmergencyContact?: string; EmergencyContactName?: string;
}
interface Doctor { DoctorID: number; DoctorName: string; Specialty: string; }
interface Visit {
  VisitID?: number; PatientID: number; DoctorID: number; ReasonForVisit: string;
  VitalSigns?: string; Notes?: string; Status: string;
  PatientName?: string; VisitDate?: string;
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
  total_patients: number; total_doctors: number; today_visits: number;
  pending_prescriptions: number; pending_tests: number;
}
interface DoctorRecord {
  PatientID?: number; PatientName: string; BloodGroup: string;
  DoctorName: string; Specialty: string; VisitDate: string;
  ReasonForVisit: string; VisitStatus: string; VitalSigns?: string;
  VisitNotes?: string; DiagnosisName?: string; DiagnosisDesc?: string;
  IsChronic?: boolean; Severity?: string; MedicineName?: string;
  Dosage?: string; Frequency?: string; Duration?: string;
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
interface SummaryVisit {
  VisitID: number; VisitDate: string; ReasonForVisit: string;
  VitalSigns?: string; Notes?: string; Status: string;
  DoctorName: string; Specialty: string;
}
interface SummaryDiagnosis {
  DiagnosisName: string; Description?: string;
  Severity: string; IsChronic: boolean; VisitDate: string;
}
interface SummaryPrescription {
  MedicineName: string; Dosage: string; Frequency: string;
  Duration: string; Instructions?: string;
  IsDispensed: boolean; DoctorName: string; VisitDate: string;
}
interface PatientSummary {
  patient: Patient & { SummaryNotes: string; NotesUpdatedBy: string; UpdatedAt?: string; };
  visits: SummaryVisit[];
  diagnoses: SummaryDiagnosis[];
  prescriptions: SummaryPrescription[];
  files: MedicalFile[];
}
interface RegisterForm {
  username: string; password: string; email: string; name: string;
  gender: string; dob: string; phone: string; address: string;
  blood_group: string; emergency_contact: string; emergency_contact_name: string;
}
interface RoleEntity {
  role: string; icon: React.ReactNode; color: string; glow: string;
  bg: string; border: string; demoUser: string; demoPass: string;
  label: string; desc: string;
}

// ─────────────────────────────────────────────
//  Constants
// ─────────────────────────────────────────────
const ENTITIES: RoleEntity[] = [
  {
    role: 'Doctor',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" style={{width:26,height:26}}><path d="M3 9a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9Z"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="12" y1="12" x2="12" y2="16"/><line x1="10" y1="14" x2="14" y2="14"/></svg>,
    color:'#06b6d4',glow:'rgba(6,182,212,0.35)',bg:'rgba(6,182,212,0.08)',border:'rgba(6,182,212,0.3)',
    demoUser:'dr_anil',demoPass:'doctor123',label:'Clinical Staff',desc:'Manage visits, diagnoses & prescriptions',
  },
  {
    role: 'Patient',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" style={{width:26,height:26}}><circle cx="12" cy="8" r="4"/><path d="M6 20v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/></svg>,
    color:'#8b5cf6',glow:'rgba(139,92,246,0.35)',bg:'rgba(139,92,246,0.08)',border:'rgba(139,92,246,0.3)',
    demoUser:'rahul_p',demoPass:'password123',label:'Patient Portal',desc:'View records, reports & prescriptions',
  },
  {
    role: 'Radiologist',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" style={{width:26,height:26}}><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/><path d="M7 8l2 3 2-5 2 4 1-2h2"/></svg>,
    color:'#f43f5e',glow:'rgba(244,63,94,0.35)',bg:'rgba(244,63,94,0.08)',border:'rgba(244,63,94,0.3)',
    demoUser:'rad_priya',demoPass:'scan1234',label:'Radiology Dept',desc:'Upload & manage patient scans & imaging',
  },
  {
    role: 'Pharmacist',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" style={{width:26,height:26}}><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 9h6M12 6v6"/><circle cx="9" cy="15" r="1.5" fill="currentColor"/><circle cx="12" cy="15" r="1.5" fill="currentColor"/><circle cx="15" cy="15" r="1.5" fill="currentColor"/></svg>,
    color:'#10b981',glow:'rgba(16,185,129,0.35)',bg:'rgba(16,185,129,0.08)',border:'rgba(16,185,129,0.3)',
    demoUser:'pharm_amit',demoPass:'pharmacy123',label:'Pharmacy',desc:'Dispense & track prescription orders',
  },
  {
    role: 'Admin',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" style={{width:26,height:26}}><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>,
    color:'#f59e0b',glow:'rgba(245,158,11,0.35)',bg:'rgba(245,158,11,0.08)',border:'rgba(245,158,11,0.3)',
    demoUser:'admin',demoPass:'admin123',label:'Administration',desc:'Manage staff, patients & system data',
  },
];

const API = 'http://localhost:5000/api';
const SCAN_TYPES = ['X-Ray','MRI','CT Scan','Ultrasound','PET Scan','Mammography','Fluoroscopy'];

function decodeJWT(token: string): AuthUser | null {
  try {
    const b64 = token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/');
    return JSON.parse(decodeURIComponent(atob(b64).split('').map(c=>'%'+('00'+c.charCodeAt(0).toString(16)).slice(-2)).join('')));
  } catch { return null; }
}

// ─────────────────────────────────────────────
//  Utility
// ─────────────────────────────────────────────
const sevColor = (s?: string) =>
  s==='Severe' ? '#f43f5e' : s==='Moderate' ? '#f59e0b' : '#10b981';

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span style={{ fontSize:'0.7rem', padding:'0.18rem 0.6rem', borderRadius:999,
      background:`${color}18`, color, fontWeight:700, whiteSpace:'nowrap' }}>
      {label}
    </span>
  );
}

// ─────────────────────────────────────────────
//  Modal wrapper
// ─────────────────────────────────────────────
function Modal({ title, onClose, wide, children }: { title:string; onClose:()=>void; wide?:boolean; children:React.ReactNode }) {
  return (
    <div style={{position:'fixed',inset:0,zIndex:1000,background:'rgba(6,9,16,0.85)',backdropFilter:'blur(6px)',display:'flex',alignItems:'center',justifyContent:'center',padding:'1rem'}} onClick={onClose}>
      <div style={{background:'#111827',border:'1px solid rgba(148,163,184,0.12)',borderRadius:20,padding:'1.75rem',width:'100%',maxWidth:wide?900:560,maxHeight:'92vh',overflowY:'auto',boxShadow:'0 24px 64px rgba(0,0,0,0.6)',animation:'lsSlideUp 0.3s cubic-bezier(0.16,1,0.3,1) both'}} onClick={e=>e.stopPropagation()}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'1.25rem'}}>
          <h3 style={{margin:0,color:'#f0f6ff',fontFamily:"'Syne',sans-serif",fontSize:'1.1rem',fontWeight:800}}>{title}</h3>
          <button onClick={onClose} style={{background:'none',border:'none',color:'#475569',cursor:'pointer',display:'flex'}}><X size={20}/></button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
//  PatientProfile — full-page tabbed view
// ─────────────────────────────────────────────
type ProfileTab = 'overview' | 'visits' | 'diagnoses' | 'prescriptions' | 'scans' | 'progress';

function PatientProfile({ patientId, token, onBack }: {
  patientId: number; token: string; onBack: () => void;
}) {
  const [summary, setSummary] = useState<PatientSummary | null>(null);
  const [scans,   setScans]   = useState<ScanFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab,     setTab]     = useState<ProfileTab>('overview');
  const [openVisit, setOpenVisit] = useState<number | null>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch(`${API}/patients/${patientId}/summary`, { headers: { Authorization: `Bearer ${token}` } }).then(r=>r.json()),
      fetch(`${API}/scans/patient/${patientId}`,    { headers: { Authorization: `Bearer ${token}` } }).then(r=>r.json()),
    ]).then(([sum, sc]) => { setSummary(sum); setScans(Array.isArray(sc) ? sc : []); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [patientId]);

  // Build vitals chart data from visit VitalSigns JSON
  const vitalChartData = useMemo(() => {
    if (!summary) return [];
    return summary.visits
      .filter(v => v.VitalSigns)
      .map(v => {
        let vs: any = {};
        try { vs = JSON.parse(v.VitalSigns!); } catch {}
        const bpParts = (vs.bp ?? '').split('/');
        return {
          date: v.VisitDate ? new Date(v.VisitDate).toLocaleDateString('en-IN', { day:'2-digit', month:'short' }) : '—',
          reason: v.ReasonForVisit,
          systolic:  bpParts[0] ? parseInt(bpParts[0]) : null,
          diastolic: bpParts[1] ? parseInt(bpParts[1]) : null,
          pulse:  vs.pulse ? parseInt(vs.pulse)  : null,
          temp:   vs.temp  ? parseFloat(vs.temp)  : null,
          spo2:   vs.spo2  ? parseInt(vs.spo2)   : null,
        };
      }).reverse(); // chronological
  }, [summary]);

  const TABS: { id: ProfileTab; label: string; icon: React.ReactNode; count?: number }[] = [
    { id:'overview',      label:'Overview',      icon:<User size={15}/> },
    { id:'visits',        label:'Visit History', icon:<Calendar size={15}/>, count: summary?.visits.length },
    { id:'diagnoses',     label:'Diagnoses',     icon:<Microscope size={15}/>, count: summary?.diagnoses.length },
    { id:'prescriptions', label:'Prescriptions', icon:<Pill size={15}/>, count: summary?.prescriptions.length },
    { id:'scans',         label:'Scans',         icon:<ScanLine size={15}/>, count: scans.length },
    { id:'progress',      label:'Progress',      icon:<TrendingUp size={15}/> },
  ];

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'60vh', flexDirection:'column', gap:'1rem' }}>
      <div style={{ width:40, height:40, border:'3px solid rgba(6,182,212,0.2)', borderTop:'3px solid #06b6d4', borderRadius:'50%', animation:'spin 0.8s linear infinite' }}/>
      <p style={{ color:'#475569' }}>Loading patient profile…</p>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if (!summary) return (
    <div style={{ textAlign:'center', padding:'4rem', color:'#f43f5e' }}>
      <AlertCircle size={48} style={{ marginBottom:'1rem' }}/>
      <p>Failed to load patient data.</p>
      <button onClick={onBack} className="action-btn" style={{ marginTop:'1rem' }}>← Go Back</button>
    </div>
  );

  const p = summary.patient;
  const age = p.DateOfBirth
    ? Math.floor((Date.now() - new Date(p.DateOfBirth).getTime()) / 3.15576e10)
    : null;

  // ── Blood group colour ──
  const bgColor = (bg: string) => {
    if (bg?.includes('O')) return '#f59e0b';
    if (bg?.includes('AB')) return '#8b5cf6';
    if (bg?.includes('A')) return '#06b6d4';
    return '#10b981';
  };

  const cardStyle: React.CSSProperties = {
    background: 'var(--card-bg,#111827)',
    border: '1px solid rgba(148,163,184,0.08)',
    borderRadius: 16, padding: '1.25rem 1.5rem',
  };

  return (
    <div style={{ animation: 'lsFadeDown 0.4s ease both' }}>
      <style>{`
        @keyframes lsFadeDown{from{opacity:0;transform:translateY(-10px)}to{opacity:1;transform:translateY(0)}}
        @keyframes lsSlideUp{from{opacity:0;transform:translateY(18px) scale(0.98)}to{opacity:1;transform:translateY(0) scale(1)}}
        @keyframes lsBlobFloat{0%,100%{transform:translate(0,0) scale(1)}33%{transform:translate(40px,-28px) scale(1.05)}66%{transform:translate(-22px,22px) scale(0.96)}}
      `}</style>

      {/* ── Hero header ── */}
      <div style={{ ...cardStyle, marginBottom:'1.25rem', position:'relative', overflow:'hidden' }}>
        {/* decorative blob */}
        <div style={{ position:'absolute', top:-60, right:-60, width:200, height:200, background:'radial-gradient(circle,rgba(6,182,212,0.08) 0%,transparent 70%)', borderRadius:'50%', pointerEvents:'none' }}/>

        <button onClick={onBack} style={{ display:'inline-flex', alignItems:'center', gap:'0.4rem', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(148,163,184,0.1)', borderRadius:9, padding:'0.4rem 0.875rem', color:'#64748b', cursor:'pointer', fontSize:'0.8rem', fontWeight:700, fontFamily:"'Syne',sans-serif", marginBottom:'1.25rem', letterSpacing:'0.04em' }}>
          <ArrowLeft size={14}/> Back to My Reports
        </button>

        <div style={{ display:'flex', alignItems:'flex-start', gap:'1.25rem', flexWrap:'wrap' }}>
          {/* Avatar */}
          <div style={{ width:72, height:72, borderRadius:20, background:'linear-gradient(135deg,rgba(6,182,212,0.3),rgba(139,92,246,0.3))', border:'2px solid rgba(6,182,212,0.3)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <span style={{ fontFamily:"'Syne',sans-serif", fontSize:'1.8rem', fontWeight:800, color:'#67e8f9' }}>
              {p.PatientName.charAt(0).toUpperCase()}
            </span>
          </div>

          {/* Name + basics */}
          <div style={{ flex:1, minWidth:220 }}>
            <div style={{ display:'flex', alignItems:'center', gap:'0.75rem', flexWrap:'wrap', marginBottom:'0.35rem' }}>
              <h2 style={{ margin:0, fontFamily:"'Syne',sans-serif", fontSize:'1.5rem', fontWeight:800, color:'#f0f6ff', letterSpacing:'-0.02em' }}>{p.PatientName}</h2>
              <span style={{ fontSize:'0.78rem', padding:'0.2rem 0.7rem', borderRadius:999, background:`${bgColor(p.BloodGroup)}18`, color:bgColor(p.BloodGroup), fontWeight:800, fontFamily:"'Syne',sans-serif" }}>{p.BloodGroup}</span>
              {p.Gender && <Badge label={p.Gender} color="#475569"/>}
              {age !== null && <Badge label={`${age} yrs`} color="#334155"/>}
            </div>
            <p style={{ margin:'0 0 0.5rem', color:'#475569', fontSize:'0.84rem' }}>{p.Email}</p>
            <div style={{ display:'flex', gap:'1.25rem', flexWrap:'wrap' }}>
              <span style={{ display:'flex', alignItems:'center', gap:'0.35rem', fontSize:'0.8rem', color:'#334155' }}><Phone size={13}/>{p.PhoneNumber}</span>
              <span style={{ display:'flex', alignItems:'center', gap:'0.35rem', fontSize:'0.8rem', color:'#334155' }}><MapPin size={13}/>{p.Address}</span>
              {p.EmergencyContactName && <span style={{ display:'flex', alignItems:'center', gap:'0.35rem', fontSize:'0.8rem', color:'#334155' }}><Zap size={13} color="#f59e0b"/>{p.EmergencyContactName} — {p.EmergencyContact}</span>}
            </div>
          </div>

          {/* Quick stats */}
          <div style={{ display:'flex', gap:'0.75rem', flexWrap:'wrap' }}>
            {[
              { label:'Visits', value: summary.visits.length, color:'#06b6d4' },
              { label:'Diagnoses', value: summary.diagnoses.length, color:'#f43f5e' },
              { label:'Chronic', value: summary.diagnoses.filter(d=>d.IsChronic).length, color:'#f59e0b' },
              { label:'Scans', value: scans.length, color:'#8b5cf6' },
            ].map(s => (
              <div key={s.label} style={{ background:`${s.color}08`, border:`1px solid ${s.color}20`, borderRadius:12, padding:'0.7rem 1rem', textAlign:'center', minWidth:70 }}>
                <p style={{ margin:0, fontSize:'1.4rem', fontWeight:800, color:s.color, fontFamily:"'Syne',sans-serif", lineHeight:1 }}>{s.value}</p>
                <p style={{ margin:'0.2rem 0 0', fontSize:'0.65rem', color:'#334155', fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase' }}>{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Tab bar ── */}
      <div style={{ display:'flex', gap:'0.35rem', marginBottom:'1.25rem', flexWrap:'wrap' }}>
        {TABS.map(t => {
          const active = tab === t.id;
          return (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              display:'flex', alignItems:'center', gap:'0.4rem',
              padding:'0.55rem 1rem', borderRadius:11, cursor:'pointer', fontSize:'0.82rem', fontWeight:700,
              fontFamily:"'Syne',sans-serif", letterSpacing:'0.03em',
              background: active ? '#06b6d4' : 'rgba(255,255,255,0.03)',
              border: active ? '1px solid #06b6d4' : '1px solid rgba(148,163,184,0.08)',
              color: active ? '#fff' : '#475569',
              boxShadow: active ? '0 4px 14px rgba(6,182,212,0.3)' : 'none',
              transition: 'all 0.2s',
            }}>
              {t.icon}
              {t.label}
              {t.count !== undefined && (
                <span style={{ background: active ? 'rgba(255,255,255,0.25)' : 'rgba(148,163,184,0.1)', borderRadius:999, fontSize:'0.65rem', padding:'0.1rem 0.45rem', fontWeight:800 }}>
                  {t.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ══════════════════════════════════════════
          TAB: OVERVIEW
      ══════════════════════════════════════════ */}
      {tab === 'overview' && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem' }}>
          {/* Demographics detail */}
          <div style={cardStyle}>
            <p style={{ margin:'0 0 1rem', fontSize:'0.7rem', fontWeight:800, letterSpacing:'0.1em', textTransform:'uppercase', color:'#334155' }}>Demographics</p>
            <div style={{ display:'flex', flexDirection:'column', gap:'0.6rem' }}>
              {[
                ['Full Name',    p.PatientName],
                ['Date of Birth', p.DateOfBirth ? `${new Date(p.DateOfBirth).toLocaleDateString()} (${age} yrs)` : '—'],
                ['Gender',       p.Gender],
                ['Blood Group',  p.BloodGroup],
                ['Phone',        p.PhoneNumber],
                ['Email',        p.Email],
                ['Address',      p.Address],
                ['Emergency Contact', p.EmergencyContactName ? `${p.EmergencyContactName} — ${p.EmergencyContact}` : '—'],
              ].map(([label, val]) => (
                <div key={label} style={{ display:'flex', gap:'0.75rem', padding:'0.5rem 0', borderBottom:'1px solid rgba(148,163,184,0.05)' }}>
                  <span style={{ fontSize:'0.75rem', fontWeight:700, color:'#334155', minWidth:130, flexShrink:0 }}>{label}</span>
                  <span style={{ fontSize:'0.82rem', color:'#94a3b8', wordBreak:'break-word' }}>{val}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Clinical summary notes */}
          <div style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>
            <div style={cardStyle}>
              <p style={{ margin:'0 0 0.75rem', fontSize:'0.7rem', fontWeight:800, letterSpacing:'0.1em', textTransform:'uppercase', color:'#334155' }}>
                Clinical Summary Notes
              </p>
              <div style={{ background:'rgba(255,255,255,0.02)', border:'1px solid rgba(148,163,184,0.07)', borderRadius:11, padding:'0.875rem 1rem', minHeight:90 }}>
                <p style={{ margin:0, color: p.SummaryNotes ? '#94a3b8' : '#334155', fontSize:'0.85rem', lineHeight:1.65, whiteSpace:'pre-wrap' }}>
                  {p.SummaryNotes || 'No clinical notes recorded yet. Ask your administrator to add notes.'}
                </p>
              </div>
              {p.NotesUpdatedBy && (
                <p style={{ margin:'0.5rem 0 0', fontSize:'0.72rem', color:'#334155' }}>Last updated by <strong style={{ color:'#475569' }}>{p.NotesUpdatedBy}</strong></p>
              )}
            </div>

            {/* Chronic conditions quick list */}
            <div style={cardStyle}>
              <p style={{ margin:'0 0 0.75rem', fontSize:'0.7rem', fontWeight:800, letterSpacing:'0.1em', textTransform:'uppercase', color:'#334155' }}>Chronic Conditions</p>
              {summary.diagnoses.filter(d => d.IsChronic).length === 0
                ? <p style={{ margin:0, color:'#334155', fontSize:'0.84rem' }}>No chronic conditions recorded.</p>
                : summary.diagnoses.filter(d => d.IsChronic).map((d, i) => (
                  <div key={i} style={{ display:'flex', alignItems:'center', gap:'0.6rem', padding:'0.45rem 0', borderBottom:'1px solid rgba(148,163,184,0.05)' }}>
                    <div style={{ width:8, height:8, borderRadius:'50%', background: sevColor(d.Severity), flexShrink:0 }}/>
                    <span style={{ flex:1, fontSize:'0.84rem', color:'#f0f6ff', fontWeight:600 }}>{d.DiagnosisName}</span>
                    <Badge label={d.Severity} color={sevColor(d.Severity)}/>
                  </div>
                ))
              }
            </div>

            {/* Active medications */}
            <div style={cardStyle}>
              <p style={{ margin:'0 0 0.75rem', fontSize:'0.7rem', fontWeight:800, letterSpacing:'0.1em', textTransform:'uppercase', color:'#334155' }}>Active Medications</p>
              {summary.prescriptions.filter(r => !r.IsDispensed).length === 0
                ? <p style={{ margin:0, color:'#334155', fontSize:'0.84rem' }}>No pending prescriptions.</p>
                : summary.prescriptions.filter(r => !r.IsDispensed).map((rx, i) => (
                  <div key={i} style={{ display:'flex', alignItems:'center', gap:'0.6rem', padding:'0.45rem 0', borderBottom:'1px solid rgba(148,163,184,0.05)' }}>
                    <Pill size={13} color="#10b981"/>
                    <span style={{ flex:1, fontSize:'0.84rem', color:'#f0f6ff', fontWeight:600 }}>{rx.MedicineName}</span>
                    <span style={{ fontSize:'0.75rem', color:'#64748b' }}>{rx.Dosage}</span>
                  </div>
                ))
              }
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════
          TAB: VISIT HISTORY
      ══════════════════════════════════════════ */}
      {tab === 'visits' && (
        <div>
          {summary.visits.length === 0 ? (
            <div style={{ textAlign:'center', padding:'3rem', color:'#334155' }}>
              <Calendar size={48} style={{ marginBottom:'1rem', opacity:0.3 }}/>
              <p>No visits recorded yet.</p>
            </div>
          ) : (
            <div style={{ position:'relative' }}>
              {/* Timeline spine */}
              <div style={{ position:'absolute', left:27, top:0, bottom:0, width:2, background:'rgba(148,163,184,0.07)', zIndex:0 }}/>
              <div style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>
                {summary.visits.map((v, i) => {
                  const isOpen = openVisit === i;
                  const statusColor = v.Status === 'Completed' ? '#10b981' : v.Status === 'In Progress' ? '#f59e0b' : '#475569';
                  let vitals: any = {};
                  try { vitals = v.VitalSigns ? JSON.parse(v.VitalSigns) : {}; } catch {}

                  return (
                    <div key={i} style={{ display:'flex', gap:'1rem', position:'relative', zIndex:1 }}>
                      {/* Timeline dot */}
                      <div style={{ flexShrink:0, width:56, display:'flex', flexDirection:'column', alignItems:'center', paddingTop:14 }}>
                        <div style={{ width:14, height:14, borderRadius:'50%', background:statusColor, border:`3px solid #060910`, boxShadow:`0 0 0 3px ${statusColor}30`, zIndex:2 }}/>
                        <span style={{ fontSize:'0.62rem', color:'#334155', marginTop:5, textAlign:'center', fontFamily:"'JetBrains Mono',monospace" }}>
                          V{summary.visits.length - i}
                        </span>
                      </div>

                      {/* Card */}
                      <div style={{ flex:1, background:'var(--card-bg,#111827)', border:'1px solid rgba(148,163,184,0.08)', borderRadius:16, overflow:'hidden' }}>
                        {/* Header — always visible */}
                        <button onClick={() => setOpenVisit(isOpen ? null : i)} style={{ all:'unset', width:'100%', cursor:'pointer', display:'flex', alignItems:'center', padding:'1rem 1.25rem', gap:'0.75rem', boxSizing:'border-box', background: isOpen ? 'rgba(6,182,212,0.04)' : 'transparent' }}>
                          <div style={{ flex:1, display:'flex', alignItems:'center', gap:'0.875rem', flexWrap:'wrap' }}>
                            <div style={{ width:40, height:40, borderRadius:11, background:`${statusColor}12`, border:`1px solid ${statusColor}25`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                              <Calendar size={16} color={statusColor}/>
                            </div>
                            <div>
                              <p style={{ margin:0, fontWeight:700, color:'#f0f6ff', fontSize:'0.95rem' }}>{v.ReasonForVisit}</p>
                              <p style={{ margin:'0.15rem 0 0', fontSize:'0.76rem', color:'#475569' }}>
                                {v.VisitDate ? new Date(v.VisitDate).toLocaleDateString('en-IN', { weekday:'short', day:'2-digit', month:'long', year:'numeric' }) : '—'}
                                &nbsp;·&nbsp;{v.DoctorName}&nbsp;({v.Specialty})
                              </p>
                            </div>
                          </div>
                          <div style={{ display:'flex', alignItems:'center', gap:'0.6rem', flexShrink:0 }}>
                            <Badge label={v.Status} color={statusColor}/>
                            <span style={{ color:'#334155' }}>{isOpen ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}</span>
                          </div>
                        </button>

                        {/* Expanded detail */}
                        {isOpen && (
                          <div style={{ borderTop:'1px solid rgba(148,163,184,0.07)' }}>
                            {/* Vitals strip */}
                            {Object.keys(vitals).length > 0 && (
                              <div style={{ display:'flex', gap:'0', borderBottom:'1px solid rgba(148,163,184,0.07)' }}>
                                {[
                                  ['Blood Pressure', vitals.bp, '#f43f5e'],
                                  ['Pulse', vitals.pulse ? `${vitals.pulse} bpm` : null, '#f59e0b'],
                                  ['Temperature', vitals.temp ? `${vitals.temp}°F` : null, '#10b981'],
                                  ['SpO₂', vitals.spo2 ? `${vitals.spo2}%` : null, '#06b6d4'],
                                  ['Weight', vitals.weight ? `${vitals.weight} kg` : null, '#8b5cf6'],
                                ].filter(([, val]) => val).map(([label, val, color], j, arr) => (
                                  <div key={label as string} style={{ flex:1, padding:'0.75rem 1rem', borderRight: j < arr.length-1 ? '1px solid rgba(148,163,184,0.07)' : 'none', textAlign:'center' }}>
                                    <p style={{ margin:0, fontSize:'1.05rem', fontWeight:800, color: color as string, fontFamily:"'Syne',sans-serif" }}>{val as string}</p>
                                    <p style={{ margin:'0.1rem 0 0', fontSize:'0.65rem', color:'#334155', fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase' }}>{label as string}</p>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Notes + linked data */}
                            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:0 }}>
                              <div style={{ padding:'1rem 1.25rem', borderRight:'1px solid rgba(148,163,184,0.07)' }}>
                                <p style={{ margin:'0 0 0.5rem', fontSize:'0.68rem', fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:'#334155' }}>Clinical Notes</p>
                                <p style={{ margin:0, fontSize:'0.83rem', color:'#64748b', lineHeight:1.6 }}>{v.Notes || 'No notes recorded.'}</p>
                              </div>

                              {/* Diagnoses on this visit */}
                              <div style={{ padding:'1rem 1.25rem', borderRight:'1px solid rgba(148,163,184,0.07)' }}>
                                <p style={{ margin:'0 0 0.5rem', fontSize:'0.68rem', fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:'#334155' }}>Diagnoses</p>
                                {(() => {
                                  const visitDiag = summary.diagnoses.filter(d =>
                                    d.VisitDate?.slice(0,10) === v.VisitDate?.slice(0,10)
                                  );
                                  return visitDiag.length === 0
                                    ? <p style={{ margin:0, fontSize:'0.83rem', color:'#334155' }}>None recorded.</p>
                                    : visitDiag.map((d, di) => (
                                      <div key={di} style={{ marginBottom:'0.5rem' }}>
                                        <p style={{ margin:0, fontWeight:700, color:'#f0f6ff', fontSize:'0.86rem' }}>{d.DiagnosisName}</p>
                                        <div style={{ display:'flex', gap:'0.35rem', marginTop:'0.2rem' }}>
                                          <Badge label={d.Severity} color={sevColor(d.Severity)}/>
                                          {d.IsChronic && <Badge label="Chronic" color="#8b5cf6"/>}
                                        </div>
                                        {d.Description && <p style={{ margin:'0.3rem 0 0', fontSize:'0.78rem', color:'#64748b' }}>{d.Description}</p>}
                                      </div>
                                    ));
                                })()}
                              </div>

                              {/* Prescriptions on this visit */}
                              <div style={{ padding:'1rem 1.25rem' }}>
                                <p style={{ margin:'0 0 0.5rem', fontSize:'0.68rem', fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:'#334155' }}>Prescriptions</p>
                                {(() => {
                                  const visitRx = summary.prescriptions.filter(rx =>
                                    rx.VisitDate?.slice(0,10) === v.VisitDate?.slice(0,10)
                                  );
                                  return visitRx.length === 0
                                    ? <p style={{ margin:0, fontSize:'0.83rem', color:'#334155' }}>None prescribed.</p>
                                    : visitRx.map((rx, ri) => (
                                      <div key={ri} style={{ marginBottom:'0.5rem' }}>
                                        <p style={{ margin:0, fontWeight:700, color:'#f0f6ff', fontSize:'0.86rem' }}>{rx.MedicineName}</p>
                                        <p style={{ margin:'0.1rem 0', fontSize:'0.78rem', color:'#64748b' }}>{rx.Dosage} · {rx.Frequency} · {rx.Duration}</p>
                                        <Badge label={rx.IsDispensed ? 'Dispensed' : 'Pending'} color={rx.IsDispensed ? '#10b981' : '#f59e0b'}/>
                                      </div>
                                    ));
                                })()}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════
          TAB: DIAGNOSES
      ══════════════════════════════════════════ */}
      {tab === 'diagnoses' && (
        <div>
          {summary.diagnoses.length === 0 ? (
            <div style={{ textAlign:'center', padding:'3rem', color:'#334155' }}>
              <Microscope size={48} style={{ marginBottom:'1rem', opacity:0.3 }}/>
              <p>No diagnoses recorded.</p>
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:'0.75rem' }}>
              {/* Severity summary row */}
              <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'0.75rem', marginBottom:'0.5rem' }}>
                {[
                  ['Total', summary.diagnoses.length, '#06b6d4'],
                  ['Chronic', summary.diagnoses.filter(d=>d.IsChronic).length, '#8b5cf6'],
                  ['Severe', summary.diagnoses.filter(d=>d.Severity==='Severe').length, '#f43f5e'],
                  ['Moderate', summary.diagnoses.filter(d=>d.Severity==='Moderate').length, '#f59e0b'],
                ].map(([l,v,c]) => (
                  <div key={l as string} style={{ ...cardStyle, textAlign:'center', padding:'0.875rem' }}>
                    <p style={{ margin:0, fontSize:'1.5rem', fontWeight:800, color: c as string, fontFamily:"'Syne',sans-serif" }}>{v as number}</p>
                    <p style={{ margin:'0.2rem 0 0', fontSize:'0.68rem', color:'#334155', fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase' }}>{l as string}</p>
                  </div>
                ))}
              </div>

              {summary.diagnoses.map((d, i) => (
                <div key={i} style={{ ...cardStyle, display:'flex', gap:'1rem', alignItems:'flex-start' }}>
                  <div style={{ width:44, height:44, borderRadius:12, background:`${sevColor(d.Severity)}12`, border:`1px solid ${sevColor(d.Severity)}25`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                    <Microscope size={18} color={sevColor(d.Severity)}/>
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:'0.6rem', marginBottom:'0.3rem', flexWrap:'wrap' }}>
                      <p style={{ margin:0, fontWeight:800, color:'#f0f6ff', fontSize:'0.95rem', fontFamily:"'Syne',sans-serif" }}>{d.DiagnosisName}</p>
                      <Badge label={d.Severity} color={sevColor(d.Severity)}/>
                      {d.IsChronic && <Badge label="Chronic" color="#8b5cf6"/>}
                    </div>
                    {d.Description && <p style={{ margin:'0 0 0.4rem', fontSize:'0.84rem', color:'#64748b', lineHeight:1.55 }}>{d.Description}</p>}
                    <p style={{ margin:0, fontSize:'0.74rem', color:'#334155', display:'flex', alignItems:'center', gap:'0.35rem' }}>
                      <Calendar size={12}/> {d.VisitDate ? new Date(d.VisitDate).toLocaleDateString('en-IN', { day:'2-digit', month:'long', year:'numeric' }) : '—'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════
          TAB: PRESCRIPTIONS
      ══════════════════════════════════════════ */}
      {tab === 'prescriptions' && (
        <div>
          {summary.prescriptions.length === 0 ? (
            <div style={{ textAlign:'center', padding:'3rem', color:'#334155' }}>
              <Pill size={48} style={{ marginBottom:'1rem', opacity:0.3 }}/>
              <p>No prescriptions recorded.</p>
            </div>
          ) : (
            <>
              {/* Summary bar */}
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'0.75rem', marginBottom:'1rem' }}>
                {[
                  ['Total Meds', summary.prescriptions.length, '#06b6d4'],
                  ['Dispensed', summary.prescriptions.filter(r=>r.IsDispensed).length, '#10b981'],
                  ['Pending', summary.prescriptions.filter(r=>!r.IsDispensed).length, '#f59e0b'],
                ].map(([l,v,c]) => (
                  <div key={l as string} style={{ ...cardStyle, textAlign:'center', padding:'0.875rem' }}>
                    <p style={{ margin:0, fontSize:'1.5rem', fontWeight:800, color: c as string, fontFamily:"'Syne',sans-serif" }}>{v as number}</p>
                    <p style={{ margin:'0.2rem 0 0', fontSize:'0.68rem', color:'#334155', fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase' }}>{l as string}</p>
                  </div>
                ))}
              </div>

              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Medicine</th><th>Dosage</th><th>Frequency</th>
                      <th>Duration</th><th>Instructions</th><th>Prescribed By</th>
                      <th>Date</th><th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.prescriptions.map((rx, i) => (
                      <tr key={i}>
                        <td><strong style={{ color:'#f0f6ff' }}>{rx.MedicineName}</strong></td>
                        <td><code style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:'0.82rem', color:'#06b6d4' }}>{rx.Dosage}</code></td>
                        <td>{rx.Frequency}</td>
                        <td>{rx.Duration}</td>
                        <td style={{ fontSize:'0.8rem', color:'#64748b', maxWidth:180 }}>{rx.Instructions || '—'}</td>
                        <td>{rx.DoctorName}</td>
                        <td style={{ whiteSpace:'nowrap', fontSize:'0.8rem' }}>{rx.VisitDate ? new Date(rx.VisitDate).toLocaleDateString() : '—'}</td>
                        <td>
                          <span className={`status-badge ${rx.IsDispensed ? 'dispensed' : 'pending'}`}>
                            {rx.IsDispensed ? <><CheckCircle size={12}/> Dispensed</> : <><Clock size={12}/> Pending</>}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════
          TAB: SCANS
      ══════════════════════════════════════════ */}
      {tab === 'scans' && (
        <div>
          {scans.length === 0 ? (
            <div style={{ textAlign:'center', padding:'3rem', color:'#334155' }}>
              <ScanLine size={48} style={{ marginBottom:'1rem', opacity:0.3 }}/>
              <p>No scans uploaded for this patient.</p>
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:'0.75rem' }}>
              {/* Group by scan type */}
              {Array.from(new Set(scans.map(s => s.FileType))).map(type => {
                const group = scans.filter(s => s.FileType === type);
                return (
                  <div key={type}>
                    <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', marginBottom:'0.5rem' }}>
                      <ScanLine size={14} color="#f43f5e"/>
                      <p style={{ margin:0, fontSize:'0.72rem', fontWeight:800, letterSpacing:'0.08em', textTransform:'uppercase', color:'#475569' }}>{type} ({group.length})</p>
                    </div>
                    {group.map(s => (
                      <div key={s.FileID} style={{ ...cardStyle, display:'flex', alignItems:'center', gap:'1rem', marginBottom:'0.5rem', borderLeft:'3px solid #f43f5e' }}>
                        <div style={{ width:46, height:46, borderRadius:12, background:'rgba(244,63,94,0.1)', border:'1px solid rgba(244,63,94,0.2)', display:'flex', alignItems:'center', justifyContent:'center', color:'#f43f5e', flexShrink:0 }}>
                          <ScanLine size={20}/>
                        </div>
                        <div style={{ flex:1, minWidth:0 }}>
                          <p style={{ margin:0, fontWeight:700, color:'#f0f6ff', fontSize:'0.9rem', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{s.FileName}</p>
                          <p style={{ margin:'0.15rem 0 0', fontSize:'0.78rem', color:'#475569' }}>
                            {(s.FileSize / 1024 / 1024).toFixed(2)} MB · Uploaded {new Date(s.UploadedAt).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' })} by <strong style={{ color:'#64748b' }}>{s.UploadedByUsername}</strong>
                          </p>
                          {s.Description && <p style={{ margin:'0.2rem 0 0', fontSize:'0.8rem', color:'#64748b', lineHeight:1.5 }}>{s.Description}</p>}
                        </div>
                        <a href={`${API}/files/download/${s.FileID}`} target="_blank" rel="noreferrer"
                          style={{ background:'rgba(244,63,94,0.1)', border:'1px solid rgba(244,63,94,0.25)', borderRadius:9, padding:'0.45rem 1rem', color:'#f43f5e', display:'flex', alignItems:'center', gap:'0.4rem', fontSize:'0.8rem', fontWeight:700, textDecoration:'none', whiteSpace:'nowrap', flexShrink:0 }}>
                          <Download size={14}/> Download
                        </a>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════
          TAB: PROGRESS (charts)
      ══════════════════════════════════════════ */}
      {tab === 'progress' && (
        <div style={{ display:'flex', flexDirection:'column', gap:'1.25rem' }}>
          {vitalChartData.length < 2 ? (
            <div style={{ textAlign:'center', padding:'3rem', color:'#334155' }}>
              <TrendingUp size={48} style={{ marginBottom:'1rem', opacity:0.3 }}/>
              <p>Need at least 2 visits with vitals to show trends.</p>
            </div>
          ) : (
            <>
              {/* Blood Pressure chart */}
              {vitalChartData.some(d => d.systolic) && (
                <div style={cardStyle}>
                  <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', marginBottom:'1rem' }}>
                    <div style={{ width:32, height:32, borderRadius:9, background:'rgba(244,63,94,0.1)', border:'1px solid rgba(244,63,94,0.2)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                      <Activity size={15} color="#f43f5e"/>
                    </div>
                    <div>
                      <p style={{ margin:0, fontWeight:800, color:'#f0f6ff', fontSize:'0.9rem', fontFamily:"'Syne',sans-serif" }}>Blood Pressure</p>
                      <p style={{ margin:0, fontSize:'0.72rem', color:'#334155' }}>Systolic / Diastolic (mmHg)</p>
                    </div>
                    <div style={{ marginLeft:'auto', display:'flex', gap:'0.5rem' }}>
                      <Badge label="Systolic" color="#f43f5e"/>
                      <Badge label="Diastolic" color="#8b5cf6"/>
                    </div>
                  </div>
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={vitalChartData} margin={{ top:5, right:10, left:-10, bottom:5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.06)"/>
                      <XAxis dataKey="date" tick={{ fill:'#334155', fontSize:11 }} axisLine={false} tickLine={false}/>
                      <YAxis domain={[40,200]} tick={{ fill:'#334155', fontSize:11 }} axisLine={false} tickLine={false}/>
                      <Tooltip
                        contentStyle={{ background:'#111827', border:'1px solid rgba(148,163,184,0.12)', borderRadius:10, color:'#f0f6ff', fontSize:'0.82rem' }}
                        formatter={(val: any, name: string) => [`${val} mmHg`, name === 'systolic' ? 'Systolic' : 'Diastolic']}
                        labelFormatter={(l) => `Visit: ${l}`}
                      />
                      <ReferenceLine y={120} stroke="rgba(244,63,94,0.2)" strokeDasharray="4 4" label={{ value:'Normal SBP 120', fill:'#334155', fontSize:10 }}/>
                      <ReferenceLine y={80}  stroke="rgba(139,92,246,0.2)" strokeDasharray="4 4" label={{ value:'Normal DBP 80', fill:'#334155', fontSize:10 }}/>
                      <Line type="monotone" dataKey="systolic" stroke="#f43f5e" strokeWidth={2.5} dot={{ r:5, fill:'#f43f5e', strokeWidth:0 }} activeDot={{ r:7 }} connectNulls/>
                      <Line type="monotone" dataKey="diastolic" stroke="#8b5cf6" strokeWidth={2.5} dot={{ r:5, fill:'#8b5cf6', strokeWidth:0 }} activeDot={{ r:7 }} connectNulls/>
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Pulse chart */}
              {vitalChartData.some(d => d.pulse) && (
                <div style={cardStyle}>
                  <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', marginBottom:'1rem' }}>
                    <div style={{ width:32, height:32, borderRadius:9, background:'rgba(245,158,11,0.1)', border:'1px solid rgba(245,158,11,0.2)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                      <Heart size={15} color="#f59e0b"/>
                    </div>
                    <div>
                      <p style={{ margin:0, fontWeight:800, color:'#f0f6ff', fontSize:'0.9rem', fontFamily:"'Syne',sans-serif" }}>Heart Rate</p>
                      <p style={{ margin:0, fontSize:'0.72rem', color:'#334155' }}>Pulse rate (bpm)</p>
                    </div>
                    <Badge label="Pulse (bpm)" color="#f59e0b" />
                  </div>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={vitalChartData} margin={{ top:5, right:10, left:-10, bottom:5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.06)"/>
                      <XAxis dataKey="date" tick={{ fill:'#334155', fontSize:11 }} axisLine={false} tickLine={false}/>
                      <YAxis domain={[40,140]} tick={{ fill:'#334155', fontSize:11 }} axisLine={false} tickLine={false}/>
                      <Tooltip
                        contentStyle={{ background:'#111827', border:'1px solid rgba(148,163,184,0.12)', borderRadius:10, color:'#f0f6ff', fontSize:'0.82rem' }}
                        formatter={(val: any) => [`${val} bpm`, 'Pulse']}
                      />
                      <ReferenceLine y={60} stroke="rgba(245,158,11,0.2)" strokeDasharray="4 4"/>
                      <ReferenceLine y={100} stroke="rgba(245,158,11,0.2)" strokeDasharray="4 4"/>
                      <Line type="monotone" dataKey="pulse" stroke="#f59e0b" strokeWidth={2.5} dot={{ r:5, fill:'#f59e0b', strokeWidth:0 }} activeDot={{ r:7 }} connectNulls/>
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Temperature chart */}
              {vitalChartData.some(d => d.temp) && (
                <div style={cardStyle}>
                  <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', marginBottom:'1rem' }}>
                    <div style={{ width:32, height:32, borderRadius:9, background:'rgba(16,185,129,0.1)', border:'1px solid rgba(16,185,129,0.2)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                      <Zap size={15} color="#10b981"/>
                    </div>
                    <div>
                      <p style={{ margin:0, fontWeight:800, color:'#f0f6ff', fontSize:'0.9rem', fontFamily:"'Syne',sans-serif" }}>Body Temperature</p>
                      <p style={{ margin:0, fontSize:'0.72rem', color:'#334155' }}>Temperature (°F)</p>
                    </div>
                    <Badge label="Temp (°F)" color="#10b981" />
                  </div>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={vitalChartData} margin={{ top:5, right:10, left:-10, bottom:5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.06)"/>
                      <XAxis dataKey="date" tick={{ fill:'#334155', fontSize:11 }} axisLine={false} tickLine={false}/>
                      <YAxis domain={[96, 105]} tick={{ fill:'#334155', fontSize:11 }} axisLine={false} tickLine={false}/>
                      <Tooltip
                        contentStyle={{ background:'#111827', border:'1px solid rgba(148,163,184,0.12)', borderRadius:10, color:'#f0f6ff', fontSize:'0.82rem' }}
                        formatter={(val: any) => [`${val}°F`, 'Temperature']}
                      />
                      <ReferenceLine y={98.6} stroke="rgba(16,185,129,0.3)" strokeDasharray="4 4" label={{ value:'Normal 98.6°F', fill:'#334155', fontSize:10 }}/>
                      <Line type="monotone" dataKey="temp" stroke="#10b981" strokeWidth={2.5} dot={{ r:5, fill:'#10b981', strokeWidth:0 }} activeDot={{ r:7 }} connectNulls/>
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Diagnosis timeline chart (text-based, since recharts needs numeric) */}
              <div style={cardStyle}>
                <p style={{ margin:'0 0 1rem', fontWeight:800, color:'#f0f6ff', fontSize:'0.9rem', fontFamily:"'Syne',sans-serif" }}>Diagnosis Timeline</p>
                <div style={{ position:'relative', paddingLeft:'1rem' }}>
                  <div style={{ position:'absolute', left:3, top:0, bottom:0, width:2, background:'rgba(148,163,184,0.07)' }}/>
                  {summary.diagnoses.map((d, i) => (
                    <div key={i} style={{ display:'flex', gap:'0.875rem', marginBottom:'0.75rem', position:'relative' }}>
                      <div style={{ width:10, height:10, borderRadius:'50%', background:sevColor(d.Severity), flexShrink:0, marginTop:4, position:'relative', zIndex:1 }}/>
                      <div style={{ flex:1 }}>
                        <div style={{ display:'flex', gap:'0.5rem', alignItems:'center', flexWrap:'wrap' }}>
                          <p style={{ margin:0, fontWeight:700, color:'#f0f6ff', fontSize:'0.86rem' }}>{d.DiagnosisName}</p>
                          <Badge label={d.Severity} color={sevColor(d.Severity)}/>
                          {d.IsChronic && <Badge label="Chronic" color="#8b5cf6"/>}
                        </div>
                        <p style={{ margin:'0.15rem 0 0', fontSize:'0.74rem', color:'#334155' }}>{d.VisitDate ? new Date(d.VisitDate).toLocaleDateString('en-IN', { day:'2-digit', month:'long', year:'numeric' }) : '—'}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
//  Edit Patient Modal
// ─────────────────────────────────────────────
function EditPatientModal({ patient, token, onClose, onSaved }: { patient:Patient; token:string; onClose:()=>void; onSaved:()=>void }) {
  const [form, setForm] = useState({ name:patient.PatientName, gender:patient.Gender, dob:patient.DateOfBirth?.split('T')[0]??'', phone:patient.PhoneNumber, address:patient.Address, blood_group:patient.BloodGroup, emergency_contact:patient.EmergencyContact??'', emergency_contact_name:patient.EmergencyContactName??'' });
  const [saving,setSaving]=useState(false); const [err,setErr]=useState('');
  async function save(e:React.FormEvent){e.preventDefault();setSaving(true);setErr('');try{const res=await fetch(`${API}/patients/${patient.PatientID}`,{method:'PUT',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(form)});const d=await res.json();if(!res.ok)throw new Error(d.error);onSaved();}catch(ex:any){setErr(ex.message);}finally{setSaving(false);}}
  return (<Modal title={`Edit — ${patient.PatientName}`} onClose={onClose}>{err&&<div className="form-error" style={{marginBottom:'1rem'}}><AlertCircle size={14}/> {err}</div>}<form onSubmit={save} className="data-form" style={{padding:0,background:'none',boxShadow:'none'}}><div className="form-row"><div className="form-group"><label>Full Name *</label><input type="text" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} required/></div><div className="form-group"><label>Gender *</label><select value={form.gender} onChange={e=>setForm({...form,gender:e.target.value})}><option>Male</option><option>Female</option><option>Other</option></select></div></div><div className="form-row"><div className="form-group"><label>Date of Birth *</label><input type="date" value={form.dob} onChange={e=>setForm({...form,dob:e.target.value})}/></div><div className="form-group"><label>Blood Group *</label><select value={form.blood_group} onChange={e=>setForm({...form,blood_group:e.target.value})}>{['A+','A-','B+','B-','O+','O-','AB+','AB-'].map(g=><option key={g}>{g}</option>)}</select></div></div><div className="form-row"><div className="form-group"><label>Phone *</label><input type="tel" value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})}/></div><div className="form-group"><label>Address *</label><input type="text" value={form.address} onChange={e=>setForm({...form,address:e.target.value})}/></div></div><div className="form-row"><div className="form-group"><label>Emergency Name</label><input type="text" value={form.emergency_contact_name} onChange={e=>setForm({...form,emergency_contact_name:e.target.value})}/></div><div className="form-group"><label>Emergency Phone</label><input type="tel" value={form.emergency_contact} onChange={e=>setForm({...form,emergency_contact:e.target.value})}/></div></div><button type="submit" className="submit-btn" disabled={saving} style={{marginTop:'0.5rem'}}><Save size={15} style={{marginRight:6}}/>{saving?'Saving…':'Save Changes'}</button></form></Modal>);
}

// ─────────────────────────────────────────────
//  Assign Credentials Modal
// ─────────────────────────────────────────────
function AssignCredsModal({ patient, token, onClose, onSaved }: { patient:PatientNoCreds; token:string; onClose:()=>void; onSaved:()=>void }) {
  const [form,setForm]=useState({username:'',password:''});const [show,setShow]=useState(false);const [saving,setSaving]=useState(false);const [err,setErr]=useState('');
  async function save(e:React.FormEvent){e.preventDefault();setSaving(true);setErr('');try{const res=await fetch(`${API}/admin/assign-credentials`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({patient_id:patient.PatientID,...form})});const d=await res.json();if(!res.ok)throw new Error(d.error);onSaved();}catch(ex:any){setErr(ex.message);}finally{setSaving(false);}}
  return (<Modal title={`Assign Credentials — ${patient.PatientName}`} onClose={onClose}><p style={{color:'#64748b',fontSize:'0.85rem',marginBottom:'1.25rem'}}>This patient was imported via CSV and has no login account yet.</p>{err&&<div className="form-error" style={{marginBottom:'1rem'}}><AlertCircle size={14}/> {err}</div>}<form onSubmit={save} className="data-form" style={{padding:0,background:'none',boxShadow:'none'}}><div className="form-group"><label>Username *</label><input type="text" value={form.username} minLength={3} required onChange={e=>setForm({...form,username:e.target.value})} placeholder="Min 3 characters"/></div><div className="form-group"><label>Password *</label><div style={{position:'relative'}}><input type={show?'text':'password'} value={form.password} minLength={6} required onChange={e=>setForm({...form,password:e.target.value})} placeholder="Min 6 characters" style={{paddingRight:'2.5rem'}}/><button type="button" onClick={()=>setShow(v=>!v)} style={{position:'absolute',right:10,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',color:'#475569',cursor:'pointer',display:'flex'}}>{show?<EyeOff size={15}/>:<Eye size={15}/>}</button></div></div><div style={{background:'rgba(6,182,212,0.06)',border:'1px solid rgba(6,182,212,0.15)',borderRadius:10,padding:'0.75rem 1rem',marginBottom:'1rem',fontSize:'0.82rem',color:'#67e8f9'}}><span><strong>Patient:</strong> {patient.PatientName} · <strong>Blood:</strong> {patient.BloodGroup} · <strong>Email:</strong> {patient.Email}</span></div><button type="submit" className="submit-btn" disabled={saving}><Key size={15} style={{marginRight:6}}/>{saving?'Assigning…':'Assign Credentials'}</button></form></Modal>);
}

// ─────────────────────────────────────────────
//  LoginScreen
// ─────────────────────────────────────────────
function LoginScreen({ onLogin, onShowRegister, formErr, loading }: { onLogin:(u:string,p:string)=>Promise<void>; onShowRegister:()=>void; formErr:string; loading:boolean }) {
  const [selectedRole,setSelectedRole]=useState<string|null>(null);const [hoveredRole,setHoveredRole]=useState<string|null>(null);const [username,setUsername]=useState('');const [password,setPassword]=useState('');const [showPass,setShowPass]=useState(false);const [focusU,setFocusU]=useState(false);const [focusP,setFocusP]=useState(false);
  const entity=ENTITIES.find(e=>e.role===selectedRole)??null;const color=entity?.color??'#06b6d4';const glow=entity?.glow??'rgba(6,182,212,0.35)';
  const inputStyle=(focused:boolean,c:string):React.CSSProperties=>({width:'100%',padding:'0.8rem 1rem',boxSizing:'border-box',background:focused?`${c}08`:'rgba(255,255,255,0.025)',border:`1px solid ${focused?c:'rgba(148,163,184,0.09)'}`,borderRadius:11,color:'#f0f6ff',fontFamily:'inherit',fontSize:'0.92rem',outline:'none',boxShadow:focused?`0 0 0 3px ${c}12`:'none',transition:'all 0.2s'});
  return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#060910',padding:'1.5rem 1rem',position:'relative',overflow:'hidden',fontFamily:"'Instrument Sans','Segoe UI',sans-serif"}}>
      {[{t:'-8%',l:'-4%',c:'rgba(6,182,212,0.12)',s:560,d:22,dl:0},{t:'65%',l:'72%',c:'rgba(139,92,246,0.10)',s:460,d:28,dl:4},{t:'35%',l:'42%',c:'rgba(16,185,129,0.07)',s:360,d:18,dl:8}].map((b,i)=>(
        <div key={i} style={{position:'absolute',top:b.t,left:b.l,width:b.s,height:b.s,background:`radial-gradient(circle,${b.c} 0%,transparent 70%)`,borderRadius:'50%',filter:'blur(60px)',pointerEvents:'none',animation:`lsBlobFloat ${b.d}s ease-in-out infinite ${b.dl}s`}}/>
      ))}
      <div style={{position:'absolute',inset:0,pointerEvents:'none',backgroundImage:'linear-gradient(rgba(148,163,184,0.045) 1px,transparent 1px),linear-gradient(90deg,rgba(148,163,184,0.045) 1px,transparent 1px)',backgroundSize:'56px 56px'}}/>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=JetBrains+Mono:wght@400;500&display=swap');@keyframes lsFadeDown{from{opacity:0;transform:translateY(-14px)}to{opacity:1;transform:translateY(0)}}@keyframes lsSlideUp{from{opacity:0;transform:translateY(18px) scale(0.98)}to{opacity:1;transform:translateY(0) scale(1)}}@keyframes lsBlobFloat{0%,100%{transform:translate(0,0) scale(1)}33%{transform:translate(40px,-28px) scale(1.05)}66%{transform:translate(-22px,22px) scale(0.96)}}`}</style>
      <div style={{position:'relative',zIndex:1,width:'100%',maxWidth:1060,display:'flex',flexDirection:'column',alignItems:'center',gap:'1.75rem'}}>
        <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:'0.6rem',animation:'lsFadeDown 0.6s ease both'}}>
          <div style={{width:60,height:60,borderRadius:16,background:'linear-gradient(135deg,#06b6d4,#8b5cf6)',display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 0 32px rgba(6,182,212,0.4)'}}><Heart size={28} color="white"/></div>
          <h1 style={{fontFamily:"'Syne','Segoe UI',sans-serif",fontSize:'1.75rem',fontWeight:800,letterSpacing:'-0.03em',margin:0,background:'linear-gradient(135deg,#67e8f9 0%,#f0f6ff 50%,#8b5cf6 100%)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',backgroundClip:'text'}}>MediCare Plus</h1>
          <p style={{fontSize:'0.72rem',color:'#334155',letterSpacing:'0.14em',textTransform:'uppercase',fontWeight:700,margin:0}}>Hospital Management System</p>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:'0.6rem'}}>
          {(['Select your role','Sign in'] as const).map((lbl,i)=>{const active=i===0?!selectedRole:!!selectedRole;return(<React.Fragment key={i}>{i>0&&<div style={{width:28,height:1,background:selectedRole?'#1e3a4a':'#0f1929',transition:'background 0.3s'}}/>}<div style={{display:'flex',alignItems:'center',gap:'0.4rem'}}><div style={{width:20,height:20,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',background:active?(i===0?'#06b6d4':color):'#0f1929',border:`1px solid ${active?(i===0?'#06b6d4':color):'#1e293b'}`,fontSize:'0.62rem',fontWeight:800,color:'white',transition:'all 0.3s'}}>{i+1}</div><span style={{fontSize:'0.7rem',fontWeight:700,letterSpacing:'0.07em',textTransform:'uppercase',color:active?(i===0?'#06b6d4':color):'#1e293b',transition:'color 0.3s'}}>{lbl}</span></div></React.Fragment>);})}
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:'0.75rem',width:'100%'}}>
          {ENTITIES.map((e,i)=>{const isSel=selectedRole===e.role,isHov=hoveredRole===e.role;return(<button key={e.role} onClick={()=>{setSelectedRole(e.role);setUsername('');setPassword('');}} onMouseEnter={()=>setHoveredRole(e.role)} onMouseLeave={()=>setHoveredRole(null)} style={{all:'unset',position:'relative',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:'0.7rem',padding:'1.4rem 0.75rem',cursor:'pointer',boxSizing:'border-box',background:isSel?e.bg:isHov?'rgba(255,255,255,0.025)':'rgba(17,24,39,0.7)',border:`1px solid ${isSel?e.border:isHov?'rgba(148,163,184,0.12)':'rgba(148,163,184,0.07)'}`,borderRadius:18,backdropFilter:'blur(14px)',transform:isSel?'translateY(-5px)':isHov?'translateY(-2px)':'translateY(0)',boxShadow:isSel?`0 10px 36px ${e.glow},0 0 0 1px ${e.border}`:isHov?'0 4px 16px rgba(0,0,0,0.35)':'none',transition:'all 0.25s cubic-bezier(0.16,1,0.3,1)',animation:`lsFadeDown 0.55s ${0.05+i*0.07}s ease both`}}><div style={{position:'absolute',top:0,left:'14%',right:'14%',height:2,background:e.color,borderRadius:999,opacity:isSel?0.9:0,transition:'opacity 0.25s'}}/>{isSel&&<div style={{position:'absolute',top:9,right:9,width:20,height:20,borderRadius:'50%',background:e.color,display:'flex',alignItems:'center',justifyContent:'center',boxShadow:`0 0 10px ${e.glow}`}}><svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3} strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg></div>}<div style={{width:50,height:50,borderRadius:13,flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',background:isSel?`${e.color}1a`:'rgba(255,255,255,0.03)',border:`1px solid ${isSel?e.border:'rgba(148,163,184,0.07)'}`,color:isSel?e.color:isHov?'#64748b':'#334155',transition:'all 0.25s'}}>{e.icon}</div><div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:'0.15rem'}}><p style={{fontFamily:"'Syne',sans-serif",fontSize:'0.88rem',fontWeight:800,letterSpacing:'-0.01em',margin:0,color:isSel?e.color:isHov?'#64748b':'#1e293b',transition:'color 0.25s'}}>{e.role}</p><p style={{fontSize:'0.58rem',fontWeight:700,letterSpacing:'0.07em',textTransform:'uppercase',margin:0,color:isSel?'#475569':'#0f1929'}}>{e.label}</p></div><p style={{fontSize:'0.68rem',textAlign:'center',lineHeight:1.4,margin:0,color:isSel?'#475569':isHov?'#1e293b':'#0d1626',transition:'color 0.25s'}}>{e.desc}</p></button>);})}
        </div>
        {selectedRole&&entity&&(
          <div style={{width:'100%',maxWidth:460,boxSizing:'border-box',background:'rgba(17,24,39,0.88)',backdropFilter:'blur(24px)',border:`1px solid ${color}28`,borderRadius:22,padding:'2rem 2.25rem',boxShadow:`0 8px 40px rgba(0,0,0,0.55),0 0 0 1px ${color}14`,position:'relative',overflow:'hidden',animation:'lsSlideUp 0.4s cubic-bezier(0.16,1,0.3,1) both'}}>
            <div style={{position:'absolute',top:0,left:'12%',right:'12%',height:1,background:`linear-gradient(90deg,transparent,${color},transparent)`,opacity:0.65}}/>
            <div style={{marginBottom:'1.25rem',display:'flex',alignItems:'flex-start',justifyContent:'space-between'}}>
              <div><div style={{display:'flex',alignItems:'center',gap:'0.5rem',marginBottom:'0.25rem'}}><div style={{width:28,height:28,borderRadius:8,background:`${color}1a`,border:`1px solid ${color}30`,display:'flex',alignItems:'center',justifyContent:'center',color}}>{entity.icon}</div><h2 style={{fontFamily:"'Syne',sans-serif",fontSize:'1.2rem',fontWeight:800,letterSpacing:'-0.02em',color,margin:0}}>{entity.role} Portal</h2></div><p style={{fontSize:'0.79rem',color:'#334155',margin:0}}>{entity.desc}</p></div>
              <button onClick={()=>setSelectedRole(null)} style={{background:'none',border:'1px solid rgba(148,163,184,0.1)',borderRadius:8,color:'#475569',cursor:'pointer',padding:'0.32rem 0.6rem',fontSize:'0.7rem',fontWeight:700,letterSpacing:'0.06em',textTransform:'uppercase',display:'flex',alignItems:'center',gap:'0.3rem',fontFamily:'inherit'}}><svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg> Back</button>
            </div>
            {formErr&&<div style={{padding:'0.75rem 1rem',background:'rgba(244,63,94,0.08)',border:'1px solid rgba(244,63,94,0.22)',borderRadius:10,color:'#fda4af',fontSize:'0.84rem',marginBottom:'1rem',display:'flex',alignItems:'center',gap:'0.5rem'}}><AlertCircle size={15}/>{formErr}</div>}
            <form onSubmit={async e=>{e.preventDefault();await onLogin(username,password);}}>
              <div style={{marginBottom:'1rem'}}><label style={{fontSize:'0.68rem',fontWeight:700,letterSpacing:'0.09em',textTransform:'uppercase',color:'#334155',display:'block',marginBottom:'0.4rem'}}>Username</label><input type="text" value={username} onChange={e=>setUsername(e.target.value)} onFocus={()=>setFocusU(true)} onBlur={()=>setFocusU(false)} placeholder={`Enter ${entity.role.toLowerCase()} username`} required autoComplete="username" style={inputStyle(focusU,color)}/></div>
              <div style={{marginBottom:'1rem'}}><label style={{fontSize:'0.68rem',fontWeight:700,letterSpacing:'0.09em',textTransform:'uppercase',color:'#334155',display:'block',marginBottom:'0.4rem'}}>Password</label><div style={{position:'relative'}}><input type={showPass?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)} onFocus={()=>setFocusP(true)} onBlur={()=>setFocusP(false)} placeholder="Enter your password" required autoComplete="current-password" style={{...inputStyle(focusP,color),paddingRight:'2.8rem'}}/><button type="button" onClick={()=>setShowPass(v=>!v)} style={{position:'absolute',right:10,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',color:'#334155',cursor:'pointer',display:'flex',alignItems:'center',padding:4}}>{showPass?<EyeOff size={15}/>:<Eye size={15}/>}</button></div></div>
              <button type="submit" disabled={loading} style={{width:'100%',marginTop:'0.25rem',padding:'0.875rem',background:`linear-gradient(135deg,${color},${color}bb)`,border:'none',borderRadius:12,color:'#fff',fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:'0.88rem',letterSpacing:'0.05em',cursor:loading?'wait':'pointer',opacity:loading?0.65:1,boxShadow:`0 4px 20px ${glow}`,transition:'transform 0.2s,box-shadow 0.2s'}}>{loading?'Signing in…':`Sign in as ${entity.role}`}</button>
            </form>
            <div onClick={()=>{setUsername(entity.demoUser);setPassword(entity.demoPass);}} title="Click to auto-fill" style={{marginTop:'1rem',padding:'0.55rem 0.875rem',background:`${color}07`,border:`1px solid ${color}18`,borderRadius:9,display:'flex',alignItems:'center',gap:'0.5rem',cursor:'pointer',userSelect:'none'}}>
              <AlertCircle size={13} color={color}/><span style={{fontSize:'0.71rem',color:'#334155',fontFamily:"'JetBrains Mono',monospace"}}>Demo → </span><span style={{fontSize:'0.71rem',color:'#67e8f9',fontFamily:"'JetBrains Mono',monospace",fontWeight:600}}>{entity.demoUser} / {entity.demoPass}</span><span style={{fontSize:'0.67rem',color:'#1e293b',marginLeft:'auto',fontFamily:"'JetBrains Mono',monospace"}}>↑ click to fill</span>
            </div>
          </div>
        )}
        {!selectedRole&&<p style={{fontSize:'0.78rem',color:'#1e293b',letterSpacing:'0.04em',animation:'lsFadeDown 0.5s 0.4s ease both'}}>↑ Select your role above to continue</p>}
        <p style={{fontSize:'0.84rem',color:'#334155',margin:0}}>New patient?{' '}<button onClick={onShowRegister} style={{background:'none',border:'none',color:'#06b6d4',cursor:'pointer',fontWeight:600,fontFamily:'inherit',fontSize:'0.84rem',textDecoration:'underline'}}>Register here</button></p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
//  RegisterScreen
// ─────────────────────────────────────────────
function RegisterScreen({ onRegister, onBack, formErr, loading }: { onRegister:(e:React.FormEvent,f:RegisterForm)=>Promise<void>; onBack:()=>void; formErr:string; loading:boolean }) {
  const [regF,setRegF]=useState<RegisterForm>({username:'',password:'',email:'',name:'',gender:'Male',dob:'',phone:'',address:'',blood_group:'O+',emergency_contact:'',emergency_contact_name:''});
  return (<div className="login-container"><div className="login-bg"/><div className="login-card"><div className="login-header"><div className="logo-container"><UserPlus className="logo-icon"/></div><h1>Patient Registration</h1><p>Create your account</p></div>{formErr&&<div className="form-error"><AlertCircle size={15}/> {formErr}</div>}<form onSubmit={e=>onRegister(e,regF)} className="register-form"><div className="form-row"><div className="form-group"><label>Username *</label><input type="text" value={regF.username} onChange={e=>setRegF({...regF,username:e.target.value})} placeholder="Min 3 chars" minLength={3} required/></div><div className="form-group"><label>Password *</label><input type="password" value={regF.password} onChange={e=>setRegF({...regF,password:e.target.value})} placeholder="Min 6 chars" minLength={6} required/></div></div><div className="form-row"><div className="form-group"><label>Full Name *</label><input type="text" value={regF.name} onChange={e=>setRegF({...regF,name:e.target.value})} required/></div><div className="form-group"><label>Email *</label><input type="email" value={regF.email} onChange={e=>setRegF({...regF,email:e.target.value})} required/></div></div><div className="form-row"><div className="form-group"><label>Gender *</label><select value={regF.gender} onChange={e=>setRegF({...regF,gender:e.target.value})}><option>Male</option><option>Female</option><option>Other</option></select></div><div className="form-group"><label>Date of Birth *</label><input type="date" value={regF.dob} onChange={e=>setRegF({...regF,dob:e.target.value})} max={new Date().toISOString().split('T')[0]} required/></div></div><div className="form-row"><div className="form-group"><label>Phone *</label><input type="tel" value={regF.phone} onChange={e=>setRegF({...regF,phone:e.target.value})} pattern="[0-9]{10}" required/></div><div className="form-group"><label>Blood Group *</label><select value={regF.blood_group} onChange={e=>setRegF({...regF,blood_group:e.target.value})}>{['A+','A-','B+','B-','O+','O-','AB+','AB-'].map(bg=><option key={bg}>{bg}</option>)}</select></div></div><div className="form-group"><label>Address *</label><input type="text" value={regF.address} onChange={e=>setRegF({...regF,address:e.target.value})} required/></div><h4 style={{color:'var(--text-mid)',margin:'1rem 0 0.5rem',fontSize:'0.9rem'}}>Emergency Contact (Optional)</h4><div className="form-row"><div className="form-group"><label>Contact Name</label><input type="text" value={regF.emergency_contact_name} onChange={e=>setRegF({...regF,emergency_contact_name:e.target.value})}/></div><div className="form-group"><label>Contact Phone</label><input type="tel" value={regF.emergency_contact} onChange={e=>setRegF({...regF,emergency_contact:e.target.value})} pattern="[0-9]{10}"/></div></div><button type="submit" className="login-btn" disabled={loading}>{loading?'Creating Account…':'Register'}</button></form><div className="register-link"><p>Already have an account? <button onClick={onBack} className="link-btn">Login here</button></p></div></div></div>);
}

// ─────────────────────────────────────────────
//  Main App
// ─────────────────────────────────────────────
export default function App() {
  const [token,   setToken]   = useState<string|null>(()=>localStorage.getItem('token'));
  const [user,    setUser]    = useState<AuthUser|null>(()=>{ const t=localStorage.getItem('token'); return t?decodeJWT(t):null; });
  const [view,    setView]    = useState('dashboard');
  const [showReg, setShowReg] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formErr, setFormErr] = useState('');

  // Patient profile navigation
  const [profilePatient, setProfilePatient] = useState<{id:number; name:string}|null>(null);

  // Data
  const [stats,         setStats]         = useState<DashboardStats>({total_patients:0,total_doctors:0,today_visits:0,pending_prescriptions:0,pending_tests:0});
  const [records,       setRecords]       = useState<any[]>([]);
  const [doctorRecords, setDoctorRecords] = useState<DoctorRecord[]>([]);
  const [patients,      setPatients]      = useState<Patient[]>([]);
  const [doctors,       setDoctors]       = useState<Doctor[]>([]);
  const [visits,        setVisits]        = useState<Visit[]>([]);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [medFiles,      setMedFiles]      = useState<MedicalFile[]>([]);
  const [myScans,       setMyScans]       = useState<ScanFile[]>([]);
  const [importResult,  setImportResult]  = useState<any>(null);
  const [pendingOnly,   setPendingOnly]   = useState(false);
  const [noCreds,       setNoCreds]       = useState<PatientNoCreds[]>([]);

  // Modals
  const [editPatient,   setEditPatient]   = useState<Patient|null>(null);
  const [assignPatient, setAssignPatient] = useState<PatientNoCreds|null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Patient|null>(null);

  // Forms
  const [scanF,   setScanF]   = useState({file:null as File|null, patient_id:'', scan_type:'X-Ray', description:''});
  const [visitF,  setVisitF]  = useState({PatientID:0,DoctorID:0,ReasonForVisit:'',VitalSigns:'',Notes:'',Status:'Scheduled'});
  const [diagF,   setDiagF]   = useState({VisitID:0,DiagnosisName:'',Description:'',IsChronic:false,Severity:'Mild'});
  const [rxF,     setRxF]     = useState({visit_id:0,medicine:'',dosage:'',frequency:'',duration:'',instructions:''});
  const [fileF,   setFileF]   = useState({file:null as File|null,file_type:'X-Ray',description:''});
  const [impFile, setImpFile] = useState<File|null>(null);

  const authHdr = useCallback(()=>({Authorization:`Bearer ${token}`,'Content-Type':'application/json'}),[token]);
  async function apiFetch(path:string,opts:RequestInit={}) {
    const res=await fetch(`${API}${path}`,{...opts,headers:{...authHdr(),...(opts.headers??{})}});
    const json=await res.json().catch(()=>({}));
    if(!res.ok) throw new Error(json.error||`HTTP ${res.status}`);
    return json;
  }

  const loadStats      = useCallback(()=>apiFetch('/dashboard/stats').then(setStats).catch(console.error),[token]);
  const loadRecords    = useCallback(()=>apiFetch('/records/all').then(setRecords).catch(console.error),[token]);
  const loadMyRecords  = useCallback(()=>apiFetch('/records/my').then(setRecords).catch(console.error),[token]);
  const loadDoctorRecs = useCallback(()=>apiFetch('/records/doctor').then(setDoctorRecords).catch(console.error),[token]);
  const loadPatients   = useCallback(()=>apiFetch('/patients').then(setPatients).catch(console.error),[token]);
  const loadDoctors    = useCallback(()=>apiFetch('/doctors').then(setDoctors).catch(console.error),[token]);
  const loadVisits     = useCallback(()=>apiFetch('/visits').then(setVisits).catch(console.error),[token]);
  const loadRx         = useCallback(()=>{ apiFetch(`/prescriptions${pendingOnly?'?pending=1':''}`).then(setPrescriptions).catch(console.error); },[token,pendingOnly]);
  const loadFiles      = useCallback(()=>{ if(user?.patient_id) apiFetch(`/files/patient/${user.patient_id}`).then(setMedFiles).catch(console.error); },[token,user]);
  const loadMyScans    = useCallback(()=>apiFetch('/scans/mine').then(setMyScans).catch(console.error),[token]);
  const loadNoCreds    = useCallback(()=>apiFetch('/admin/patients-without-credentials').then(setNoCreds).catch(console.error),[token]);

  useEffect(()=>{
    if(!user||!token) return;
    loadStats();
    if(user.role==='Doctor')      { loadRecords(); loadDoctorRecs(); loadDoctors(); loadPatients(); loadVisits(); }
    if(user.role==='Patient')     { loadMyRecords(); loadFiles(); }
    if(user.role==='Admin')       { loadPatients(); loadNoCreds(); }
    if(user.role==='Pharmacist')  { loadRx(); }
    if(user.role==='Radiologist') { loadPatients(); loadMyScans(); }
  },[user,token,view]);

  const doLogin=async(username:string,password:string)=>{ setLoading(true); setFormErr(''); try{ const res=await fetch(`${API}/auth/login`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password})}); const data=await res.json(); if(!data.token) throw new Error(data.error||'Login failed'); localStorage.setItem('token',data.token); setToken(data.token); setUser(decodeJWT(data.token)); }catch(e:any){ setFormErr(e.message); }finally{ setLoading(false); } };
  const doRegister=async(e:React.FormEvent,regF:RegisterForm)=>{ e.preventDefault(); setLoading(true); setFormErr(''); try{ await apiFetch('/auth/register',{method:'POST',body:JSON.stringify(regF)}); setShowReg(false); }catch(e:any){ setFormErr(e.message); }finally{ setLoading(false); } };
  const doLogout=()=>{ localStorage.removeItem('token'); setToken(null); setUser(null); setView('dashboard'); setProfilePatient(null); };

  const submitVisit=async(e:React.FormEvent)=>{ e.preventDefault(); setLoading(true); try{ await apiFetch('/visits',{method:'POST',body:JSON.stringify({patient_id:visitF.PatientID,doctor_id:visitF.DoctorID,reason:visitF.ReasonForVisit,vital_signs:visitF.VitalSigns,notes:visitF.Notes,status:visitF.Status})}); setVisitF({PatientID:0,DoctorID:0,ReasonForVisit:'',VitalSigns:'',Notes:'',Status:'Scheduled'}); loadVisits(); }catch(e:any){ alert(e.message); }finally{ setLoading(false); } };
  const submitDiag=async(e:React.FormEvent)=>{ e.preventDefault(); setLoading(true); try{ await apiFetch('/diagnosis',{method:'POST',body:JSON.stringify({visit_id:diagF.VisitID,name:diagF.DiagnosisName,description:diagF.Description,is_chronic:diagF.IsChronic,severity:diagF.Severity})}); setDiagF({VisitID:0,DiagnosisName:'',Description:'',IsChronic:false,Severity:'Mild'}); loadRecords(); }catch(e:any){ alert(e.message); }finally{ setLoading(false); } };
  const submitRx=async(e:React.FormEvent)=>{ e.preventDefault(); setLoading(true); try{ await apiFetch('/prescriptions',{method:'POST',body:JSON.stringify(rxF)}); setRxF({visit_id:0,medicine:'',dosage:'',frequency:'',duration:'',instructions:''}); loadRecords(); }catch(e:any){ alert(e.message); }finally{ setLoading(false); } };
  const dispense=async(id:number)=>{ try{ await apiFetch(`/prescriptions/${id}/dispense`,{method:'POST'}); loadRx(); }catch(e:any){ alert(e.message); } };
  const submitUpload=async(e:React.FormEvent)=>{ e.preventDefault(); if(!fileF.file) return; setLoading(true); try{ const fd=new FormData(); fd.append('file',fileF.file); fd.append('patient_id',String(user?.patient_id??'')); fd.append('file_type',fileF.file_type); fd.append('description',fileF.description); const res=await fetch(`${API}/files/upload`,{method:'POST',headers:{Authorization:`Bearer ${token}`},body:fd}); const d=await res.json(); if(!res.ok) throw new Error(d.error); setFileF({file:null,file_type:'X-Ray',description:''}); loadFiles(); }catch(e:any){ alert(e.message); }finally{ setLoading(false); } };
  const downloadFile=async(fid:number,name:string)=>{ const res=await fetch(`${API}/files/download/${fid}`,{headers:{Authorization:`Bearer ${token}`}}); if(!res.ok) return alert('Download failed'); const a=document.createElement('a'); a.href=URL.createObjectURL(await res.blob()); a.download=name; document.body.appendChild(a); a.click(); URL.revokeObjectURL(a.href); document.body.removeChild(a); };
  const submitImport=async(e:React.FormEvent)=>{ e.preventDefault(); if(!impFile) return; setLoading(true); try{ const fd=new FormData(); fd.append('file',impFile); const res=await fetch(`${API}/admin/import-patients`,{method:'POST',headers:{Authorization:`Bearer ${token}`},body:fd}); const d=await res.json(); if(!res.ok) throw new Error(d.error); setImportResult(d); setImpFile(null); loadPatients(); loadNoCreds(); }catch(e:any){ alert(e.message); }finally{ setLoading(false); } };
  const doDeletePatient=async(p:Patient)=>{ try{ await apiFetch(`/patients/${p.PatientID}`,{method:'DELETE'}); setDeleteConfirm(null); loadPatients(); loadNoCreds(); }catch(e:any){ alert(e.message); } };
  const submitScanUpload=async(e:React.FormEvent)=>{ e.preventDefault(); if(!scanF.file||!scanF.patient_id) return; setLoading(true); try{ const fd=new FormData(); fd.append('file',scanF.file); fd.append('patient_id',scanF.patient_id); fd.append('scan_type',scanF.scan_type); fd.append('description',scanF.description); const res=await fetch(`${API}/scans/upload`,{method:'POST',headers:{Authorization:`Bearer ${token}`},body:fd}); const d=await res.json(); if(!res.ok) throw new Error(d.error); setScanF({file:null,patient_id:'',scan_type:'X-Ray',description:''}); loadMyScans(); alert('Scan uploaded successfully!'); }catch(e:any){ alert(e.message); }finally{ setLoading(false); } };

  const openPatientProfile = (id: number, name: string) => { setProfilePatient({ id, name }); setView('patient-profile'); };

  const titles:Record<string,string>={ dashboard:'Dashboard', records:'All Medical Records', 'my-records':'My Medical Records', 'doctor-reports':'My Patients', 'patient-profile': profilePatient?.name ?? 'Patient Profile', 'create-visit':'Create New Visit', 'add-diagnosis':'Add Diagnosis', 'add-rx':'Add Prescription', 'my-files':'My Medical Files', 'upload-file':'Upload Medical File', prescriptions:'Prescriptions Management', patients:'Patient Management', import:'Import Patients', 'assign-creds':'Assign Credentials', 'upload-scan':'Upload Scan', 'my-uploads':'My Scan Uploads' };

  if(!token||!user){
    if(showReg) return <RegisterScreen onRegister={doRegister} onBack={()=>{setShowReg(false);setFormErr('');}} formErr={formErr} loading={loading}/>;
    return <LoginScreen onLogin={doLogin} onShowRegister={()=>{setShowReg(true);setFormErr('');}} formErr={formErr} loading={loading}/>;
  }

  // Derive unique patients from doctor records
  const uniquePatients = useMemo(() => {
    const seen = new Set<string>();
    const result: Array<{name:string; bloodGroup:string; patientId?:number; visitCount:number}> = [];
    doctorRecords.forEach(r => {
      if (!seen.has(r.PatientName)) {
        seen.add(r.PatientName);
        const count = doctorRecords.filter(x => x.PatientName === r.PatientName).length;
        result.push({ name:r.PatientName, bloodGroup:r.BloodGroup, patientId:r.PatientID, visitCount:count });
      }
    });
    return result;
  }, [doctorRecords]);

  return (
    <div className="dashboard">
      {/* ── Modals ── */}
      {editPatient   && <EditPatientModal   patient={editPatient}   token={token} onClose={()=>setEditPatient(null)}   onSaved={()=>{ setEditPatient(null); loadPatients(); }}/>}
      {assignPatient && <AssignCredsModal   patient={assignPatient} token={token} onClose={()=>setAssignPatient(null)} onSaved={()=>{ setAssignPatient(null); loadNoCreds(); loadPatients(); }}/>}
      {deleteConfirm && (
        <Modal title="Confirm Deletion" onClose={()=>setDeleteConfirm(null)}>
          <p style={{color:'#94a3b8',marginBottom:'1.5rem',lineHeight:1.6}}>Deactivate <strong style={{color:'#f0f6ff'}}>{deleteConfirm.PatientName}</strong>? Their login will also be disabled. Reversible from the database.</p>
          <div style={{display:'flex',gap:'0.75rem'}}>
            <button onClick={()=>setDeleteConfirm(null)} className="action-btn secondary" style={{flex:1}}>Cancel</button>
            <button onClick={()=>doDeletePatient(deleteConfirm)} style={{flex:1,padding:'0.75rem',background:'linear-gradient(135deg,#f43f5e,#e11d48)',border:'none',borderRadius:10,color:'white',fontWeight:700,cursor:'pointer',fontFamily:"'Syne',sans-serif",display:'flex',alignItems:'center',justifyContent:'center',gap:'0.4rem'}}><Trash2 size={15}/> Confirm Delete</button>
          </div>
        </Modal>
      )}

      {/* ── Sidebar ── */}
      <aside className="sidebar">
        <div className="sidebar-header"><Heart className="sidebar-logo"/><div><h2>MediCare</h2><p className="sidebar-subtitle">{user.role}</p></div></div>
        <nav className="sidebar-nav">
          <button className={view==='dashboard'?'active':''} onClick={()=>setView('dashboard')}><Activity/> Dashboard</button>
          {user.role==='Doctor'&&<>
            <button className={view==='records'?'active':''} onClick={()=>setView('records')}><FileText/> All Records</button>
            <button className={view==='doctor-reports'||view==='patient-profile'?'active':''} onClick={()=>{ setProfilePatient(null); setView('doctor-reports'); }}><Users/> My Patients</button>
            <button className={view==='create-visit'?'active':''} onClick={()=>setView('create-visit')}><PlusCircle/> Create Visit</button>
            <button className={view==='add-diagnosis'?'active':''} onClick={()=>setView('add-diagnosis')}><Stethoscope/> Add Diagnosis</button>
            <button className={view==='add-rx'?'active':''} onClick={()=>setView('add-rx')}><Pill/> Add Prescription</button>
          </>}
          {user.role==='Patient'&&<>
            <button className={view==='my-records'?'active':''} onClick={()=>setView('my-records')}><FileText/> My Records</button>
            <button className={view==='my-files'?'active':''} onClick={()=>setView('my-files')}><FileImage/> My Files</button>
            <button className={view==='upload-file'?'active':''} onClick={()=>setView('upload-file')}><Upload/> Upload File</button>
          </>}
          {user.role==='Radiologist'&&<>
            <button className={view==='upload-scan'?'active':''} onClick={()=>setView('upload-scan')}><Upload/> Upload Scan</button>
            <button className={view==='my-uploads'?'active':''} onClick={()=>setView('my-uploads')}><ScanLine/> My Uploads</button>
          </>}
          {user.role==='Pharmacist'&&<button className={view==='prescriptions'?'active':''} onClick={()=>setView('prescriptions')}><Pill/> Prescriptions</button>}
          {user.role==='Admin'&&<>
            <button className={view==='patients'?'active':''} onClick={()=>setView('patients')}><Users/> Patients</button>
            <button className={view==='assign-creds'?'active':''} onClick={()=>setView('assign-creds')}>
              <Key/> Assign Credentials
              {noCreds.length>0&&<span style={{marginLeft:'auto',background:'#f43f5e',color:'white',borderRadius:999,fontSize:'0.65rem',fontWeight:700,padding:'0.1rem 0.45rem'}}>{noCreds.length}</span>}
            </button>
            <button className={view==='import'?'active':''} onClick={()=>setView('import')}><Upload/> Import Patients</button>
          </>}
        </nav>
        <div className="sidebar-footer"><div className="user-info"><User size={16}/><span>{user.username}</span></div><button className="logout-btn" onClick={doLogout}><LogOut/> Logout</button></div>
      </aside>

      {/* ── Main ── */}
      <main className="main-content">
        <header className="content-header">
          <div style={{ display:'flex', alignItems:'center', gap:'0.75rem' }}>
            {view==='patient-profile' && (
              <button onClick={()=>{ setProfilePatient(null); setView('doctor-reports'); }} style={{ background:'rgba(6,182,212,0.08)', border:'1px solid rgba(6,182,212,0.18)', borderRadius:9, padding:'0.35rem 0.65rem', color:'#06b6d4', cursor:'pointer', display:'flex', alignItems:'center' }}><ArrowLeft size={16}/></button>
            )}
            <div>
              <h1>{titles[view]??'Dashboard'}</h1>
              <p className="subtitle">
                {view==='patient-profile' ? `Full medical profile · ${user.username}` : `Welcome back, ${user.username}`}
              </p>
            </div>
          </div>
          <div className="user-badge">
            {user.role==='Doctor'&&<Stethoscope/>}{user.role==='Patient'&&<User/>}
            {user.role==='Pharmacist'&&<Pill/>}{user.role==='Admin'&&<Shield/>}
            {user.role==='Radiologist'&&<ScanLine/>}
            <span>{user.role}</span>
          </div>
        </header>

        <div className="content-body">

          {/* ── Patient Profile (Doctor) ── */}
          {view==='patient-profile' && profilePatient && (
            <PatientProfile patientId={profilePatient.id} token={token} onBack={()=>{ setProfilePatient(null); setView('doctor-reports'); }}/>
          )}

          {/* ── Dashboard ── */}
          {view==='dashboard'&&(
            <div className="dashboard-grid">
              <div className="stat-card stat-primary"><div className="stat-icon"><Users/></div><div className="stat-details"><h3>{stats.total_patients}</h3><p>Total Patients</p></div></div>
              <div className="stat-card stat-success"><div className="stat-icon"><Stethoscope/></div><div className="stat-details"><h3>{stats.total_doctors}</h3><p>Total Doctors</p></div></div>
              <div className="stat-card stat-warning"><div className="stat-icon"><Calendar/></div><div className="stat-details"><h3>{stats.today_visits}</h3><p>Today's Visits</p></div></div>
              <div className="stat-card stat-danger"><div className="stat-icon"><Pill/></div><div className="stat-details"><h3>{stats.pending_prescriptions}</h3><p>Pending Prescriptions</p></div></div>
              <div className="welcome-card">
                <h2>Welcome to MediCare Plus 🏥</h2>
                <p>Your comprehensive hospital management solution.</p>
                {user.role==='Patient'&&<div className="patient-quick-info"><div className="info-item"><FileText size={20}/><div><strong>{records.length}</strong><span>Medical Records</span></div></div><div className="info-item"><FileImage size={20}/><div><strong>{medFiles.length}</strong><span>Uploaded Files</span></div></div></div>}
                {user.role==='Radiologist'&&<div className="patient-quick-info"><div className="info-item"><ScanLine size={20}/><div><strong>{myScans.length}</strong><span>Scans Uploaded</span></div></div><div className="info-item"><Users size={20}/><div><strong>{patients.length}</strong><span>Total Patients</span></div></div></div>}
                {user.role==='Admin'&&noCreds.length>0&&<div style={{background:'rgba(244,63,94,0.08)',border:'1px solid rgba(244,63,94,0.2)',borderRadius:12,padding:'0.875rem 1rem',marginBottom:'1rem',display:'flex',alignItems:'center',justifyContent:'space-between'}}><div style={{display:'flex',alignItems:'center',gap:'0.6rem'}}><Key size={18} color="#f43f5e"/><span style={{color:'#fda4af',fontSize:'0.88rem',fontWeight:600}}>{noCreds.length} patient{noCreds.length>1?'s':''} need login credentials</span></div><button onClick={()=>setView('assign-creds')} className="action-btn" style={{padding:'0.4rem 0.875rem',fontSize:'0.8rem',marginTop:0}}>Assign Now</button></div>}
                <div className="quick-actions">
                  {user.role==='Doctor'&&<><button onClick={()=>setView('create-visit')} className="action-btn">Create Visit</button><button onClick={()=>setView('doctor-reports')} className="action-btn secondary">My Patients</button></>}
                  {user.role==='Patient'&&<><button onClick={()=>setView('my-records')} className="action-btn">View My Records</button><button onClick={()=>setView('upload-file')} className="action-btn secondary">Upload File</button></>}
                  {user.role==='Pharmacist'&&<button onClick={()=>setView('prescriptions')} className="action-btn">View Prescriptions</button>}
                  {user.role==='Admin'&&<><button onClick={()=>setView('patients')} className="action-btn">Manage Patients</button><button onClick={()=>setView('import')} className="action-btn secondary">Import Patients</button></>}
                  {user.role==='Radiologist'&&<><button onClick={()=>setView('upload-scan')} className="action-btn">Upload Scan</button><button onClick={()=>setView('my-uploads')} className="action-btn secondary">View My Uploads</button></>}
                </div>
              </div>
            </div>
          )}

          {/* ── All Records ── */}
          {(view==='records'||view==='my-records')&&(
            <div className="records-container">{records.length===0?<div className="empty-state"><FileText size={64}/><h3>No records found</h3></div>:(<div className="table-container"><table className="data-table"><thead><tr><th>Patient</th><th>Doctor</th><th>Visit Date</th><th>Diagnosis</th><th>Medicine</th><th>Status</th></tr></thead><tbody>{records.map((r,i)=>(<tr key={i}><td><div className="patient-cell"><strong>{r.PatientName}</strong><span className="badge blood-group">{r.BloodGroup}</span></div></td><td><div className="doctor-cell"><strong>{r.DoctorName}</strong><small>{r.Specialty}</small></div></td><td>{r.VisitDate?new Date(r.VisitDate).toLocaleDateString():'—'}</td><td>{r.DiagnosisName||'—'}</td><td>{r.MedicineName||'—'}</td><td><span className={`status-badge ${r.IsDispensed?'dispensed':'pending'}`}>{r.IsDispensed?'Dispensed':'Pending'}</span></td></tr>))}</tbody></table></div>)}</div>
          )}

          {/* ── My Patients (Doctor) — clickable patient cards ── */}
          {view==='doctor-reports'&&(
            <div>
              {uniquePatients.length===0?(
                <div className="empty-state"><Users size={64}/><h3>No patients yet</h3><p>Once you log visits, your patients will appear here.</p></div>
              ):(
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))', gap:'1rem' }}>
                  {uniquePatients.map((pt, i) => {
                    const ptRecords = doctorRecords.filter(r => r.PatientName === pt.name);
                    const hasChronic = ptRecords.some(r => r.IsChronic);
                    const latestVisit = ptRecords[0];
                    const bgC = latestVisit?.BloodGroup?.includes('O') ? '#f59e0b' : latestVisit?.BloodGroup?.includes('AB') ? '#8b5cf6' : latestVisit?.BloodGroup?.includes('A') ? '#06b6d4' : '#10b981';
                    return (
                      <button key={i} onClick={() => pt.patientId && openPatientProfile(pt.patientId, pt.name)} style={{ all:'unset', cursor: pt.patientId ? 'pointer' : 'default', display:'block', background:'var(--card-bg,#111827)', border:'1px solid rgba(148,163,184,0.08)', borderRadius:18, padding:'1.25rem 1.5rem', transition:'all 0.25s cubic-bezier(0.16,1,0.3,1)', position:'relative', overflow:'hidden' }}
                        onMouseEnter={e=>{ if(pt.patientId){ (e.currentTarget as HTMLButtonElement).style.transform='translateY(-3px)'; (e.currentTarget as HTMLButtonElement).style.borderColor='rgba(6,182,212,0.3)'; (e.currentTarget as HTMLButtonElement).style.boxShadow='0 8px 32px rgba(6,182,212,0.12)'; }}}
                        onMouseLeave={e=>{ (e.currentTarget as HTMLButtonElement).style.transform='none'; (e.currentTarget as HTMLButtonElement).style.borderColor='rgba(148,163,184,0.08)'; (e.currentTarget as HTMLButtonElement).style.boxShadow='none'; }}>
                        {/* Top accent */}
                        <div style={{ position:'absolute', top:0, left:0, right:0, height:3, background:'linear-gradient(90deg,#06b6d4,#8b5cf6)', opacity:0.6 }}/>
                        {/* Avatar + Name */}
                        <div style={{ display:'flex', alignItems:'center', gap:'0.875rem', marginBottom:'1rem' }}>
                          <div style={{ width:52, height:52, borderRadius:15, background:`linear-gradient(135deg,${bgC}30,${bgC}10)`, border:`2px solid ${bgC}30`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                            <span style={{ fontFamily:"'Syne',sans-serif", fontSize:'1.3rem', fontWeight:800, color:bgC }}>{pt.name.charAt(0).toUpperCase()}</span>
                          </div>
                          <div style={{ flex:1, minWidth:0 }}>
                            <p style={{ margin:0, fontWeight:800, color:'#f0f6ff', fontSize:'0.95rem', fontFamily:"'Syne',sans-serif", overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{pt.name}</p>
                            <div style={{ display:'flex', gap:'0.4rem', marginTop:'0.3rem', flexWrap:'wrap' }}>
                              <Badge label={pt.bloodGroup} color={bgC}/>
                              {hasChronic && <Badge label="Chronic" color="#8b5cf6"/>}
                            </div>
                          </div>
                          <div style={{ color:'#334155', flexShrink:0 }}><ChevronDown size={18}/></div>
                        </div>
                        {/* Stats row */}
                        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'0.5rem', marginBottom:'1rem' }}>
                          {[
                            ['Visits', pt.visitCount, '#06b6d4'],
                            ['Diagnoses', ptRecords.filter(r=>r.DiagnosisName).length, '#f43f5e'],
                            ['Meds', ptRecords.filter(r=>r.MedicineName).length, '#10b981'],
                          ].map(([l,v,c]) => (
                            <div key={l as string} style={{ background:`${c as string}08`, border:`1px solid ${c as string}15`, borderRadius:10, padding:'0.5rem', textAlign:'center' }}>
                              <p style={{ margin:0, fontSize:'1.1rem', fontWeight:800, color:c as string, fontFamily:"'Syne',sans-serif", lineHeight:1 }}>{v as number}</p>
                              <p style={{ margin:'0.1rem 0 0', fontSize:'0.6rem', color:'#334155', fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase' }}>{l as string}</p>
                            </div>
                          ))}
                        </div>
                        {/* Latest visit */}
                        {latestVisit && (
                          <div style={{ background:'rgba(255,255,255,0.02)', border:'1px solid rgba(148,163,184,0.06)', borderRadius:10, padding:'0.6rem 0.875rem' }}>
                            <p style={{ margin:'0 0 0.15rem', fontSize:'0.62rem', fontWeight:700, letterSpacing:'0.07em', textTransform:'uppercase', color:'#334155' }}>Latest Visit</p>
                            <p style={{ margin:0, fontSize:'0.82rem', color:'#94a3b8', fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{latestVisit.ReasonForVisit}</p>
                            <p style={{ margin:'0.15rem 0 0', fontSize:'0.72rem', color:'#334155' }}>{latestVisit.VisitDate ? new Date(latestVisit.VisitDate).toLocaleDateString('en-IN', {day:'2-digit',month:'short',year:'numeric'}) : '—'}</p>
                          </div>
                        )}
                        {pt.patientId && (
                          <div style={{ marginTop:'0.875rem', display:'flex', alignItems:'center', gap:'0.35rem', color:'#06b6d4', fontSize:'0.78rem', fontWeight:700 }}>
                            <Layers size={13}/> Click to view full profile
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── Create Visit ── */}
          {view==='create-visit'&&(<div className="form-container"><form onSubmit={submitVisit} className="data-form"><h3>📋 Visit Information</h3><div className="form-row"><div className="form-group"><label>Patient *</label><select value={visitF.PatientID||''} onChange={e=>setVisitF({...visitF,PatientID:Number(e.target.value)})} required><option value="">Select Patient</option>{patients.map(p=><option key={p.PatientID} value={p.PatientID}>{p.PatientName} — {p.BloodGroup}</option>)}</select></div><div className="form-group"><label>Doctor *</label><select value={visitF.DoctorID||''} onChange={e=>setVisitF({...visitF,DoctorID:Number(e.target.value)})} required><option value="">Select Doctor</option>{doctors.map(d=><option key={d.DoctorID} value={d.DoctorID}>{d.DoctorName} — {d.Specialty}</option>)}</select></div></div><div className="form-group"><label>Reason *</label><input type="text" value={visitF.ReasonForVisit} onChange={e=>setVisitF({...visitF,ReasonForVisit:e.target.value})} required/></div><div className="form-group"><label>Vital Signs (JSON)</label><textarea value={visitF.VitalSigns} onChange={e=>setVisitF({...visitF,VitalSigns:e.target.value})} placeholder='{"bp":"120/80","temp":"98.6","pulse":"72","spo2":"98"}' rows={3}/></div><div className="form-group"><label>Notes</label><textarea value={visitF.Notes} onChange={e=>setVisitF({...visitF,Notes:e.target.value})} rows={4}/></div><div className="form-group"><label>Status</label><select value={visitF.Status} onChange={e=>setVisitF({...visitF,Status:e.target.value})}><option>Scheduled</option><option>In Progress</option><option>Completed</option></select></div><button type="submit" className="submit-btn" disabled={loading}>{loading?'Creating…':'Create Visit'}</button></form></div>)}

          {/* ── Add Diagnosis ── */}
          {view==='add-diagnosis'&&(<div className="form-container"><form onSubmit={submitDiag} className="data-form"><h3>🩺 Diagnosis</h3><div className="form-row"><div className="form-group"><label>Visit *</label><select value={diagF.VisitID||''} onChange={e=>setDiagF({...diagF,VisitID:Number(e.target.value)})} required><option value="">Select Visit</option>{visits.map(v=><option key={v.VisitID} value={v.VisitID}>#{v.VisitID} — {v.PatientName} ({v.VisitDate?new Date(v.VisitDate).toLocaleDateString():''})</option>)}</select></div><div className="form-group"><label>Severity *</label><select value={diagF.Severity} onChange={e=>setDiagF({...diagF,Severity:e.target.value})}><option>Mild</option><option>Moderate</option><option>Severe</option></select></div></div><div className="form-group"><label>Diagnosis Name *</label><input type="text" value={diagF.DiagnosisName} onChange={e=>setDiagF({...diagF,DiagnosisName:e.target.value})} required/></div><div className="form-group"><label>Description</label><textarea value={diagF.Description} onChange={e=>setDiagF({...diagF,Description:e.target.value})} rows={4}/></div><div className="form-group checkbox-group"><label><input type="checkbox" checked={diagF.IsChronic} onChange={e=>setDiagF({...diagF,IsChronic:e.target.checked})}/><span>Chronic Condition</span></label></div><button type="submit" className="submit-btn" disabled={loading}>{loading?'Adding…':'Add Diagnosis'}</button></form></div>)}

          {/* ── Add Prescription ── */}
          {view==='add-rx'&&(<div className="form-container"><form onSubmit={submitRx} className="data-form"><h3>💊 Prescription</h3><div className="form-group"><label>Visit *</label><select value={rxF.visit_id||''} onChange={e=>setRxF({...rxF,visit_id:Number(e.target.value)})} required><option value="">Select Visit</option>{visits.map(v=><option key={v.VisitID} value={v.VisitID}>#{v.VisitID} — {v.PatientName} ({v.VisitDate?new Date(v.VisitDate).toLocaleDateString():''})</option>)}</select></div><div className="form-row"><div className="form-group"><label>Medicine *</label><input type="text" value={rxF.medicine} onChange={e=>setRxF({...rxF,medicine:e.target.value})} required/></div><div className="form-group"><label>Dosage *</label><input type="text" value={rxF.dosage} onChange={e=>setRxF({...rxF,dosage:e.target.value})} required/></div></div><div className="form-row"><div className="form-group"><label>Frequency *</label><input type="text" value={rxF.frequency} onChange={e=>setRxF({...rxF,frequency:e.target.value})} required/></div><div className="form-group"><label>Duration *</label><input type="text" value={rxF.duration} onChange={e=>setRxF({...rxF,duration:e.target.value})} required/></div></div><div className="form-group"><label>Instructions</label><textarea value={rxF.instructions} onChange={e=>setRxF({...rxF,instructions:e.target.value})} rows={3}/></div><button type="submit" className="submit-btn" disabled={loading}>{loading?'Adding…':'Add Prescription'}</button></form></div>)}

          {/* ── My Files (Patient) ── */}
          {view==='my-files'&&(<div className="files-container">{medFiles.length===0?<div className="empty-state"><FileImage size={64}/><h3>No files uploaded</h3><button onClick={()=>setView('upload-file')} className="action-btn">Upload File</button></div>:(<div className="files-grid">{medFiles.map(f=>(<div key={f.FileID} className="file-card"><div className="file-icon"><FileImage size={40}/></div><div className="file-details"><h4>{f.FileType}</h4><p className="file-name">{f.FileName}</p><p className="file-size">{(f.FileSize/1024/1024).toFixed(2)} MB</p><p className="file-date">{new Date(f.UploadedAt).toLocaleDateString()}</p>{f.Description&&<p className="file-desc">{f.Description}</p>}</div><button className="download-btn" onClick={()=>downloadFile(f.FileID,f.FileName)}><Download size={20}/> Download</button></div>))}</div>)}</div>)}

          {/* ── Upload File (Patient) ── */}
          {view==='upload-file'&&(<div className="form-container"><form onSubmit={submitUpload} className="data-form upload-form"><h3>📤 Upload Medical File</h3><div className="form-group"><label>File Type *</label><select value={fileF.file_type} onChange={e=>setFileF({...fileF,file_type:e.target.value})}>{['X-Ray','MRI','CT Scan','Blood Test','Report','Prescription','Other'].map(t=><option key={t}>{t}</option>)}</select></div><div className="form-group"><label>Select File *</label><div className="file-input-wrapper"><input type="file" onChange={e=>setFileF({...fileF,file:e.target.files?.[0]||null})} accept=".jpg,.jpeg,.png,.pdf,.dcm" required/>{fileF.file&&<p className="file-selected">Selected: {fileF.file.name}</p>}</div><small>JPG, PNG, PDF, DICOM · max 50 MB</small></div><div className="form-group"><label>Description</label><textarea value={fileF.description} onChange={e=>setFileF({...fileF,description:e.target.value})} rows={3}/></div><button type="submit" className="submit-btn" disabled={loading||!fileF.file}>{loading?'Uploading…':'Upload File'}</button></form></div>)}

          {/* ── Prescriptions (Pharmacist) ── */}
          {view==='prescriptions'&&(<div className="prescriptions-container"><div className="prescriptions-header"><label className="filter-checkbox"><input type="checkbox" checked={pendingOnly} onChange={e=>{setPendingOnly(e.target.checked);setTimeout(loadRx,0);}}/><span>Show Pending Only</span></label></div>{prescriptions.length===0?<div className="empty-state"><Pill size={64}/><h3>No prescriptions</h3></div>:(<div className="table-container"><table className="data-table"><thead><tr><th>Patient</th><th>Medicine</th><th>Dosage</th><th>Frequency</th><th>Duration</th><th>Doctor</th><th>Status</th><th>Action</th></tr></thead><tbody>{prescriptions.map(p=>(<tr key={p.PrescriptionID}><td><strong>{p.PatientName}</strong></td><td><strong>{p.MedicineName}</strong></td><td>{p.Dosage}</td><td>{p.Frequency}</td><td>{p.Duration}</td><td>{p.DoctorName}</td><td><span className={`status-badge ${p.IsDispensed?'dispensed':'pending'}`}>{p.IsDispensed?<><CheckCircle size={14}/> Dispensed</>:<><Clock size={14}/> Pending</>}</span></td><td>{!p.IsDispensed&&<button className="dispense-btn" onClick={()=>dispense(p.PrescriptionID)}>Dispense</button>}</td></tr>))}</tbody></table></div>)}</div>)}

          {/* ── Upload Scan (Radiologist) ── */}
          {view==='upload-scan'&&(<div className="form-container"><form onSubmit={submitScanUpload} className="data-form"><h3>🩻 Upload Patient Scan</h3><div className="form-row"><div className="form-group"><label>Patient *</label><select value={scanF.patient_id} onChange={e=>setScanF({...scanF,patient_id:e.target.value})} required><option value="">Select Patient</option>{patients.map(p=><option key={p.PatientID} value={p.PatientID}>{p.PatientName} — {p.BloodGroup}</option>)}</select></div><div className="form-group"><label>Scan Type *</label><select value={scanF.scan_type} onChange={e=>setScanF({...scanF,scan_type:e.target.value})}>{SCAN_TYPES.map(t=><option key={t}>{t}</option>)}</select></div></div><div className="form-group"><label>Scan File *</label><div className="file-input-wrapper"><input type="file" onChange={e=>setScanF({...scanF,file:e.target.files?.[0]||null})} accept=".jpg,.jpeg,.png,.pdf,.dcm" required/>{scanF.file&&<p className="file-selected">Selected: {scanF.file.name}</p>}</div><small>Accepted: JPG, PNG, PDF, DICOM · max 50 MB</small></div><div className="form-group"><label>Description / Findings</label><textarea value={scanF.description} onChange={e=>setScanF({...scanF,description:e.target.value})} rows={4} placeholder="e.g. Chest X-Ray — No consolidation seen."/></div><button type="submit" className="submit-btn" disabled={loading||!scanF.file||!scanF.patient_id}>{loading?'Uploading…':'Upload Scan'}</button></form></div>)}

          {/* ── My Uploads (Radiologist) ── */}
          {view==='my-uploads'&&(<div className="files-container">{myScans.length===0?<div className="empty-state"><ScanLine size={64}/><h3>No scans uploaded yet</h3><button onClick={()=>setView('upload-scan')} className="action-btn">Upload Scan</button></div>:(<div style={{display:'flex',flexDirection:'column',gap:'0.75rem'}}>{myScans.map(s=>(<div key={s.FileID} style={{background:'var(--card-bg)',border:'1px solid rgba(244,63,94,0.14)',borderRadius:14,padding:'1rem 1.25rem',display:'flex',alignItems:'center',gap:'1rem'}}><div style={{width:44,height:44,borderRadius:11,background:'rgba(244,63,94,0.1)',border:'1px solid rgba(244,63,94,0.2)',display:'flex',alignItems:'center',justifyContent:'center',color:'#f43f5e',flexShrink:0}}><ScanLine size={20}/></div><div style={{flex:1,minWidth:0}}><div style={{display:'flex',alignItems:'center',gap:'0.6rem',marginBottom:'0.2rem'}}><p style={{margin:0,fontWeight:700,color:'#f0f6ff',fontSize:'0.9rem'}}>{s.FileName}</p><Badge label={s.FileType} color="#f43f5e"/></div><p style={{margin:0,fontSize:'0.78rem',color:'#475569'}}>Patient: <strong style={{color:'#94a3b8'}}>{s.PatientName}</strong> · {s.BloodGroup} · {(s.FileSize/1024/1024).toFixed(2)} MB · {new Date(s.UploadedAt).toLocaleDateString()}</p>{s.Description&&<p style={{margin:'0.25rem 0 0',fontSize:'0.78rem',color:'#64748b'}}>{s.Description}</p>}</div><button onClick={()=>downloadFile(s.FileID,s.FileName)} className="download-btn" style={{whiteSpace:'nowrap'}}><Download size={16}/> Download</button></div>))}</div>)}</div>)}

          {/* ── Patients (Admin) ── */}
          {view==='patients'&&(<div className="patients-container">{patients.length===0?<div className="empty-state"><Users size={64}/><h3>No patients found</h3></div>:(<div className="table-container"><table className="data-table"><thead><tr><th>Name</th><th>Email</th><th>Gender</th><th>DOB</th><th>Blood</th><th>Phone</th><th>Address</th><th style={{textAlign:'center'}}>Actions</th></tr></thead><tbody>{patients.map(p=>(<tr key={p.PatientID}><td><strong>{p.PatientName}</strong></td><td><div className="contact-cell"><Mail size={14}/><span>{p.Email}</span></div></td><td>{p.Gender}</td><td>{new Date(p.DateOfBirth).toLocaleDateString()}</td><td><span className="badge blood-group">{p.BloodGroup}</span></td><td><div className="contact-cell"><Phone size={14}/><span>{p.PhoneNumber}</span></div></td><td><div className="contact-cell"><MapPin size={14}/><span>{p.Address}</span></div></td><td><div style={{display:'flex',gap:'0.35rem',justifyContent:'center',flexWrap:'wrap'}}><button onClick={()=>setEditPatient(p)} style={{background:'rgba(6,182,212,0.1)',border:'1px solid rgba(6,182,212,0.2)',borderRadius:8,padding:'0.32rem 0.55rem',color:'#06b6d4',cursor:'pointer',display:'flex',alignItems:'center',gap:'0.25rem',fontSize:'0.75rem',fontWeight:600}}><Edit2 size={12}/> Edit</button><button onClick={()=>setDeleteConfirm(p)} style={{background:'rgba(244,63,94,0.08)',border:'1px solid rgba(244,63,94,0.2)',borderRadius:8,padding:'0.32rem 0.55rem',color:'#f43f5e',cursor:'pointer',display:'flex',alignItems:'center',gap:'0.25rem',fontSize:'0.75rem',fontWeight:600}}><Trash2 size={12}/> Delete</button></div></td></tr>))}</tbody></table></div>)}</div>)}

          {/* ── Assign Credentials (Admin) ── */}
          {view==='assign-creds'&&(<div className="patients-container">{noCreds.length===0?<div className="empty-state"><Key size={64}/><h3>All patients have credentials</h3></div>:(<><div style={{marginBottom:'1rem',padding:'0.875rem 1.25rem',background:'rgba(245,158,11,0.06)',border:'1px solid rgba(245,158,11,0.18)',borderRadius:12,display:'flex',alignItems:'center',gap:'0.6rem'}}><AlertCircle size={16} color="#f59e0b"/><p style={{margin:0,color:'#fbbf24',fontSize:'0.85rem'}}><strong>{noCreds.length}</strong> patient{noCreds.length>1?'s':''} imported via CSV need login credentials.</p></div><div className="table-container"><table className="data-table"><thead><tr><th>Name</th><th>Email</th><th>Gender</th><th>Blood Group</th><th>Phone</th><th>Imported On</th><th style={{textAlign:'center'}}>Action</th></tr></thead><tbody>{noCreds.map(p=>(<tr key={p.PatientID}><td><strong>{p.PatientName}</strong></td><td><div className="contact-cell"><Mail size={14}/><span>{p.Email}</span></div></td><td>{p.Gender}</td><td><span className="badge blood-group">{p.BloodGroup}</span></td><td><div className="contact-cell"><Phone size={14}/><span>{p.PhoneNumber}</span></div></td><td>{p.CreatedAt?new Date(p.CreatedAt).toLocaleDateString():'—'}</td><td style={{textAlign:'center'}}><button onClick={()=>setAssignPatient(p)} style={{background:'linear-gradient(135deg,#f59e0b,#d97706)',border:'none',borderRadius:8,padding:'0.4rem 0.875rem',color:'white',cursor:'pointer',display:'inline-flex',alignItems:'center',gap:'0.35rem',fontSize:'0.8rem',fontWeight:700,fontFamily:"'Syne',sans-serif"}}><Key size={13}/> Assign</button></td></tr>))}</tbody></table></div></>)}</div>)}

          {/* ── Import (Admin) ── */}
          {view==='import'&&(<div className="import-container"><div className="import-section"><h3>📥 Import Patients from Excel / CSV</h3><div className="import-instructions"><h4>Required Columns:</h4><p>Name, Email, Gender, DOB, Phone, Address, BloodGroup</p><a href="data:text/csv;charset=utf-8,Name,Email,Gender,DOB,Phone,Address,BloodGroup%0AJohn Doe,john@email.com,Male,1990-01-15,9876543210,Mumbai,O%2B" download="patient_template.csv" className="download-template-btn"><Download size={20}/> Download Template</a></div><form onSubmit={submitImport} className="import-form"><div className="form-group"><label>Select Excel / CSV File</label><input type="file" onChange={e=>setImpFile(e.target.files?.[0]||null)} accept=".xlsx,.xls,.csv" required/>{impFile&&<p className="file-selected">Selected: {impFile.name}</p>}</div><button type="submit" className="submit-btn" disabled={loading||!impFile}>{loading?'Importing…':'Import Patients'}</button></form>{importResult&&(<div className="import-result"><h4>Import Results:</h4><div className="result-stats"><div className="result-stat success"><strong>{importResult.successful}</strong><span>Successful</span></div><div className="result-stat error"><strong>{importResult.failed}</strong><span>Failed</span></div><div className="result-stat total"><strong>{importResult.total}</strong><span>Total</span></div></div>{importResult.errors?.length>0&&<div className="error-log"><h5>Errors:</h5><ul>{importResult.errors.map((e:string,i:number)=><li key={i}>{e}</li>)}</ul></div>}{importResult.successful>0&&<div style={{marginTop:'1rem',padding:'0.75rem 1rem',background:'rgba(245,158,11,0.06)',border:'1px solid rgba(245,158,11,0.18)',borderRadius:10,display:'flex',alignItems:'center',justifyContent:'space-between'}}><span style={{color:'#fbbf24',fontSize:'0.85rem'}}>New patients need login credentials.</span><button onClick={()=>setView('assign-creds')} className="action-btn" style={{padding:'0.4rem 0.875rem',fontSize:'0.8rem',marginTop:0}}>Assign Credentials →</button></div>}</div>)}</div></div>)}

        </div>
      </main>
    </div>
  );
}