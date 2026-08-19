export const calculateAge = (dobString: string, admitDateString: string): number => {
  if (!dobString || !admitDateString) return 0;
  try {
    const [day, month, year] = dobString.split("/").map(Number);
    const dob = new Date(year, month - 1, day);
    const [admitDay, admitMonth, admitYear] = admitDateString
      .split(" ")[0]
      .split("/")
      .map(Number);
    const admitDate = new Date(admitYear, admitMonth - 1, admitDay);
    let age = admitDate.getFullYear() - dob.getFullYear();
    const monthDiff = admitDate.getMonth() - dob.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && admitDate.getDate() < day)) age--;
    return age;
  } catch {
    return 0;
  }
};
