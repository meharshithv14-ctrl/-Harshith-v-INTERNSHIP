"""
Hospital Management System — Flask API  (app.py)  v3.0
========================================================
Run:  python app.py

NEW in v3.0:
  • Chronic Disease Progress endpoints  (GET / POST / DELETE)
  • Full Patient Detail endpoint  sp_GetPatientFullDetails (doctor portal)
  • Theme preference saved per user (stored client-side via JWT; API echoes it)

Install:
  pip install flask flask-cors PyJWT pyodbc pandas openpyxl
"""

from flask import Flask, request, jsonify, send_file, g
from flask_cors import CORS
import jwt
import datetime
import os
import math as _math
import hashlib
from functools import wraps
from werkzeug.utils import secure_filename
import pandas as pd
import pyodbc

# ─────────────────────────────────────────────
#  App setup — serves built React frontend + API
# ─────────────────────────────────────────────
import sys

# ── Static folder: where Vite puts its build output ──────────────────────────
# Vite is configured to build to:  hospital-backend/static/
# So Flask looks for  static/index.html  to serve the React SPA.
# If you run app.py from inside hospital-backend/, the path is just "static".
STATIC_FOLDER = os.path.join(os.path.dirname(__file__), "static")
app = Flask(
    __name__,
    static_folder=STATIC_FOLDER,
    static_url_path=""         # serve static files at root URL, not /static/
)
CORS(app, resources={r"/api/*": {"origins": "*"}})

SECRET_KEY       = os.getenv("HMS_SECRET_KEY", "hospital_secret_key_change_in_production")
UPLOAD_FOLDER    = os.path.join(os.path.dirname(__file__), "uploads")
ALLOWED_EXT      = {"png", "jpg", "jpeg", "pdf", "dcm", "xlsx", "xls", "csv"}
MAX_UPLOAD_BYTES = 50 * 1024 * 1024

os.makedirs(os.path.join(UPLOAD_FOLDER, "medical_files"),  exist_ok=True)
os.makedirs(os.path.join(UPLOAD_FOLDER, "patient_imports"), exist_ok=True)

app.config["UPLOAD_FOLDER"]      = UPLOAD_FOLDER
app.config["MAX_CONTENT_LENGTH"] = MAX_UPLOAD_BYTES

# ─────────────────────────────────────────────
#  Database
# ─────────────────────────────────────────────
DB_SERVER = r"LAPTOP-OGJ9GR0I\SQLEXPRESS"   # ← change to your server
DB_NAME   = "HospitalManagementSystem"
DB_DRIVER = "{ODBC Driver 17 for SQL Server}"

def get_db() -> pyodbc.Connection:
    conn_str = (
        f"DRIVER={DB_DRIVER};"
        f"SERVER={DB_SERVER};"
        f"DATABASE={DB_NAME};"
        "Trusted_Connection=yes;"
    )
    return pyodbc.connect(conn_str, autocommit=False)

def row_to_dict(cursor: pyodbc.Cursor, row: pyodbc.Row) -> dict:
    result: dict = {}
    for i, col in enumerate(cursor.description):
        val = row[i]
        if isinstance(val, (datetime.datetime, datetime.date)):
            val = val.isoformat()
        elif isinstance(val, bytes):
            val = val.hex()
        result[col[0]] = val
    return result

# ─────────────────────────────────────────────
#  Password helpers
# ─────────────────────────────────────────────
def hash_password(plain: str) -> str:
    return hashlib.sha256(plain.encode()).hexdigest()

def verify_password(plain: str, stored: str) -> bool:
    return stored == hash_password(plain) or stored == plain

# ─────────────────────────────────────────────
#  File helper
# ─────────────────────────────────────────────
def allowed_file(filename: str) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXT

# ─────────────────────────────────────────────
#  Auth decorator
# ─────────────────────────────────────────────
def login_required(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        auth = request.headers.get("Authorization", "")
        if not auth.startswith("Bearer "):
            return jsonify({"error": "Token missing"}), 401
        try:
            token = auth.split(" ", 1)[1]
            g.user = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        except jwt.ExpiredSignatureError:
            return jsonify({"error": "Token expired"}), 401
        except jwt.InvalidTokenError:
            return jsonify({"error": "Invalid token"}), 401
        return f(*args, **kwargs)
    return wrapper

def current_user() -> dict:
    user: dict = g.get("user")
    if user is None:
        raise RuntimeError("current_user() called outside login_required context")
    return user

# ─────────────────────────────────────────────
#  Serve React SPA
# ─────────────────────────────────────────────
from flask import send_from_directory


# ═══════════════════════════════════════════════
#  AUTHENTICATION
# ═══════════════════════════════════════════════
@app.route("/api/auth/login", methods=["POST"])
def login():
    data     = request.get_json(silent=True) or {}
    username = str(data.get("username") or "").strip()
    password = str(data.get("password") or "")
    if not username or not password:
        return jsonify({"error": "Username and password are required"}), 400

    conn = get_db(); cur = conn.cursor()
    try:
        cur.execute("""
            SELECT UserID, Username, PasswordHash, Email, Role,
                   PatientID, DoctorID, PharmacistID, RadiologistID, ReceptionistID
            FROM   Users
            WHERE  Username = ? AND IsActive = 1
        """, username)
        row = cur.fetchone()
        if row is None or not verify_password(password, row.PasswordHash):
            return jsonify({"error": "Invalid username or password"}), 401

        payload = {
            "user_id":          row.UserID,
            "username":         row.Username,
            "email":            row.Email,
            "role":             row.Role,
            "patient_id":       row.PatientID,
            "doctor_id":        row.DoctorID,
            "pharmacist_id":    row.PharmacistID,
            "radiologist_id":   row.RadiologistID,
            "receptionist_id":  row.ReceptionistID,
            "exp": datetime.datetime.utcnow() + datetime.timedelta(hours=8),
        }
        token = jwt.encode(payload, SECRET_KEY, algorithm="HS256")
        cur.execute("UPDATE Users SET LastLogin = GETDATE() WHERE UserID = ?", row.UserID)
        conn.commit()
        return jsonify({"token": token, "role": row.Role, "username": row.Username})
    except Exception as exc:
        conn.rollback(); return jsonify({"error": str(exc)}), 500
    finally:
        cur.close(); conn.close()


@app.route("/api/auth/register", methods=["POST"])
def register():
    data     = request.get_json(silent=True) or {}
    required = ["username", "password", "email", "name", "gender", "dob", "phone", "address", "blood_group"]
    missing  = [f for f in required if not data.get(f)]
    if missing:
        return jsonify({"error": f"Missing fields: {', '.join(missing)}"}), 400

    username = str(data["username"]).strip()
    password = str(data["password"])
    if len(username) < 3:
        return jsonify({"error": "Username must be at least 3 characters"}), 400
    if len(password) < 6:
        return jsonify({"error": "Password must be at least 6 characters"}), 400

    conn = get_db(); cur = conn.cursor()
    try:
        cur.execute("SELECT 1 FROM Users WHERE Username = ?", username)
        if cur.fetchone():
            return jsonify({"error": "Username already taken"}), 409

        cur.execute("SELECT 1 FROM Users WHERE Email = ?", data["email"])
        if cur.fetchone():
            return jsonify({"error": "Email already registered"}), 409

        cur.execute("""
            INSERT INTO Patients
                (PatientName, Email, Gender, DateOfBirth, PhoneNumber,
                 Address, BloodGroup, EmergencyContact, EmergencyContactName)
            OUTPUT INSERTED.PatientID
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            data["name"], data["email"], data["gender"], data["dob"],
            data["phone"], data["address"], data["blood_group"],
            data.get("emergency_contact", ""),
            data.get("emergency_contact_name", ""),
        ))
        patient_row = cur.fetchone()
        if patient_row is None:
            raise RuntimeError("Failed to insert patient record")
        patient_id: int = patient_row[0]

        cur.execute("""
            INSERT INTO Users (Username, PasswordHash, Email, Role, PatientID)
            VALUES (?, ?, ?, 'Patient', ?)
        """, (username, hash_password(password), data["email"], patient_id))
        conn.commit()
        return jsonify({"message": "Registration successful! Please log in.", "username": username, "patient_id": patient_id}), 201
    except Exception as exc:
        conn.rollback(); return jsonify({"error": str(exc)}), 500
    finally:
        cur.close(); conn.close()

# ═══════════════════════════════════════════════
#  DASHBOARD
# ═══════════════════════════════════════════════
@app.route("/api/dashboard/stats", methods=["GET"])
@login_required
def dashboard_stats():
    conn = get_db(); cur = conn.cursor()
    try:
        cur.execute("SELECT * FROM vw_DashboardStats")
        row = cur.fetchone()
        return jsonify({
            "total_patients":        int(row[0]) if row else 0,
            "total_doctors":         int(row[1]) if row else 0,
            "total_radiologists":    int(row[2]) if row else 0,
            "today_visits":          int(row[3]) if row else 0,
            "pending_prescriptions": int(row[4]) if row else 0,
            "pending_tests":         int(row[5]) if row else 0,
        })
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500
    finally:
        cur.close(); conn.close()

# ═══════════════════════════════════════════════
#  PATIENTS
# ═══════════════════════════════════════════════
@app.route("/api/patients", methods=["GET"])
@login_required
def get_patients():
    conn = get_db(); cur = conn.cursor()
    try:
        cur.execute("""
            SELECT PatientID, PatientName, Email, Gender, DateOfBirth,
                   PhoneNumber, Address, BloodGroup,
                   EmergencyContact, EmergencyContactName, CreatedAt
            FROM   Patients WHERE IsActive = 1 ORDER BY CreatedAt DESC
        """)
        return jsonify([row_to_dict(cur, r) for r in cur.fetchall()])
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500
    finally:
        cur.close(); conn.close()


@app.route("/api/patients/<int:pid>", methods=["GET"])
@login_required
def get_patient(pid: int):
    conn = get_db(); cur = conn.cursor()
    try:
        cur.execute("""
            SELECT PatientID, PatientName, Email, Gender, DateOfBirth,
                   PhoneNumber, Address, BloodGroup,
                   EmergencyContact, EmergencyContactName, CreatedAt
            FROM   Patients WHERE PatientID = ? AND IsActive = 1
        """, pid)
        row = cur.fetchone()
        if row is None:
            return jsonify({"error": "Patient not found"}), 404
        return jsonify(row_to_dict(cur, row))
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500
    finally:
        cur.close(); conn.close()


@app.route("/api/patients/<int:pid>", methods=["PUT"])
@login_required
def update_patient(pid: int):
    data = request.get_json(silent=True) or {}
    conn = get_db(); cur = conn.cursor()
    try:
        cur.execute("""
            UPDATE Patients
            SET PatientName=?, Gender=?, DateOfBirth=?, PhoneNumber=?,
                Address=?, BloodGroup=?, EmergencyContact=?, EmergencyContactName=?
            WHERE PatientID = ?
        """, (data.get("name"), data.get("gender"), data.get("dob"), data.get("phone"),
              data.get("address"), data.get("blood_group"),
              data.get("emergency_contact"), data.get("emergency_contact_name"), pid))
        conn.commit()
        return jsonify({"message": "Patient updated successfully"})
    except Exception as exc:
        conn.rollback(); return jsonify({"error": str(exc)}), 500
    finally:
        cur.close(); conn.close()


@app.route("/api/patients/<int:pid>", methods=["DELETE"])
@login_required
def delete_patient(pid: int):
    user = current_user()
    if user.get("role") != "Admin":
        return jsonify({"error": "Admin access required"}), 403
    conn = get_db(); cur = conn.cursor()
    try:
        cur.execute("SELECT PatientID FROM Patients WHERE PatientID = ? AND IsActive = 1", pid)
        if cur.fetchone() is None:
            return jsonify({"error": "Patient not found"}), 404
        cur.execute("UPDATE Patients SET IsActive = 0 WHERE PatientID = ?", pid)
        cur.execute("UPDATE Users    SET IsActive = 0 WHERE PatientID = ?", pid)
        conn.commit()
        return jsonify({"message": "Patient deactivated successfully"})
    except Exception as exc:
        conn.rollback(); return jsonify({"error": str(exc)}), 500
    finally:
        cur.close(); conn.close()

# ═══════════════════════════════════════════════
#  PATIENT BULK DELETE (Admin only)
# ═══════════════════════════════════════════════
@app.route("/api/patients/bulk-delete", methods=["POST"])
@login_required
def bulk_delete_patients():
    """
    Bulk deactivate patients by ID list.
    Expects JSON: { "patient_ids": [1,2,3,...] }
    """
    user = current_user()
    if user.get("role") != "Admin":
        return jsonify({"error": "Admin access required"}), 403
    
    data = request.get_json(silent=True) or {}
    patient_ids = data.get("patient_ids", [])
    
    if not isinstance(patient_ids, list):
        return jsonify({"error": "patient_ids must be a list"}), 400
    if not patient_ids:
        return jsonify({"error": "No patient IDs provided"}), 400
    
    # Validate all IDs are integers
    try:
        ids = [int(pid) for pid in patient_ids]
    except (ValueError, TypeError):
        return jsonify({"error": "All patient IDs must be integers"}), 400
    
    conn = get_db(); cur = conn.cursor()
    try:
        # Check which IDs actually exist and are active
        placeholders = ','.join('?' * len(ids))
        cur.execute(f"""
            SELECT PatientID FROM Patients
            WHERE PatientID IN ({placeholders}) AND IsActive = 1
        """, ids)
        existing = {row[0] for row in cur.fetchall()}
        
        if not existing:
            return jsonify({"error": "No active patients found with the provided IDs"}), 404
        
        # Update Patients table
        cur.execute(f"""
            UPDATE Patients SET IsActive = 0
            WHERE PatientID IN ({placeholders}) AND IsActive = 1
        """, ids)
        
        # Update Users table
        cur.execute(f"""
            UPDATE Users SET IsActive = 0
            WHERE PatientID IN ({placeholders})
        """, ids)
        
        conn.commit()
        return jsonify({
            "message": f"Successfully deactivated {len(existing)} patient(s)",
            "deactivated_count": len(existing),
            "deactivated_ids": list(existing)
        })
    except Exception as exc:
        conn.rollback(); return jsonify({"error": str(exc)}), 500
    finally:
        cur.close(); conn.close()


# ═══════════════════════════════════════════════
#  PATIENT FULL DETAILS  (Doctor Portal)
# ═══════════════════════════════════════════════
@app.route("/api/patients/<int:pid>/full-details", methods=["GET"])
@login_required
def get_patient_full_details(pid: int):
    """
    Returns a multi-result-set from sp_GetPatientFullDetails:
    demographics, visits, diagnoses, prescriptions, lab tests,
    chronic progress history, and medical files — all in one call.
    Accessible by: Doctor, Admin, Radiologist.
    Patients may only access their own record.
    """
    user = current_user()
    role = user.get("role", "")
    if role == "Patient" and user.get("patient_id") != pid:
        return jsonify({"error": "Access denied"}), 403

    conn = get_db(); cur = conn.cursor()
    try:
        cur.execute("EXEC sp_GetPatientFullDetails ?", pid)

        def fetch_all():
            rows = cur.fetchall()
            data = [row_to_dict(cur, r) for r in rows]
            return data

        demographics   = fetch_all()
        cur.nextset()
        visits         = fetch_all()
        cur.nextset()
        diagnoses      = fetch_all()
        cur.nextset()
        prescriptions  = fetch_all()
        cur.nextset()
        lab_tests      = fetch_all()
        cur.nextset()
        chronic_progress = fetch_all()
        cur.nextset()
        files          = fetch_all()

        if not demographics:
            return jsonify({"error": "Patient not found"}), 404

        return jsonify({
            "patient":          demographics[0],
            "visits":           visits,
            "diagnoses":        diagnoses,
            "prescriptions":    prescriptions,
            "lab_tests":        lab_tests,
            "chronic_progress": chronic_progress,
            "files":            files,
        })
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500
    finally:
        cur.close(); conn.close()

# ═══════════════════════════════════════════════
#  CHRONIC DISEASE PROGRESS
# ═══════════════════════════════════════════════
@app.route("/api/chronic-progress/<int:pid>", methods=["GET"])
@login_required
def get_chronic_progress(pid: int):
    """Return all chronic progress entries for a patient."""
    user = current_user()
    role = user.get("role", "")
    if role == "Patient" and user.get("patient_id") != pid:
        return jsonify({"error": "Access denied"}), 403

    diag_name = request.args.get("diagnosis")
    conn = get_db(); cur = conn.cursor()
    try:
        cur.execute("EXEC sp_GetChronicProgress ?, ?", pid, diag_name)
        rows = cur.fetchall()
        return jsonify([row_to_dict(cur, r) for r in rows])
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500
    finally:
        cur.close(); conn.close()


@app.route("/api/chronic-progress", methods=["POST"])
@login_required
def add_chronic_progress():
    """Doctor records a new progress entry for a chronic condition."""
    user = current_user()
    if user.get("role") not in ("Doctor", "Admin"):
        return jsonify({"error": "Only doctors can record chronic progress"}), 403

    data      = request.get_json(silent=True) or {}
    patient_id = data.get("patient_id")
    diag_name  = data.get("diagnosis_name")
    score      = data.get("progress_score")
    doctor_id  = user.get("doctor_id")

    if not all([patient_id, diag_name, score is not None]):
        return jsonify({"error": "patient_id, diagnosis_name, and progress_score are required"}), 400

    try:
        score = float(score)
        if not 0 <= score <= 100:
            raise ValueError
    except (TypeError, ValueError):
        return jsonify({"error": "progress_score must be a number between 0 and 100"}), 400

    conn = get_db(); cur = conn.cursor()
    try:
        cur.execute("""
            INSERT INTO ChronicDiseaseProgress
                (PatientID, DiagnosisName, ProgressScore,
                 BloodPressure, BloodSugar, Weight, Notes, RecordedBy)
            OUTPUT INSERTED.ProgressID
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            int(patient_id), str(diag_name), score,
            data.get("blood_pressure"),
            data.get("blood_sugar"),
            data.get("weight"),
            data.get("notes"),
            int(doctor_id) if doctor_id else None,
        ))
        row = cur.fetchone()
        if row is None:
            raise RuntimeError("Insert failed")
        prog_id: int = row[0]
        conn.commit()
        return jsonify({"message": "Progress entry recorded", "progress_id": prog_id}), 201
    except Exception as exc:
        conn.rollback(); return jsonify({"error": str(exc)}), 500
    finally:
        cur.close(); conn.close()


@app.route("/api/chronic-progress/<int:progress_id>", methods=["DELETE"])
@login_required
def delete_chronic_progress(progress_id: int):
    """Delete a progress entry (doctor or admin only)."""
    user = current_user()
    if user.get("role") not in ("Doctor", "Admin"):
        return jsonify({"error": "Access denied"}), 403
    conn = get_db(); cur = conn.cursor()
    try:
        cur.execute("DELETE FROM ChronicDiseaseProgress WHERE ProgressID = ?", progress_id)
        if cur.rowcount == 0:
            return jsonify({"error": "Entry not found"}), 404
        conn.commit()
        return jsonify({"message": "Progress entry deleted"})
    except Exception as exc:
        conn.rollback(); return jsonify({"error": str(exc)}), 500
    finally:
        cur.close(); conn.close()

# ═══════════════════════════════════════════════
#  DOCTORS
# ═══════════════════════════════════════════════
@app.route("/api/doctors", methods=["GET"])
@login_required
def get_doctors():
    conn = get_db(); cur = conn.cursor()
    try:
        cur.execute("""
            SELECT DoctorID, DoctorName, Email, Specialty, PhoneNumber, LicenseNumber, YearsOfExperience
            FROM   Doctors WHERE IsActive = 1 ORDER BY DoctorName
        """)
        return jsonify([row_to_dict(cur, r) for r in cur.fetchall()])
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500
    finally:
        cur.close(); conn.close()


@app.route("/api/doctors", methods=["POST"])
@login_required
def add_doctor():
    """Add a new doctor (admin only)."""
    user = current_user()
    if user.get("role") != "Admin":
        return jsonify({"error": "Admin access required"}), 403
    
    data = request.get_json(silent=True) or {}
    required = ["doctor_name", "email", "specialty", "phone_number"]
    missing = [f for f in required if not data.get(f)]
    if missing:
        return jsonify({"error": f"Missing required fields: {', '.join(missing)}"}), 400
    
    doctor_name = str(data["doctor_name"]).strip()
    email = str(data["email"]).strip()
    specialty = str(data["specialty"]).strip()
    phone_number = str(data["phone_number"]).strip()
    license_number = str(data.get("license_number", "")).strip()
    years_of_experience = data.get("years_of_experience")
    
    # Validate email format
    if "@" not in email:
        return jsonify({"error": "Invalid email format"}), 400
    
    conn = get_db(); cur = conn.cursor()
    try:
        # Check if doctor with same email already exists
        cur.execute("SELECT 1 FROM Doctors WHERE Email = ? AND IsActive = 1", email)
        if cur.fetchone():
            return jsonify({"error": "A doctor with this email already exists"}), 409
        
        # Insert new doctor
        cur.execute("""
            INSERT INTO Doctors (DoctorName, Email, Specialty, PhoneNumber,
                                 LicenseNumber, YearsOfExperience, IsActive)
            OUTPUT INSERTED.DoctorID
            VALUES (?, ?, ?, ?, ?, ?, 1)
        """, (
            doctor_name, email, specialty, phone_number,
            license_number if license_number else None,
            int(years_of_experience) if years_of_experience else None
        ))
        
        row = cur.fetchone()
        if row is None:
            raise RuntimeError("Failed to insert doctor record")
        
        doctor_id = row[0]
        
        # Also create a user account for the doctor
        # Generate a temporary password (first 8 chars of email + "123")
        temp_password = email.split('@')[0][:8] + "123"
        username = email.split('@')[0]  # Use email prefix as username
        
        # Check if username already exists
        cur.execute("SELECT 1 FROM Users WHERE Username = ?", username)
        if cur.fetchone():
            # If username exists, append doctor_id
            username = f"{username}{doctor_id}"
        
        cur.execute("""
            INSERT INTO Users (Username, PasswordHash, Email, Role, DoctorID)
            VALUES (?, ?, ?, 'Doctor', ?)
        """, (username, hash_password(temp_password), email, doctor_id))
        
        conn.commit()
        return jsonify({
            "message": "Doctor added successfully",
            "doctor_id": doctor_id,
            "username": username,
            "temp_password": temp_password,
            "note": "Doctor user account created with temporary password"
        }), 201
    except Exception as exc:
        conn.rollback()
        return jsonify({"error": str(exc)}), 500
    finally:
        cur.close(); conn.close()

# ═══════════════════════════════════════════════
#  VISITS
# ═══════════════════════════════════════════════
@app.route("/api/visits", methods=["GET"])
@login_required
def get_visits():
    conn = get_db(); cur = conn.cursor()
    try:
        cur.execute("""
            SELECT v.VisitID, v.PatientID, p.PatientName,
                   v.DoctorID, d.DoctorName,
                   v.VisitDate, v.ReasonForVisit, v.VitalSigns, v.Notes, v.Status
            FROM   Visits v
            JOIN   Patients p ON v.PatientID = p.PatientID
            JOIN   Doctors  d ON v.DoctorID  = d.DoctorID
            ORDER  BY v.VisitDate DESC
        """)
        return jsonify([row_to_dict(cur, r) for r in cur.fetchall()])
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500
    finally:
        cur.close(); conn.close()


@app.route("/api/visits", methods=["POST"])
@login_required
def create_visit():
    data = request.get_json(silent=True) or {}
    if not data.get("patient_id") or not data.get("doctor_id"):
        return jsonify({"error": "patient_id and doctor_id are required"}), 400
    conn = get_db(); cur = conn.cursor()
    try:
        cur.execute("""
            INSERT INTO Visits (PatientID, DoctorID, ReasonForVisit, VitalSigns, Notes, Status)
            OUTPUT INSERTED.VisitID
            VALUES (?, ?, ?, ?, ?, ?)
        """, (int(data["patient_id"]), int(data["doctor_id"]),
              str(data.get("reason", "")), str(data.get("vital_signs", "")),
              str(data.get("notes", "")), str(data.get("status", "Scheduled"))))
        row = cur.fetchone()
        if row is None:
            raise RuntimeError("Insert failed")
        conn.commit()
        return jsonify({"message": "Visit created", "visit_id": row[0]}), 201
    except Exception as exc:
        conn.rollback(); return jsonify({"error": str(exc)}), 500
    finally:
        cur.close(); conn.close()

# ═══════════════════════════════════════════════
#  RECORDS
# ═══════════════════════════════════════════════
@app.route("/api/records/all", methods=["GET"])
@login_required
def get_all_records():
    conn = get_db(); cur = conn.cursor()
    try:
        cur.execute("EXEC sp_GetAllRecords")
        return jsonify([row_to_dict(cur, r) for r in cur.fetchall()])
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500
    finally:
        cur.close(); conn.close()


@app.route("/api/records/my", methods=["GET"])
@login_required
def get_my_records():
    user = current_user()
    patient_id = user.get("patient_id")
    if not patient_id:
        return jsonify({"error": "Not a patient account"}), 403
    conn = get_db(); cur = conn.cursor()
    try:
        cur.execute("EXEC sp_GetPatientRecords ?", int(patient_id))
        return jsonify([row_to_dict(cur, r) for r in cur.fetchall()])
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500
    finally:
        cur.close(); conn.close()


@app.route("/api/records/doctor", methods=["GET"])
@login_required
def get_doctor_records():
    user = current_user()
    doctor_id = user.get("doctor_id")
    if not doctor_id:
        return jsonify({"error": "Not a doctor account"}), 403
    conn = get_db(); cur = conn.cursor()
    try:
        cur.execute("""
            SELECT
                p.PatientID, p.PatientName, p.BloodGroup,
                d.DoctorName, d.Specialty,
                v.VisitID, v.VisitDate, v.ReasonForVisit,
                v.Status AS VisitStatus, v.VitalSigns, v.Notes AS VisitNotes,
                diag.DiagnosisName, diag.Description AS DiagnosisDesc,
                diag.IsChronic, diag.Severity,
                rx.MedicineName, rx.Dosage, rx.Frequency, rx.Duration,
                rx.Instructions, rx.IsDispensed, rx.DispensedDate
            FROM       Visits v
            JOIN       Patients      p    ON v.PatientID  = p.PatientID
            JOIN       Doctors       d    ON v.DoctorID   = d.DoctorID
            LEFT JOIN  Diagnoses     diag ON diag.VisitID = v.VisitID
            LEFT JOIN  Prescriptions rx   ON rx.VisitID   = v.VisitID
            WHERE      v.DoctorID = ? AND p.IsActive = 1
            ORDER BY   v.VisitDate DESC
        """, int(doctor_id))
        return jsonify([row_to_dict(cur, r) for r in cur.fetchall()])
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500
    finally:
        cur.close(); conn.close()

# ═══════════════════════════════════════════════
#  DIAGNOSIS
# ═══════════════════════════════════════════════
@app.route("/api/diagnosis", methods=["POST"])
@login_required
def add_diagnosis():
    data = request.get_json(silent=True) or {}
    if not data.get("visit_id") or not data.get("name"):
        return jsonify({"error": "visit_id and name are required"}), 400
    conn = get_db(); cur = conn.cursor()
    try:
        cur.execute("""
            INSERT INTO Diagnoses (VisitID, DiagnosisName, Description, IsChronic, Severity)
            OUTPUT INSERTED.DiagnosisID
            VALUES (?, ?, ?, ?, ?)
        """, (int(data["visit_id"]), str(data["name"]),
              str(data.get("description", "")),
              bool(data.get("is_chronic", False)),
              str(data.get("severity", "Mild"))))
        row = cur.fetchone()
        if row is None:
            raise RuntimeError("Insert failed")
        conn.commit()
        return jsonify({"message": "Diagnosis added", "diagnosis_id": row[0]}), 201
    except Exception as exc:
        conn.rollback(); return jsonify({"error": str(exc)}), 500
    finally:
        cur.close(); conn.close()

# ═══════════════════════════════════════════════
#  PRESCRIPTIONS
# ═══════════════════════════════════════════════
@app.route("/api/prescriptions", methods=["GET"])
@login_required
def get_prescriptions():
    pending_only = request.args.get("pending", "0") == "1"
    conn = get_db(); cur = conn.cursor()
    try:
        cur.execute("EXEC sp_GetPrescriptionsForPharmacy ?", int(pending_only))
        return jsonify([row_to_dict(cur, r) for r in cur.fetchall()])
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500
    finally:
        cur.close(); conn.close()


@app.route("/api/prescriptions", methods=["POST"])
@login_required
def add_prescription():
    data = request.get_json(silent=True) or {}
    if not data.get("visit_id") or not data.get("medicine"):
        return jsonify({"error": "visit_id and medicine are required"}), 400
    conn = get_db(); cur = conn.cursor()
    try:
        cur.execute("""
            INSERT INTO Prescriptions (VisitID, MedicineName, Dosage, Frequency, Duration, Instructions)
            OUTPUT INSERTED.PrescriptionID
            VALUES (?, ?, ?, ?, ?, ?)
        """, (int(data["visit_id"]), str(data["medicine"]),
              str(data.get("dosage", "")), str(data.get("frequency", "")),
              str(data.get("duration", "")), str(data.get("instructions", ""))))
        row = cur.fetchone()
        if row is None:
            raise RuntimeError("Insert failed")
        conn.commit()
        return jsonify({"message": "Prescription added", "prescription_id": row[0]}), 201
    except Exception as exc:
        conn.rollback(); return jsonify({"error": str(exc)}), 500
    finally:
        cur.close(); conn.close()


@app.route("/api/prescriptions/<int:pid>/dispense", methods=["POST"])
@login_required
def dispense_prescription(pid: int):
    user = current_user()
    pharmacist_id = user.get("pharmacist_id")
    if not pharmacist_id:
        return jsonify({"error": "Only pharmacists can dispense prescriptions"}), 403
    conn = get_db(); cur = conn.cursor()
    try:
        cur.execute("""
            UPDATE Prescriptions
            SET IsDispensed=1, DispensedBy=?, DispensedDate=GETDATE()
            WHERE PrescriptionID = ? AND IsDispensed = 0
        """, (int(pharmacist_id), pid))
        if cur.rowcount == 0:
            return jsonify({"error": "Prescription not found or already dispensed"}), 404
        conn.commit()
        return jsonify({"message": "Prescription dispensed successfully"})
    except Exception as exc:
        conn.rollback(); return jsonify({"error": str(exc)}), 500
    finally:
        cur.close(); conn.close()

# ═══════════════════════════════════════════════
#  PATIENT SUMMARY SHEET
# ═══════════════════════════════════════════════
def _ensure_summary_notes_table(cur: pyodbc.Cursor) -> None:
    cur.execute("""
        IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'PatientSummaryNotes')
        CREATE TABLE PatientSummaryNotes (
            PatientID  INT           PRIMARY KEY,
            Notes      NVARCHAR(MAX) NULL,
            UpdatedBy  NVARCHAR(100) NULL,
            UpdatedAt  DATETIME      DEFAULT GETDATE()
        )
    """)


@app.route("/api/patients/<int:pid>/summary", methods=["GET"])
@login_required
def get_patient_summary(pid: int):
    user = current_user()
    role = user.get("role", "")
    if role == "Patient" and user.get("patient_id") != pid:
        return jsonify({"error": "Access denied"}), 403
    conn = get_db(); cur = conn.cursor()
    try:
        _ensure_summary_notes_table(cur); conn.commit()
        cur.execute("""
            SELECT p.PatientID, p.PatientName, p.Email, p.Gender, p.DateOfBirth,
                   p.PhoneNumber, p.Address, p.BloodGroup,
                   p.EmergencyContact, p.EmergencyContactName,
                   ISNULL(n.Notes,'') AS SummaryNotes,
                   ISNULL(n.UpdatedBy,'') AS NotesUpdatedBy, n.UpdatedAt
            FROM   Patients p
            LEFT JOIN PatientSummaryNotes n ON n.PatientID = p.PatientID
            WHERE  p.PatientID = ? AND p.IsActive = 1
        """, pid)
        row = cur.fetchone()
        if row is None:
            return jsonify({"error": "Patient not found"}), 404
        patient = row_to_dict(cur, row)

        cur.execute("""
            SELECT v.VisitID, v.VisitDate, v.ReasonForVisit, v.VitalSigns, v.Notes, v.Status,
                   d.DoctorName, d.Specialty
            FROM Visits v JOIN Doctors d ON v.DoctorID = d.DoctorID
            WHERE v.PatientID = ? ORDER BY v.VisitDate DESC
        """, pid)
        visits = [row_to_dict(cur, r) for r in cur.fetchall()]

        cur.execute("""
            SELECT dg.DiagnosisName, dg.Description, dg.Severity, dg.IsChronic, v.VisitDate
            FROM Diagnoses dg JOIN Visits v ON dg.VisitID = v.VisitID
            WHERE v.PatientID = ? ORDER BY v.VisitDate DESC
        """, pid)
        diagnoses = [row_to_dict(cur, r) for r in cur.fetchall()]

        cur.execute("""
            SELECT rx.MedicineName, rx.Dosage, rx.Frequency, rx.Duration, rx.Instructions,
                   rx.IsDispensed, rx.DispensedDate, d.DoctorName, v.VisitDate
            FROM Prescriptions rx
            JOIN Visits v ON rx.VisitID = v.VisitID
            JOIN Doctors d ON v.DoctorID = d.DoctorID
            WHERE v.PatientID = ? ORDER BY v.VisitDate DESC
        """, pid)
        prescriptions = [row_to_dict(cur, r) for r in cur.fetchall()]

        cur.execute("""
            SELECT f.FileID, f.FileType, f.FileName, f.FileSize, f.Description, f.UploadedAt,
                   u.Username AS UploadedByUsername
            FROM MedicalFiles f LEFT JOIN Users u ON f.UploadedBy = u.UserID
            WHERE f.PatientID = ? ORDER BY f.UploadedAt DESC
        """, pid)
        files = [row_to_dict(cur, r) for r in cur.fetchall()]

        # Latest chronic progress scores
        cur.execute("EXEC sp_GetLatestChronicScores ?", pid)
        chronic_scores = [row_to_dict(cur, r) for r in cur.fetchall()]

        return jsonify({"patient": patient, "visits": visits, "diagnoses": diagnoses,
                        "prescriptions": prescriptions, "files": files, "chronic_scores": chronic_scores})
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500
    finally:
        cur.close(); conn.close()


@app.route("/api/patients/<int:pid>/summary-notes", methods=["PUT"])
@login_required
def update_summary_notes(pid: int):
    user = current_user()
    if user.get("role") not in ("Admin", "Doctor"):
        return jsonify({"error": "Admin or Doctor access required"}), 403
    data  = request.get_json(silent=True) or {}
    notes = str(data.get("notes", ""))
    conn = get_db(); cur = conn.cursor()
    try:
        _ensure_summary_notes_table(cur)
        cur.execute("""
            MERGE PatientSummaryNotes AS target
            USING (SELECT ? AS PatientID) AS src ON target.PatientID = src.PatientID
            WHEN MATCHED THEN
                UPDATE SET Notes=?, UpdatedBy=?, UpdatedAt=GETDATE()
            WHEN NOT MATCHED THEN
                INSERT (PatientID, Notes, UpdatedBy) VALUES (?, ?, ?);
        """, (pid, notes, user["username"], pid, notes, user["username"]))
        conn.commit()
        return jsonify({"message": "Summary notes updated"})
    except Exception as exc:
        conn.rollback(); return jsonify({"error": str(exc)}), 500
    finally:
        cur.close(); conn.close()

# ═══════════════════════════════════════════════
#  FILE UPLOAD / DOWNLOAD
# ═══════════════════════════════════════════════
@app.route("/api/files/upload", methods=["POST"])
@login_required
def upload_file():
    user = current_user()
    if "file" not in request.files:
        return jsonify({"error": "No file part in request"}), 400
    f = request.files["file"]
    raw_filename: str | None = f.filename
    if not raw_filename or raw_filename == "":
        return jsonify({"error": "No file selected"}), 400
    if not allowed_file(raw_filename):
        return jsonify({"error": "File type not allowed"}), 400

    patient_id_str = request.form.get("patient_id", "")
    if not patient_id_str:
        return jsonify({"error": "patient_id is required"}), 400
    visit_id_str = request.form.get("visit_id") or None
    file_type    = request.form.get("file_type", "Other")
    description  = request.form.get("description", "")

    safe_name   = secure_filename(raw_filename)
    ts          = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    stored_name = f"{ts}_{safe_name}"
    filepath    = os.path.join(UPLOAD_FOLDER, "medical_files", stored_name)
    f.save(filepath)
    size = os.path.getsize(filepath)
    ext  = safe_name.rsplit(".", 1)[-1].lower() if "." in safe_name else ""

    conn = get_db(); cur = conn.cursor()
    try:
        cur.execute("""
            INSERT INTO MedicalFiles
                (PatientID, VisitID, UploadedBy, FileType, FileName, FileExtension, FilePath, FileSize, Description)
            OUTPUT INSERTED.FileID
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (int(patient_id_str), int(visit_id_str) if visit_id_str else None,
              int(user["user_id"]), str(file_type), safe_name, ext, filepath, size, description))
        row = cur.fetchone()
        if row is None:
            raise RuntimeError("Insert failed")
        conn.commit()
        return jsonify({"message": "File uploaded successfully", "file_id": row[0]}), 201
    except Exception as exc:
        conn.rollback()
        if os.path.exists(filepath):
            os.remove(filepath)
        return jsonify({"error": str(exc)}), 500
    finally:
        cur.close(); conn.close()


@app.route("/api/files/patient/<int:pid>", methods=["GET"])
@login_required
def get_patient_files(pid: int):
    conn = get_db(); cur = conn.cursor()
    try:
        cur.execute("EXEC sp_GetPatientFiles ?", pid)
        return jsonify([row_to_dict(cur, r) for r in cur.fetchall()])
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500
    finally:
        cur.close(); conn.close()


@app.route("/api/files/download/<int:fid>", methods=["GET"])
@login_required
def download_file(fid: int):
    conn = get_db(); cur = conn.cursor()
    try:
        cur.execute("SELECT FilePath, FileName FROM MedicalFiles WHERE FileID = ?", fid)
        row = cur.fetchone()
        if row is None:
            return jsonify({"error": "File record not found"}), 404
        filepath: str = str(row[0])
        filename: str = str(row[1])
        if not os.path.exists(filepath):
            return jsonify({"error": "Physical file missing on server"}), 404
        return send_file(filepath, as_attachment=True, download_name=filename)
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500
    finally:
        cur.close(); conn.close()

# ═══════════════════════════════════════════════
#  SCANS (Radiologist + Doctor)
# ═══════════════════════════════════════════════
SCAN_TYPES = {"X-Ray","MRI","CT Scan","Ultrasound","PET Scan","Mammography","Fluoroscopy"}

@app.route("/api/scans/upload", methods=["POST"])
@login_required
def upload_scan():
    user = current_user()
    if user.get("role") not in ("Radiologist","Doctor","Admin"):
        return jsonify({"error": "Access denied"}), 403
    if "file" not in request.files:
        return jsonify({"error": "No file part"}), 400
    f = request.files["file"]
    raw_filename: str | None = f.filename
    if not raw_filename or raw_filename == "":
        return jsonify({"error": "No file selected"}), 400
    if not allowed_file(raw_filename):
        return jsonify({"error": "File type not allowed"}), 400
    patient_id_str = request.form.get("patient_id", "")
    if not patient_id_str:
        return jsonify({"error": "patient_id is required"}), 400
    scan_type   = request.form.get("scan_type", "X-Ray")
    if scan_type not in SCAN_TYPES:
        scan_type = "X-Ray"
    description = request.form.get("description", "")
    safe_name   = secure_filename(raw_filename)
    ts          = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    stored_name = f"scan_{ts}_{safe_name}"
    filepath    = os.path.join(UPLOAD_FOLDER, "medical_files", stored_name)
    f.save(filepath)
    size = os.path.getsize(filepath)
    ext  = safe_name.rsplit(".", 1)[-1].lower() if "." in safe_name else ""
    conn = get_db(); cur = conn.cursor()
    try:
        cur.execute("""
            INSERT INTO MedicalFiles
                (PatientID, UploadedBy, FileType, FileName, FileExtension, FilePath, FileSize, Description)
            OUTPUT INSERTED.FileID
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (int(patient_id_str), int(user["user_id"]),
              scan_type, safe_name, ext, filepath, size, description))
        row = cur.fetchone()
        if row is None:
            raise RuntimeError("Insert failed")
        conn.commit()
        return jsonify({"message": "Scan uploaded successfully", "file_id": row[0]}), 201
    except Exception as exc:
        conn.rollback()
        if os.path.exists(filepath):
            os.remove(filepath)
        return jsonify({"error": str(exc)}), 500
    finally:
        cur.close(); conn.close()


@app.route("/api/scans/patient/<int:pid>", methods=["GET"])
@login_required
def get_patient_scans(pid: int):
    user = current_user()
    if user.get("role") == "Patient" and user.get("patient_id") != pid:
        return jsonify({"error": "Access denied"}), 403
    conn = get_db(); cur = conn.cursor()
    try:
        placeholders = ",".join("?" * len(SCAN_TYPES))
        cur.execute(f"""
            SELECT f.FileID, f.FileType, f.FileName, f.FileSize, f.Description, f.UploadedAt,
                   u.Username AS UploadedByUsername, p.PatientName
            FROM   MedicalFiles f
            LEFT JOIN Users    u ON f.UploadedBy = u.UserID
            LEFT JOIN Patients p ON f.PatientID  = p.PatientID
            WHERE  f.PatientID = ? AND f.FileType IN ({placeholders})
            ORDER BY f.UploadedAt DESC
        """, pid, *list(SCAN_TYPES))
        return jsonify([row_to_dict(cur, r) for r in cur.fetchall()])
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500
    finally:
        cur.close(); conn.close()


@app.route("/api/scans/mine", methods=["GET"])
@login_required
def get_my_scans():
    user = current_user()
    conn = get_db(); cur = conn.cursor()
    try:
        cur.execute("""
            SELECT f.FileID, f.FileType, f.FileName, f.FileSize, f.Description, f.UploadedAt,
                   p.PatientName, p.BloodGroup
            FROM MedicalFiles f JOIN Patients p ON f.PatientID = p.PatientID
            WHERE f.UploadedBy = ? ORDER BY f.UploadedAt DESC
        """, int(user["user_id"]))
        return jsonify([row_to_dict(cur, r) for r in cur.fetchall()])
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500
    finally:
        cur.close(); conn.close()

# ═══════════════════════════════════════════════
#  ADMIN — CREDENTIAL MANAGEMENT
# ═══════════════════════════════════════════════
@app.route("/api/admin/patients-without-credentials", methods=["GET"])
@login_required
def patients_without_credentials():
    user = current_user()
    if user.get("role") != "Admin":
        return jsonify({"error": "Admin access required"}), 403
    conn = get_db(); cur = conn.cursor()
    try:
        cur.execute("""
            SELECT p.PatientID, p.PatientName, p.Email, p.Gender, p.PhoneNumber, p.BloodGroup, p.CreatedAt
            FROM   Patients p
            LEFT JOIN Users u ON u.PatientID = p.PatientID AND u.IsActive = 1
            WHERE  p.IsActive = 1 AND u.UserID IS NULL
            ORDER BY p.CreatedAt DESC
        """)
        return jsonify([row_to_dict(cur, r) for r in cur.fetchall()])
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500
    finally:
        cur.close(); conn.close()


@app.route("/api/admin/assign-credentials", methods=["POST"])
@login_required
def assign_credentials():
    user = current_user()
    if user.get("role") != "Admin":
        return jsonify({"error": "Admin access required"}), 403
    data       = request.get_json(silent=True) or {}
    patient_id = data.get("patient_id")
    username   = str(data.get("username") or "").strip()
    password   = str(data.get("password") or "")
    if not patient_id or not username or not password:
        return jsonify({"error": "patient_id, username and password are required"}), 400
    conn = get_db(); cur = conn.cursor()
    try:
        cur.execute("SELECT Email FROM Patients WHERE PatientID = ? AND IsActive = 1", int(patient_id))
        row = cur.fetchone()
        if row is None:
            return jsonify({"error": "Patient not found"}), 404
        email: str = str(row[0])
        cur.execute("SELECT 1 FROM Users WHERE Username = ?", username)
        if cur.fetchone():
            return jsonify({"error": "Username already taken"}), 409
        cur.execute("""
            INSERT INTO Users (Username, PasswordHash, Email, Role, PatientID)
            VALUES (?, ?, ?, 'Patient', ?)
        """, (username, hash_password(password), email, int(patient_id)))
        conn.commit()
        return jsonify({"message": f"Credentials assigned to patient #{patient_id}"}), 201
    except Exception as exc:
        conn.rollback(); return jsonify({"error": str(exc)}), 500
    finally:
        cur.close(); conn.close()

# ═══════════════════════════════════════════════
#  ADMIN — BULK IMPORT
# ═══════════════════════════════════════════════
@app.route("/api/admin/import-patients", methods=["POST"])
@login_required
def import_patients():
    """
    Bulk-import patients from CSV/Excel.

    Required columns : Name, Email, Gender, DOB, Phone, Address, BloodGroup
    Optional columns : Username, Password, EmergencyContactName, EmergencyContact

    • If Username + Password are present in the row the patient gets a login
      account created immediately (no need for a separate "Assign Credentials"
      step).
    • Duplicate emails are skipped.
    • Password is stored as SHA-256 hash (same as register endpoint).
    """
    user = current_user()
    if user.get("role") != "Admin":
        return jsonify({"error": "Admin access required"}), 403
    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400
    f = request.files["file"]
    raw_filename: str | None = f.filename
    if not raw_filename or raw_filename == "":
        return jsonify({"error": "No file selected"}), 400
    fname = secure_filename(raw_filename)
    if not fname.lower().endswith((".xlsx", ".xls", ".csv")):
        return jsonify({"error": "Only Excel / CSV files are accepted"}), 400

    ts       = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    filepath = os.path.join(UPLOAD_FOLDER, "patient_imports", f"{ts}_{fname}")
    f.save(filepath)
    try:
        df = pd.read_csv(filepath) if filepath.endswith(".csv") else pd.read_excel(filepath)
    except Exception as exc:
        return jsonify({"error": f"Could not parse file: {exc}"}), 400

    required_cols = ["Name", "Email", "Gender", "DOB", "Phone", "Address", "BloodGroup"]
    missing_cols  = [c for c in required_cols if c not in df.columns]
    if missing_cols:
        return jsonify({"error": f"Missing columns: {', '.join(missing_cols)}"}), 400

    conn = get_db(); cur = conn.cursor()
    total = len(df)
    successful = 0; failed = 0; creds_created = 0
    errors: list[str] = []

    for raw_idx, row in df.iterrows():
        row_num = int(raw_idx) + 2  # type: ignore
        try:
            email_val = str(row.get("Email") or "").strip().lower()
            if not email_val:
                errors.append(f"Row {row_num}: Email is empty — skipped"); failed += 1; continue

            # ── Skip duplicate patients ──────────────────────────────────
            cur.execute("SELECT PatientID FROM Patients WHERE LOWER(Email) = ? AND IsActive = 1", email_val)
            existing = cur.fetchone()
            if existing:
                errors.append(f"Row {row_num}: {email_val} already exists — skipped")
                failed += 1; continue

            # ── Insert patient ───────────────────────────────────────────
            cur.execute("""
                INSERT INTO Patients
                    (PatientName, Email, Gender, DateOfBirth, PhoneNumber,
                     Address, BloodGroup, EmergencyContact, EmergencyContactName)
                OUTPUT INSERTED.PatientID
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                str(row.get("Name")  or "").strip(),
                email_val,
                str(row.get("Gender") or "").strip(),
                str(row.get("DOB")    or "").strip() or None,
                str(row.get("Phone")  or "").strip(),
                str(row.get("Address")    or "").strip(),
                str(row.get("BloodGroup") or "O+").strip(),
                str(row.get("EmergencyContact")     or "").strip() or None,
                str(row.get("EmergencyContactName") or "").strip() or None,
            ))
            pid_row = cur.fetchone()
            if pid_row is None:
                raise RuntimeError("Patient INSERT failed")
            patient_id: int = pid_row[0]

            # ── Optionally create login credentials ──────────────────────
            raw_user = str(row.get("Username") or "").strip()
            raw_pass = str(row.get("Password") or "").strip()
            if raw_user and raw_pass:
                # Check username not already taken
                cur.execute("SELECT 1 FROM Users WHERE Username = ?", raw_user)
                if cur.fetchone():
                    errors.append(
                        f"Row {row_num}: Username '{raw_user}' already taken — "
                        f"patient imported but no credentials created"
                    )
                else:
                    cur.execute("""
                        INSERT INTO Users (Username, PasswordHash, Email, Role, PatientID)
                        VALUES (?, ?, ?, 'Patient', ?)
                    """, (raw_user, hash_password(raw_pass), email_val, patient_id))
                    creds_created += 1

            successful += 1

        except Exception as exc:
            errors.append(f"Row {row_num}: {exc}"); failed += 1

    try:
        conn.commit()
        cur.execute("""
            INSERT INTO ImportHistory
                (ImportedBy, FileName, TotalRecords, SuccessfulRecords, FailedRecords, ErrorLog)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (int(user["user_id"]), fname, total, successful, failed, "\n".join(errors)))
        conn.commit()
    except Exception as exc:
        conn.rollback()
        return jsonify({"error": f"Commit failed: {exc}"}), 500
    finally:
        cur.close(); conn.close()

    return jsonify({
        "message":       "Import completed",
        "total":         total,
        "successful":    successful,
        "failed":        failed,
        "creds_created": creds_created,
        "errors":        errors,
    })

# ═══════════════════════════════════════════════
#  LAB TESTS
# ═══════════════════════════════════════════════

@app.route("/api/lab-tests", methods=["GET"])
@login_required
def get_lab_tests():
    """
    Returns lab tests for the logged-in doctor's patients.
    Doctors see tests for their visits; Admin sees all.
    """
    user      = current_user()
    role      = user.get("role", "")
    doctor_id = user.get("doctor_id")

    conn = get_db(); cur = conn.cursor()
    try:
        if role == "Admin":
            cur.execute("""
                SELECT lt.TestID, lt.VisitID, lt.TestName, lt.TestType,
                       lt.Status, lt.Results, lt.ResultDate, lt.CreatedAt,
                       v.VisitDate, p.PatientName
                FROM   LabTests lt
                JOIN   Visits v  ON lt.VisitID   = v.VisitID
                JOIN   Patients p ON v.PatientID = p.PatientID
                ORDER  BY lt.CreatedAt DESC
            """)
        elif role == "Doctor" and doctor_id:
            cur.execute("""
                SELECT lt.TestID, lt.VisitID, lt.TestName, lt.TestType,
                       lt.Status, lt.Results, lt.ResultDate, lt.CreatedAt,
                       v.VisitDate, p.PatientName
                FROM   LabTests lt
                JOIN   Visits v   ON lt.VisitID   = v.VisitID
                JOIN   Patients p ON v.PatientID  = p.PatientID
                WHERE  v.DoctorID = ?
                ORDER  BY lt.CreatedAt DESC
            """, int(doctor_id))
        else:
            return jsonify({"error": "Access denied"}), 403

        rows = cur.fetchall()
        return jsonify([row_to_dict(cur, r) for r in rows])
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500
    finally:
        cur.close(); conn.close()


@app.route("/api/lab-tests", methods=["POST"])
@login_required
def add_lab_test():
    """Doctor orders a new lab test for a visit."""
    user = current_user()
    if user.get("role") not in ("Doctor", "Admin"):
        return jsonify({"error": "Only doctors can order lab tests"}), 403

    data = request.get_json(silent=True) or {}
    visit_id  = data.get("visit_id")
    test_name = data.get("test_name")
    test_type = data.get("test_type", "Blood Test")

    if not visit_id or not test_name:
        return jsonify({"error": "visit_id and test_name are required"}), 400

    conn = get_db(); cur = conn.cursor()
    try:
        cur.execute("""
            INSERT INTO LabTests (VisitID, TestName, TestType, Status)
            OUTPUT INSERTED.TestID
            VALUES (?, ?, ?, 'Pending')
        """, (int(visit_id), str(test_name), str(test_type)))
        row = cur.fetchone()
        if row is None:
            raise RuntimeError("Insert failed")
        conn.commit()
        return jsonify({"message": "Lab test ordered", "test_id": row[0]}), 201
    except Exception as exc:
        conn.rollback()
        return jsonify({"error": str(exc)}), 500
    finally:
        cur.close(); conn.close()


@app.route("/api/lab-tests/<int:tid>/result", methods=["PUT"])
@login_required
def update_lab_result(tid: int):
    """Doctor enters results for a completed lab test."""
    user = current_user()
    if user.get("role") not in ("Doctor", "Admin"):
        return jsonify({"error": "Only doctors can update lab results"}), 403

    data        = request.get_json(silent=True) or {}
    results     = data.get("results", "")
    result_date = data.get("result_date")

    conn = get_db(); cur = conn.cursor()
    try:
        cur.execute("""
            UPDATE LabTests
            SET    Results    = ?,
                   ResultDate = ?,
                   Status     = 'Completed'
            WHERE  TestID = ?
        """, (str(results), result_date, tid))
        if cur.rowcount == 0:
            return jsonify({"error": "Test not found"}), 404
        conn.commit()
        return jsonify({"message": "Lab result updated"})
    except Exception as exc:
        conn.rollback()
        return jsonify({"error": str(exc)}), 500
    finally:
        cur.close(); conn.close()


@app.route("/api/lab-tests/<int:tid>", methods=["DELETE"])
@login_required
def delete_lab_test(tid: int):
    """Cancel / delete a lab test (Doctor or Admin only)."""
    user = current_user()
    if user.get("role") not in ("Doctor", "Admin"):
        return jsonify({"error": "Access denied"}), 403

    conn = get_db(); cur = conn.cursor()
    try:
        cur.execute("DELETE FROM LabTests WHERE TestID = ?", tid)
        if cur.rowcount == 0:
            return jsonify({"error": "Test not found"}), 404
        conn.commit()
        return jsonify({"message": "Lab test deleted"})
    except Exception as exc:
        conn.rollback()
        return jsonify({"error": str(exc)}), 500
    finally:
        cur.close(); conn.close()

# ═══════════════════════════════════════════════
#  1-YEAR DATA RETENTION — purge old patient records
# ═══════════════════════════════════════════════

@app.route("/api/admin/patients/<int:pid>/purge-old-data", methods=["DELETE"])
@login_required
def purge_old_patient_data(pid: int):
    """
    Admin-only: delete visits, diagnoses, prescriptions, lab tests, and
    chronic-progress entries for a patient that are older than 1 year.
    Medical files are NOT deleted (they may be needed for legal purposes).
    Returns counts of purged records by type.
    """
    user = current_user()
    if user.get("role") != "Admin":
        return jsonify({"error": "Admin access required"}), 403

    cutoff = (datetime.datetime.utcnow() - datetime.timedelta(days=365)).strftime("%Y-%m-%d")
    purged: dict = {}

    conn = get_db(); cur = conn.cursor()
    try:
        # 1. Find old visits for this patient
        cur.execute("""
            SELECT VisitID FROM Visits
            WHERE PatientID = ? AND CAST(VisitDate AS DATE) < ?
        """, (pid, cutoff))
        old_visit_ids = [r[0] for r in cur.fetchall()]

        if old_visit_ids:
            placeholders = ",".join("?" * len(old_visit_ids))

            # Delete lab tests tied to old visits
            cur.execute(f"DELETE FROM LabTests WHERE VisitID IN ({placeholders})", old_visit_ids)
            purged["lab_tests"] = cur.rowcount

            # Delete prescriptions tied to old visits
            cur.execute(f"DELETE FROM Prescriptions WHERE VisitID IN ({placeholders})", old_visit_ids)
            purged["prescriptions"] = cur.rowcount

            # Delete diagnoses tied to old visits
            cur.execute(f"DELETE FROM Diagnoses WHERE VisitID IN ({placeholders})", old_visit_ids)
            purged["diagnoses"] = cur.rowcount

            # Delete the visits themselves
            cur.execute(f"DELETE FROM Visits WHERE VisitID IN ({placeholders})", old_visit_ids)
            purged["visits"] = cur.rowcount
        else:
            purged["visits"] = purged["diagnoses"] = purged["prescriptions"] = purged["lab_tests"] = 0

        # 2. Delete chronic progress entries older than 1 year
        cur.execute("""
            DELETE FROM ChronicDiseaseProgress
            WHERE PatientID = ? AND CAST(RecordDate AS DATE) < ?
        """, (pid, cutoff))
        purged["chronic_progress"] = cur.rowcount

        # 3. Delete completed/cancelled appointments older than 1 year
        cur.execute("""
            DELETE FROM Appointments
            WHERE PatientID = ?
              AND Status IN ('Completed','Cancelled')
              AND CAST(RequestedDate AS DATE) < ?
        """, (pid, cutoff))
        purged["appointments"] = cur.rowcount

        conn.commit()

        total = sum(purged.values())
        return jsonify({
            "message": f"Purged {total} records older than 1 year ({cutoff})",
            "purged":  purged,
            "cutoff":  cutoff,
        })
    except Exception as exc:
        conn.rollback()
        return jsonify({"error": str(exc)}), 500
    finally:
        cur.close(); conn.close()


# ═══════════════════════════════════════════════
#  APPOINTMENTS
# ═══════════════════════════════════════════════

@app.route("/api/appointments", methods=["GET"])
@login_required
def get_appointments():
    """
    Patient   → own appointments only
    Receptionist / Admin → all appointments, optional ?status=Pending
    Doctor    → own confirmed/upcoming appointments
    """
    user      = current_user()
    role      = user.get("role", "")
    status    = request.args.get("status")        # optional filter

    conn = get_db(); cur = conn.cursor()
    try:
        if role == "Patient":
            pid = user.get("patient_id")
            if not pid:
                return jsonify({"error": "Not a patient account"}), 403
            cur.execute("EXEC sp_GetPatientAppointments ?", int(pid))

        elif role == "Doctor":
            did = user.get("doctor_id")
            if not did:
                return jsonify({"error": "Not a doctor account"}), 403
            cur.execute("EXEC sp_GetDoctorAppointments ?", int(did))

        elif role in ("Receptionist", "Admin"):
            cur.execute("EXEC sp_GetAllAppointments ?", status)

        else:
            return jsonify({"error": "Access denied"}), 403

        rows = cur.fetchall()
        return jsonify([row_to_dict(cur, r) for r in rows])

    except Exception as exc:
        return jsonify({"error": str(exc)}), 500
    finally:
        cur.close(); conn.close()


@app.route("/api/appointments", methods=["POST"])
@login_required
def book_appointment():
    """Patient books an appointment request (no doctor assigned yet)."""
    user = current_user()
    if user.get("role") != "Patient":
        return jsonify({"error": "Only patients can book appointments"}), 403

    patient_id = user.get("patient_id")
    if not patient_id:
        return jsonify({"error": "Patient ID not found in token"}), 403

    data           = request.get_json(silent=True) or {}
    requested_date = data.get("requested_date")
    time_slot      = data.get("time_slot", "")
    reason         = data.get("reason", "")
    patient_notes  = data.get("patient_notes", "")
    preferred_doc  = data.get("preferred_doctor_id")   # optional — patient preference

    if not requested_date:
        return jsonify({"error": "requested_date is required"}), 400

    conn = get_db(); cur = conn.cursor()
    try:
        cur.execute("""
            INSERT INTO Appointments
                (PatientID, DoctorID, RequestedDate, TimeSlot,
                 Status, Reason, PatientNotes)
            OUTPUT INSERTED.AppointmentID
            VALUES (?, ?, ?, ?, 'Pending', ?, ?)
        """, (
            int(patient_id),
            int(preferred_doc) if preferred_doc else None,
            requested_date,
            str(time_slot),
            str(reason),
            str(patient_notes),
        ))
        row = cur.fetchone()
        if row is None:
            raise RuntimeError("Insert failed")
        conn.commit()
        return jsonify({
            "message": "Appointment request submitted. Our receptionist will confirm shortly.",
            "appointment_id": row[0]
        }), 201
    except Exception as exc:
        conn.rollback()
        return jsonify({"error": str(exc)}), 500
    finally:
        cur.close(); conn.close()


@app.route("/api/appointments/<int:aid>/assign", methods=["PUT"])
@login_required
def assign_appointment(aid: int):
    """
    Receptionist (or Admin) assigns a doctor and confirms the appointment.
    """
    user = current_user()
    if user.get("role") not in ("Receptionist", "Admin"):
        return jsonify({"error": "Only receptionists can assign doctors"}), 403

    data       = request.get_json(silent=True) or {}
    doctor_id  = data.get("doctor_id")
    time_slot  = data.get("time_slot")
    rec_notes  = data.get("receptionist_notes", "")
    status     = data.get("status", "Confirmed")   # allow setting to Cancelled too

    if status == "Confirmed" and not doctor_id:
        return jsonify({"error": "doctor_id is required when confirming"}), 400

    # Resolve the receptionist's own ID (if role is Receptionist)
    rec_id: int | None = None
    if user.get("role") == "Receptionist":
        conn0 = get_db(); cur0 = conn0.cursor()
        try:
            cur0.execute("""
                SELECT r.ReceptionistID
                FROM Receptionists r
                JOIN Users u ON u.ReceptionistID = r.ReceptionistID
                WHERE u.UserID = ?
            """, int(user["user_id"]))
            row0 = cur0.fetchone()
            if row0:
                rec_id = row0[0]
        finally:
            cur0.close(); conn0.close()

    conn = get_db(); cur = conn.cursor()
    try:
        cur.execute("""
            UPDATE Appointments
            SET DoctorID          = ?,
                Status            = ?,
                TimeSlot          = COALESCE(?, TimeSlot),
                ReceptionistNotes = ?,
                HandledBy         = COALESCE(?, HandledBy),
                UpdatedAt         = GETDATE()
            WHERE AppointmentID = ?
        """, (
            int(doctor_id) if doctor_id else None,
            str(status),
            str(time_slot) if time_slot else None,
            str(rec_notes),
            rec_id,
            aid,
        ))
        if cur.rowcount == 0:
            return jsonify({"error": "Appointment not found"}), 404
        conn.commit()
        return jsonify({"message": f"Appointment {status.lower()} successfully"})
    except Exception as exc:
        conn.rollback()
        return jsonify({"error": str(exc)}), 500
    finally:
        cur.close(); conn.close()


@app.route("/api/appointments/<int:aid>/cancel", methods=["PUT"])
@login_required
def cancel_appointment(aid: int):
    """Patient cancels their own pending appointment."""
    user = current_user()
    conn = get_db(); cur = conn.cursor()
    try:
        # Patients can only cancel their own
        if user.get("role") == "Patient":
            cur.execute("""
                UPDATE Appointments
                SET Status = 'Cancelled', UpdatedAt = GETDATE()
                WHERE AppointmentID = ? AND PatientID = ? AND Status = 'Pending'
            """, (aid, int(user.get("patient_id") or 0)))
        else:
            cur.execute("""
                UPDATE Appointments
                SET Status = 'Cancelled', UpdatedAt = GETDATE()
                WHERE AppointmentID = ?
            """, aid)

        if cur.rowcount == 0:
            return jsonify({"error": "Appointment not found or cannot be cancelled"}), 404
        conn.commit()
        return jsonify({"message": "Appointment cancelled"})
    except Exception as exc:
        conn.rollback()
        return jsonify({"error": str(exc)}), 500
    finally:
        cur.close(); conn.close()


@app.route("/api/appointments/<int:aid>/complete", methods=["PUT"])
@login_required
def complete_appointment(aid: int):
    """Doctor marks their appointment as completed."""
    user = current_user()
    if user.get("role") not in ("Doctor", "Admin", "Receptionist"):
        return jsonify({"error": "Access denied"}), 403
    conn = get_db(); cur = conn.cursor()
    try:
        cur.execute("""
            UPDATE Appointments
            SET Status = 'Completed', UpdatedAt = GETDATE()
            WHERE AppointmentID = ?
        """, aid)
        if cur.rowcount == 0:
            return jsonify({"error": "Appointment not found"}), 404
        conn.commit()
        return jsonify({"message": "Appointment marked as completed"})
    except Exception as exc:
        conn.rollback()
        return jsonify({"error": str(exc)}), 500
    finally:
        cur.close(); conn.close()


# ─────────────────────────────────────────────
#  RECEPTIONISTS list (for admin)
# ─────────────────────────────────────────────
@app.route("/api/receptionists", methods=["GET"])
@login_required
def get_receptionists():
    user = current_user()
    if user.get("role") != "Admin":
        return jsonify({"error": "Admin access required"}), 403
    conn = get_db(); cur = conn.cursor()
    try:
        cur.execute("""
            SELECT ReceptionistID, ReceptionistName, Email, PhoneNumber, LicenseNumber, CreatedAt
            FROM Receptionists WHERE IsActive = 1 ORDER BY ReceptionistName
        """)
        return jsonify([row_to_dict(cur, r) for r in cur.fetchall()])
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500
    finally:
        cur.close(); conn.close()




# ═══════════════════════════════════════════════
#  ANALYTICS — 360° Patient Longitudinal View
# ═══════════════════════════════════════════════

@app.route("/api/analytics/frequent-flyers", methods=["GET"])
@login_required
def frequent_flyers():
    """
    Patients with > threshold visits in the last N months.
    Query params: ?threshold=3&months=6
    Returns visit count, span, most frequent complaint, chronic flag.
    """
    user = current_user()
    if user.get("role") not in ("Doctor", "Admin"):
        return jsonify({"error": "Access denied"}), 403

    threshold = int(request.args.get("threshold", 3))
    months    = int(request.args.get("months",    6))

    conn = get_db(); cur = conn.cursor()
    try:
        cur.execute("""
            SELECT
                p.PatientID,
                p.PatientName,
                p.BloodGroup,
                p.PhoneNumber,
                p.Gender,
                COUNT(v.VisitID)                               AS VisitCount,
                MIN(CAST(v.VisitDate AS DATE))                 AS FirstVisit,
                MAX(CAST(v.VisitDate AS DATE))                 AS LastVisit,
                DATEDIFF(day,
                    MIN(CAST(v.VisitDate AS DATE)),
                    MAX(CAST(v.VisitDate AS DATE)))             AS SpanDays,
                (SELECT TOP 1 v2.ReasonForVisit
                 FROM   Visits v2
                 WHERE  v2.PatientID = p.PatientID
                   AND  v2.VisitDate >= DATEADD(month, -?, GETDATE())
                 GROUP  BY v2.ReasonForVisit
                 ORDER  BY COUNT(*) DESC)                      AS MostFrequentComplaint,
                CASE WHEN EXISTS (
                    SELECT 1 FROM Diagnoses d2
                    JOIN   Visits v3 ON d2.VisitID = v3.VisitID
                    WHERE  v3.PatientID = p.PatientID
                      AND  d2.IsChronic = 1
                ) THEN 1 ELSE 0 END                            AS HasChronic
            FROM   Patients p
            JOIN   Visits   v  ON v.PatientID = p.PatientID
            WHERE  v.VisitDate  >= DATEADD(month, -?, GETDATE())
              AND  p.IsActive   = 1
            GROUP  BY p.PatientID, p.PatientName,
                      p.BloodGroup, p.PhoneNumber, p.Gender
            HAVING COUNT(v.VisitID) > ?
            ORDER  BY VisitCount DESC
        """, (months, months, threshold))
        return jsonify([row_to_dict(cur, r) for r in cur.fetchall()])
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500
    finally:
        cur.close(); conn.close()


@app.route("/api/analytics/patient-diagnosis-summary/<int:pid>",
           methods=["GET"])
@login_required
def patient_diagnosis_summary(pid: int):
    """
    Diagnoses ranked by frequency for one patient over the past year.
    Returns DiagnosisName, Frequency, LastSeen, WorstSeverity, IsChronic.
    """
    user = current_user()
    if user.get("role") not in ("Doctor", "Admin"):
        return jsonify({"error": "Access denied"}), 403

    conn = get_db(); cur = conn.cursor()
    try:
        cur.execute("""
            SELECT
                d.DiagnosisName,
                COUNT(*)                              AS Frequency,
                MAX(CAST(v.VisitDate AS DATE))        AS LastSeen,
                MAX(d.Severity)                       AS WorstSeverity,
                MAX(CAST(d.IsChronic AS TINYINT))     AS IsChronic
            FROM   Diagnoses d
            JOIN   Visits v ON d.VisitID = v.VisitID
            WHERE  v.PatientID = ?
              AND  v.VisitDate >= DATEADD(year, -1, GETDATE())
            GROUP  BY d.DiagnosisName
            ORDER  BY Frequency DESC
        """, pid)
        return jsonify([row_to_dict(cur, r) for r in cur.fetchall()])
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500
    finally:
        cur.close(); conn.close()


@app.route("/api/analytics/visit-trend/<int:pid>", methods=["GET"])
@login_required
def patient_visit_trend(pid: int):
    """
    Monthly visit counts for a patient over the past 12 months.
    Used by the admin patient detail bar chart.
    """
    user = current_user()
    if user.get("role") not in ("Doctor", "Admin"):
        return jsonify({"error": "Access denied"}), 403

    conn = get_db(); cur = conn.cursor()
    try:
        cur.execute("""
            SELECT
                FORMAT(VisitDate, 'yyyy-MM')  AS MonthKey,
                FORMAT(VisitDate, 'MMM yy')   AS MonthLabel,
                COUNT(*)                       AS VisitCount
            FROM   Visits
            WHERE  PatientID = ?
              AND  VisitDate >= DATEADD(month, -12, GETDATE())
            GROUP  BY FORMAT(VisitDate, 'yyyy-MM'),
                      FORMAT(VisitDate, 'MMM yy')
            ORDER  BY MonthKey ASC
        """, pid)
        return jsonify([row_to_dict(cur, r) for r in cur.fetchall()])
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500
    finally:
        cur.close(); conn.close()


# ═══════════════════════════════════════════════
#  BULK VISIT HISTORY IMPORT (with deduplication)
# ═══════════════════════════════════════════════

def _find_or_create_patient(cur: pyodbc.Cursor, row: dict) -> tuple:
    """
    Match patient by Email first, then (PatientName + DOB) fallback.
    Returns (PatientID: int, was_created: bool).
    Never creates a duplicate profile.
    """
    email = str(row.get("Email") or "").strip().lower()
    name  = str(row.get("Name")  or "").strip()
    dob   = str(row.get("DOB")   or "").strip()

    # 1️⃣ Primary match: email (unique in DB)
    if email:
        cur.execute(
            "SELECT PatientID FROM Patients WHERE LOWER(Email) = ? AND IsActive = 1",
            email,
        )
        r = cur.fetchone()
        if r:
            return r[0], False

    # 2️⃣ Fallback: name + DOB
    if name and dob:
        cur.execute("""
            SELECT PatientID FROM Patients
            WHERE  PatientName = ?
              AND  CAST(DateOfBirth AS DATE) = TRY_CAST(? AS DATE)
              AND  IsActive = 1
        """, (name, dob))
        r = cur.fetchone()
        if r:
            return r[0], False

    # 3️⃣ Not found — create new patient record
    placeholder_email = (
        email
        if email
        else f"imported_{datetime.datetime.now().timestamp():.0f}@noemail.local"
    )
    cur.execute("""
        INSERT INTO Patients
            (PatientName, Email, Gender, DateOfBirth,
             PhoneNumber, Address, BloodGroup)
        OUTPUT INSERTED.PatientID
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (
        name or "Unknown",
        placeholder_email,
        str(row.get("Gender") or "").strip() or "Unknown",
        dob or None,
        str(row.get("Phone") or "").strip(),
        str(row.get("Address") or "").strip(),
        str(row.get("BloodGroup") or "O+").strip(),
    ))
    r2 = cur.fetchone()
    if r2 is None:
        raise RuntimeError(f"Failed to insert patient: {name}")
    return r2[0], True


@app.route("/api/admin/import-visits", methods=["POST"])
@login_required
def import_visit_history():
    """
    Bulk-import historical visits from an Excel/CSV file.

    Required columns : Email, VisitDate, ReasonForVisit, DoctorName
    Optional columns : Name, DOB, Gender, BloodGroup, Phone, Address,
                       Username, Password,           ← create login on import
                       DiagnosisName, IsChronic, Severity, Description,
                       MedicineName, Dosage, Frequency, Duration, Instructions,
                       BP, HeartRate, Temp, SpO2, Notes

    Deduplication
    ─────────────
    • Patients : Email → (Name+DOB) → create new
    • Visits   : skip if same PatientID+DoctorID+Date+Reason already exists
    • Credentials : only created when Username+Password supplied AND username
                    not already taken
    """
    user = current_user()
    if user.get("role") != "Admin":
        return jsonify({"error": "Admin access required"}), 403

    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400

    f             = request.files["file"]
    raw_filename: str | None = f.filename
    if not raw_filename or raw_filename == "":
        return jsonify({"error": "No file selected"}), 400

    fname = secure_filename(raw_filename)
    if not fname.lower().endswith((".xlsx", ".xls", ".csv")):
        return jsonify({"error": "Only Excel / CSV files are accepted"}), 400

    ts       = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    filepath = os.path.join(
        UPLOAD_FOLDER, "patient_imports", f"visits_{ts}_{fname}"
    )
    f.save(filepath)

    try:
        df = (
            pd.read_csv(filepath)
            if filepath.endswith(".csv")
            else pd.read_excel(filepath)
        )
    except Exception as exc:
        return jsonify({"error": f"Could not parse file: {exc}"}), 400

    required_cols = ["Email", "VisitDate", "ReasonForVisit", "DoctorName"]
    missing_cols  = [c for c in required_cols if c not in df.columns]
    if missing_cols:
        return jsonify({"error": f"Missing columns: {', '.join(missing_cols)}"}), 400

    import json as _json

    conn = get_db(); cur = conn.cursor()
    total            = len(df)
    successful       = 0
    failed           = 0
    patients_created = 0
    creds_created    = 0
    diagnoses_added  = 0
    rx_added         = 0
    errors: list[str] = []

    for raw_idx, row in df.iterrows():
        row_num  = int(raw_idx) + 2      # type: ignore
        row_dict = {
            k: (None if (isinstance(v, float) and _math.isnan(v)) else v)
            for k, v in row.items()
        }

        try:
            # ── Patient deduplication ──────────────────────────────────
            patient_id, was_created = _find_or_create_patient(cur, row_dict)
            if was_created:
                patients_created += 1

            # ── Optional: create credentials for this patient ──────────
            raw_user = str(row_dict.get("Username") or "").strip()
            raw_pass = str(row_dict.get("Password") or "").strip()
            if raw_user and raw_pass:
                cur.execute(
                    "SELECT 1 FROM Users WHERE PatientID = ? AND IsActive = 1",
                    patient_id,
                )
                already_has_creds = cur.fetchone()
                if not already_has_creds:
                    cur.execute("SELECT 1 FROM Users WHERE Username = ?", raw_user)
                    username_taken = cur.fetchone()
                    if username_taken:
                        errors.append(
                            f"Row {row_num}: Username '{raw_user}' already taken — "
                            f"visit imported but no credentials created"
                        )
                    else:
                        email_val = str(row_dict.get("Email") or "").strip().lower()
                        cur.execute("""
                            INSERT INTO Users (Username, PasswordHash, Email, Role, PatientID)
                            VALUES (?, ?, ?, 'Patient', ?)
                        """, (raw_user, hash_password(raw_pass), email_val, patient_id))
                        creds_created += 1

            # ── Doctor lookup ──────────────────────────────────────────
            doctor_name = str(row_dict.get("DoctorName") or "").strip()
            cur.execute(
                "SELECT DoctorID FROM Doctors WHERE DoctorName = ? AND IsActive = 1",
                doctor_name,
            )
            doc = cur.fetchone()
            if not doc:
                errors.append(
                    f"Row {row_num}: Doctor '{doctor_name}' not found — skipped"
                )
                failed += 1
                continue

            # ── Visit deduplication ────────────────────────────────────
            visit_date = str(row_dict.get("VisitDate") or "").strip()
            reason     = str(row_dict.get("ReasonForVisit") or "").strip()
            cur.execute("""
                SELECT VisitID FROM Visits
                WHERE  PatientID = ? AND DoctorID  = ?
                  AND  CAST(VisitDate AS DATE) = TRY_CAST(? AS DATE)
                  AND  ReasonForVisit = ?
            """, (patient_id, doc[0], visit_date, reason))
            if cur.fetchone():
                errors.append(
                    f"Row {row_num}: Duplicate visit for "
                    f"{row_dict.get('Email')} on {visit_date} — skipped"
                )
                failed += 1
                continue

            # ── Build vitals JSON ──────────────────────────────────────
            vitals: dict[str, str] = {}
            if row_dict.get("BP"):        vitals["bp"]    = str(row_dict["BP"])
            if row_dict.get("HeartRate"): vitals["pulse"] = str(row_dict["HeartRate"])
            if row_dict.get("Temp"):      vitals["temp"]  = str(row_dict["Temp"])
            if row_dict.get("SpO2"):      vitals["spo2"]  = str(row_dict["SpO2"])
            vital_str = _json.dumps(vitals) if vitals else ""

            # ── Insert Visit ───────────────────────────────────────────
            cur.execute("""
                INSERT INTO Visits
                    (PatientID, DoctorID, VisitDate,
                     ReasonForVisit, VitalSigns, Notes, Status)
                OUTPUT INSERTED.VisitID
                VALUES (?, ?, TRY_CAST(? AS DATETIME), ?, ?, ?, 'Completed')
            """, (
                patient_id, doc[0], visit_date, reason,
                vital_str,
                str(row_dict.get("Notes") or ""),
            ))
            visit_row = cur.fetchone()
            if visit_row is None:
                raise RuntimeError("Visit INSERT failed — no VisitID returned")
            visit_id = visit_row[0]

            # ── Insert Diagnosis (optional) ────────────────────────────
            if row_dict.get("DiagnosisName"):
                is_chronic = str(
                    row_dict.get("IsChronic") or "0"
                ).lower() in ("1", "true", "yes")
                cur.execute("""
                    INSERT INTO Diagnoses
                        (VisitID, DiagnosisName, Description, IsChronic, Severity)
                    VALUES (?, ?, ?, ?, ?)
                """, (
                    visit_id,
                    str(row_dict["DiagnosisName"]),
                    str(row_dict.get("Description") or ""),
                    is_chronic,
                    str(row_dict.get("Severity") or "Mild"),
                ))
                diagnoses_added += 1

            # ── Insert Prescription (optional) ─────────────────────────
            if row_dict.get("MedicineName"):
                cur.execute("""
                    INSERT INTO Prescriptions
                        (VisitID, MedicineName, Dosage,
                         Frequency, Duration, Instructions)
                    VALUES (?, ?, ?, ?, ?, ?)
                """, (
                    visit_id,
                    str(row_dict["MedicineName"]),
                    str(row_dict.get("Dosage")       or ""),
                    str(row_dict.get("Frequency")    or ""),
                    str(row_dict.get("Duration")     or ""),
                    str(row_dict.get("Instructions") or ""),
                ))
                rx_added += 1

            successful += 1

        except Exception as exc:
            errors.append(f"Row {row_num}: {exc}")
            failed += 1

    # ── Commit all inserts ─────────────────────────────────────────────
    try:
        conn.commit()
        cur.execute("""
            INSERT INTO ImportHistory
                (ImportedBy, FileName, TotalRecords,
                 SuccessfulRecords, FailedRecords, ErrorLog)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (
            int(user["user_id"]), fname, total,
            successful, failed, "\n".join(errors),
        ))
        conn.commit()
    except Exception as exc:
        conn.rollback()
        return jsonify({"error": f"Commit failed: {exc}"}), 500
    finally:
        cur.close(); conn.close()

    return jsonify({
        "message":          "Visit history import completed",
        "total":            total,
        "successful":       successful,
        "failed":           failed,
        "patients_created": patients_created,
        "creds_created":    creds_created,
        "diagnoses_added":  diagnoses_added,
        "rx_added":         rx_added,
        "errors":           errors,
    })


@app.route("/api/admin/import-template", methods=["GET"])
@login_required
def download_import_template():
    """
    Serve a ready-to-fill CSV template.
    ?type=patients  → patient profile + optional credentials columns
    ?type=visits    → full visit history + optional credentials columns
    """
    import io
    template_type = request.args.get("type", "patients")

    if template_type == "visits":
        headers = [
            # Patient identity (used for deduplication / auto-create)
            "Email", "Name", "DOB", "Gender", "BloodGroup", "Phone", "Address",
            # Optional credentials — fill to create login on import
            "Username", "Password",
            # Visit core
            "VisitDate", "ReasonForVisit", "DoctorName",
            # Diagnosis (optional)
            "DiagnosisName", "IsChronic", "Severity", "Description",
            # Prescription (optional)
            "MedicineName", "Dosage", "Frequency", "Duration", "Instructions",
            # Vitals (optional)
            "BP", "HeartRate", "Temp", "SpO2", "Notes",
        ]
        sample = [
            "rahul@email.com", "Rahul Mehta", "1990-01-15", "Male", "O+",
            "9876543210", "Mumbai",
            "rahul_p", "password123",           # ← credentials columns
            "2024-06-15", "BP follow-up", "Dr. Anil Kumar",
            "Hypertension", "1", "Moderate", "Persistent high BP on 3 readings",
            "Amlodipine", "5mg", "Once daily", "30 days", "Take with food",
            "140/90", "88", "98.4", "98%", "Patient reports mild dizziness",
        ]
    else:   # patients
        headers = [
            # Core demographics
            "Name", "Email", "Gender", "DOB", "Phone", "Address", "BloodGroup",
            # Emergency contact (optional)
            "EmergencyContactName", "EmergencyContact",
            # Credentials (optional) — fill to create login on import
            "Username", "Password",
        ]
        sample = [
            "John Doe", "john@email.com", "Male", "1990-01-15",
            "9876543210", "Mumbai", "O+",
            "Jane Doe", "9876500000",    # emergency contact
            "john_doe", "password123",  # ← credentials columns
        ]

    buf = io.StringIO()
    buf.write(",".join(headers) + "\n")
    buf.write(",".join(str(s) for s in sample) + "\n")
    buf.seek(0)

    return send_file(
        io.BytesIO(buf.getvalue().encode()),
        mimetype="text/csv",
        as_attachment=True,
        download_name=f"hms_{template_type}_template.csv",
    )


@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def serve_react(path: str):
    """
    Serve the built React app for ALL non-API routes.
    - If the file exists in static/dist/ (JS, CSS, assets), serve it directly.
    - Otherwise serve index.html so React Router handles the URL.
    """
    dist_dir = os.path.join(os.path.dirname(__file__), "static", "dist")

    # If no build exists yet, return a helpful message
    if not os.path.isdir(dist_dir):
        return (
            "<h2>Frontend not built yet.</h2>"
            "<p>Run: <code>cd hospital-frontend && npm run build</code></p>",
            503,
        )

    # Serve actual file if it exists (JS bundles, CSS, images, favicon…)
    target = os.path.join(dist_dir, path)
    if path and os.path.isfile(target):
        return send_from_directory(dist_dir, path)

    # Fall back to index.html for all React routes
    return send_from_directory(dist_dir, "index.html")

# ─────────────────────────────────────────────
#  Entry point
# ─────────────────────────────────────────────
if __name__ == "__main__":
    port  = int(os.getenv("HMS_PORT", "5000"))
    debug = os.getenv("HMS_DEBUG", "0") == "1"
    print(f"Hospital Management System  v3.2")
    print(f"DB  : {DB_SERVER} / {DB_NAME}")
    print(f"URL : http://localhost:{port}")
    print(f"Mode: {'DEBUG' if debug else 'PRODUCTION'}")
    app.run(debug=debug, host="0.0.0.0", port=port)