import { useEffect, useState, useMemo } from "react";
import { supabase } from "../lib/supabaseClient";

const CLASS_NAMES_1_TO_12 = Array.from({ length: 12 }, (_, index) => String(index + 1));
const SCHEMA_CACHE_MISS_CODE = "PGRST204";
const ON_CONFLICT_CONSTRAINT_MISS = "42P10";
const RLS_POLICY_VIOLATION = "42501";

async function ensureClassesViaRpc({ schoolId, teacherProfileId }) {
  let { error } = await supabase.rpc("ensure_school_classes", {
    p_school_id: schoolId,
    p_teacher_profile_id: teacherProfileId || null,
  });

  if (error?.code === SCHEMA_CACHE_MISS_CODE && error.message.includes("teacher_profile_id")) {
    const retryResult = await supabase.rpc("ensure_school_classes", {
      p_school_id: schoolId,
      p_teacher_profile_id: null,
    });

    error = retryResult.error;
  }

  return { error };
}

async function ensureStandardClasses({ schoolId, teacherProfileId }) {
  const { data: existingClasses, error: loadError } = await supabase
    .from("classes")
    .select("id, class_name, section")
    .eq("school_id", schoolId)
    .in("class_name", CLASS_NAMES_1_TO_12);

  if (loadError) {
    return { error: loadError };
  }

  const existingKeys = new Set(
    (existingClasses || []).map((item) => `${item.class_name}::${item.section || "A"}`)
  );

  const missingClasses = CLASS_NAMES_1_TO_12
    .filter((className) => !existingKeys.has(`${className}::A`))
    .map((className) => ({
      school_id: schoolId,
      class_name: className,
      section: "A",
      teacher_profile_id: teacherProfileId || null,
    }));

  if (missingClasses.length === 0) {
    return { error: null };
  }

  let { error: insertError } = await supabase
    .from("classes")
    .insert(missingClasses);

  if (
    insertError?.code === RLS_POLICY_VIOLATION
    || insertError?.message?.toLowerCase().includes("row-level security")
  ) {
    return ensureClassesViaRpc({ schoolId, teacherProfileId });
  }

  if (insertError?.code === SCHEMA_CACHE_MISS_CODE && insertError.message.includes("teacher_profile_id")) {
    const classesWithoutTeacher = missingClasses.map(({ teacher_profile_id, ...rest }) => rest);
    const retryResult = await supabase
      .from("classes")
      .insert(classesWithoutTeacher);

    insertError = retryResult.error;

    if (
      insertError?.code === RLS_POLICY_VIOLATION
      || insertError?.message?.toLowerCase().includes("row-level security")
    ) {
      return ensureClassesViaRpc({ schoolId, teacherProfileId: null });
    }
  }

  return { error: insertError };
}

function buildClassOptions(classRows) {
  const byClassName = new Map((classRows || []).map((item) => [item.class_name, item]));

  return CLASS_NAMES_1_TO_12.map((className) => (
    byClassName.get(className) || {
      id: `virtual-${className}`,
      class_name: className,
      section: "A",
      isVirtual: true,
    }
  ));
}

function normalizeCellValue(value) {
  return String(value ?? "").trim();
}

function normalizeName(value) {
  return normalizeCellValue(value).toLowerCase().replace(/\s+/g, " ");
}

function simplifyName(value) {
  return normalizeName(value).replace(/[^a-z0-9 ]/g, "").trim();
}

function namesLookSimilar(left, right) {
  const normalizedLeft = simplifyName(left);
  const normalizedRight = simplifyName(right);

  if (!normalizedLeft || !normalizedRight) {
    return false;
  }

  if (normalizedLeft === normalizedRight) {
    return true;
  }

  if (normalizedLeft.includes(normalizedRight) || normalizedRight.includes(normalizedLeft)) {
    return true;
  }

  const leftTokens = normalizedLeft.split(" ").filter(Boolean);
  const rightTokens = normalizedRight.split(" ").filter(Boolean);

  return leftTokens.length > 0
    && rightTokens.length > 0
    && leftTokens.every((token) => rightTokens.some((candidate) => candidate.startsWith(token) || token.startsWith(candidate)));
}

function normalizeClassValue(value) {
  const raw = normalizeCellValue(value).toUpperCase();
  const match = raw.match(/\d+/);
  return match ? match[0] : raw;
}

function parseExcelDateNumber(value) {
  const epoch = new Date(Date.UTC(1899, 11, 30));
  const parsed = new Date(epoch.getTime() + Number(value) * 24 * 60 * 60 * 1000);

  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  return parsed.toISOString().slice(0, 10);
}

function normalizeDateValue(value) {
  if (value === undefined || value === null || value === "") {
    return "";
  }

  if (typeof value === "number") {
    const excelDate = parseExcelDateNumber(value);
    if (excelDate) {
      return excelDate;
    }
  }

  const raw = normalizeCellValue(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return raw;
  }

  const dashMatch = raw.match(/^(\d{2})[-/](\d{2})[-/](\d{4})$/);
  if (dashMatch) {
    const [, dd, mm, yyyy] = dashMatch;
    return `${yyyy}-${mm}-${dd}`;
  }

  const parsedDate = new Date(raw);
  if (!Number.isNaN(parsedDate.getTime())) {
    return parsedDate.toISOString().slice(0, 10);
  }

  return raw;
}

function getRowValue(row, keys) {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && row[key] !== "") {
      return row[key];
    }
  }
  return "";
}

export default function TeacherTakeAttendance({ profile }) {
  const [classes, setClasses] = useState([]);
  const [classesError, setClassesError] = useState("");
  const [selectedClass, setSelectedClass] = useState("");
  const [students, setStudents] = useState([]);
  const [attendance, setAttendance] = useState({});
  const [uploadedRowsCount, setUploadedRowsCount] = useState(0);
  const [lastUploadMessage, setLastUploadMessage] = useState("");
  const [savingAttendance, setSavingAttendance] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [selectedSubject, setSelectedSubject] = useState("");
  const [selectedPeriod, setSelectedPeriod] = useState("");
  const [uploadingExcel, setUploadingExcel] = useState(false);

  const schoolId = profile?.school_id;
  async function reloadClasses() {
    const { data, error } = await supabase
      .from("classes")
      .select("id, class_name, section")
      .eq("school_id", schoolId)
      .in("class_name", CLASS_NAMES_1_TO_12)
      .order("class_name", { ascending: true });

    if (error) {
      setClasses(buildClassOptions([]));
      setClassesError(`Failed to load class dropdown: ${error.message}`);
      return [];
    }

    const classOptions = buildClassOptions(data || []);
    setClasses(classOptions);
    return classOptions;
  }

  async function ensureSelectedClassRecord(className) {
    if (!className || !schoolId) {
      return null;
    }

    const currentMatch = classes.find((item) => item.class_name === className && !item.isVirtual);
    if (currentMatch) {
      return currentMatch;
    }

    const { error } = await ensureStandardClasses({
      schoolId,
      teacherProfileId: profile?.id,
    });

    if (error) {
      setClassesError(`Could not prepare classes 1-12: ${error.message}`);
    }

    const refreshedClasses = await reloadClasses();
    return refreshedClasses.find((item) => item.class_name === className && !item.isVirtual) || null;
  }

  useEffect(() => {
    if (!schoolId) return;

    async function loadClasses() {
      setClassesError("");

      const { error: seedError } = await ensureStandardClasses({
        schoolId,
        teacherProfileId: profile?.id,
      });

      if (seedError) {
        if (seedError.code === ON_CONFLICT_CONSTRAINT_MISS) {
          setClassesError(
            "The database is missing the unique constraint for classes. Run the latest Supabase class repair SQL and refresh."
          );
        } else if (seedError.code === SCHEMA_CACHE_MISS_CODE && seedError.message.includes("teacher_profile_id")) {
          setClassesError(
            "Classes were created without teacher assignment because the database schema cache has not picked up `teacher_profile_id` yet. Run the latest Supabase SQL fix and refresh."
          );
        } else {
          setClassesError(`Could not prepare classes 1-12: ${seedError.message}`);
        }
      }

      await reloadClasses();
    }

    loadClasses();
  }, [schoolId, profile?.id]);

  useEffect(() => {
    if (!selectedClass) {
      setStudents([]);
      setAttendance({});
      return;
    }

    async function loadStudents() {
      const classRecord = await ensureSelectedClassRecord(selectedClass);

      if (!classRecord?.id) {
        setStudents([]);
        return;
      }

      // Load students for the selected class
      const { data, error: studentError } = await supabase
        .from("students")
        .select("id, full_name, roll_number")
        .eq("class_id", classRecord.id)
        .order("roll_number", { ascending: true });

      if (studentError) {
        console.error('Error loading students:', studentError);
        setStudents([]);
        setClassesError(`Error loading students: ${studentError.message}`);
        return;
      }

      setStudents(data || []);
      console.log(`Loaded ${(data || []).length} students for class ${selectedClass}`);

      // Load existing attendance for the selected date/subject/period
      if (!selectedSubject || !selectedPeriod) {
        // If subject or period not selected, just use default 'present' status
        const defaultAttendance = {};
        (data || []).forEach((student) => {
          defaultAttendance[student.id] = 'present';
        });
        setAttendance(defaultAttendance);
        return;
      }

      const { data: attendanceRows, error: attendanceError } = await supabase
        .from("attendance")
        .select("student_id, status")
        .eq("class_id", classRecord.id)
        .eq("attendance_date", selectedDate)
        .eq("subject", selectedSubject.trim())
        .eq("period", selectedPeriod.trim());

      if (attendanceError) {
        console.warn('Warning loading attendance:', attendanceError);
        // If attendance loading fails, just use defaults
      }

      const attendanceMap = {};
      (attendanceRows || []).forEach((row) => (attendanceMap[row.student_id] = row.status));

      // Default to 'present' if no existing attendance
      const defaultAttendance = {};
      (data || []).forEach((student) => {
        defaultAttendance[student.id] = attendanceMap[student.id] || 'present';
      });
      setAttendance(defaultAttendance);
    }

    loadStudents();
  }, [selectedClass, selectedDate, selectedSubject, selectedPeriod]);

  useEffect(() => {
    setUploadedRowsCount(0);
    setLastUploadMessage("");
  }, [selectedClass, selectedDate, selectedSubject, selectedPeriod]);

  const attendanceSummary = useMemo(() => {
    const total = students.length;
    const present = Object.values(attendance).filter(status => status === 'present').length;
    const absent = Object.values(attendance).filter(status => status === 'absent').length;
    const late = Object.values(attendance).filter(status => status === 'late').length;
    const leave = Object.values(attendance).filter(status => status === 'leave').length;

    return { total, present, absent, late, leave };
  }, [attendance, students]);

  const invalidSubmit = useMemo(
    () => !selectedClass || students.length === 0 || !selectedSubject || !selectedPeriod,
    [selectedClass, students, selectedSubject, selectedPeriod]
  );

  const markAllPresent = () => {
    const newAttendance = {};
    students.forEach((student) => {
      newAttendance[student.id] = 'present';
    });
    setAttendance(newAttendance);
  };

  const updateAttendanceStatus = (studentId, status) => {
    setAttendance((prev) => ({ ...prev, [studentId]: status }));
  };

  async function saveAttendance() {
    if (!selectedClass || !selectedSubject || !selectedPeriod) {
      alert('Please select Class, Subject, and Period before saving.');
      return;
    }
    
    if (!schoolId) {
      alert('School ID is missing from your profile.');
      return;
    }
    
    if (students.length === 0) {
      alert('No students found for this class.');
      return;
    }

    setSavingAttendance(true);

    try {
      const classRecord = await ensureSelectedClassRecord(selectedClass);

      if (!classRecord?.id) {
        alert('Please select a valid class before saving attendance.');
        setSavingAttendance(false);
        return;
      }

      // Prepare the payload with required fields (marked_by omitted to avoid schema cache issues)
      const payload = students.map((student) => ({
        school_id: schoolId,
        class_id: classRecord.id,
        student_id: student.id,
        attendance_date: selectedDate,
        status: attendance[student.id] || "absent",
        subject: selectedSubject.trim() || "General",
        period: selectedPeriod.trim() || "1",
      }));

      console.log('Saving attendance payload:', payload);

      // Use upsert to handle updates for existing attendance records
      const { data, error } = await supabase
        .from("attendance")
        .upsert(payload, { 
          onConflict: "student_id,attendance_date,class_id,subject,period"
        })
        .select();

      if (error) {
        console.error('Error saving attendance:', error);
        console.error('Error code:', error.code);
        console.error('Error details:', error.details);
        alert(`Error saving attendance: ${error.message}\n\nPlease ensure:\n1. You have teacher role\n2. This class belongs to your school\n3. All students are valid`);
      } else {
        console.log('Attendance saved successfully:', data);
        alert(`Attendance saved successfully for ${students.length} students!`);
      }
    } catch (err) {
      console.error('Exception while saving attendance:', err);
      alert(`Exception: ${err.message}`);
    } finally {
      setSavingAttendance(false);
    }
  }

  const downloadTemplate = async () => {
    const [{ utils, write, book_new, book_append_sheet }, { saveAs }] = await Promise.all([
      import("xlsx").then((mod) => ({
        utils: mod.utils,
        write: mod.write,
        book_new: mod.utils.book_new,
        book_append_sheet: mod.utils.book_append_sheet,
      })),
      import("file-saver"),
    ]);

    const templateData = students.map((student, index) => ({
      'Roll No': student.roll_number,
      'Student Name': student.full_name,
      'Status': 'present' // Default to present
    }));

    const ws = utils.json_to_sheet(templateData);
    const wb = book_new();
    book_append_sheet(wb, ws, 'Attendance Template');
    const wbout = write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(new Blob([wbout], { type: 'application/octet-stream' }), `attendance_${selectedDate}.xlsx`);
  };

  const handleExcelUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setUploadingExcel(true);

    try {
      const { read, utils } = await import("xlsx");
      const buffer = await file.arrayBuffer();
      const workbook = read(buffer, { type: 'array' });
      const jsonData = utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);

      // Use Web Worker for processing
      const worker = new Worker(
        new URL('../workers/excelProcessor.worker.js', import.meta.url),
        { type: 'module' }
      );

      worker.postMessage({
        jsonData,
        students,
        selectedDate,
        selectedSubject,
        selectedPeriod,
        selectedClass
      });

      worker.onmessage = (event) => {
        const { success, newAttendance, matchedRows, unmatchedRows, errors, totalRows } = event.data;

        if (success) {
          setAttendance(prev => ({ ...prev, ...newAttendance }));
          setUploadedRowsCount(matchedRows);

          let message = `Imported ${matchedRows} attendance row${matchedRows === 1 ? "" : "s"} for Class ${selectedClass} on ${selectedDate}.`;

          if (unmatchedRows.length > 0) {
            message += ` Unmatched students: ${unmatchedRows.slice(0, 3).join(', ')}${unmatchedRows.length > 3 ? '...' : ''}.`;
          }

          if (errors.length > 0) {
            message += ` Errors: ${errors.slice(0, 2).join('; ')}${errors.length > 2 ? '...' : ''}.`;
          }

          setLastUploadMessage(message);
        } else {
          setLastUploadMessage(`Error processing Excel file: ${newAttendance}`);
        }

        setUploadingExcel(false);
        worker.terminate();
      };

      worker.onerror = (error) => {
        console.error('Worker error:', error);
        setLastUploadMessage('Error processing Excel file. Please try again.');
        setUploadingExcel(false);
        worker.terminate();
      };

    } catch (error) {
      console.error('Excel processing error:', error);
      setLastUploadMessage('Error reading Excel file. Please check the file format.');
      setUploadingExcel(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'present': return '#4CAF50';
      case 'absent': return '#F44336';
      case 'late': return '#FF9800';
      case 'leave': return '#9C27B0';
      default: return '#9E9E9E';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'present': return '✅';
      case 'absent': return '❌';
      case 'late': return '⏳';
      case 'leave': return '🏠';
      default: return '❓';
    }
  };

  return (
    <div className="dashboard-card" style={{ maxWidth: '1200px', margin: '0 auto' }}>
      <h2>Take Attendance</h2>
      {classesError ? <p className="error-text">{classesError}</p> : null}

      {/* Top Context Bar */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '16px',
        marginBottom: '24px',
        padding: '16px',
        backgroundColor: '#f5f5f5',
        borderRadius: '8px',
        alignItems: 'center'
      }}>
        <div>
          <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '4px' }}>Date</label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '4px' }}>Class</label>
          <select
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc', minWidth: '120px' }}
          >
            <option value="">-- select class --</option>
            {classes.map((cl) => (
              <option key={cl.class_name} value={cl.class_name}>{`Class ${cl.class_name}`}</option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '4px' }}>Subject *</label>
          <input
            type="text"
            value={selectedSubject}
            onChange={(e) => setSelectedSubject(e.target.value)}
            placeholder="e.g., Mathematics"
            required
            style={{
              padding: '8px',
              borderRadius: '4px',
              border: selectedSubject.trim() === '' ? '2px solid #dc3545' : '1px solid #ccc',
              minWidth: '120px'
            }}
          />
          {selectedSubject.trim() === '' && (
            <small style={{ color: '#dc3545', fontSize: '12px' }}>Subject is required</small>
          )}
        </div>

        <div>
          <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '4px' }}>Period *</label>
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            required
            style={{
              padding: '8px',
              borderRadius: '4px',
              border: selectedPeriod === '' ? '2px solid #dc3545' : '1px solid #ccc',
              minWidth: '100px'
            }}
          >
            <option value="">-- select --</option>
            <option value="1">Period 1</option>
            <option value="2">Period 2</option>
            <option value="3">Period 3</option>
            <option value="4">Period 4</option>
            <option value="5">Period 5</option>
            <option value="6">Period 6</option>
            <option value="7">Period 7</option>
            <option value="8">Period 8</option>
          </select>
          {selectedPeriod === '' && (
            <small style={{ color: '#dc3545', fontSize: '12px' }}>Period is required</small>
          )}
        </div>

        <div>
          <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '4px' }}>Teacher</label>
          <span style={{ padding: '8px', display: 'inline-block' }}>{profile?.name || profile?.full_name || 'N/A'}</span>
        </div>
      </div>

      {/* Excel Upload Section */}
      {selectedClass && (
        <div style={{ marginBottom: '16px', display: 'flex', gap: '16px', alignItems: 'center' }}>
          <button
            onClick={downloadTemplate}
            style={{
              padding: '8px 16px',
              backgroundColor: '#2196F3',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            📥 Download Excel Template
          </button>

          <div>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleExcelUpload}
              style={{ display: 'none' }}
              id="excel-upload"
            />
            <label
              htmlFor="excel-upload"
              style={{
                padding: '8px 16px',
                backgroundColor: '#FF9800',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                display: 'inline-block'
              }}
            >
              📤 Upload Excel {uploadingExcel ? '(Processing...)' : ''}
            </label>
          </div>
        </div>
      )}

      {selectedClass && lastUploadMessage ? (
        <div
          style={{
            marginBottom: '16px',
            padding: '14px 16px',
            borderRadius: '8px',
            backgroundColor: uploadedRowsCount > 0 ? '#E8F5E9' : '#FFF3E0',
            border: `1px solid ${uploadedRowsCount > 0 ? '#81C784' : '#FFB74D'}`,
            color: '#1F2937'
          }}
        >
          <strong style={{ display: 'block', marginBottom: '4px' }}>Excel Upload Status</strong>
          <span>{lastUploadMessage}</span>
        </div>
      ) : null}

      {/* Mark All Present Button */}
      {selectedClass && students.length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          <button
            onClick={markAllPresent}
            style={{
              padding: '12px 24px',
              backgroundColor: '#4CAF50',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: 'bold'
            }}
          >
            ✅ Mark All Present
          </button>
        </div>
      )}

      {/* Student List */}
      {selectedClass && (
        <div style={{ marginBottom: '24px' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '16px'
          }}>
            {students.map((student) => (
              <div
                key={student.id}
                style={{
                  border: '1px solid #ddd',
                  borderRadius: '8px',
                  padding: '16px',
                  backgroundColor: '#fff'
                }}
              >
                <div style={{ marginBottom: '12px' }}>
                  <strong>{student.roll_number}. {student.full_name}</strong>
                </div>

                <div style={{
                  display: 'flex',
                  gap: '8px',
                  flexWrap: 'wrap',
                  marginBottom: '12px'
                }}>
                  {['present', 'absent', 'late', 'leave'].map((status) => (
                    <button
                      key={status}
                      onClick={() => updateAttendanceStatus(student.id, status)}
                      style={{
                        padding: '8px 12px',
                        border: `2px solid ${attendance[student.id] === status ? getStatusColor(status) : '#ccc'}`,
                        backgroundColor: attendance[student.id] === status ? getStatusColor(status) : 'white',
                        color: attendance[student.id] === status ? 'white' : '#333',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '14px',
                        flex: '1',
                        minWidth: '80px'
                      }}
                    >
                      {getStatusIcon(status)} {status.charAt(0).toUpperCase() + status.slice(1)}
                    </button>
                  ))}
                </div>

                <div style={{
                  fontSize: '18px',
                  fontWeight: 'bold',
                  color: getStatusColor(attendance[student.id] || 'absent'),
                  textAlign: 'center'
                }}>
                  Current: {getStatusIcon(attendance[student.id] || 'absent')} {(attendance[student.id] || 'absent').charAt(0).toUpperCase() + (attendance[student.id] || 'absent').slice(1)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Summary Section */}
      {selectedClass && students.length > 0 && (
        <div style={{
          backgroundColor: '#f9f9f9',
          padding: '16px',
          borderRadius: '8px',
          marginBottom: '24px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: '16px'
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{attendanceSummary.total}</div>
            <div>Total Students</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#4CAF50' }}>{attendanceSummary.present}</div>
            <div>Present</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#F44336' }}>{attendanceSummary.absent}</div>
            <div>Absent</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#FF9800' }}>{attendanceSummary.late}</div>
            <div>Late</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#9C27B0' }}>{attendanceSummary.leave}</div>
            <div>Leave</div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      {selectedClass && (
        <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
          <button
            className="primary-button"
            onClick={saveAttendance}
            disabled={invalidSubmit || savingAttendance}
            style={{
              padding: '12px 24px',
              fontSize: '16px',
              fontWeight: 'bold',
              backgroundColor: invalidSubmit ? '#ccc' : '#4CAF50',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: invalidSubmit ? 'not-allowed' : 'pointer'
            }}
          >
            💾 {savingAttendance ? "Saving..." : "Save Attendance"}
          </button>

          <button
            onClick={() => {
              if (confirm('Are you sure you want to reset all attendance?')) {
                markAllPresent();
              }
            }}
            style={{
              padding: '12px 24px',
              fontSize: '16px',
              backgroundColor: '#FF9800',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            🔄 Reset
          </button>
        </div>
      )}
    </div>
  );
}
