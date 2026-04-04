// Excel Processing Web Worker
// Handles heavy Excel file processing without blocking the main thread

self.onmessage = async (event) => {
  const {
    jsonData,
    students,
    selectedDate,
    selectedSubject,
    selectedPeriod,
    selectedClass
  } = event.data;

  try {
    const newAttendance = {};
    let matchedRows = 0;
    const unmatchedRows = [];
    const errors = [];

    // Process each row
    jsonData.forEach((row, index) => {
      try {
        const rowRoll = String(row['Roll No'] || row['Roll Number'] || '').trim();

        if (!rowRoll) {
          errors.push(`Row ${index + 1}: Missing roll number`);
          return;
        }

        const student = students.find(s =>
          s.roll_number.toLowerCase() === rowRoll.toLowerCase()
        );

        if (student) {
          // Validate status
          const statusValue = String(row['Status'] || '').toLowerCase().trim();
          const validStatuses = ['present', 'absent', 'late', 'leave'];

          if (!validStatuses.includes(statusValue)) {
            errors.push(`Row ${index + 1}: Invalid status "${statusValue}" for roll ${rowRoll}`);
            return;
          }

          newAttendance[student.id] = statusValue;
          matchedRows++;
        } else {
          unmatchedRows.push(rowRoll);
        }
      } catch (rowError) {
        errors.push(`Row ${index + 1}: ${rowError.message}`);
      }
    });

    // Send results back to main thread
    self.postMessage({
      success: true,
      newAttendance,
      matchedRows,
      unmatchedRows,
      errors,
      totalRows: jsonData.length
    });

  } catch (error) {
    self.postMessage({
      success: false,
      error: error.message
    });
  }
};