"""
db.py — Database Connection Module
====================================
Centralised database access for the HMS Flask backend.

Configuration priority (highest → lowest):
  1. Environment variables  (recommended for production)
  2. .env file              (pip install python-dotenv)
  3. Hard-coded defaults    (development only)

Environment variables:
  HMS_DB_SERVER   — SQL Server host, e.g. localhost\\SQLEXPRESS
  HMS_DB_NAME     — Database name, default HospitalManagementSystem
  HMS_DB_DRIVER   — ODBC driver string
  HMS_DB_USER     — SQL Server login (leave empty for Windows auth)
  HMS_DB_PASSWORD — SQL Server password (leave empty for Windows auth)

Usage:
  from db import get_db, row_to_dict

  conn = get_db()
  cur  = conn.cursor()
  cur.execute("SELECT * FROM Patients WHERE IsActive = 1")
  rows = [row_to_dict(cur, r) for r in cur.fetchall()]
  cur.close()
  conn.close()
"""

import os
import datetime
import pyodbc

# ── Try to load .env if python-dotenv is installed ──────────
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass  # python-dotenv not installed — use env vars or defaults

# ── Connection settings ──────────────────────────────────────
DB_SERVER   = os.getenv("HMS_DB_SERVER",   r"LAPTOP-OGJ9GR0I\SQLEXPRESS")
DB_NAME     = os.getenv("HMS_DB_NAME",     "HospitalManagementSystem")
DB_DRIVER   = os.getenv("HMS_DB_DRIVER",   "{ODBC Driver 17 for SQL Server}")
DB_USER     = os.getenv("HMS_DB_USER",     "")      # empty = Windows auth
DB_PASSWORD = os.getenv("HMS_DB_PASSWORD", "")

# ── Build connection string ──────────────────────────────────
def _build_conn_str() -> str:
    base = (
        f"DRIVER={DB_DRIVER};"
        f"SERVER={DB_SERVER};"
        f"DATABASE={DB_NAME};"
    )
    if DB_USER and DB_PASSWORD:
        # SQL Server authentication
        return base + f"UID={DB_USER};PWD={DB_PASSWORD};"
    else:
        # Windows / Trusted Connection authentication
        return base + "Trusted_Connection=yes;"


def get_db() -> pyodbc.Connection:
    """
    Open and return a new pyodbc connection.
    autocommit=False — callers must call conn.commit() or conn.rollback().
    Always close the connection in a finally block.
    """
    try:
        conn = pyodbc.connect(_build_conn_str(), autocommit=False)
        return conn
    except pyodbc.Error as exc:
        raise ConnectionError(
            f"Cannot connect to SQL Server at '{DB_SERVER}/{DB_NAME}'. "
            f"Check DB_SERVER, ODBC driver, and Windows auth settings.\n"
            f"Original error: {exc}"
        ) from exc


def row_to_dict(cursor: pyodbc.Cursor, row: pyodbc.Row) -> dict:
    """
    Convert a pyodbc Row to a JSON-serialisable dict.
    Handles: datetime → ISO string, bytes → hex string, everything else as-is.
    """
    result: dict = {}
    for i, col in enumerate(cursor.description):
        val = row[i]
        if isinstance(val, (datetime.datetime, datetime.date)):
            val = val.isoformat()
        elif isinstance(val, bytes):
            val = val.hex()
        result[col[0]] = val
    return result


def test_connection() -> bool:
    """
    Quick connectivity check. Returns True on success, False on failure.
    Safe to call at startup.
    """
    try:
        conn = get_db()
        cur  = conn.cursor()
        cur.execute("SELECT 1")
        cur.close()
        conn.close()
        print(f"✅ Database connection OK  →  {DB_SERVER} / {DB_NAME}")
        return True
    except Exception as exc:
        print(f"❌ Database connection FAILED: {exc}")
        return False


if __name__ == "__main__":
    test_connection()