"""
Hospital Management System – Flask API  (app.py)
Run:  python app.py

All four type-checker errors fixed:
  1. request.user  → flask.g.user          (Request has no 'user' attr)
  2. None-check on f.filename before use   (str | None not assignable to str)
  3. allowed_file() now accepts str        (called only after None-guard)
  4. int(idx) cast in iterrows loop        (Hashable + 2 not supported)
"""

from flask import Flask, request, jsonify, send_file, g
from flask_cors import CORS
import jwt
import datetime
import os
import hashlib
from functools import wraps
from werkzeug.utils import secure_filename
import pandas as pd
import pyodbc

# ─────────────────────────────────────────────
#  App setup
# ─────────────────────────────────────────────
app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}})

SECRET_KEY       = "hospital_secret_key_change_in_production"
UPLOAD_FOLDER    = "uploads"
ALLOWED_EXT      = {"png", "jpg", "jpeg", "pdf", "dcm", "xlsx", "xls", "csv"}
MAX_UPLOAD_BYTES = 50 * 1024 * 1024

os.makedirs(os.path.join(UPLOAD_FOLDER, "medical_files"),   exist_ok=True)
os.makedirs(os.path.join(UPLOAD_FOLDER, "patient_imports"), exist_ok=True)

app.config["UPLOAD_FOLDER"]      = UPLOAD_FOLDER
app.config["MAX_CONTENT_LENGTH"] = MAX_UPLOAD_BYTES


# ─────────────────────────────────────────────
#  Database
# ─────────────────────────────────────────────
DB_SERVER = r"LAPTOP-OGJ9GR0I\SQLEXPRESS"   # ← change if needed
DB_NAME   = "HospitalManagementSystem"
DB_DRIVER = "{ODBC Driver 17 for SQL Server}"


def get_db() -> pyodbc.Connection:
    conn_str = (
        f"DRIVER={DB_DRIVER};"
        f"SERVER={DB_SERVER};"
        f"DATABASE={DB_NAME};"
        "Trusted_Connection=yes;"
    )
    conn = pyodbc.connect(conn_str, autocommit=False)
    return conn


def row_to_dict(cursor: pyodbc.Cursor, row: pyodbc.Row) -> dict:
    """Convert a pyodbc row to a JSON-safe dict."""
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
    """
    Accepts both hashed (new registrations) and plain-text (seed data).
    """
    return stored == hash_password(plain) or stored == plain


# ─────────────────────────────────────────────
#  File helper  (FIX #3 – accepts str, not str|None)
# ─────────────────────────────────────────────
def allowed_file(filename: str) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXT


# ─────────────────────────────────────────────
#  Auth decorator  (FIX #1 – store on flask.g, NOT request.user)
# ─────────────────────────────────────────────
def login_required(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        auth = request.headers.get("Authorization", "")
        if not auth.startswith("Bearer "):
            return jsonify({"error": "Token missing"}), 401
        try:
            token = auth.split(" ", 1)[1]
            # Store decoded payload on flask.g — never on request
            g.user = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        except jwt.ExpiredSignatureError:
            return jsonify({"error": "Token expired"}), 401
        except jwt.InvalidTokenError:
            return jsonify({"error": "Invalid token"}), 401
        return f(*args, **kwargs)
    return wrapper


# ─────────────────────────────────────────────
#  Convenience accessor  (FIX #2 – never None)
# ─────────────────────────────────────────────
def current_user() -> dict:
    """Return g.user; raises RuntimeError if login_required wasn't applied."""
    user: dict = g.get("user")  # type: ignore[assignment]
    if user is None:
        raise RuntimeError("current_user() called outside login_required context")
    return user


# ─────────────────────────────────────────────
#  Health-check
# ─────────────────────────────────────────────
@app.route("/")
def home():
    return jsonify({"message": "Hospital Management System API", "version": "2.2", "status": "Running"})


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

    conn = get_db()
    cur  = conn.cursor()
    try:
        cur.execute("""
            SELECT UserID, Username, PasswordHash, Email, Role,
                   PatientID, DoctorID, PharmacistID
            FROM   Users
            WHERE  Username = ? AND IsActive = 1
        """, username)
        row = cur.fetchone()

        if row is None or not verify_password(password, row.PasswordHash):
            return jsonify({"error": "Invalid username or password"}), 401

        payload = {
            "user_id":       row.UserID,
            "username":      row.Username,
            "email":         row.Email,
            "role":          row.Role,
            "patient_id":    row.PatientID,
            "doctor_id":     row.DoctorID,
            "pharmacist_id": row.PharmacistID,
            "exp": datetime.datetime.utcnow() + datetime.timedelta(hours=8),
        }
        token = jwt.encode(payload, SECRET_KEY, algorithm="HS256")

        cur.execute("UPDATE Users SET LastLogin = GETDATE() WHERE UserID = ?", row.UserID)
        conn.commit()

        return jsonify({"token": token, "role": row.Role, "username": row.Username})

    except Exception as exc:
        conn.rollback()
        return jsonify({"error": str(exc)}), 500
    finally:
        cur.close()
        conn.close()


@app.route("/api/auth/register", methods=["POST"])
def register():
    data = request.get_json(silent=True) or {}

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

    conn = get_db()
    cur  = conn.cursor()
    try:
        cur.execute("SELECT 1 FROM Users WHERE Username = ?", username)
        if cur.fetchone():
            return jsonify({"error": "Username already taken"}), 409

        cur.execute("SELECT 1 FROM Users WHERE Email = ?", data["email"])
        if cur.fetchone():
            return jsonify({"error": "Email already registered"}), 409

        cur.execute("SELECT 1 FROM Patients WHERE Email = ?", data["email"])
        if cur.fetchone():
            return jsonify({"error": "A patient with this email already exists"}), 409

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
        return jsonify({
            "message":    "Registration successful! Please log in.",
            "username":   username,
            "patient_id": patient_id,
        }), 201

    except Exception as exc:
        conn.rollback()
        return jsonify({"error": str(exc)}), 500
    finally:
        cur.close()
        conn.close()


# ═══════════════════════════════════════════════
#  DASHBOARD
# ═══════════════════════════════════════════════

@app.route("/api/dashboard/stats", methods=["GET"])
@login_required
def dashboard_stats():
    conn = get_db()
    cur  = conn.cursor()
    try:
        cur.execute("SELECT * FROM vw_DashboardStats")
        row = cur.fetchone()
        return jsonify({
            "total_patients":        int(row[0]) if row else 0,
            "total_doctors":         int(row[1]) if row else 0,
            "today_visits":          int(row[2]) if row else 0,
            "pending_prescriptions": int(row[3]) if row else 0,
            "pending_tests":         int(row[4]) if row else 0,
        })
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500
    finally:
        cur.close()
        conn.close()


# ═══════════════════════════════════════════════
#  PATIENTS
# ═══════════════════════════════════════════════

@app.route("/api/patients", methods=["GET"])
@login_required
def get_patients():
    conn = get_db()
    cur  = conn.cursor()
    try:
        cur.execute("""
            SELECT PatientID, PatientName, Email, Gender, DateOfBirth,
                   PhoneNumber, Address, BloodGroup,
                   EmergencyContact, EmergencyContactName, CreatedAt
            FROM   Patients
            WHERE  IsActive = 1
            ORDER  BY CreatedAt DESC
        """)
        rows = cur.fetchall()
        return jsonify([row_to_dict(cur, r) for r in rows])
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500
    finally:
        cur.close()
        conn.close()


@app.route("/api/patients/<int:pid>", methods=["GET"])
@login_required
def get_patient(pid: int):
    conn = get_db()
    cur  = conn.cursor()
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
        cur.close()
        conn.close()


@app.route("/api/patients/<int:pid>", methods=["PUT"])
@login_required
def update_patient(pid: int):
    data = request.get_json(silent=True) or {}
    conn = get_db()
    cur  = conn.cursor()
    try:
        cur.execute("""
            UPDATE Patients
            SET PatientName          = ?,
                Gender               = ?,
                DateOfBirth          = ?,
                PhoneNumber          = ?,
                Address              = ?,
                BloodGroup           = ?,
                EmergencyContact     = ?,
                EmergencyContactName = ?
            WHERE PatientID = ?
        """, (
            data.get("name"),
            data.get("gender"),
            data.get("dob"),
            data.get("phone"),
            data.get("address"),
            data.get("blood_group"),
            data.get("emergency_contact"),
            data.get("emergency_contact_name"),
            pid,
        ))
        conn.commit()
        return jsonify({"message": "Patient updated successfully"})
    except Exception as exc:
        conn.rollback()
        return jsonify({"error": str(exc)}), 500
    finally:
        cur.close()
        conn.close()


@app.route("/api/patients/<int:pid>", methods=["DELETE"])
@login_required
def delete_patient(pid: int):
    """Soft-delete: sets IsActive = 0 and deactivates linked User account."""
    user = current_user()
    if user.get("role") != "Admin":
        return jsonify({"error": "Admin access required"}), 403

    conn = get_db()
    cur  = conn.cursor()
    try:
        cur.execute("SELECT PatientID FROM Patients WHERE PatientID = ? AND IsActive = 1", pid)
        if cur.fetchone() is None:
            return jsonify({"error": "Patient not found"}), 404

        cur.execute("UPDATE Patients SET IsActive = 0 WHERE PatientID = ?", pid)
        cur.execute("UPDATE Users    SET IsActive = 0 WHERE PatientID = ?", pid)
        conn.commit()
        return jsonify({"message": "Patient deactivated successfully"})
    except Exception as exc:
        conn.rollback()
        return jsonify({"error": str(exc)}), 500
    finally:
        cur.close()
        conn.close()


# ═══════════════════════════════════════════════
#  DOCTORS
# ═══════════════════════════════════════════════

@app.route("/api/doctors", methods=["GET"])
@login_required
def get_doctors():
    conn = get_db()
    cur  = conn.cursor()
    try:
        cur.execute("""
            SELECT DoctorID, DoctorName, Email, Specialty,
                   PhoneNumber, LicenseNumber, YearsOfExperience
            FROM   Doctors WHERE IsActive = 1 ORDER BY DoctorName
        """)
        rows = cur.fetchall()
        return jsonify([row_to_dict(cur, r) for r in rows])
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500
    finally:
        cur.close()
        conn.close()


# ═══════════════════════════════════════════════
#  VISITS
# ═══════════════════════════════════════════════

@app.route("/api/visits", methods=["GET"])
@login_required
def get_visits():
    conn = get_db()
    cur  = conn.cursor()
    try:
        cur.execute("""
            SELECT v.VisitID, v.PatientID, p.PatientName,
                   v.DoctorID, d.DoctorName,
                   v.VisitDate, v.ReasonForVisit,
                   v.VitalSigns, v.Notes, v.Status
            FROM   Visits v
            JOIN   Patients p ON v.PatientID = p.PatientID
            JOIN   Doctors  d ON v.DoctorID  = d.DoctorID
            ORDER  BY v.VisitDate DESC
        """)
        rows = cur.fetchall()
        return jsonify([row_to_dict(cur, r) for r in rows])
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500
    finally:
        cur.close()
        conn.close()


@app.route("/api/visits", methods=["POST"])
@login_required
def create_visit():
    data = request.get_json(silent=True) or {}
    if not data.get("patient_id") or not data.get("doctor_id"):
        return jsonify({"error": "patient_id and doctor_id are required"}), 400

    conn = get_db()
    cur  = conn.cursor()
    try:
        cur.execute("""
            INSERT INTO Visits
                (PatientID, DoctorID, ReasonForVisit, VitalSigns, Notes, Status)
            OUTPUT INSERTED.VisitID
            VALUES (?, ?, ?, ?, ?, ?)
        """, (
            int(data["patient_id"]), int(data["doctor_id"]),
            str(data.get("reason", "")),
            str(data.get("vital_signs", "")),
            str(data.get("notes", "")),
            str(data.get("status", "Scheduled")),
        ))
        result_row = cur.fetchone()
        if result_row is None:
            raise RuntimeError("Failed to insert visit")
        visit_id: int = result_row[0]
        conn.commit()
        return jsonify({"message": "Visit created", "visit_id": visit_id}), 201
    except Exception as exc:
        conn.rollback()
        return jsonify({"error": str(exc)}), 500
    finally:
        cur.close()
        conn.close()


# ═══════════════════════════════════════════════
#  RECORDS
# ═══════════════════════════════════════════════

@app.route("/api/records/all", methods=["GET"])
@login_required
def get_all_records():
    conn = get_db()
    cur  = conn.cursor()
    try:
        cur.execute("EXEC sp_GetAllRecords")
        rows = cur.fetchall()
        return jsonify([row_to_dict(cur, r) for r in rows])
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500
    finally:
        cur.close()
        conn.close()


@app.route("/api/records/my", methods=["GET"])
@login_required
def get_my_records():
    user       = current_user()
    patient_id = user.get("patient_id")
    if not patient_id:
        return jsonify({"error": "Not a patient account"}), 403

    conn = get_db()
    cur  = conn.cursor()
    try:
        cur.execute("EXEC sp_GetPatientRecords ?", int(patient_id))
        rows = cur.fetchall()
        return jsonify([row_to_dict(cur, r) for r in rows])
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500
    finally:
        cur.close()
        conn.close()


@app.route("/api/records/doctor", methods=["GET"])
@login_required
def get_doctor_records():
    """Returns all records (visits + diagnoses + prescriptions) for the
    logged-in doctor's own patients, ordered most-recent first."""
    user      = current_user()
    doctor_id = user.get("doctor_id")
    if not doctor_id:
        return jsonify({"error": "Not a doctor account"}), 403

    conn = get_db()
    cur  = conn.cursor()
    try:
        cur.execute("""
            SELECT
                p.PatientName,
                p.BloodGroup,
                d.DoctorName,
                d.Specialty,
                v.VisitDate,
                v.ReasonForVisit,
                v.Status         AS VisitStatus,
                v.VitalSigns,
                v.Notes          AS VisitNotes,
                diag.DiagnosisName,
                diag.Description AS DiagnosisDesc,
                diag.IsChronic,
                diag.Severity,
                rx.MedicineName,
                rx.Dosage,
                rx.Frequency,
                rx.Duration,
                rx.Instructions,
                rx.IsDispensed,
                rx.DispensedDate
            FROM       Visits      v
            JOIN       Patients    p    ON v.PatientID  = p.PatientID
            JOIN       Doctors     d    ON v.DoctorID   = d.DoctorID
            LEFT JOIN  Diagnoses   diag ON diag.VisitID = v.VisitID
            LEFT JOIN  Prescriptions rx ON rx.VisitID  = v.VisitID
            WHERE      v.DoctorID = ?
              AND      p.IsActive = 1
            ORDER BY   v.VisitDate DESC
        """, int(doctor_id))
        rows = cur.fetchall()
        return jsonify([row_to_dict(cur, r) for r in rows])
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500
    finally:
        cur.close()
        conn.close()


# ═══════════════════════════════════════════════
#  ADMIN — CREDENTIAL MANAGEMENT
# ═══════════════════════════════════════════════

@app.route("/api/admin/patients-without-credentials", methods=["GET"])
@login_required
def patients_without_credentials():
    """Returns patients that have no User account (e.g. imported via CSV)."""
    user = current_user()
    if user.get("role") != "Admin":
        return jsonify({"error": "Admin access required"}), 403

    conn = get_db()
    cur  = conn.cursor()
    try:
        cur.execute("""
            SELECT p.PatientID, p.PatientName, p.Email, p.Gender,
                   p.PhoneNumber, p.BloodGroup, p.CreatedAt
            FROM   Patients p
            LEFT JOIN Users u ON u.PatientID = p.PatientID AND u.IsActive = 1
            WHERE  p.IsActive = 1
              AND  u.UserID IS NULL
            ORDER BY p.CreatedAt DESC
        """)
        rows = cur.fetchall()
        return jsonify([row_to_dict(cur, r) for r in rows])
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500
    finally:
        cur.close()
        conn.close()


@app.route("/api/admin/assign-credentials", methods=["POST"])
@login_required
def assign_credentials():
    """Admin assigns a username + password to a patient who has no account."""
    user = current_user()
    if user.get("role") != "Admin":
        return jsonify({"error": "Admin access required"}), 403

    data       = request.get_json(silent=True) or {}
    patient_id = data.get("patient_id")
    username   = str(data.get("username") or "").strip()
    password   = str(data.get("password") or "")

    if not patient_id or not username or not password:
        return jsonify({"error": "patient_id, username and password are required"}), 400
    if len(username) < 3:
        return jsonify({"error": "Username must be at least 3 characters"}), 400
    if len(password) < 6:
        return jsonify({"error": "Password must be at least 6 characters"}), 400

    conn = get_db()
    cur  = conn.cursor()
    try:
        # Verify patient exists
        cur.execute("SELECT Email FROM Patients WHERE PatientID = ? AND IsActive = 1", int(patient_id))
        row = cur.fetchone()
        if row is None:
            return jsonify({"error": "Patient not found"}), 404
        email: str = str(row[0])

        # Check username uniqueness
        cur.execute("SELECT 1 FROM Users WHERE Username = ?", username)
        if cur.fetchone():
            return jsonify({"error": "Username already taken"}), 409

        # Check patient doesn't already have an account
        cur.execute("SELECT 1 FROM Users WHERE PatientID = ? AND IsActive = 1", int(patient_id))
        if cur.fetchone():
            return jsonify({"error": "This patient already has login credentials"}), 409

        cur.execute("""
            INSERT INTO Users (Username, PasswordHash, Email, Role, PatientID)
            VALUES (?, ?, ?, 'Patient', ?)
        """, (username, hash_password(password), email, int(patient_id)))
        conn.commit()
        return jsonify({"message": f"Credentials assigned to patient #{patient_id}"}), 201

    except Exception as exc:
        conn.rollback()
        return jsonify({"error": str(exc)}), 500
    finally:
        cur.close()
        conn.close()


# ═══════════════════════════════════════════════
#  DIAGNOSIS
# ═══════════════════════════════════════════════

@app.route("/api/diagnosis", methods=["POST"])
@login_required
def add_diagnosis():
    data = request.get_json(silent=True) or {}
    if not data.get("visit_id") or not data.get("name"):
        return jsonify({"error": "visit_id and name are required"}), 400

    conn = get_db()
    cur  = conn.cursor()
    try:
        cur.execute("""
            INSERT INTO Diagnoses
                (VisitID, DiagnosisName, Description, IsChronic, Severity)
            OUTPUT INSERTED.DiagnosisID
            VALUES (?, ?, ?, ?, ?)
        """, (
            int(data["visit_id"]),
            str(data["name"]),
            str(data.get("description", "")),
            bool(data.get("is_chronic", False)),
            str(data.get("severity", "Mild")),
        ))
        result_row = cur.fetchone()
        if result_row is None:
            raise RuntimeError("Failed to insert diagnosis")
        diag_id: int = result_row[0]
        conn.commit()
        return jsonify({"message": "Diagnosis added", "diagnosis_id": diag_id}), 201
    except Exception as exc:
        conn.rollback()
        return jsonify({"error": str(exc)}), 500
    finally:
        cur.close()
        conn.close()


@app.route("/api/diagnosis/<int:did>", methods=["PUT"])
@login_required
def update_diagnosis(did: int):
    data = request.get_json(silent=True) or {}
    conn = get_db()
    cur  = conn.cursor()
    try:
        cur.execute("""
            UPDATE Diagnoses
            SET DiagnosisName = ?, Description = ?, IsChronic = ?, Severity = ?
            WHERE DiagnosisID = ?
        """, (
            str(data.get("name", "")),
            str(data.get("description", "")),
            bool(data.get("is_chronic", False)),
            str(data.get("severity", "Mild")),
            did,
        ))
        conn.commit()
        return jsonify({"message": "Diagnosis updated"})
    except Exception as exc:
        conn.rollback()
        return jsonify({"error": str(exc)}), 500
    finally:
        cur.close()
        conn.close()


@app.route("/api/diagnosis/<int:did>", methods=["DELETE"])
@login_required
def delete_diagnosis(did: int):
    conn = get_db()
    cur  = conn.cursor()
    try:
        cur.execute("DELETE FROM Diagnoses WHERE DiagnosisID = ?", did)
        conn.commit()
        return jsonify({"message": "Diagnosis deleted"})
    except Exception as exc:
        conn.rollback()
        return jsonify({"error": str(exc)}), 500
    finally:
        cur.close()
        conn.close()


# ═══════════════════════════════════════════════
#  PRESCRIPTIONS
# ═══════════════════════════════════════════════

@app.route("/api/prescriptions", methods=["GET"])
@login_required
def get_prescriptions():
    pending_only = request.args.get("pending", "0") == "1"
    conn = get_db()
    cur  = conn.cursor()
    try:
        cur.execute("EXEC sp_GetPrescriptionsForPharmacy ?", int(pending_only))
        rows = cur.fetchall()
        return jsonify([row_to_dict(cur, r) for r in rows])
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500
    finally:
        cur.close()
        conn.close()


@app.route("/api/prescriptions", methods=["POST"])
@login_required
def add_prescription():
    data = request.get_json(silent=True) or {}
    if not data.get("visit_id") or not data.get("medicine"):
        return jsonify({"error": "visit_id and medicine are required"}), 400

    conn = get_db()
    cur  = conn.cursor()
    try:
        cur.execute("""
            INSERT INTO Prescriptions
                (VisitID, MedicineName, Dosage, Frequency, Duration, Instructions)
            OUTPUT INSERTED.PrescriptionID
            VALUES (?, ?, ?, ?, ?, ?)
        """, (
            int(data["visit_id"]),
            str(data["medicine"]),
            str(data.get("dosage", "")),
            str(data.get("frequency", "")),
            str(data.get("duration", "")),
            str(data.get("instructions", "")),
        ))
        result_row = cur.fetchone()
        if result_row is None:
            raise RuntimeError("Failed to insert prescription")
        rx_id: int = result_row[0]
        conn.commit()
        return jsonify({"message": "Prescription added", "prescription_id": rx_id}), 201
    except Exception as exc:
        conn.rollback()
        return jsonify({"error": str(exc)}), 500
    finally:
        cur.close()
        conn.close()


@app.route("/api/prescriptions/<int:pid>/dispense", methods=["POST"])
@login_required
def dispense_prescription(pid: int):
    user          = current_user()
    pharmacist_id = user.get("pharmacist_id")
    if not pharmacist_id:
        return jsonify({"error": "Only pharmacists can dispense prescriptions"}), 403

    conn = get_db()
    cur  = conn.cursor()
    try:
        cur.execute("""
            UPDATE Prescriptions
            SET IsDispensed   = 1,
                DispensedBy   = ?,
                DispensedDate = GETDATE()
            WHERE PrescriptionID = ? AND IsDispensed = 0
        """, (int(pharmacist_id), pid))
        if cur.rowcount == 0:
            return jsonify({"error": "Prescription not found or already dispensed"}), 404
        conn.commit()
        return jsonify({"message": "Prescription dispensed successfully"})
    except Exception as exc:
        conn.rollback()
        return jsonify({"error": str(exc)}), 500
    finally:
        cur.close()
        conn.close()


# ═══════════════════════════════════════════════
#  MEDICAL FILE UPLOAD / DOWNLOAD
# ═══════════════════════════════════════════════

@app.route("/api/files/upload", methods=["POST"])
@login_required
def upload_file():
    user = current_user()

    if "file" not in request.files:
        return jsonify({"error": "No file part in request"}), 400

    f = request.files["file"]

    # FIX #2 — guard against None / empty filename before passing to allowed_file()
    raw_filename: str | None = f.filename
    if not raw_filename or raw_filename == "":
        return jsonify({"error": "No file selected"}), 400

    # Now raw_filename is guaranteed to be a non-empty str
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

    conn = get_db()
    cur  = conn.cursor()
    try:
        cur.execute("""
            INSERT INTO MedicalFiles
                (PatientID, VisitID, UploadedBy, FileType,
                 FileName, FileExtension, FilePath, FileSize, Description)
            OUTPUT INSERTED.FileID
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            int(patient_id_str),
            int(visit_id_str) if visit_id_str else None,
            int(user["user_id"]),
            str(file_type),
            safe_name, ext, filepath, size, description,
        ))
        result_row = cur.fetchone()
        if result_row is None:
            raise RuntimeError("Failed to insert file record")
        file_id: int = result_row[0]
        conn.commit()
        return jsonify({"message": "File uploaded successfully", "file_id": file_id}), 201
    except Exception as exc:
        conn.rollback()
        if os.path.exists(filepath):
            os.remove(filepath)
        return jsonify({"error": str(exc)}), 500
    finally:
        cur.close()
        conn.close()


@app.route("/api/files/patient/<int:pid>", methods=["GET"])
@login_required
def get_patient_files(pid: int):
    conn = get_db()
    cur  = conn.cursor()
    try:
        cur.execute("EXEC sp_GetPatientFiles ?", pid)
        rows = cur.fetchall()
        return jsonify([row_to_dict(cur, r) for r in rows])
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500
    finally:
        cur.close()
        conn.close()


@app.route("/api/files/download/<int:fid>", methods=["GET"])
@login_required
def download_file(fid: int):
    conn = get_db()
    cur  = conn.cursor()
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
        cur.close()
        conn.close()


# ═══════════════════════════════════════════════
#  ADMIN — BULK IMPORT
# ═══════════════════════════════════════════════

@app.route("/api/admin/import-patients", methods=["POST"])
@login_required
def import_patients():
    user = current_user()
    if user.get("role") != "Admin":
        return jsonify({"error": "Admin access required"}), 403

    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400

    f = request.files["file"]

    # FIX #2 — guard None filename
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

    conn = get_db()
    cur  = conn.cursor()
    total      = len(df)
    successful = 0
    failed     = 0
    errors: list[str] = []

    for raw_idx, row in df.iterrows():
        # FIX #4 — cast index to int so "+ 2" is valid arithmetic, not Hashable + int
        row_num = int(raw_idx) + 2  # type: ignore[arg-type]
        try:
            email_val = str(row["Email"]).strip()
            cur.execute("SELECT 1 FROM Patients WHERE Email = ?", email_val)
            if cur.fetchone():
                errors.append(f"Row {row_num}: {email_val} already exists — skipped")
                failed += 1
                continue

            cur.execute("""
                INSERT INTO Patients
                    (PatientName, Email, Gender, DateOfBirth,
                     PhoneNumber, Address, BloodGroup)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (
                str(row["Name"]).strip(),
                email_val,
                str(row["Gender"]).strip(),
                str(row["DOB"]).strip(),
                str(row["Phone"]).strip(),
                str(row["Address"]).strip(),
                str(row["BloodGroup"]).strip(),
            ))
            successful += 1

        except Exception as exc:
            errors.append(f"Row {row_num}: {exc}")
            failed += 1

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
        cur.close()
        conn.close()

    return jsonify({
        "message":    "Import completed",
        "total":      total,
        "successful": successful,
        "failed":     failed,
        "errors":     errors,
    })


# ═══════════════════════════════════════════════
#  PATIENT SUMMARY SHEET
# ═══════════════════════════════════════════════

def _ensure_summary_notes_table(cur: pyodbc.Cursor) -> None:
    """Create PatientSummaryNotes if it does not exist yet."""
    cur.execute("""
        IF NOT EXISTS (
            SELECT 1 FROM INFORMATION_SCHEMA.TABLES
            WHERE TABLE_NAME = 'PatientSummaryNotes'
        )
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
    """
    Returns a structured summary sheet for one patient.
    Accessible by: Patient (own only), Doctor, Admin, Radiologist.
    """
    user = current_user()
    role = user.get("role", "")

    # Patients may only view their own summary
    if role == "Patient" and user.get("patient_id") != pid:
        return jsonify({"error": "Access denied"}), 403

    conn = get_db()
    cur  = conn.cursor()
    try:
        _ensure_summary_notes_table(cur)
        conn.commit()

        # ── Demographics ──────────────────────────
        cur.execute("""
            SELECT p.PatientID, p.PatientName, p.Email, p.Gender,
                   p.DateOfBirth, p.PhoneNumber, p.Address, p.BloodGroup,
                   p.EmergencyContact, p.EmergencyContactName,
                   ISNULL(n.Notes, '')   AS SummaryNotes,
                   ISNULL(n.UpdatedBy, '') AS NotesUpdatedBy,
                   n.UpdatedAt
            FROM   Patients p
            LEFT JOIN PatientSummaryNotes n ON n.PatientID = p.PatientID
            WHERE  p.PatientID = ? AND p.IsActive = 1
        """, pid)
        row = cur.fetchone()
        if row is None:
            return jsonify({"error": "Patient not found"}), 404
        patient = row_to_dict(cur, row)

        # ── Visits ────────────────────────────────
        cur.execute("""
            SELECT v.VisitID, v.VisitDate, v.ReasonForVisit,
                   v.VitalSigns, v.Notes, v.Status,
                   d.DoctorName, d.Specialty
            FROM   Visits v
            JOIN   Doctors d ON v.DoctorID = d.DoctorID
            WHERE  v.PatientID = ?
            ORDER  BY v.VisitDate DESC
        """, pid)
        visits = [row_to_dict(cur, r) for r in cur.fetchall()]

        # ── Diagnoses ─────────────────────────────
        cur.execute("""
            SELECT diag.DiagnosisName, diag.Description,
                   diag.Severity, diag.IsChronic, v.VisitDate
            FROM   Diagnoses diag
            JOIN   Visits v ON diag.VisitID = v.VisitID
            WHERE  v.PatientID = ?
            ORDER  BY v.VisitDate DESC
        """, pid)
        diagnoses = [row_to_dict(cur, r) for r in cur.fetchall()]

        # ── Prescriptions ─────────────────────────
        cur.execute("""
            SELECT rx.MedicineName, rx.Dosage, rx.Frequency,
                   rx.Duration, rx.Instructions,
                   rx.IsDispensed, rx.DispensedDate,
                   d.DoctorName, v.VisitDate
            FROM   Prescriptions rx
            JOIN   Visits  v ON rx.VisitID  = v.VisitID
            JOIN   Doctors d ON v.DoctorID  = d.DoctorID
            WHERE  v.PatientID = ?
            ORDER  BY v.VisitDate DESC
        """, pid)
        prescriptions = [row_to_dict(cur, r) for r in cur.fetchall()]

        # ── Files / Scans ─────────────────────────
        cur.execute("""
            SELECT f.FileID, f.FileType, f.FileName, f.FileSize,
                   f.Description, f.UploadedAt,
                   u.Username AS UploadedByUsername
            FROM   MedicalFiles f
            LEFT JOIN Users u ON f.UploadedBy = u.UserID
            WHERE  f.PatientID = ?
            ORDER  BY f.UploadedAt DESC
        """, pid)
        files = [row_to_dict(cur, r) for r in cur.fetchall()]

        return jsonify({
            "patient":       patient,
            "visits":        visits,
            "diagnoses":     diagnoses,
            "prescriptions": prescriptions,
            "files":         files,
        })

    except Exception as exc:
        return jsonify({"error": str(exc)}), 500
    finally:
        cur.close()
        conn.close()


@app.route("/api/patients/<int:pid>/summary-notes", methods=["PUT"])
@login_required
def update_summary_notes(pid: int):
    """Admin-only: update the free-text summary notes for a patient."""
    user = current_user()
    if user.get("role") != "Admin":
        return jsonify({"error": "Admin access required"}), 403

    data  = request.get_json(silent=True) or {}
    notes = str(data.get("notes", ""))

    conn = get_db()
    cur  = conn.cursor()
    try:
        _ensure_summary_notes_table(cur)

        cur.execute("""
            MERGE PatientSummaryNotes AS target
            USING (SELECT ? AS PatientID) AS src ON target.PatientID = src.PatientID
            WHEN MATCHED THEN
                UPDATE SET Notes = ?, UpdatedBy = ?, UpdatedAt = GETDATE()
            WHEN NOT MATCHED THEN
                INSERT (PatientID, Notes, UpdatedBy)
                VALUES (?, ?, ?);
        """, (pid, notes, user["username"], pid, notes, user["username"]))
        conn.commit()
        return jsonify({"message": "Summary notes updated"})
    except Exception as exc:
        conn.rollback()
        return jsonify({"error": str(exc)}), 500
    finally:
        cur.close()
        conn.close()


# ═══════════════════════════════════════════════
#  SCANS  (Radiologist + Doctor view)
# ═══════════════════════════════════════════════

SCAN_TYPES = {"X-Ray", "MRI", "CT Scan", "Ultrasound", "PET Scan",
              "Mammography", "Fluoroscopy"}


@app.route("/api/scans/upload", methods=["POST"])
@login_required
def upload_scan():
    """
    Radiologist (or Doctor / Admin) uploads a scan for a specific patient.
    Accepts multipart/form-data: file, patient_id, scan_type, description.
    """
    user = current_user()
    if user.get("role") not in ("Radiologist", "Doctor", "Admin"):
        return jsonify({"error": "Access denied"}), 403

    if "file" not in request.files:
        return jsonify({"error": "No file part"}), 400

    f            = request.files["file"]
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

    conn = get_db()
    cur  = conn.cursor()
    try:
        cur.execute("""
            INSERT INTO MedicalFiles
                (PatientID, UploadedBy, FileType,
                 FileName, FileExtension, FilePath, FileSize, Description)
            OUTPUT INSERTED.FileID
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            int(patient_id_str),
            int(user["user_id"]),
            scan_type, safe_name, ext, filepath, size, description,
        ))
        result_row = cur.fetchone()
        if result_row is None:
            raise RuntimeError("Failed to insert scan record")
        file_id: int = result_row[0]
        conn.commit()
        return jsonify({"message": "Scan uploaded successfully", "file_id": file_id}), 201
    except Exception as exc:
        conn.rollback()
        if os.path.exists(filepath):
            os.remove(filepath)
        return jsonify({"error": str(exc)}), 500
    finally:
        cur.close()
        conn.close()


@app.route("/api/scans/patient/<int:pid>", methods=["GET"])
@login_required
def get_patient_scans(pid: int):
    """Return all scan-type files for a patient (Doctor, Admin, Radiologist)."""
    user = current_user()
    role = user.get("role", "")
    if role == "Patient" and user.get("patient_id") != pid:
        return jsonify({"error": "Access denied"}), 403

    conn = get_db()
    cur  = conn.cursor()
    try:
        placeholders = ",".join("?" * len(SCAN_TYPES))
        cur.execute(f"""
            SELECT f.FileID, f.FileType, f.FileName, f.FileSize,
                   f.Description, f.UploadedAt,
                   u.Username AS UploadedByUsername,
                   p.PatientName
            FROM   MedicalFiles f
            LEFT JOIN Users    u ON f.UploadedBy = u.UserID
            LEFT JOIN Patients p ON f.PatientID  = p.PatientID
            WHERE  f.PatientID = ?
              AND  f.FileType  IN ({placeholders})
            ORDER BY f.UploadedAt DESC
        """, pid, *list(SCAN_TYPES))
        rows = cur.fetchall()
        return jsonify([row_to_dict(cur, r) for r in rows])
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500
    finally:
        cur.close()
        conn.close()


@app.route("/api/scans/mine", methods=["GET"])
@login_required
def get_my_scans():
    """Radiologist: return all scans they personally uploaded."""
    user = current_user()
    conn = get_db()
    cur  = conn.cursor()
    try:
        cur.execute("""
            SELECT f.FileID, f.FileType, f.FileName, f.FileSize,
                   f.Description, f.UploadedAt,
                   p.PatientName, p.BloodGroup
            FROM   MedicalFiles f
            JOIN   Patients p ON f.PatientID = p.PatientID
            WHERE  f.UploadedBy = ?
            ORDER  BY f.UploadedAt DESC
        """, int(user["user_id"]))
        rows = cur.fetchall()
        return jsonify([row_to_dict(cur, r) for r in rows])
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500
    finally:
        cur.close()
        conn.close()


# ─────────────────────────────────────────────
#  Entry point
# ─────────────────────────────────────────────
if __name__ == "__main__":
    print("Hospital Management System API  v2.2")
    print(f"DB: {DB_SERVER} / {DB_NAME}")
    app.run(debug=True, host="0.0.0.0", port=5000)