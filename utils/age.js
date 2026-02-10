const calculateAge = (dateOfBirth) => {
  if (!dateOfBirth) return null;
  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age -= 1;
  }
  return age;
};

const getAgeBand = (dateOfBirth) => {
  const age = calculateAge(dateOfBirth);
  if (age === null) return null;
  if (age < 13) return "u13";
  if (age < 16) return "13_15";
  if (age < 18) return "16_17";
  return "18_plus";
};

module.exports = {
  calculateAge,
  getAgeBand,
};
