export interface PracticeDate {
  date: string; // YYYY-MM-DD
  dayName: 'Sun' | 'Wed' | 'Sat';
  formattedDate: string; // MM/DD
}

export function getPracticeDates(year: number, month: number): PracticeDate[] {
  const dates: PracticeDate[] = [];
  const lastDay = new Date(year, month, 0).getDate();

  for (let day = 1; day <= lastDay; day++) {
    const date = new Date(year, month - 1, day);
    const dayOfWeek = date.getDay(); // 0 = Sun, 3 = Wed

    if (dayOfWeek === 0 || dayOfWeek === 3 || dayOfWeek === 6) {
      dates.push({
        date: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
        dayName: dayOfWeek === 0 ? 'Sun' : dayOfWeek === 3 ? 'Wed' : 'Sat',
        formattedDate: `${month}/${day}`,
      });
    }
  }

  return dates;
}
