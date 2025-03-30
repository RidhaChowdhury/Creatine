import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from "react-native";

const DAY_LETTERS = ["S", "M", "T", "W", "R", "F", "S"];
const { width } = Dimensions.get("window");
const CELL_SIZE = (width - 80) / 7.5;

interface DayData {
  date: string; // YYYY-MM-DD format
  count: number;
}

interface Props {
  data: DayData[];
  endDate: string; // YYYY-MM-DD format
  numDays: number; // Should be multiple of 7
  onDayPress?: (date: string) => void;
}

const colors :string[] = ["#777777", "#AAAAAA", "#CCCCCC", "#FFFFFF"]; 

// Helper function to parse date string without timezone issues
const parseDateString = (dateStr: string) => {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
};

const HeatCalendar = ({ data, endDate, numDays, onDayPress }: Props) => {
  // Parse end date in UTC to avoid timezone issues
  const end = parseDateString(endDate);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - numDays + 1);

  // Generate all dates in the range (UTC)
  const allDates = Array.from({ length: numDays }, (_, i) => {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + i);
    return date.toISOString().split("T")[0];
  });

  // Group into weeks (arrays of 7 days)
  const weeks = [];
  for (let i = 0; i < numDays; i += 7) {
    weeks.push(allDates.slice(i, i + 7));
  }

  // Create a map for quick count lookup
  const countMap = data.reduce((acc, { date, count }) => {
    acc[date] = count;
    return acc;
  }, {} as Record<string, number>);

  return (
    <View style={styles.container}>
      {weeks.map((week, weekIndex) => (
        <View key={weekIndex} style={styles.weekRow}>
          {week.map((date) => {
            const count = countMap[date] || 0;
            const dateObj = parseDateString(date);
            const dayOfWeek = dateObj.getUTCDay();
            const isFuture = date > endDate;

            return (
              <TouchableOpacity
                key={date}
                onPress={() => !isFuture && onDayPress?.(date)}
                style={[
                  styles.dayCell,
                  {
                    backgroundColor: colors[count],
                    opacity: isFuture ? 0.5 : 1,
                  },
                ]}
                disabled={isFuture}
              >
                <Text style={styles.dayNumber}>{dateObj.getUTCDate()}</Text>
                <Text style={styles.dayLetter}>{DAY_LETTERS[dayOfWeek]}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 8,
    padding: 16,
  },
  weekRow: {
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
  },
  dayCell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  dayNumber: {
    position: "absolute",
    top: 2,
    right: 2,
    fontSize: 10,
    color: "#1e293b",
  },
  dayLetter: {
    position: "absolute",
    bottom: 2,
    left: 2,
    fontSize: 10,
    color: "#1e293b",
  },
});

export default HeatCalendar;
